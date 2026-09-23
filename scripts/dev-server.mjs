// Local dev server: serves /public and runs the real Pages Functions against a local SQLite "D1".
// Usage: node scripts/dev-server.mjs   (Node 22+)  -> http://localhost:8788
import http from "node:http";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUB = path.join(ROOT, "public");
const db = new DatabaseSync(":memory:");
db.exec(await readFile(path.join(ROOT, "schema.sql"), "utf8"));
const stmt = (sql) => ({
  _a: [], bind(...a) { this._a = a; return this; },
  async all() { return { results: db.prepare(sql.replace(/\?\d+/g, "?")).all(...order(sql, this._a)) }; },
  async first() { return db.prepare(sql.replace(/\?\d+/g, "?")).get(...order(sql, this._a)); },
  async run() { db.prepare(sql.replace(/\?\d+/g, "?")).run(...order(sql, this._a)); return { success: true }; },
});
const order = (sql, a) => [...sql.matchAll(/\?(\d+)/g)].map((m) => a[Number(m[1]) - 1]);
const env = {
  DB: { prepare: stmt },
  ASSETS: { fetch: async (u) => new Response(await readFile(path.join(PUB, new URL(u).pathname))) },
};
const fns = {
  "/api/crowd": await import(pathToFileURL(path.join(ROOT, "functions/api/crowd.js"))),
  "/api/event": await import(pathToFileURL(path.join(ROOT, "functions/api/event.js"))),
};
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost:8788");
  const fn = fns[url.pathname];
  if (fn) {
    const chunks = []; for await (const c of req) chunks.push(c);
    const headers = new Headers(req.headers); headers.set("cf-connecting-ip", req.headers["x-test-ip"] || "127.0.0.1");
    const request = new Request(url, { method: req.method, headers, body: req.method === "POST" ? Buffer.concat(chunks) : undefined });
    const h = req.method === "GET" ? fn.onRequestGet : fn.onRequestPost;
    if (!h) { res.writeHead(405).end(); return; }
    const r = await h({ request, env });
    res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer())); return;
  }
  const p = path.join(PUB, url.pathname === "/" ? "index.html" : url.pathname);
  if (!p.startsWith(PUB)) { res.writeHead(403).end(); return; }
  try { const b = await readFile(p); res.writeHead(200, { "content-type": MIME[path.extname(p)] || "application/octet-stream" }); res.end(b); }
  catch { res.writeHead(404).end("not found"); }
}).listen(8788, () => console.log("Agomoni dev server → http://localhost:8788"));
