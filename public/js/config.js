/* Site-wide settings — edit these, nothing else needs to change. */
window.SITE = {
  name_bn: "আগমনী",
  name_en: "Agomoni",
  github: "https://github.com/SouRitra01",
  githubHandle: "SouRitra01",
  // Leave as "/api" when hosted on Cloudflare Pages (crowd reports use Pages Functions + D1).
  api: "/api",
  // Puja calendar 2026 (IST). Shashthi/Saptami vary by a day between panjikas.
  dates: [
    ["d_mahalaya", "2026-10-10"],
    ["d_shashthi", "2026-10-16"],
    ["d_saptami", "2026-10-17"],
    ["d_ashtami", "2026-10-19"],
    ["d_navami", "2026-10-20"],
    ["d_dashami", "2026-10-21"],
  ],
  countdownTo: "2026-10-16T00:00:00+05:30",
  pujoEnds: "2026-10-22T06:00:00+05:30",
};
