// Cloudflare Pages Function: /api/event — anonymous usage events for the post-Puja analysis.
// POST { type: "route_built" | "match", city, payload: {...} }
const TYPES = new Set(["route_built", "match"]);
const CITIES = new Set(["kolkata", "bengaluru"]);

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return new Response(null, { status: 400 }); }
  const { type, city, payload } = body || {};
  const p = JSON.stringify(payload ?? {});
  if (!TYPES.has(type) || !CITIES.has(city) || p.length > 1000) return new Response(null, { status: 400 });
  await env.DB.prepare("INSERT INTO events (type, city, payload, ts) VALUES (?1, ?2, ?3, ?4)")
    .bind(type, city, p, Math.floor(Date.now() / 1000)).run();
  return new Response(null, { status: 204 });
}
