/* ============================================================================
 * data.js — Single source of truth for the Vancouver tracker.
 *
 * This is the ONLY file you normally need to edit by hand:
 *   1. TEAMS      — strength ratings (Elo). Tweak if you disagree.
 *   2. GROUPS     — the 4 teams in each group. Fix the 3 playoff teams if wrong.
 *   3. RESULTS    — group-stage match results. The live API fills these in
 *                   automatically; you can also type them in by hand here.
 *
 * The bracket structure (BRACKET) is verified fact for WC2026 — don't change it.
 * ========================================================================== */

/* ----------------------------------------------------------------------------
 * 1. TEAMS — approximate World Football Elo ratings (mid-2026).
 *    Higher = stronger. These drive the win-probability math.
 *    Source: eloratings.net style values, rounded. Edit freely.
 * -------------------------------------------------------------------------- */
const TEAMS = {
  // Group A
  "Mexico": 1830, "South Korea": 1785, "South Africa": 1640, "Czechia": 1775,
  // Group B
  "Canada": 1760, "Switzerland": 1860, "Qatar": 1680, "Bosnia & Herzegovina": 1740,
  // Group C
  "Brazil": 2030, "Morocco": 1900, "Scotland": 1760, "Haiti": 1545,
  // Group D
  "USA": 1800, "Australia": 1720, "Paraguay": 1720, "Türkiye": 1790,
  // Group E
  "Germany": 1965, "Ecuador": 1800, "Ivory Coast": 1770, "Curaçao": 1560,
  // Group F
  "Netherlands": 2030, "Japan": 1850, "Tunisia": 1690, "Sweden": 1820,
  // Group G
  "Belgium": 1930, "Iran": 1770, "Egypt": 1700, "New Zealand": 1580,
  // Group H
  "Spain": 2120, "Uruguay": 1930, "Saudi Arabia": 1650, "Cape Verde": 1620,
  // Group I
  "France": 2080, "Senegal": 1840, "Norway": 1850, "Iraq": 1600,
  // Group J
  "Argentina": 2100, "Austria": 1790, "Algeria": 1780, "Jordan": 1600,
  // Group K  (Portugal's group)
  "Portugal": 2030, "Colombia": 1960, "Uzbekistan": 1680, "DR Congo": 1700,
  // Group L
  "England": 2010, "Croatia": 1900, "Panama": 1640, "Ghana": 1720,
};

/* ----------------------------------------------------------------------------
 * 2. GROUPS — rosters. Order doesn't matter.
 *    ⚠️ The 4th team in D, F, I came from playoffs — verify these are correct.
 *    DR Congo in Group K is confirmed (Portugal drew them 1-1 in the opener).
 * -------------------------------------------------------------------------- */
const GROUPS = {
  A: ["Mexico", "South Korea", "South Africa", "Czechia"],
  B: ["Canada", "Switzerland", "Qatar", "Bosnia & Herzegovina"],
  C: ["Brazil", "Morocco", "Scotland", "Haiti"],
  D: ["USA", "Australia", "Paraguay", "Türkiye"],
  E: ["Germany", "Ecuador", "Ivory Coast", "Curaçao"],
  F: ["Netherlands", "Japan", "Tunisia", "Sweden"],
  G: ["Belgium", "Iran", "Egypt", "New Zealand"],
  H: ["Spain", "Uruguay", "Saudi Arabia", "Cape Verde"],
  I: ["France", "Senegal", "Norway", "Iraq"],
  J: ["Argentina", "Austria", "Algeria", "Jordan"],
  K: ["Portugal", "Colombia", "Uzbekistan", "DR Congo"], // Portugal's group
  L: ["England", "Croatia", "Panama", "Ghana"],
};

/* The two groups that feed YOUR Vancouver game (Match 96). */
const YOUR_GROUP = "K";          // Portugal's side
const OPPONENT_GROUP = "B";      // the other side of Match 96
const YOUR_TEAM = "Portugal";    // the team you're rooting for

/* ----------------------------------------------------------------------------
 * 3. RESULTS — group-stage match results.
 *    Format: { group, home, away, hg (home goals), ag (away goals) }
 *    The live API auto-populates this; entries here are a manual seed/override.
 *    Only include FINISHED matches. Unplayed games are simulated.
 * -------------------------------------------------------------------------- */
