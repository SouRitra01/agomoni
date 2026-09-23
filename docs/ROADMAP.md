# Agomoni roadmap: data science and AI features

Written 24 Sept 2026. Site deadline 30 Sept; pujo 16–21 Oct (Shashthi to Dashami).

## Where each idea stands

| # | Feature | Status today | Gap |
|---|---|---|---|
| 1 | Smart route optimiser | **Built.** Held–Karp exact order (≤11 stops) + 2-opt/relocate on a crowd- and hour-aware timeline; walk/metro/cab per leg; "minutes saved" shown. | Distances are straight-line × a detour factor, not real walking routes. No evaluation numbers published. |
| 2 | Pujo Match | **Built.** 6 hand-scored features per pandal, cosine similarity, "why" shows the top 2 features. | Feature scores are my judgement, not learned. No "similar pandals". No feedback loop. |
| 3 | Live crowd reports | **Built (API + UI).** 1–4 reports, 90-min time-weighted average, rate-limited, hashed device ID; the route planner uses live levels. | No heatmap view. Nothing nudges people to report, so data volume will be low. |
| 4 | Pujo Mitra chatbot | Not built | — |
| 5 | Post-Dashami analysis | `events` table exists | **Only 2 events are tracked** (`route_built`, `match`). Not enough for the write-up. |

## The one thing that can't wait
**Instrumentation (#5) must ship before launch.** Data not logged during pujo can never be recovered, and the write-up, the heatmap and next year's forecast all depend on it. It's also the cheapest item (about half a day).

## Plan

### Phase A: before launch (by 30 Sept), must do
1. **Deploy** (HANDOFF task 2). Everything below needs the live API.
2. **Instrumentation.** Log these anonymous events (no IP, no location, no personal data):
   - `view` (which tab), `city`, `lang`
   - `search` (query text, number of results)
   - `pandal_open`, `add_route`, `remove_route`
   - `route_built` (stop count, optimised minutes, user-order minutes, start hour), which is already partly logged
   - `match` (answers), `match_add_all`
   - `food_nearby_click`, `gmaps_click`
   - `report` (it's already in the reports table)
   - `ref` (utm_source), so a LinkedIn post's traffic can be measured later

   Also: a per-device daily hash (the same salting as reports) so unique users can be counted, and batched sending so crowded 3G networks aren't hit with many requests.
3. **Crowd-report nudge.** If the user allows location and is within about 150 m of a pandal, show a one-tap "how's the crowd here?" card. This is what turns #3 from a feature into a dataset.
4. Verify pandal coordinates (HANDOFF task 3). The nudge and the routes depend on them.

### Phase B: before Shashthi (by 15 Oct), strong upgrades
5. **Real walking distances (upgrades #1).** Compute a 54×54 walking-time matrix **once, offline**, with OpenRouteService's free matrix API (2,916 pairs, which fits one free request; needs a free API key). Ship it as `data/walk_matrix.json`, and the browser keeps solving instantly with no API calls.
   - The data science part: fit road distance against straight-line distance on the matrix, report the calibrated detour factor and its error (R²), and show how many route orders change. That's a small, honest model-validation story.
6. **Crowd heatmap page (#3).** A pandal × hour grid from real reports, showing each cell's report count and hiding cells with fewer than 3 reports. Served by a new `GET /api/crowd/heatmap` endpoint that aggregates in D1. **No prediction.** The page says so and explains that this year's data trains next year's forecast.
7. **"Similar pandals" (upgrades #2).** Item-to-item similarity precomputed from the feature vectors, shown as "you might also like" on each card. No model is needed at runtime.
8. **Smart search** (a cheaper alternative to the chatbot): Bengali ⇄ English with transliteration ("bagbazar" ⇄ "বাগবাজার"), typo tolerance, and area names. It answers most "where is X / what's near Y" questions deterministically.

### Phase C: after Dashami (late Oct to Nov), portfolio
9. **Analysis notebook** (`analysis/pujo2026.ipynb`, run in Google Colab, since this PC has no Python):
   - crowd by pandal × hour (the real heatmap)
   - optimiser impact: distribution of minutes saved versus the user's own order
   - what people searched for and matched on; bn vs en; Kolkata vs Bengaluru
   - funnel: visit → search → route built → report
   - data-quality section: report counts, rate-limit hits, coverage gaps
10. **Public results page** on the site plus a **LinkedIn post / case study.** Frame it as "Year 1: collect honestly; Year 2: forecast".

### Phase D: next year (pujo 2027)
11. **Crowd forecast:** train on 2026 reports (features: pandal, hour, day, weather, type), backtest honestly, and ship it with uncertainty bands.
12. **Learned Pujo Match weights:** use 2026 feedback (which recommendations got added to routes) to tune feature weights.

### #4 Pujo Mitra chatbot: build last, only if traffic justifies it
- Build it only after smart search (item 8) exists and there are real users.
- Design so it can't invent facts: questions about places, distances, metro and crowd are answered by the **engine and data.json** (deterministic). The LLM only phrases the answer and must cite pandal cards; if something isn't in our data, it says "don't know".
- Cost and quota: Cloudflare Workers AI free tier, with a daily cap. When the quota runs out, it falls back to smart search instead of failing, so the one viral night can't break it.
- Not planned before pujo 2026.

## Order of work (summary)
1. Deploy
2. Instrumentation
3. Crowd nudge
4. Verify coordinates
5. Walking matrix
6. Heatmap page
7. Similar pandals
8. Smart search
9. Pujo (collect)
10. Analysis + write-up
11. Forecast (2027)
12. Chatbot (only if justified)

## Needs from Poulami
- A Cloudflare account for the deploy (item 1).
- A free OpenRouteService API key (item 5), created at openrouteservice.org.
- Google Colab (free) for the analysis notebook (item 9).
