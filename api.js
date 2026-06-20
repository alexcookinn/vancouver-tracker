/* ============================================================================
 * api.js — Auto-fetch live group-stage results.
 *
 * Default source: TheSportsDB (free, CORS-friendly, works from a static page
 * like GitHub Pages — no backend needed). It fills in finished group games so
 * the simulation runs off real results.
 *
 * If the fetch fails or returns nothing, the app silently falls back to the
 * seed/manual results in data.js — so the tracker never breaks.
 *
 * Want better/faster data later? Swap in an API-Football key (see CONFIG).
 * ========================================================================== */

const CONFIG = {
  // TheSportsDB free tier. League 4429 = FIFA World Cup. Key "3" is the public
  // free key. (Upgrade to a paid key for 2-minute live refresh if you want.)
  sportsdbKey: "3",
  sportsdbLeagueId: "4429",
  season: "2026",
};

/* Map TheSportsDB team spellings → the names used in data.js GROUPS/TEAMS.
 * Add any mismatches you spot here. */
const TEAM_ALIASES = {
  "United States": "USA",
  "USMNT": "USA",
  "Korea Republic": "South Korea",
  "South Korea": "South Korea",
  "Bosnia and Herzegovina": "Bosnia & Herzegovina",
  "Czech Republic": "Czechia",
  "Cote d'Ivoire": "Ivory Coast",
  "Côte d'Ivoire": "Ivory Coast",
  "Curacao": "Curaçao",
  "DR Congo": "DR Congo",
  "Congo DR": "DR Congo",
  "IR Iran": "Iran",
  "Saudi Arabia": "Saudi Arabia",
  "Turkey": "Türkiye",
  "Turkiye": "Türkiye",
  "Türkiye": "Türkiye",
  "Cabo Verde": "Cape Verde",
};

function canonTeam(name) {
  if (!name) return null;
  const n = name.trim();
  return TEAM_ALIASES[n] || n;
}

/* Which group is a team in? (null if not found → likely a knockout game.) */
function groupOf(team, GROUPS) {
  for (const g of Object.keys(GROUPS))
    if (GROUPS[g].includes(team)) return g;
  return null;
}

/* Fetch finished group-stage results from TheSportsDB. Returns an array in the
 * data.js RESULTS format, or null on failure. */
async function fetchLiveResults(GROUPS) {
  const url = `https://www.thesportsdb.com/api/v1/json/${CONFIG.sportsdbKey}` +
              `/eventsseason.php?id=${CONFIG.sportsdbLeagueId}&s=${CONFIG.season}`;
  let json;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("HTTP " + res.status);
    json = await res.json();
  } catch (e) {
    console.warn("[api] live fetch failed, using seed/manual data:", e.message);
    return null;
  }
  const events = json && json.events;
  if (!Array.isArray(events)) return null;

  const out = [];
  for (const ev of events) {
    // Only finished matches with a real score.
    const status = (ev.strStatus || "").toLowerCase();
    const finished = status.includes("match finished") || status === "ft" ||
                     (ev.intHomeScore != null && ev.intAwayScore != null &&
                      status !== "ns" && status !== "");
    if (!finished) continue;
    const home = canonTeam(ev.strHomeTeam);
    const away = canonTeam(ev.strAwayTeam);
    const hg = parseInt(ev.intHomeScore, 10);
    const ag = parseInt(ev.intAwayScore, 10);
    if (home == null || away == null || isNaN(hg) || isNaN(ag)) continue;

    const gh = groupOf(home, GROUPS), ga = groupOf(away, GROUPS);
    if (!gh || gh !== ga) continue; // skip knockout / cross-group games
    out.push({ group: gh, home, away, hg, ag });
  }
  return out.length ? out : null;
}

/* Merge live results with the seed, de-duplicating by group + team pair.
 * The curated SEED is authoritative — live data can only ADD games that the
 * seed doesn't already have, so a flaky feed can never overwrite good data. */
function mergeResults(seed, live) {
  if (!live) return seed.slice();
  const key = (r) => r.group + "|" + [r.home, r.away].sort().join("|");
  const map = new Map();
  for (const r of live) map.set(key(r), r);  // live first…
  for (const r of seed) map.set(key(r), r);  // …seed overrides (wins conflicts)
  return Array.from(map.values());
}

window.WCapi = { fetchLiveResults, mergeResults, CONFIG };