let RESULTS = [
  // ---- Actual results as of Jun 20, 2026 (curated; source of truth) ----
  // Group A
  { group: "A", home: "Mexico", away: "South Africa", hg: 2, ag: 0 },
  { group: "A", home: "South Korea", away: "Czechia", hg: 2, ag: 1 },
  { group: "A", home: "Czechia", away: "South Africa", hg: 1, ag: 1 },
  { group: "A", home: "Mexico", away: "South Korea", hg: 1, ag: 0 },
  // Group B
  { group: "B", home: "Canada", away: "Bosnia & Herzegovina", hg: 1, ag: 1 },
  { group: "B", home: "Qatar", away: "Switzerland", hg: 1, ag: 1 },
  { group: "B", home: "Switzerland", away: "Bosnia & Herzegovina", hg: 4, ag: 1 },
  { group: "B", home: "Canada", away: "Qatar", hg: 6, ag: 0 },
  { group: "B", home: "Switzerland", away: "Canada", hg: 2, ag: 1 },
  // Group C
  { group: "C", home: "Brazil", away: "Morocco", hg: 1, ag: 1 },
  { group: "C", home: "Scotland", away: "Haiti", hg: 1, ag: 0 },
  { group: "C", home: "Morocco", away: "Scotland", hg: 1, ag: 0 },
  { group: "C", home: "Brazil", away: "Haiti", hg: 3, ag: 0 },
  // Group D
  { group: "D", home: "USA", away: "Paraguay", hg: 4, ag: 1 },
  { group: "D", home: "Australia", away: "Türkiye", hg: 2, ag: 0 },
  { group: "D", home: "USA", away: "Australia", hg: 2, ag: 0 },
  { group: "D", home: "Paraguay", away: "Türkiye", hg: 1, ag: 0 },
  // Group E
  { group: "E", home: "Germany", away: "Curaçao", hg: 7, ag: 1 },
  { group: "E", home: "Ivory Coast", away: "Ecuador", hg: 1, ag: 0 },
  { group: "E", home: "Germany", away: "Ivory Coast", hg: 2, ag: 1 },
  // Group F
  { group: "F", home: "Netherlands", away: "Japan", hg: 2, ag: 2 },
  { group: "F", home: "Sweden", away: "Tunisia", hg: 5, ag: 1 },
  { group: "F", home: "Netherlands", away: "Sweden", hg: 5, ag: 1 },
  // Group G
  { group: "G", home: "Belgium", away: "Egypt", hg: 1, ag: 1 },
  { group: "G", home: "Iran", away: "New Zealand", hg: 2, ag: 2 },
  // Group H
  { group: "H", home: "Spain", away: "Cape Verde", hg: 0, ag: 0 },
  { group: "H", home: "Saudi Arabia", away: "Uruguay", hg: 1, ag: 1 },
  // Group I
  { group: "I", home: "France", away: "Senegal", hg: 3, ag: 1 },
  { group: "I", home: "Norway", away: "Iraq", hg: 4, ag: 1 },
  // Group J
  { group: "J", home: "Argentina", away: "Algeria", hg: 3, ag: 0 },
  { group: "J", home: "Austria", away: "Jordan", hg: 3, ag: 1 },
  // Group K  (Portugal's group)
  { group: "K", home: "Portugal", away: "DR Congo", hg: 1, ag: 1 },
  { group: "K", home: "Colombia", away: "Uzbekistan", hg: 3, ag: 1 },
  { group: "K", home: "Portugal", away: "Uzbekistan", hg: 5, ag: 0 },
  { group: "K", home: "Colombia", away: "DR Congo", hg: 1, ag: 0 },
  { group: "K", home: "Portugal", away: "Colombia", hg: 1, ag: 1 },
  // Group L
  { group: "L", home: "England", away: "Croatia", hg: 4, ag: 2 },
  { group: "L", home: "Ghana", away: "Panama", hg: 1, ag: 0 },
];

/* ----------------------------------------------------------------------------
 * BRACKET — VERIFIED FACT. Do not edit.
 *
 * Vancouver Round of 16 = Match 96 (Tue Jul 7, 2026, BC Place).
 *   Match 96 = winner(M85) vs winner(M87)
 *
 *   M85 (Vancouver, Jul 2) = Group B WINNER  vs  best-3rd from {E,F,G,I,J}
 *   M87 (Kansas City, Jul 3)= Group K WINNER  vs  best-3rd from {D,E,I,J,L}
 *
 * So to reach Match 96 you must WIN your group, then win your R32 game.
 * The Group K runner-up goes to Toronto (M83) → Dallas (M93), NOT Vancouver.
 * -------------------------------------------------------------------------- */
const BRACKET = {
  finalMatch: { id: 96, name: "Round of 16", venue: "BC Place, Vancouver", date: "2026-07-07" },
  sides: {
    // Portugal's side
    K: {
      r32: { id: 87, venue: "Kansas City", date: "2026-07-03",
             groupWinner: "K", thirdFrom: ["D", "E", "I", "J", "L"] },
    },
    // Opponent side
    B: {
      r32: { id: 85, venue: "Vancouver", date: "2026-07-02",
             groupWinner: "B", thirdFrom: ["E", "F", "G", "I", "J"] },
    },
  },
};

/* Expose to other scripts (works as plain <script> includes, no modules). */
window.WC = { TEAMS, GROUPS, YOUR_GROUP, OPPONENT_GROUP, YOUR_TEAM, RESULTS, BRACKET };
