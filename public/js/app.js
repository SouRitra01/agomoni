/* Agomoni — UI layer. Depends on SITE (config.js), I18N (i18n.js), Engine (engine.js), L (Leaflet, optional). */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const store = {
    get(k, d) { try { const v = localStorage.getItem("agomoni:" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem("agomoni:" + k, JSON.stringify(v)); } catch {} },
  };

  const S = {
    lang: store.get("lang", "bn"),
    city: store.get("city", "kolkata"),
    route: store.get("route", { kolkata: [], bengaluru: [] }),
    zone: "all", type: "all", q: "", sort: "name",
    live: {}, liveOk: true, pos: null, plan: null,
    data: { pandals: [], metro: [], food: [] },
    match: {}, foodNear: "",
  };

  /* ---------- i18n helpers ---------- */
  const t = (k) => (I18N[S.lang] && I18N[S.lang][k]) ?? I18N.en[k] ?? k;
  const BN = "০১২৩৪৫৬৭৮৯";
  const num = (x) => (S.lang === "bn" ? String(x).replace(/\d/g, (d) => BN[d]) : String(x));
  const nm = (o, f = "name") => o[`${f}_${S.lang}`] || o[`${f}_en`] || "";
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function clock(min) {
    const m = Math.round(min) % (24 * 60), h = Math.floor(m / 60), mm = String(m % 60).padStart(2, "0");
    return num(`${h}:${mm}`);
  }
  function dur(min) {
    min = Math.round(min); const h = Math.floor(min / 60), m = min % 60;
    if (S.lang === "bn") return h ? `${num(h)} ঘণ্টা ${m ? num(m) + " মিনিট" : ""}`.trim() : `${num(m)} মিনিট`;
    return h ? `${h}h ${m ? m + "m" : ""}`.trim() : `${m} min`;
  }
  const modeLabel = (m) => `<span class="mode ${m}">${t(m)}</span>`;

  function toast(msg) {
    const el = $("#toast"); el.textContent = msg; el.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => (el.hidden = true), 2600);
  }
  function track(type, payload) {
    try { fetch(`${SITE.api}/event`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type, city: S.city, payload }), keepalive: true }).catch(() => {}); } catch {}
  }

  /* ---------- data helpers ---------- */
  const cityPandals = () => S.data.pandals.filter((p) => p.city === S.city);
  const cityMetro = () => S.data.metro.filter((m) => m.city === S.city);
  const byId = (id) => S.data.pandals.find((p) => p.id === id);
  const routeIds = () => (S.route[S.city] ||= []);
  function saveRoute() { store.set("route", S.route); updateRouteBadge(); }
  function updateRouteBadge() {
    const n = routeIds().length, el = $("#routeCount");
    el.hidden = !n; el.textContent = num(n);
  }
  function toggleRoute(id) {
    const r = routeIds(), i = r.indexOf(id);
    if (i >= 0) r.splice(i, 1);
    else { if (r.length >= 15) return toast(t("max_stops")); r.push(id); }
    S.plan = null; saveRoute();
  }
  const liveLevel = (p) => S.live[p.id]?.level;
  function crowdHTML(p) {
    const lv = liveLevel(p), l = Math.round(lv ?? p.crowd);
    const label = lv != null ? `<span class="badge live">${t("live")}</span> ${t("c" + l)} · ${num(S.live[p.id].n)} ${t("reports")}` : `${t("usual")}: ${t("c" + l)}`;
    return `<span class="crowd"><span class="dots l${l}"><i></i><i></i><i></i><i></i></span> ${label}</span>`;
  }
  function metroHTML(p) {
    const st = Engine.nearestStation(p, cityMetro());
    if (!st || st.km > 2.2) return "";
    const walkMin = Math.max(1, Math.round((st.km * 1.3) / 4.5 * 60));
    return `<span>${t("metro_near")}: <b>${esc(nm(st.station))}</b> · ${num(walkMin)} ${t("min")} ${t("walk")}</span>`;
  }

  /* ---------- photos ---------- */
  // Pandals with their own photo use it (key "p-<id>"); the rest get a representative
  // photo of the same kind of puja, spread round-robin so neighbouring cards differ.
  const PH = Object.fromEntries((window.PHOTOS || []).map((p) => [p.key, p]));
  const poolKeys = (pre) => Object.keys(PH).filter((k) => pre.some((x) => k.startsWith(x + "-")));
  let photoMap = null;
  function photoFor(p) {
    if (PH["p-" + p.id]) return { ...PH["p-" + p.id], own: true };
    if (!photoMap) {
      photoMap = {}; const seen = {};
      for (const q of S.data.pandals) {
        if (PH["p-" + q.id]) continue;
        let pre = q.city === "bengaluru" ? ["blr", "sabeki"] : [q.type];
        if (!poolKeys(pre).length) pre = ["theme"];
        const pool = poolKeys(pre), key = pre.join();
        seen[key] = (seen[key] ?? -1) + 1;
        if (pool.length) photoMap[q.id] = PH[pool[seen[key] % pool.length]];
      }
    }
    return photoMap[p.id] || null;
  }
  function photoHTML(p) {
    const ph = photoFor(p); if (!ph) return "";
    return `<figure class="pphoto"><img src="${ph.src}" alt="${esc(nm(p))}" loading="lazy" decoding="async">${ph.own ? "" : `<figcaption>${t("photo_rep")}</figcaption>`}</figure>`;
  }
  function renderMoments() {
    $("#moments").innerHTML = [["m-kumartuli", "mo_kumartuli"], ["m-dhunuchi", "mo_dhunuchi"], ["m-lights", "mo_lights"], ["m-sindoor", "mo_sindoor"]]
      .filter(([k]) => PH[k])
      .map(([k, l]) => `<figure class="moment"><img src="${PH[k].src}" alt="${esc(t(l))}" loading="lazy" decoding="async"><figcaption>${t(l)}</figcaption></figure>`).join("");
  }
  function creditsHTML() {
    const bySrc = new Map((window.PHOTOS || []).map((p) => [p.source, p]));
    if (!bySrc.size) return "";
    const title = (u) => decodeURIComponent(u.split("File:")[1] || u).replace(/_/g, " ").replace(/\.(jpe?g|png)$/i, "");
    return `<h3>${t("photo_credits")}</h3><p class="fine">${t("photo_credits_note")}</p><ul class="credits">${[...bySrc.values()].map((p) =>
      `<li><a href="${esc(p.source)}" target="_blank" rel="noopener">${esc(title(p.source))}</a> — ${esc(p.author)} · ${esc(p.license)}</li>`).join("")}</ul>`;
  }

  /* ---------- static text ---------- */
  function applyStatic() {
    document.documentElement.lang = S.lang;
    $$("[data-t]").forEach((el) => (el.textContent = t(el.dataset.t)));
    $("#q").placeholder = t("search_ph");
    $("#langBtn").textContent = S.lang === "bn" ? "EN" : "বাং";
    $$(".seg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.city === S.city)));
    $("#heroCity").textContent = t("city_" + S.city); $("#heroYear").textContent = num(2026);
    $("#legend").innerHTML = ["theme", "sabeki", "bonedi", "heritage"].map((x) => `<span class="tag t-${x}">${t("t_" + x)}</span>`).join("");
    const gh = $("#ghLink"); gh.href = SITE.github; gh.textContent = "@" + SITE.githubHandle;
    renderMoments();
    document.title = `${S.lang === "bn" ? SITE.name_bn : SITE.name_en} — ${t("brandSub")} · ${t("city_" + S.city)} ${num(2026)}`;
  }

  /* ---------- home ---------- */
  function renderSchedule() {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    $("#schedule").innerHTML = SITE.dates.map(([k, d]) => {
      const dt = new Date(d + "T12:00:00+05:30");
      const label = dt.toLocaleDateString(S.lang === "bn" ? "bn-IN" : "en-IN", { day: "numeric", month: "long", weekday: "short", timeZone: "Asia/Kolkata" });
      return `<li class="${d === today ? "today" : ""}"><b>${t(k)}</b><span>${esc(label)}</span></li>`;
    }).join("");
  }
  function tickCountdown() {
    const el = $("#countdown"); if (!el) return;
    const now = Date.now(), mahalaya = Date.parse(SITE.dates[0][1] + "T04:00:00+05:30"), target = Date.parse(SITE.countdownTo), end = Date.parse(SITE.pujoEnds);
    if (now >= target && now < end) { el.innerHTML = `<p class="live">${t("pujo_on")}</p>`; return; }
    if (now >= end) { el.innerHTML = ""; return; }
    const [goal, label] = now < mahalaya ? [mahalaya, "countdown_mahalaya"] : [target, "countdown_to"];
    const s = Math.floor((goal - now) / 1000);
    const parts = [[Math.floor(s / 86400), "days"], [Math.floor((s % 86400) / 3600), "hours"], [Math.floor((s % 3600) / 60), "mins"], [s % 60, "secs"]];
    el.innerHTML = `<p class="lbl">${t(label)}</p>` + parts.map(([v, k], i) => `${i ? '<span class="sep"></span>' : ""}<div class="unit"><b>${num(String(v).padStart(2, "0"))}</b><span>${t(k)}</span></div>`).join("");
  }

  /* Shiuli (night jasmine) drifting down the Mahalaya sky */
  function shiuli() {
    const c = $("#shiuli"); if (!c || !c.getContext) return;
    const ctx = c.getContext("2d"), still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let W, H, flowers = [], raf;
    const rnd = (a, b) => a + Math.random() * (b - a);
    function size() {
      const r = c.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1);
      W = r.width; H = r.height; c.width = W * d; c.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0);
      const n = Math.round(Math.min(26, Math.max(10, W / 45)));
      flowers = Array.from({ length: n }, () => ({ x: rnd(W * .35, W), y: rnd(-H, H), r: rnd(5, 11), rot: rnd(0, 6.28), vr: rnd(-.01, .01), vy: rnd(.25, .6), sway: rnd(0, 6.28), a: rnd(.35, .9) }));
    }
    function flower(f) {
      ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot); ctx.globalAlpha = f.a;
      ctx.fillStyle = "#FFFFFF";
      for (let i = 0; i < 6; i++) { ctx.rotate(Math.PI / 3); ctx.beginPath(); ctx.ellipse(0, -f.r * .62, f.r * .32, f.r * .62, 0, 0, 6.28); ctx.fill(); }
      ctx.fillStyle = "#E8741C"; ctx.beginPath(); ctx.arc(0, 0, f.r * .26, 0, 6.28); ctx.fill();
      ctx.restore();
    }
    function frame() {
      ctx.clearRect(0, 0, W, H);
      for (const f of flowers) {
        if (!still) { f.y += f.vy; f.sway += .01; f.x += Math.sin(f.sway) * .25; f.rot += f.vr; if (f.y > H + 20) { f.y = -20; f.x = rnd(W * .3, W); } }
        flower(f);
      }
      if (!still && currentView() === "home" && !document.hidden) raf = requestAnimationFrame(frame); else raf = null;
    }
    size(); frame();
    addEventListener("resize", () => { size(); if (!raf) frame(); });
    shiuli.resume = () => { if (!raf && !still) frame(); };
  }

  /* ---------- pandals ---------- */
  function renderChips() {
    const zones = ["all", ...new Set(cityPandals().map((p) => p.zone))];
    const types = ["all", ...new Set(cityPandals().map((p) => p.type))];
    if (!zones.includes(S.zone)) S.zone = "all";
    if (!types.includes(S.type)) S.type = "all";
    $("#zoneChips").innerHTML = zones.map((z) => `<button class="chip" data-zone="${z}" aria-pressed="${S.zone === z}">${z === "all" ? t("all") : t("z_" + z)}</button>`).join("");
    $("#typeChips").innerHTML = types.map((x) => `<button class="chip" data-type="${x}" aria-pressed="${S.type === x}">${x === "all" ? t("all") : t("t_" + x)}</button>`).join("");
  }
  /* ---------- food near pandals ---------- */
  const cityName = (c = S.city) => (c === "kolkata" ? "Kolkata" : "Bengaluru");
  const distTxt = (km) => km < 1 ? `${num(Math.max(50, Math.round(km * 1000 / 50) * 50))} ${S.lang === "bn" ? "মিটার" : "m"}` : `${num(km.toFixed(1))} ${S.lang === "bn" ? "কিমি" : "km"}`;
  const gmPlace = (f) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${f.name_en}, ${f.area_en}, ${cityName(f.city)}`)}`;
  // Live Google Maps search covers every pandal, including cities with no curated list.
  const gmNearby = (p) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`restaurants near ${p.name_en}, ${p.area_en}, ${cityName(p.city)}`)}`;
  const foodNear = (p, maxKm = 2.5) => S.data.food.filter((f) => f.city === p.city)
    .map((f) => ({ f, km: Engine.haversine(p, f) })).filter((x) => x.km <= maxKm).sort((a, b) => a.km - b.km);
  function foodNearHTML(p) {
    const near = foodNear(p).slice(0, 2);
    const stall = p.food >= 0.8 ? `<span class="badge stall">${t("stall_big")}</span>` : "";
    return `<div class="fnear"><b>${t("food_nearby")}</b>${stall}
      ${near.map(({ f, km }) => `<span><a href="#food" data-foodnear="${p.id}">${esc(nm(f))}</a> — ${esc(nm(f, "try"))} · ${distTxt(km)}</span>`).join("")}
      <a class="fmore" target="_blank" rel="noopener" href="${gmNearby(p)}">${t("more_restaurants")} ↗</a></div>`;
  }

  function pandalCard(p) {
    const inR = routeIds().includes(p.id);
    const theme = nm(p, "theme_2026") || t("theme_tba");
    return `<article class="pcard" id="p-${p.id}">${photoHTML(p)}
      <div class="meta"><span class="tag t-${p.type}">${t("t_" + p.type)}</span><span>${esc(nm(p, "area"))}</span>${p.since ? `<span>${t("since")} ${num(p.since)}</span>` : ""}</div>
      <h3>${esc(nm(p))}</h3>${S.lang === "bn" ? `<div class="en">${esc(p.name_en)}</div>` : ""}
      <p class="note">${esc(nm(p, "note"))}</p>
      <div class="theme26"><b>${t("theme26")}:</b> ${esc(theme)}</div>
      <div class="meta">${crowdHTML(p)}</div>
      <div class="meta">${metroHTML(p)}</div>
      ${foodNearHTML(p)}
      <div class="actions">
        <button class="btn small ${inR ? "ghost" : "primary"}" data-add="${p.id}">${inR ? t("in_route") : t("add_route")}</button>
        <button class="btn small ghost" data-map="${p.id}">${t("show_map")}</button>
        <button class="btn small ghost" data-report="${p.id}">${t("report")}</button>
      </div>
    </article>`;
  }
  function renderPandals() {
    renderChips();
    const q = S.q.trim().toLowerCase();
    let list = cityPandals().filter((p) =>
      (S.zone === "all" || p.zone === S.zone) && (S.type === "all" || p.type === S.type) &&
      (!q || [p.name_bn, p.name_en, p.area_bn, p.area_en].some((f) => (f || "").toLowerCase().includes(q))));
    if (S.sort === "name") list.sort((a, b) => nm(a).localeCompare(nm(b), S.lang === "bn" ? "bn" : "en"));
    if (S.sort === "crowd") list.sort((a, b) => (liveLevel(a) ?? a.crowd) - (liveLevel(b) ?? b.crowd));
    if (S.sort === "near" && S.pos) list.sort((a, b) => Engine.haversine(S.pos, a) - Engine.haversine(S.pos, b));
    $("#pCount").textContent = S.lang === "bn" ? `${num(list.length)}টি মণ্ডপ` : `${list.length} pandals`;
    $("#pandalGrid").innerHTML = list.map(pandalCard).join("");
  }

  /* ---------- map ---------- */
  let map = null, markerLayer = null, routeLayer = null;
  const typeColor = { theme: "#B3261E", sabeki: "#B8862B", bonedi: "#7A3E9D", heritage: "#3F7A4A" };
  function ensureMap() {
    if (map) return true;
    if (typeof L === "undefined") { $("#map").innerHTML = `<div class="map-fallback">Map library failed to load — check your connection.</div>`; return false; }
    map = L.map("map", { zoomControl: true });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map);
    markerLayer = L.layerGroup().addTo(map); routeLayer = L.layerGroup().addTo(map);
    return true;
  }
  function pinIcon(color, n) {
    return L.divIcon({ className: "", iconSize: n ? [26, 26] : [18, 18], iconAnchor: n ? [13, 26] : [9, 18],
      html: `<div class="pin ${n ? "n" : ""}" style="background:${color}">${n ? `<span>${n}</span>` : ""}</div>` });
  }
  /* Schematic map: projected lat/lng, metro lines drawn from station order. No tiles needed. */
  let schemZoom = 1, schemSel = null;
  function renderSchematic(focusId) {
    const box = $("#map"); box.classList.add("schematic");
    const ps = cityPandals(), st = cityMetro();
    const all = [...ps, ...st], lat0 = all.reduce((a, p) => a + p.lat, 0) / all.length, kx = Math.cos((lat0 * Math.PI) / 180);
    const xs = all.map((p) => p.lng * kx), ys = all.map((p) => -p.lat);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const W = 1000, pad = 50, sc = (W - 2 * pad) / (maxX - minX), H = Math.round((maxY - minY) * sc + 2 * pad);
    const X = (p) => pad + (p.lng * kx - minX) * sc, Y = (p) => pad + (-p.lat - minY) * sc;
    const lineCol = { blue: "var(--m-blue)", green: "var(--m-green)", purple: "var(--m-purple)" };
    const lines = [...new Set(st.map((s) => s.line))].map((ln) => {
      const pts = st.filter((s) => s.line === ln).sort((a, b) => a.seq - b.seq);
      return `<polyline points="${pts.map((s) => `${X(s).toFixed(1)},${Y(s).toFixed(1)}`).join(" ")}" fill="none" stroke="${lineCol[ln]}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" opacity=".55"/>` +
        pts.map((s) => `<circle cx="${X(s).toFixed(1)}" cy="${Y(s).toFixed(1)}" r="4" fill="var(--surface)" stroke="${lineCol[ln]}" stroke-width="2"/><text class="stn-label" x="${(X(s) + 7).toFixed(1)}" y="${(Y(s) + 3).toFixed(1)}">${esc(nm(s))}</text>`).join("");
    }).join("");
    let route = "";
    if (S.plan && S.plan.city === S.city) {
      const pts = [S.plan.start, ...S.plan.stops.map((s) => s.point)];
      route = `<polyline points="${pts.map((p) => `${X(p).toFixed(1)},${Y(p).toFixed(1)}`).join(" ")}" fill="none" stroke="var(--ink)" stroke-width="3" stroke-dasharray="9 6" stroke-linecap="round"/>` +
        S.plan.stops.map((s, i) => `<circle cx="${X(s.point).toFixed(1)}" cy="${Y(s.point).toFixed(1)}" r="13" fill="var(--ink)" stroke="var(--surface)" stroke-width="2"/><text class="rnum" x="${X(s.point).toFixed(1)}" y="${Y(s.point).toFixed(1)}">${num(i + 1)}</text>`).join("");
    }
    const dots = ps.map((p) => `<circle class="pdot${p.id === (focusId || schemSel) ? " sel" : ""}" data-pin="${p.id}" cx="${X(p).toFixed(1)}" cy="${Y(p).toFixed(1)}" r="8" fill="var(--t-${p.type})"><title>${esc(nm(p))}</title></circle>`).join("");
    box.innerHTML = `<div class="schem-tools"><button type="button" data-zoom="1" aria-label="${t("zoom_in")}">+</button><button type="button" data-zoom="-1" aria-label="${t("zoom_out")}">−</button></div>
      <div class="schem-scroll"><svg class="schem" viewBox="0 0 ${W} ${H}" style="width:${schemZoom * 100}%;min-width:${schemZoom * 100}%" role="img" aria-label="${t("nav_map")}">${lines}${dots}${route}</svg></div>`;
    $("#legend").innerHTML = ["theme", "sabeki", "bonedi", "heritage"].map((x) => `<span class="tag t-${x}">${t("t_" + x)}</span>`).join("") + `<span>${t("map_note")}</span>`;
    const sel = focusId || schemSel;
    if (sel) { showPinInfo(sel); const el = box.querySelector(`[data-pin="${sel}"]`); if (el && schemZoom > 1) { const sc2 = box.querySelector(".schem-scroll"), r = el.getBoundingClientRect(), b = sc2.getBoundingClientRect(); sc2.scrollLeft += r.left - b.left - b.width / 2; sc2.scrollTop += r.top - b.top - b.height / 2; } }
    else $("#mapInfo").innerHTML = "";
  }
  function showPinInfo(id) {
    schemSel = id; const p = byId(id); if (!p) return;
    $$(".pdot").forEach((d) => d.classList.toggle("sel", d.dataset.pin === id));
    $("#mapInfo").innerHTML = pandalCard(p);
  }
  function renderMap(focusId) {
    if (SITE.schematicMap || typeof L === "undefined") { if (focusId && schemZoom < 2) schemZoom = 2; return renderSchematic(focusId); }
    if (!ensureMap()) return;
    markerLayer.clearLayers(); routeLayer.clearLayers();
    const ps = cityPandals();
    ps.forEach((p) => {
      L.marker([p.lat, p.lng], { icon: pinIcon(typeColor[p.type]) }).addTo(markerLayer)
        .bindPopup(`<b>${esc(nm(p))}</b><br>${esc(nm(p, "area"))}<br>${crowdHTML(p)}<br><a href="#pandals" data-jump="${p.id}">${t("nav_pandals")} →</a> · <a href="#" data-popadd="${p.id}">${routeIds().includes(p.id) ? t("in_route") : t("add_route")}</a>`);
    });
    if (S.plan && S.plan.city === S.city) {
      const pts = [S.plan.start, ...S.plan.stops.map((s) => s.point)];
      L.polyline(pts.map((p) => [p.lat, p.lng]), { color: "#9E1B1B", weight: 4, dashArray: "8 6" }).addTo(routeLayer);
      S.plan.stops.forEach((s, i) => L.marker([s.point.lat, s.point.lng], { icon: pinIcon("#9E1B1B", num(i + 1)), zIndexOffset: 1000 }).addTo(routeLayer).bindPopup(`<b>${num(i + 1)}. ${esc(nm(s.point))}</b><br>${t("arrive")} ${clock(s.arrive)}`));
      map.fitBounds(pts.map((p) => [p.lat, p.lng]), { padding: [30, 30] });
    } else {
      map.fitBounds(ps.map((p) => [p.lat, p.lng]), { padding: [20, 20] });
    }
    if (focusId) { const p = byId(focusId); if (p) map.setView([p.lat, p.lng], 16); }
    setTimeout(() => map.invalidateSize(), 60);
  }

  /* ---------- route ---------- */
  function renderRoute() {
    const ids = routeIds(), b = $("#routeBuilder");
    if (!ids.length) { b.innerHTML = `<p class="lede">${t("route_empty")}</p><a class="btn primary" href="#match">${t("nav_match")}</a> <a class="btn ghost" href="#pandals">${t("nav_pandals")}</a>`; $("#routeResult").innerHTML = ""; return; }
    const startSel = store.get("start", "first"), time = store.get("time", "17:00");
    b.innerHTML = `<ol class="rlist">${ids.map((id) => { const p = byId(id); return p ? `<li><span>${esc(nm(p))} <span class="fine">· ${esc(nm(p, "area"))}</span></span><button data-del="${id}" aria-label="${t("remove")}">✕</button></li>` : ""; }).join("")}</ol>
      <div class="form-row">
        <label>${t("route_start")}<select id="startSel">
          <option value="first">${t("start_first")}</option><option value="gps">${t("start_gps")}</option>
          ${cityMetro().map((m) => `<option value="m:${m.id}">${t("metro")}: ${esc(nm(m))}</option>`).join("")}
        </select></label>
        <label>${t("start_time")}<input id="startTime" type="time" value="${esc(time)}"></label>
      </div>
      <div class="row-btns"><button class="btn primary" id="optBtn">${t("optimise")}</button><button class="btn ghost" id="clearBtn">${t("clear")}</button></div>`;
    const sel = $("#startSel"); sel.value = [...sel.options].some((o) => o.value === startSel) ? startSel : "first";
    renderPlan();
  }
  async function resolveStart(stops) {
    const v = $("#startSel").value;
    if (v.startsWith("m:")) { const m = S.data.metro.find((x) => x.id === v.slice(2)); return { start: { ...m, name_bn: m.name_bn, name_en: m.name_en }, stops }; }
    if (v === "gps") {
      try { const pos = await getPos(); return { start: { lat: pos.lat, lng: pos.lng, name_bn: t("start_gps"), name_en: t("start_gps") }, stops }; }
      catch { toast(t("gps_fail")); }
    }
    return { start: stops[0], stops: stops.slice(1), startIsStop: true };
  }
  async function optimise() {
    const stops = routeIds().map(byId).filter(Boolean);
    if (!stops.length) return;
    store.set("start", $("#startSel").value); store.set("time", $("#startTime").value);
    const [hh, mm] = ($("#startTime").value || "17:00").split(":").map(Number);
    const startMin = hh * 60 + mm;
    const { start, stops: rest, startIsStop } = await resolveStart(stops);
    const live = Object.fromEntries(Object.entries(S.live).map(([k, v]) => [k, v.level]));
    let plan;
    if (startIsStop && !rest.length) plan = { stops: [], total: 0, travel: 0, queue: 0, end: startMin, method: "held-karp", naiveTotal: 0 };
    else plan = Engine.planRoute(start, rest, { city: S.city, stations: cityMetro(), startMin, live });
    if (startIsStop) {
      // first pandal is visited at start time
      const lvl = Math.round(live[start.id] ?? start.crowd), dwell = Engine.DWELL[lvl] * Engine.hourFactor(hh);
      const shift = (s) => ({ ...s, arrive: s.arrive + dwell });
      plan = { ...plan, stops: [{ point: start, leg: null, arrive: startMin, dwell, crowd: lvl }, ...plan.stops.map(shift)], total: plan.total + dwell, queue: plan.queue + dwell, end: plan.end + dwell, naiveTotal: plan.naiveTotal + dwell };
    }
    S.plan = { ...plan, start, city: S.city, startMin };
    renderPlan();
    track("route_built", { n: stops.length, saved: Math.round(plan.naiveTotal - plan.total), start: $("#startSel").value.split(":")[0], hour: hh });
  }
  function renderPlan() {
    const P = S.plan, box = $("#routeResult");
    if (!P || P.city !== S.city) { box.innerHTML = ""; return; }
    const saved = Math.round(P.naiveTotal - P.total);
    box.innerHTML = `
      <div class="plan">
        <div class="stats">
          <div class="stat"><b>${dur(P.total)}</b><span>${t("total_time")}</span></div>
          <div class="stat"><b>${dur(P.travel)}</b><span>${t("travel_time")}</span></div>
          <div class="stat"><b>${dur(P.queue)}</b><span>${t("queue_time")}</span></div>
        </div>
        ${saved >= 5 ? `<p class="saving">${dur(saved)} ${t("saved")}</p>` : ""}
      </div>
      <ol class="timeline">
        ${P.stops.map((s, i) => `<li>
          ${s.leg ? `<div class="legline">${modeLabel(s.leg.mode)} ${dur(s.leg.minutes)}${s.leg.via ? ` · ${esc(nm(s.leg.via[0]))} → ${esc(nm(s.leg.via[1]))}` : ""} · ${num(s.leg.km.toFixed(1))} ${t("km")}</div>` : ""}
          <span class="stopnum">${num(i + 1)}</span>
          <div class="stop"><b>${esc(nm(s.point))}</b><div class="meta"><span>${t("arrive")} <b>${clock(s.arrive)}</b></span><span>${t("queue_time")} ${dur(s.dwell)}</span><span class="crowd"><span class="dots l${s.crowd}"><i></i><i></i><i></i><i></i></span> ${t("c" + s.crowd)}</span></div></div>
        </li>`).join("")}
      </ol>
      <p class="end">${t("end_at")}: ${clock(P.end)}</p>
      <p class="fine">${P.method === "held-karp" ? t("method_hk") : t("method_nn")} ${t("estimates")}</p>
      <div class="row-btns">
        <a class="btn ghost" href="#map">${t("view_on_map")}</a>
        <a class="btn primary" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(shareText())}">${t("share")}</a>
        <button class="btn ghost" id="copyBtn">${t("copy_link")}</button>
      </div>`;
  }
  function shareURL() {
    const ids = S.plan ? S.plan.stops.map((s) => s.point.id) : routeIds();
    return `${location.origin}${location.pathname}#route?c=${S.city}&ids=${ids.join(",")}`;
  }
  function shareText() {
    const P = S.plan;
    const lines = P.stops.map((s, i) => `${num(i + 1)}. ${nm(s.point)} — ${clock(s.arrive)}`);
    return `${S.lang === "bn" ? SITE.name_bn : SITE.name_en} · ${t("route_title")}\n${lines.join("\n")}\n${shareURL()}`;
  }

  /* ---------- match ---------- */
  const Q = [["look", ["sabeki", "theme", "grand", "bonedi"]], ["crowd", ["ok", "avoid"]], ["food", ["yes", "some", "no"]], ["with", ["friends", "family", "couple"]]];
  function renderMatch() {
    $("#matchForm").innerHTML = Q.map(([q, opts]) => `<fieldset><legend>${t("q_" + q)}</legend><div class="opts">${opts.map((o) =>
      `<input type="radio" name="${q}" id="${q}-${o}" value="${o}" ${S.match[q] === o ? "checked" : ""}><label for="${q}-${o}">${t("a_" + o)}</label>`).join("")}</div></fieldset>`).join("") +
      `<button class="btn primary" type="submit">${t("match_go")}</button>`;
    renderMatchResult();
  }
  function renderMatchResult() {
    const box = $("#matchResult");
    if (Q.some(([q]) => !S.match[q])) { box.innerHTML = ""; return; }
    const res = Engine.recommend(S.match, cityPandals(), 6);
    box.innerHTML = `<div class="row-btns" style="margin-top:20px"><button class="btn primary" id="addAll" data-ids="${res.map((r) => r.pandal.id).join(",")}">${t("match_add_all")}</button></div>
      <div class="grid">${res.map((r) => `<article class="pcard">${photoHTML(r.pandal)}
        <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px"><h3>${esc(nm(r.pandal))}</h3><span class="score">${num(r.score)}%</span></div>
        <div class="bar"><i style="width:${r.score}%"></i></div>
        <p class="why"><span class="tag t-${r.pandal.type}">${t("t_" + r.pandal.type)}</span> · ${esc(nm(r.pandal, "area"))}<br>${t("why")}: ${r.why.map((d) => t("dim_" + d)).join(" + ")}</p>
        <div class="meta">${crowdHTML(r.pandal)}</div>
        <div class="actions"><button class="btn small ${routeIds().includes(r.pandal.id) ? "ghost" : "primary"}" data-add="${r.pandal.id}">${routeIds().includes(r.pandal.id) ? t("in_route") : t("add_route")}</button>
        <button class="btn small ghost" data-map="${r.pandal.id}">${t("show_map")}</button></div>
      </article>`).join("")}</div>`;
  }

  /* ---------- food ---------- */
  function renderFood() {
    const box = $("#foodList");
    // "Near which mandap?" picker: sorts places by distance from the chosen pandal.
    const sel = $("#foodNear"), pandals = cityPandals().slice().sort((a, b) => nm(a).localeCompare(nm(b)));
    if (S.foodNear && byId(S.foodNear)?.city !== S.city) S.foodNear = "";
    sel.innerHTML = `<option value="">${t("food_near_any")}</option>` + pandals.map((p) => `<option value="${p.id}"${p.id === S.foodNear ? " selected" : ""}>${esc(nm(p))}</option>`).join("");
    const from = S.foodNear ? byId(S.foodNear) : null;
    let food = S.data.food.filter((f) => f.city === S.city);
    if (from) food = food.map((f) => ({ f, km: Engine.haversine(from, f) })).sort((a, b) => a.km - b.km).map((x) => x.f);
    // Otherwise show each place's nearest pandal — useful on a pandal-hopping night.
    const nearest = (f) => cityPandals().map((p) => ({ p, km: Engine.haversine(f, p) })).sort((a, b) => a.km - b.km)[0];
    let html = from ? `<article class="pcard fcourts fnearby"><h3>${t("food_near_title").replace("{p}", esc(nm(from)))}</h3>
      <p class="note">${from.food >= 0.8 ? t("stall_big_note") : t("stall_note")}</p>
      <div class="actions"><a class="btn small primary" target="_blank" rel="noopener" href="${gmNearby(from)}">${t("more_restaurants")} ↗</a></div></article>` : "";
    html += food.map((f) => {
      const own = PH["fp-" + f.id], ph = own || PH["f-" + f.id], n = nearest(f);
      const where = from ? `<span>${t("from_pandal")}: ${distTxt(Engine.haversine(from, f))}</span>`
        : n ? `<span>${t("near_pandal")}: <a href="#pandals" data-jump="${n.p.id}">${esc(nm(n.p))}</a> · ${distTxt(n.km)}</span>` : "";
      return `<article class="fcard">
        <a class="fimg" target="_blank" rel="noopener" href="${gmPlace(f)}" aria-label="${esc(nm(f))} — ${t("open_gmaps")}">
          ${ph ? `<img src="${ph.src}" alt="${esc(nm(f, "try"))}" loading="lazy" decoding="async">` : ""}
          <span class="fkind">${esc(nm(f, "kind"))}</span>
          <span class="ftry"><small>${t("food_try")}</small>${esc(nm(f, "try"))}</span>
          ${ph && !own ? `<span class="fnote">${t("dish_photo")}</span>` : ""}
        </a>
        <div class="fbody">
          <h3>${esc(nm(f))}</h3>
          <div class="fmeta"><span>${esc(nm(f, "area"))}</span>${where}</div>
        </div>
      </article>`;
    }).join("");
    const courts = cityPandals().filter((p) => p.food >= 0.8);
    if (courts.length && !from) html += `<article class="pcard fcourts"><h3>${t("food_courts")}</h3><p class="note">${S.city === "bengaluru" ? t("food_courts_note") : ""}</p><div class="meta">${courts.map((p) => `<a href="#pandals" data-jump="${p.id}">${esc(nm(p))}</a>`).join(" · ")}</div></article>`;
    box.innerHTML = html;
  }

  /* ---------- about ---------- */
  const ABOUT = {
    bn: `<p>আগমনী একটি ছোট ডেটা প্রোডাক্ট। ছবির পাশাপাশি এর মূল কাজ তিনটি সমস্যার সমাধান: <b>কোন ক্রমে ঘুরলে সবচেয়ে কম সময় লাগবে</b>, <b>কোন মণ্ডপ আমার রুচির সঙ্গে মেলে</b>, আর <b>এখন কোথায় ভিড় কম</b>।</p>
      <h3>১. স্মার্ট রুট — যাতায়াতের মডেল</h3>
      <p>প্রতিটি দুই মণ্ডপের মধ্যে তিনটি বিকল্প হিসেব হয় — হাঁটা (≤১.৮ কিমি), মেট্রো (নিকটতম স্টেশনে হেঁটে যাওয়া + অপেক্ষা + যাত্রা + লাইন বদল) এবং ক্যাব (পুজোর ট্র্যাফিকে ধীর গতি)। যেটা দ্রুততম, সেটাই বেছে নেওয়া হয়। সোজা দূরত্বকে রাস্তার দূরত্বে রূপান্তর করতে একটি ডিটুর ফ্যাক্টর (কলকাতা ×১.৩) ব্যবহার হয়।</p>
      <h3>২. সেরা ক্রম — Held–Karp + লোকাল সার্চ</h3>
      <p>এটা "ট্রাভেলিং সেলসম্যান" সমস্যা। ১১টি পর্যন্ত মণ্ডপের জন্য Held–Karp ডায়নামিক প্রোগ্রামিং গাণিতিকভাবে নিখুঁত উত্তর দেয় (O(2ⁿ·n²))। তারপর 2-opt ও relocate লোকাল সার্চ পুরো সময়রেখা আবার হিসেব করে — কারণ রাত ৮টায় একডালিয়ার লাইন সকাল ৮টার চেয়ে অনেক লম্বা। তাই অ্যালগরিদম ভিড়ের মণ্ডপকে ফাঁকা সময়ে সরিয়ে দিতে পারে।</p>
      <h3>৩. পুজো ম্যাচ — কনটেন্ট-ভিত্তিক রেকমেন্ডার</h3>
      <p>প্রতিটি মণ্ডপের ৬টি বৈশিষ্ট্যের স্কোর আছে (ঐতিহ্য, থিম, জাঁকজমক, শান্ত পরিবেশ, খাবার, পরিবার-বান্ধব)। আপনার উত্তর থেকে একই মাপের একটি ভেক্টর তৈরি হয়, আর কোসাইন সিমিলারিটি দিয়ে মিল মাপা হয়। "কারণ" অংশে দেখানো হয় কোন দুটি বৈশিষ্ট্য সবচেয়ে বেশি অবদান রেখেছে — ব্ল্যাক-বক্স নয়।</p>
      <h3>৪. লাইভ ভিড় — ক্রাউডসোর্সড ডেটা</h3>
      <p>দর্শনার্থীরা মণ্ডপে দাঁড়িয়ে ১–৪ স্কেলে ভিড় জানান। গত ৯০ মিনিটের রিপোর্টের সময়-ভারযুক্ত গড় দেখানো হয়, আর রুট প্ল্যানার সেটাই ব্যবহার করে। কোনও ব্যক্তিগত তথ্য বা অবস্থান সংরক্ষণ হয় না; একই ডিভাইস থেকে ১০ মিনিটে একবারই রিপোর্ট করা যায়।</p>
      <h3>সততার কথা</h3>
      <p>এ বছর ভিড়ের কোনও "ভবিষ্যদ্বাণী" দেখানো হয় না — কারণ আগের বছরের ডেটা নেই। এ বছরের রিপোর্ট দিয়ে পরের বছর আসল ফোরকাস্ট মডেল তৈরি হবে। মণ্ডপের অবস্থান আনুমানিক; ভুল পেলে জানান।</p>`,
    en: `<p>Agomoni is a small data product. Beyond the photos, it solves three problems: <b>which order takes the least time</b>, <b>which pandals match my taste</b>, and <b>where is it less crowded right now</b>.</p>
      <h3>1. Smart route — the travel model</h3>
      <p>Between every pair of pandals, three options are costed: walking (≤1.8 km), metro (walk to nearest station + wait + ride + line change) and cab (slow festival traffic). The fastest wins. Straight-line distance is converted to road distance with a detour factor (Kolkata ×1.3).</p>
      <h3>2. Best order — Held–Karp + local search</h3>
      <p>This is a travelling-salesman problem. For up to 11 pandals, Held–Karp dynamic programming gives the provably optimal order (O(2ⁿ·n²)). Then 2-opt and relocate local search re-simulate the full timeline — because Ekdalia's queue at 8 pm is far longer than at 8 am — so the algorithm can shift crowded pandals into quieter hours.</p>
      <h3>3. Pujo Match — content-based recommender</h3>
      <p>Each pandal is scored on 6 features (heritage, theme, grandeur, calm, food, family-friendliness). Your answers build a vector in the same space, and cosine similarity ranks the match. The "why" line shows the two features that contributed most — no black box.</p>
      <h3>4. Live crowd — crowdsourced data</h3>
      <p>Visitors at a pandal report crowding on a 1–4 scale. The site shows a time-weighted average of the last 90 minutes, and the route planner uses it. No personal data or location is stored; one report per device per pandal every 10 minutes.</p>
      <h3>Honesty note</h3>
      <p>There is no crowd "prediction" this year — there is no historical data yet. This year's reports become the training data for a real forecast next year. Pandal locations are approximate; tell us if one is wrong.</p>`,
  };

  /* ---------- live crowd ---------- */
  async function fetchLive() {
    try {
      const r = await fetch(`${SITE.api}/crowd?city=${S.city}`, { cache: "no-store" });
      if (!r.ok) throw 0;
      const j = await r.json(); S.live = j.levels || {}; S.liveOk = true;
    } catch { S.live = {}; S.liveOk = false; }
    const v = currentView();
    if (v === "pandals") renderPandals();
    if (v === "match") renderMatchResult();
  }
  function getPos() {
    return new Promise((res, rej) => {
      if (!navigator.geolocation) return rej();
      navigator.geolocation.getCurrentPosition((p) => { S.pos = { lat: p.coords.latitude, lng: p.coords.longitude }; res(S.pos); }, rej, { enableHighAccuracy: true, timeout: 8000, maximumAge: 120000 });
    });
  }
  let reportId = null;
  function openReport(id) {
    const p = byId(id); if (!p) return;
    reportId = id;
    $("#repName").textContent = nm(p);
    $("#repMsg").textContent = S.liveOk ? "" : t("rep_off");
    $("#repLevels").innerHTML = [1, 2, 3, 4].map((l) => `<button type="button" data-level="${l}"><span class="dots l${l}"><i></i><i></i><i></i><i></i></span>${t("c" + l)}</button>`).join("");
    $("#reportDlg").showModal();
  }
  async function sendReport(level) {
    const p = byId(reportId); if (!p) return;
    const msg = $("#repMsg");
    try {
      const pos = await getPos();
      if (Engine.haversine(pos, p) > 1.0) { msg.textContent = t("rep_far"); return; }
    } catch { /* location denied — still accept, server rate-limits */ }
    try {
      const r = await fetch(`${SITE.api}/crowd`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ city: p.city, pandal: p.id, level }) });
      if (r.status === 429) { msg.textContent = t("rep_limit"); return; }
      if (!r.ok) throw 0;
      $("#reportDlg").close(); toast(t("rep_thanks")); fetchLive();
    } catch { msg.textContent = t("rep_off"); }
  }

  /* ---------- router ---------- */
  const VIEWS = ["home", "pandals", "map", "route", "match", "food", "about"];
  const currentView = () => { const v = location.hash.slice(1).split("?")[0]; return VIEWS.includes(v) ? v : "home"; };
  function show(focus) {
    const v = currentView();
    $$(".view").forEach((s) => s.classList.toggle("active", s.id === "v-" + v));
    $$("#tabs a").forEach((a) => a.classList.toggle("active", a.dataset.view === v));
    if (v === "home") { renderSchedule(); tickCountdown(); shiuli.resume && shiuli.resume(); }
    if (v === "pandals") { renderPandals(); if (focus) setTimeout(() => $("#p-" + focus)?.scrollIntoView({ behavior: "smooth", block: "center" }), 50); }
    if (v === "map") renderMap(focus);
    if (v === "route") renderRoute();
    if (v === "match") renderMatch();
    if (v === "food") renderFood();
    if (v === "about") $("#aboutBody").innerHTML = ABOUT[S.lang] + creditsHTML();
    if (!focus) window.scrollTo(0, 0);
  }
  function readShared() {
    const [v, qs] = location.hash.slice(1).split("?");
    if (v !== "route" || !qs) return;
    const p = new URLSearchParams(qs), c = p.get("c"), ids = (p.get("ids") || "").split(",").filter((id) => byId(id)?.city === c);
    if (c && ids.length) { S.city = c; S.route[c] = ids.slice(0, 15); saveRoute(); store.set("city", c); history.replaceState(null, "", "#route"); }
  }

  /* ---------- events ---------- */
  function bind() {
    window.addEventListener("hashchange", () => { readShared(); applyStatic(); show(); });
    $("#langBtn").onclick = () => { S.lang = S.lang === "bn" ? "en" : "bn"; store.set("lang", S.lang); applyStatic(); show(); };
    $$(".seg button").forEach((b) => (b.onclick = () => { S.city = b.dataset.city; store.set("city", S.city); S.plan = null; S.zone = S.type = "all"; applyStatic(); updateRouteBadge(); show(); fetchLive(); }));
    $("#q").oninput = (e) => { S.q = e.target.value; renderPandals(); };
    $("#sort").onchange = async (e) => {
      S.sort = e.target.value;
      if (S.sort === "near" && !S.pos) { try { await getPos(); } catch { toast(t("gps_fail").split("—")[0]); } }
      renderPandals();
    };
    $("#matchForm").onsubmit = (e) => {
      e.preventDefault();
      const f = new FormData(e.target); Q.forEach(([q]) => (S.match[q] = f.get(q) || S.match[q]));
      renderMatchResult(); if (!Q.some(([q]) => !S.match[q])) { track("match", S.match); $("#matchResult").scrollIntoView({ behavior: "smooth" }); }
    };
    $("#foodNear").onchange = (e) => { S.foodNear = e.target.value; renderFood(); };
    $("#matchForm").onchange = (e) => { if (e.target.name) S.match[e.target.name] = e.target.value; };
    document.addEventListener("click", (e) => {
      const el = e.target.closest("[data-add],[data-map],[data-report],[data-del],[data-jump],[data-foodnear],[data-popadd],[data-level],[data-pin],[data-zoom],#optBtn,#clearBtn,#copyBtn,#addAll,[data-zone],[data-type]");
      if (!el) return;
      const d = el.dataset;
      if (d.add) { toggleRoute(d.add); const inR = routeIds().includes(d.add); el.textContent = inR ? t("in_route") : t("add_route"); el.classList.toggle("primary", !inR); el.classList.toggle("ghost", inR); toast(inR ? "✓ " + nm(byId(d.add)) : t("remove")); }
      else if (d.map) { location.hash = "map"; setTimeout(() => renderMap(d.map), 30); }
      else if (d.report) openReport(d.report);
      else if (d.del) { toggleRoute(d.del); renderRoute(); }
      else if (d.foodnear) { e.preventDefault(); S.foodNear = d.foodnear; if (location.hash === "#food") renderFood(); else location.hash = "food"; }
      else if (d.jump) { e.preventDefault(); location.hash = "pandals"; setTimeout(() => show(d.jump), 30); }
      else if (d.popadd) { e.preventDefault(); toggleRoute(d.popadd); map.closePopup(); toast("✓ " + nm(byId(d.popadd))); }
      else if (d.level) sendReport(Number(d.level));
      else if (d.pin) showPinInfo(d.pin);
      else if (d.zoom) { schemZoom = Math.max(1, Math.min(4, schemZoom + Number(d.zoom))); renderSchematic(); }
      else if (d.zone) { S.zone = d.zone; renderPandals(); }
      else if (d.type) { S.type = d.type; renderPandals(); }
      else if (el.id === "optBtn") optimise();
      else if (el.id === "clearBtn") { S.route[S.city] = []; S.plan = null; saveRoute(); renderRoute(); }
      else if (el.id === "copyBtn") { navigator.clipboard?.writeText(shareURL()).then(() => toast(t("copied"))).catch(() => toast(shareURL())); }
      else if (el.id === "addAll") { el.dataset.ids.split(",").forEach((id) => { if (!routeIds().includes(id) && routeIds().length < 15) routeIds().push(id); }); S.plan = null; saveRoute(); location.hash = "route"; }
    });
    document.addEventListener("visibilitychange", () => { if (!document.hidden) fetchLive(); });
  }

  /* ---------- boot ---------- */
  async function boot() {
    try { S.data = await (await fetch("data/data.json")).json(); }
    catch { document.querySelector("main").innerHTML = "<p style='padding:20px'>Could not load data/data.json</p>"; return; }
    S.route.kolkata ||= []; S.route.bengaluru ||= [];
    readShared(); applyStatic(); updateRouteBadge(); bind(); show(); shiuli();
    setInterval(tickCountdown, 1000);
    fetchLive(); setInterval(() => { if (!document.hidden) fetchLive(); }, 120000);
  }
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", boot) : boot();
})();
