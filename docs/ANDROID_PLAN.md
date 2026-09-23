# Agomoni on Google Play: plan

Status: planned, not started. Written 24 Sept 2026.

## Recommendation: wrap the website as a Trusted Web Activity (TWA)

A TWA is a small Android app that opens the live Agomoni site full-screen in Chrome, with no browser bar. It is Google's supported way to publish a web app on Play.

| | TWA (recommended) | Capacitor (native shell) | Native rewrite (Kotlin) |
|---|---|---|---|
| Code to maintain | Same website, nothing new | Website plus native plugins | A second app |
| Updating content/themes | Deploy the website; the app updates instantly | Needs an app release for native changes | App release every time |
| Offline | Via service worker | Via bundled files | Yes |
| Push notifications | Web push, works in TWA | Native FCM | Native FCM |
| Effort | 2–3 days | 1–2 weeks | 6+ weeks |

Agomoni is a content and routing site that changes daily during pujo (themes, crowd reports), so instant web updates matter more than native features. Start with a TWA. Move to Capacitor later only if we need something the web can't do, such as background location.

## Phase 0: Prerequisites (on the website, before any Android work)
1. **Deploy on Cloudflare Pages** (HANDOFF task 2). A TWA needs a live HTTPS URL. A custom domain such as `agomoni.in` (about ₹700/yr) is optional but looks better on the store than `*.pages.dev`.
2. **Make it a full PWA:**
   - `public/manifest.webmanifest` with name, short name, colours (`#3A0709` theme, `#FBF6EE` background), and 192/512 px icons plus a maskable icon.
   - `public/sw.js`, a service worker that caches the app shell, `data.json` and photos, so the app opens with no network inside a crowded pandal.
   - Lighthouse "installable" check passes.
3. **Privacy policy page** (`/privacy`). Play requires one. Contents: we store anonymous crowd reports (hashed, salted device ID, no location stored) and basic usage events, and share no personal data.

## Phase 1: Build the app (1 day)
1. Install JDK 17 and Node, then `npm i -g @bubblewrap/cli`.
2. `bubblewrap init --manifest https://<domain>/manifest.webmanifest` generates the Android project.
   - Package name: `in.agomoni.app` (**permanent**, so choose carefully).
   - Signing key: Bubblewrap creates it. **Back up the keystore and passwords.** Losing them means you can never update the app.
3. `bubblewrap build` produces the `.aab` to upload to Play.
4. Publish `public/.well-known/assetlinks.json` containing the SHA-256 fingerprint of the **Play App Signing** key (from Play Console → App integrity). Without it, the app shows a browser address bar.
5. Test on a real phone: fullscreen, back button, the Google Maps links opening the Maps app, Bengali fonts.

## Phase 2: Play Console (the slow part, mostly waiting)
1. **Developer account:** a one-time US$25 fee, plus identity verification (takes a few days).
2. **Testing rule for new personal accounts:** at the time of writing, a new personal account must run a **closed test with at least 12 testers opted in for 14 consecutive days** before it can apply for production. Check the current rule in Play Console, since Google changes it. Organisation accounts are exempt, but they need a D-U-N-S number, which also takes weeks.
3. **Store listing in Bengali and English:**
   - app icon (512×512)
   - feature graphic (1024×500): the Durga hero with the gold wordmark
   - at least 4 phone screenshots: home, pandal list, route plan, food
   - short description (80 chars) and full description
4. **Forms:** Data safety (matches the privacy policy), content rating questionnaire, target audience (not for children), no ads, and target API level (Bubblewrap targets the level Play currently requires).
5. **Production review:** usually 1–7 days for a new app.

## Timeline versus pujo (read this before deciding)
Pujo runs 16–21 Oct 2026. The shortest possible path from today:

| Step | Earliest |
|---|---|
| Account created and verified | ~27 Sept |
| Closed test starts (needs 12 testers) | ~28 Sept |
| 14 days complete | ~12 Oct |
| Production review | ~13–19 Oct |

So a public Play release **during pujo 2026 is possible but not reliable.** The plan:
- **For pujo 2026:** promote the website and let people install it from Chrome ("Add to Home screen"). The PWA work in Phase 0 makes that feel like an app.
- **At the same time:** create the Play account now and start the closed test with friends and family, so the Play app is live as early as review allows, and certainly well before pujo 2027.

## Costs
- Play developer account: US$25, one time
- Domain: about ₹700 a year (optional)
- Everything else stays free (Cloudflare free tier, Bubblewrap, GitHub)

## Checklist for the implementation session
- [ ] Deploy site (HANDOFF task 2)
- [ ] manifest + icons + service worker + /privacy
- [ ] Play developer account (Poulami does this: payment and ID verification)
- [ ] Bubblewrap project in `android/`, keystore backed up outside the repo
- [ ] assetlinks.json deployed and verified
- [ ] 12 testers recruited; closed test running
- [ ] Store listing assets (bn + en)
- [ ] Production submission
