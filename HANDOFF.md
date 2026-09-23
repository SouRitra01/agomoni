# Agomoni — handoff for the next Cowork session

Read this first. You are continuing the Agomoni (আগমনী) website project for Poulami.

## What this is
Bengali-first Durga Puja 2026 pandal guide for Kolkata + Bengaluru. Static site (public/) +
Cloudflare Pages Functions + D1 (functions/, schema.sql). 100% free stack. Deadline: 30 Sept 2026.
GitHub account for everything: SouRitra01 (do not ask again). Footer credits @SouRitra01.

## Done
- Data: data/*.csv (44 Kolkata + 10 Bengaluru pandals, metro stations, Kolkata food). `python3 scripts/build_data.py` -> public/data/data.json (validates).
- Engine (public/js/engine.js): multimodal travel model, Held-Karp exact TSP (<=11 stops, verified vs brute force 20/20), 2-opt/relocate on crowd-aware timeline; Pujo Match cosine recommender with "why".
- Live crowd API (functions/api/crowd.js, event.js) — tested locally with scripts/dev-server.mjs (Node 22+).
- Redesign "Mahalaya dawn": indigo sky hero, falling shiuli canvas, Galada + Anek Bangla fonts, light/dark themes, schematic metro map fallback.
- Preview (private): https://claude.ai/artifact/D2zehpDSzjMAWhKU3mCF29 — built with `python3 scripts/build_preview.py`.

## Open tasks (in order)
1. ~~Push to GitHub~~ DONE 2026-09-24: https://github.com/SouRitra01/agomoni (public, branch main).
2. Deploy on Cloudflare Pages (README section 1): output dir `public`, D1 `agomoni-db` bound as `DB`, secret `HASH_SALT`.
3. Verify every pandal lat/lng on Google Maps (all rows are `verified = no`) — most important before promoting.
4. Add 2026 themes (theme_2026_bn/en) as clubs announce them around Mahalaya (10 Oct).
5. Later/optional: Bengaluru food list; AI chatbot (only after launch, if traffic).

## Caveats
- Shashthi/Saptami dates differ by a day between panjikas; config uses 16/17 Oct with a note.
- Travel times are model estimates; no crowd "prediction" this year (no history) — reports collected this year feed a forecast next year.
