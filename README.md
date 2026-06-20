# Vancouver R16 Tracker 🇵🇹

A live bracket tracker for **Match 96 — Round of 16, BC Place, Vancouver, Tue Jul 7, 2026**.
It estimates, in real time, the odds that **Portugal** (and every other contender) ends up in *your* game.

## The verified bracket logic

Your Vancouver game (Match 96) is fed by two Round-of-32 matches:

| Slot | Round of 32 match | Who |
|------|-------------------|-----|
| **Portugal's side** | **M87** — Kansas City, Jul 3 | **Group K winner** vs a best-3rd-place team |
| Opponent side | M85 — Vancouver, Jul 2 | Group B winner vs a best-3rd-place team |

**To reach your game, Portugal must (1) finish 1st in Group K, then (2) win M87.**
Finishing 2nd is *not* enough — the Group K runner-up is routed to Toronto → Dallas.

## Running it locally (no tools needed)

Just **double-click `index.html`** — it opens in your browser and works offline
(falling back to seed data if it can't reach the internet).

## Deploying to GitHub Pages (free shareable link)

1. Create a free account at [github.com](https://github.com) if you don't have one.
2. Create a new **public** repository, e.g. `vancouver-tracker`.
3. Upload every file in this folder (`index.html`, `styles.css`, `data.js`,
   `sim.js`, `api.js`, `app.js`, `README.md`). Easiest: on the repo page click
   **Add file → Upload files**, drag them all in, **Commit**.
4. Go to **Settings → Pages**.
5. Under **Build and deployment → Source**, pick **Deploy from a branch**,
   choose branch **main** and folder **/(root)**, then **Save**.
6. Wait ~1 minute. Your link appears at the top of the Pages settings, like
   `https://<your-username>.github.io/vancouver-tracker/`. Share away.

(If you have `git` + the GitHub CLI installed, ask Claude to push it for you instead.)

## Keeping it accurate

Everything you'd tweak lives in **`data.js`**:

- **Results** auto-update from TheSportsDB. You can also type scores into the
  **✎ Edit results** panel on the page, or add them to `RESULTS` in `data.js`.
- **⚠️ Verify three rosters:** the 4th team in Groups **D, F, I** came from
  playoffs — confirm they match reality (`Slovakia`, `Sweden`, `Iraq` are
  placeholders). Wrong names also break live-score matching for those games.
- **Team strength** (Elo) is in the `TEAMS` map — adjust any you disagree with.

## How the % are calculated

A Monte Carlo simulation (`sim.js`, 20,000 runs) plays out the rest of every
group with Poisson-distributed goals derived from Elo ratings, applies the
World Cup tiebreakers, picks the 8 best third-place teams, assigns them to the
Round-of-32 slots using FIFA's allowed-group sets, then simulates the two
matches (M85 & M87) that feed Vancouver. The two winners are the teams in your
game. It's an informed estimate — not a guarantee.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Page structure |
| `styles.css` | Styling |
| `data.js` | **Edit me** — teams, Elo, groups, results, bracket |
| `sim.js` | Monte Carlo engine |
| `api.js` | Live-score fetch (TheSportsDB) |
| `app.js` | Glue + rendering |
