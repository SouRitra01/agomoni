/* Agomoni engine — route optimisation + Pujo Match recommender.
 * Pure functions, no DOM. Works in the browser (window.Engine) and Node (module.exports).
 *
 * Travel model (all numbers are estimates, tuned in CONFIG below):
 *   road distance ≈ straight-line distance × detour factor
 *   walk  : road km / walking speed
 *   metro : walk to nearest station + wait + ride + (transfer) + walk from station
 *   cab   : pickup wait + road km / festival traffic speed
 *   each leg takes the fastest available mode.
 * Visit (dwell) time depends on crowd level (static or live) × hour-of-day factor.
 *
 * Optimisation:
 *   1. Held–Karp dynamic programming → exact shortest travel-time order (≤ 11 stops)
 *      or nearest-neighbour seed (larger routes).
 *   2. 2-opt + relocate local search on the full time-dependent simulation
 *      (travel + crowd-aware queue time), so it can reorder to dodge peak hours.
 */
(function (root) {
  const CONFIG = {
    kolkata:   { detour: 1.3, walkKmh: 4.5, walkMaxKm: 1.8, cabKmh: 12, cabWait: 8, metroKmh: 30, metroWait: 7, transfer: 12, stationMaxKm: 1.3, metro: true },
    bengaluru: { detour: 1.4, walkKmh: 4.5, walkMaxKm: 1.2, cabKmh: 18, cabWait: 8, metroKmh: 32, metroWait: 8, transfer: 12, stationMaxKm: 1.0, metro: true },
  };
  // Lines connected by an interchange (for metro legs across lines).
  const LINKS = { kolkata: [["blue", "green"]], bengaluru: [["purple", "green"]] };
  const DWELL = { 1: 10, 2: 15, 3: 25, 4: 40 }; // minutes at pandal, by crowd level
  // Hour-of-day multiplier on queue time (festival nights peak 18:00–01:00).
  function hourFactor(h) {
    h = ((h % 24) + 24) % 24;
    if (h >= 6 && h < 12) return 0.6;
    if (h >= 12 && h < 17) return 0.8;
    if (h >= 17 && h < 23) return 1.5;
    if (h >= 23 || h < 3) return 1.25;
    return 0.7; // 03:00–06:00
  }

  const R = 6371;
  function haversine(a, b) {
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }

  function nearestStation(p, stations) {
    let best = null, bd = Infinity;
    for (const s of stations) { const d = haversine(p, s); if (d < bd) { bd = d; best = s; } }
    return best ? { station: best, km: bd } : null;
  }

  function linesConnected(city, a, b) {
    if (a === b) return true;
    return (LINKS[city] || []).some(([x, y]) => (x === a && y === b) || (x === b && y === a));
  }

  /** Fastest leg between two points. Returns {mode, minutes, km, via?}. */
  function leg(a, b, city, stations) {
    const c = CONFIG[city];
    const km = haversine(a, b) * c.detour;
    const options = [];
    if (km <= c.walkMaxKm) options.push({ mode: "walk", minutes: (km / c.walkKmh) * 60, km });
    options.push({ mode: "cab", minutes: c.cabWait + (km / c.cabKmh) * 60, km });
    if (c.metro && stations.length) {
      const sa = nearestStation(a, stations), sb = nearestStation(b, stations);
      if (sa && sb && sa.station.id !== sb.station.id && sa.km <= c.stationMaxKm && sb.km <= c.stationMaxKm &&
          linesConnected(city, sa.station.line, sb.station.line)) {
        const ride = (haversine(sa.station, sb.station) * 1.15 / c.metroKmh) * 60;
        const walkIn = ((sa.km * c.detour) / c.walkKmh) * 60, walkOut = ((sb.km * c.detour) / c.walkKmh) * 60;
        const transfer = sa.station.line === sb.station.line ? 0 : c.transfer;
        options.push({ mode: "metro", minutes: walkIn + c.metroWait + ride + transfer + walkOut, km,
          via: [sa.station, sb.station] });
      }
    }
    options.sort((x, y) => x.minutes - y.minutes);
    return options[0];
  }

  function buildMatrix(points, city, stations) {
    const n = points.length, M = [];
    for (let i = 0; i < n; i++) {
      M.push([]);
      for (let j = 0; j < n; j++) M[i].push(i === j ? { mode: "none", minutes: 0, km: 0 } : leg(points[i], points[j], city, stations));
    }
    return M;
  }

  /** Exact open-path TSP from node 0 over nodes 1..n-1 (Held–Karp). O(2^n · n²). */
  function heldKarp(cost) {
    const n = cost.length, m = n - 1;
    if (m <= 0) return [0];
    const FULL = 1 << m, INF = 1e18;
    const dp = new Float64Array(FULL * m).fill(INF), par = new Int16Array(FULL * m).fill(-1);
    for (let j = 0; j < m; j++) dp[(1 << j) * m + j] = cost[0][j + 1];
    for (let S = 1; S < FULL; S++) {
      for (let j = 0; j < m; j++) {
        const cur = dp[S * m + j];
        if (!(S & (1 << j)) || cur >= INF) continue;
        for (let k = 0; k < m; k++) {
          if (S & (1 << k)) continue;
          const T = S | (1 << k), v = cur + cost[j + 1][k + 1];
          if (v < dp[T * m + k]) { dp[T * m + k] = v; par[T * m + k] = j; }
        }
      }
    }
    let last = 0, best = INF;
    for (let j = 0; j < m; j++) if (dp[(FULL - 1) * m + j] < best) { best = dp[(FULL - 1) * m + j]; last = j; }
    const path = []; let S = FULL - 1, j = last;
    while (j !== -1) { path.push(j + 1); const p = par[S * m + j]; S ^= 1 << j; j = p; }
    return [0, ...path.reverse()];
  }

  function nearestNeighbour(cost) {
    const n = cost.length, seen = new Set([0]), order = [0];
    while (order.length < n) {
      const i = order[order.length - 1]; let best = -1, bv = Infinity;
      for (let j = 0; j < n; j++) if (!seen.has(j) && cost[i][j] < bv) { bv = cost[i][j]; best = j; }
      order.push(best); seen.add(best);
    }
    return order;
  }

  /** Simulate a route: returns timeline with arrival/leave times and totals. */
  function simulate(order, points, M, startMin, crowdOf) {
    let t = startMin, travel = 0, queue = 0;
    const stops = [];
    for (let k = 1; k < order.length; k++) {
      const i = order[k - 1], j = order[k], L = M[i][j];
      t += L.minutes; travel += L.minutes;
      const lvl = crowdOf(points[j]);
      const dwell = DWELL[lvl] * hourFactor(Math.floor(t / 60));
      stops.push({ point: points[j], leg: L, arrive: t, dwell, crowd: lvl });
      t += dwell; queue += dwell;
    }
    return { stops, total: t - startMin, travel, queue, end: t };
  }

  function improve(order, evalFn) {
    let best = order.slice(), bestV = evalFn(best), improved = true, guard = 0;
    while (improved && guard++ < 200) {
      improved = false;
      // 2-opt: reverse a segment (keep start fixed at index 0)
      for (let i = 1; i < best.length - 1; i++) for (let j = i + 1; j < best.length; j++) {
        const cand = best.slice(0, i).concat(best.slice(i, j + 1).reverse(), best.slice(j + 1));
        const v = evalFn(cand);
        if (v + 1e-9 < bestV) { best = cand; bestV = v; improved = true; }
      }
      // relocate: move one stop elsewhere
      for (let i = 1; i < best.length; i++) for (let j = 1; j < best.length; j++) {
        if (i === j) continue;
        const cand = best.slice(); const [x] = cand.splice(i, 1); cand.splice(j, 0, x);
        const v = evalFn(cand);
        if (v + 1e-9 < bestV) { best = cand; bestV = v; improved = true; }
      }
    }
    return best;
  }

  /**
   * Plan a route.
   * @param start  {lat,lng,name}
   * @param stops  pandal objects (lat,lng,crowd,id)
   * @param opts   {city, stations, startMin (minutes since midnight), live: {id: level}}
   */
  function planRoute(start, stops, opts) {
    const { city, stations = [], startMin = 18 * 60, live = {} } = opts;
    const points = [start, ...stops];
    const M = buildMatrix(points, city, stations);
    const cost = M.map((row) => row.map((l) => l.minutes));
    const method = stops.length <= 11 ? "held-karp" : "nearest-neighbour";
    const seed = method === "held-karp" ? heldKarp(cost) : nearestNeighbour(cost);
    const crowdOf = (p) => Math.max(1, Math.min(4, Math.round(live[p.id] ?? p.crowd ?? 2)));
    const seedSim = simulate(seed, points, M, startMin, crowdOf);
    const order = improve(seed, (o) => simulate(o, points, M, startMin, crowdOf).total);
    const sim = simulate(order, points, M, startMin, crowdOf);
    // Baseline: the order the user picked them in — to show the saving.
    const naive = simulate(points.map((_, i) => i), points, M, startMin, crowdOf);
    return { ...sim, order, method, seedTotal: seedSim.total, naiveTotal: naive.total };
  }

  /* ---------------- Pujo Match (content-based recommender) ---------------- */
  const DIMS = ["heritage", "theme", "grand", "quiet", "food", "family"];

  /** answers: {look: 'sabeki'|'theme'|'grand'|'bonedi', crowd: 'ok'|'avoid', food: 'yes'|'some'|'no', with: 'friends'|'family'|'couple'} */
  function userVector(a) {
    const v = { heritage: 0.2, theme: 0.2, grand: 0.2, quiet: 0.2, food: 0.3, family: 0.3 };
    const look = { sabeki: { heritage: 1 }, theme: { theme: 1 }, grand: { grand: 1 }, bonedi: { heritage: 0.8, quiet: 0.8 } }[a.look] || {};
    Object.assign(v, look);
    if (a.crowd === "avoid") { v.quiet = Math.max(v.quiet, 0.9); v.grand = Math.min(v.grand, 0.3); }
    if (a.crowd === "ok") v.grand = Math.max(v.grand, 0.6);
    v.food = { yes: 1, some: 0.5, no: 0.1 }[a.food] ?? v.food;
    if (a.with === "family") v.family = 1;
    if (a.with === "friends") { v.food = Math.max(v.food, 0.7); v.family = 0.2; }
    if (a.with === "couple") { v.quiet = Math.max(v.quiet, 0.5); v.family = 0.3; }
    return v;
  }

  function cosine(u, p) {
    let dot = 0, nu = 0, np = 0;
    for (const d of DIMS) { dot += u[d] * p[d]; nu += u[d] ** 2; np += p[d] ** 2; }
    return nu && np ? dot / Math.sqrt(nu * np) : 0;
  }

  /** Returns ranked [{pandal, score (0-100), why: [dim, dim]}]. */
  function recommend(answers, pandals, k = 6) {
    const u = userVector(answers);
    return pandals.map((p) => {
      let s = cosine(u, p);
      if (answers.crowd === "avoid") s -= 0.06 * ((p.crowd || 2) - 2);
      const contrib = DIMS.map((d) => [d, u[d] * p[d]]).sort((x, y) => y[1] - x[1]);
      return { pandal: p, score: Math.round(Math.max(0, Math.min(1, s)) * 100), why: contrib.slice(0, 2).map((c) => c[0]) };
    }).sort((a, b) => b.score - a.score).slice(0, k);
  }

  const api = { CONFIG, DWELL, hourFactor, haversine, leg, buildMatrix, heldKarp, nearestNeighbour, simulate, planRoute, userVector, recommend, DIMS, nearestStation };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Engine = api;
})(typeof window !== "undefined" ? window : globalThis);
