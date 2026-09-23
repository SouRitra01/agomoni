# আগমনী — Agomoni · Durga Puja 2026 smart route guide (Kolkata + Bengaluru)

Bengali-first pandal guide with three data features:

| Feature | Technique | Where |
|---|---|---|
| Smart route | Multimodal travel model (walk / metro / cab) + **Held–Karp DP** (exact TSP ≤ 11 stops) + **2-opt/relocate** local search on a crowd-aware, time-dependent simulation | `public/js/engine.js` |
| Pujo Match | Content-based recommender — 6-feature vectors, cosine similarity, explainable "why" | `public/js/engine.js` |
| Live crowd | Crowdsourced 1–4 reports, time-decayed average (30-min half-life, 90-min window), privacy-safe rate limiting | `functions/api/crowd.js` + Cloudflare D1 |

Everything runs on free tiers: Cloudflare Pages (hosting) + Pages Functions + D1 (database). No API keys, no paid services.

---

## 1. Deploy (≈ 20 minutes, ₹0)

You need a free GitHub account and a free Cloudflare account.

1. **GitHub** — create a new repository (e.g. `agomoni`) and upload every file in this folder (drag-and-drop on github.com works).
2. **Cloudflare** → *Workers & Pages* → *Create* → *Pages* → *Connect to Git* → pick the repo.
   - Framework preset: **None** · Build command: *(leave empty)* · Build output directory: **`public`**
   - Deploy. The site is now live at `https://<project>.pages.dev` (map, route, match all work).
3. **Database for live crowd** — Cloudflare → *Storage & Databases* → *D1* → *Create* → name `agomoni-db`.
   - Open it → *Console* → paste the contents of `schema.sql` → *Execute*.
4. **Connect DB to the site** — Pages project → *Settings* → *Bindings* → *Add* → *D1 database* → variable name **`DB`** → select `agomoni-db`.
5. **Privacy salt** — *Settings* → *Variables and Secrets* → add secret `HASH_SALT` = any long random text.
6. *Deployments* → *Retry deployment* so the binding takes effect. Test: open `https://<project>.pages.dev/api/crowd?city=kolkata` → should show `{"levels":{}…}`.

Every later push to GitHub redeploys automatically.

## 2. Edit the data (Google Sheets workflow)

The CSVs in `data/` are the source of truth.

1. Google Sheets → *File → Import → Upload* `data/pandals.csv` (repeat for `metro.csv`, `food.csv`).
2. Edit there. Columns: `heritage, theme, grand, quiet, food, family` are 0–1 feature scores (they drive Pujo Match); `crowd` is 1–4 typical crowd; `type` ∈ sabeki/theme/bonedi/heritage; set `verified` to `yes` once you've checked a row.
3. *File → Download → CSV*, replace the file in `data/`, then run
   `python3 scripts/build_data.py` → regenerates `public/data/data.json` and validates everything (duplicate ids, coordinates outside the city, bad scores).
4. Commit/upload `public/data/data.json` to GitHub.

**2026 themes:** fill `theme_2026_bn` / `theme_2026_en` as clubs announce them (most around Mahalaya, 10 Oct). Empty = "to be announced".

## 3. Run locally (optional)

```
node scripts/dev-server.mjs      # Node 22+, serves the site + real API with in-memory SQLite
# open http://localhost:8788
# No Node? On Windows, preview the static site (without the live API) with:
#   powershell -ExecutionPolicy Bypass -File scripts/serve.ps1
```

## 4. After Puja — the analysis

Export the data: D1 console → `SELECT * FROM reports;` and `SELECT * FROM events;` → download CSV.
Ideas: crowd level by pandal × hour heatmap, average minutes saved by the optimiser, most-matched preferences. Next year, train a crowd forecast on this data.

## Photos

All photos are freely licensed images from Wikimedia Commons, resized into `public/img/`. Their credits are generated into `public/js/photos.js` and listed on the site's Method page, as CC BY / BY-SA requires.

- `scripts/fetch_photos.ps1` (Windows PowerShell) downloads, resizes and credits them. To add a photo for a pandal, add a line `'p-<pandal id>' = @('<Commons file title>', 900)` and rerun it.
- Pandals without their own photo show a photo of the same kind of puja, labelled "প্রতীকী ছবি / Representative photo".
- Don't copy photos from other puja sites. They are usually copyrighted.

## Settings

`public/js/config.js` — site name, GitHub link, puja dates, API path.

## Data honesty

All pandal coordinates are approximate (`verified = no`). Check each on Google Maps before promoting the site. Travel times are estimates from a simple model.

Made by [@SouRitra01](https://github.com/SouRitra01). Map © OpenStreetMap contributors.

`python3 scripts/build_preview.py` builds a self-contained copy in `preview/` that uses the schematic map (no external map tiles).
