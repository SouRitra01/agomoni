// Cloudflare Pages Function: /api/crowd
// GET  ?city=kolkata  -> { levels: { pandalId: { level: 2.7, n: 5 } } }   (time-weighted, last 90 min)
// POST { city, pandal, level }  -> 201 | 400 | 429
// Requires a D1 binding named DB (see schema.sql / README).

const WINDOW_S = 90 * 60;       // reports older than this are ignored
const HALF_LIFE_S = 30 * 60;    // a report's weight halves every 30 minutes
const SAME_PANDAL_GAP_S = 600;  // one report per device per pandal per 10 min
const MAX_PER_HOUR = 30;        // per device, across all pandals
const CITIES = new Set(["kolkata", "bengaluru"]);

let validIds = null;
async function knownIds(env, request) {
  if (validIds) return validIds;
  try {
    const res = await env.ASSETS.fetch(new URL("/data/data.json", request.url));
    const data = await res.json();
    validIds = new Set(data.pandals.map((p) => `${p.city}:${p.id}`));
  } catch { validIds = null; }
  return validIds;
}

async function sha(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...extra } });

export async function onRequestGet({ request, env }) {
  const city = new URL(request.url).searchParams.get("city");
  if (!CITIES.has(city)) return json({ error: "bad city" }, 400);
  const now = Math.floor(Date.now() / 1000);
  const { results } = await env.DB.prepare(
    "SELECT pandal_id, level, ts FROM reports WHERE city = ?1 AND ts > ?2"
  ).bind(city, now - WINDOW_S).all();
  const acc = {};
  for (const r of results) {
    const w = Math.pow(0.5, (now - r.ts) / HALF_LIFE_S);
    const a = (acc[r.pandal_id] ||= { sw: 0, swl: 0, n: 0 });
    a.sw += w; a.swl += w * r.level; a.n += 1;
  }
  const levels = {};
  for (const [id, a] of Object.entries(acc)) levels[id] = { level: Math.round((a.swl / a.sw) * 10) / 10, n: a.n };
  return json({ levels, updated: now }, 200, { "cache-control": "public, max-age=30" });
}

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }
  const { city, pandal } = body || {};
  const level = Number(body?.level);
  if (!CITIES.has(city) || !/^[a-z0-9-]{2,60}$/.test(pandal || "") || !Number.isInteger(level) || level < 1 || level > 4)
    return json({ error: "invalid" }, 400);
  const ids = await knownIds(env, request);
  if (ids && !ids.has(`${city}:${pandal}`)) return json({ error: "unknown pandal" }, 400);

  // Privacy: the IP is never stored — only a salted, daily-rotating hash used for rate limiting.
  const ip = request.headers.get("cf-connecting-ip") || "0";
  const day = new Date().toISOString().slice(0, 10);
  const salt = env.HASH_SALT || "change-me";
  const device = await sha(`${salt}|${day}|${ip}`);
  const now = Math.floor(Date.now() / 1000);

  const recent = await env.DB.prepare(
    "SELECT SUM(CASE WHEN pandal_id = ?2 AND ts > ?3 THEN 1 ELSE 0 END) AS same, COUNT(*) AS hour FROM reports WHERE device = ?1 AND ts > ?4"
  ).bind(device, pandal, now - SAME_PANDAL_GAP_S, now - 3600).first();
  if ((recent?.same || 0) > 0 || (recent?.hour || 0) >= MAX_PER_HOUR) return json({ error: "rate limited" }, 429);

  await env.DB.prepare("INSERT INTO reports (city, pandal_id, level, ts, device) VALUES (?1, ?2, ?3, ?4, ?5)")
    .bind(city, pandal, level, now, device).run();
  return json({ ok: true }, 201);
}
