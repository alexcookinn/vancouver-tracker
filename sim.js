/* ============================================================================
 * sim.js — Monte Carlo engine.
 *
 * Runs thousands of simulated tournaments to estimate the probability that
 * each team ends up in YOUR Vancouver game (Match 96).
 *
 * Method per simulation:
 *   1. Each group: keep finished results, simulate remaining games (Poisson
 *      goals from Elo), build the final table, rank with WC tiebreakers.
 *   2. Pick the 8 best third-place teams across all 12 groups.
 *   3. Assign those thirds to the 8 "group-winner vs third" R32 slots,
 *      respecting FIFA's allowed-group sets (bipartite matching).
 *   4. Simulate the two R32 matches that feed Vancouver (M85 and M87).
 *   5. The two R32 winners ARE the two teams in the Vancouver game. Tally.
 * ========================================================================== */

/* --- Elo helpers ---------------------------------------------------------- */
function eloWinProb(ra, rb) {            // P(A beats B), knockout (no draw)
  return 1 / (1 + Math.pow(10, (rb - ra) / 400));
}

/* Poisson sampler (Knuth). lambda = expected goals. */
function poisson(lambda) {
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= Math.random(); } while (p > L);
  return k - 1;
}

/* Simulate a single match scoreline from two Elo ratings. */
function simScore(ra, rb) {
  const diff = ra - rb;
  const supremacy = diff / 150;          // ~150 Elo ≈ 1 goal of edge
  const total = 2.6;                     // avg goals per game
  const la = Math.max(0.15, total / 2 + supremacy / 2);
  const lb = Math.max(0.15, total / 2 - supremacy / 2);
  return [poisson(la), poisson(lb)];
}

/* The 6 round-robin pairings for a 4-team group. */
function groupPairings(teams) {
  const p = [];
  for (let i = 0; i < teams.length; i++)
    for (let j = i + 1; j < teams.length; j++)
      p.push([teams[i], teams[j]]);
  return p;
}

/* Find a finished result for a pairing (either home/away order). */
function findResult(results, group, a, b) {
  for (const r of results) {
    if (r.group !== group) continue;
    if (r.home === a && r.away === b) return { ag: r.hg, bg: r.ag };
    if (r.home === b && r.away === a) return { ag: r.ag, bg: r.hg };
  }
  return null;
}

/* Build + rank one group's final table for a single simulation. */
function simGroupTable(group, teams, results, elo) {
  const tbl = {};
  for (const t of teams) tbl[t] = { team: t, pts: 0, gf: 0, ga: 0, elo: elo[t] };

  for (const [a, b] of groupPairings(teams)) {
    let ag, bg;
    const fixed = findResult(results, group, a, b);
    if (fixed) { ag = fixed.ag; bg = fixed.bg; }
    else { [ag, bg] = simScore(elo[a], elo[b]); }

    tbl[a].gf += ag; tbl[a].ga += bg;
    tbl[b].gf += bg; tbl[b].ga += ag;
    if (ag > bg) tbl[a].pts += 3;
    else if (bg > ag) tbl[b].pts += 3;
    else { tbl[a].pts += 1; tbl[b].pts += 1; }
  }

  const ranked = Object.values(tbl).sort((x, y) =>
    (y.pts - x.pts) ||
    ((y.gf - y.ga) - (x.gf - x.ga)) ||      // goal difference
    (y.gf - x.gf) ||                         // goals for
    (y.elo - x.elo)                          // proxy for FIFA-ranking tiebreak
  );
  ranked.forEach((r, i) => { r.gd = r.gf - r.ga; r.pos = i + 1; });
  return ranked; // [1st, 2nd, 3rd, 4th]
}

/* FIFA allowed third-place groups for each of the 8 "winner vs third" R32
 * slots. Keyed by the winning group; value = set of groups a third may come
 * from. (Sets verified against the published 2026 bracket.) */
const THIRD_SLOTS = {
  E: ["A", "B", "C", "D", "F"],
  I: ["C", "D", "F", "G", "H"],
  A: ["C", "E", "F", "H", "I"],
  L: ["E", "H", "I", "J", "K"],
  G: ["A", "E", "H", "I", "J"],
  D: ["B", "E", "F", "I", "J"],
  B: ["E", "F", "G", "I", "J"],   // feeds M85 → Vancouver
  K: ["D", "E", "I", "J", "L"],   // feeds M87 → Vancouver (Portugal)
};

/* Assign the qualifying thirds (by group letter) to the 8 slots so every slot
 * gets a distinct eligible third. Returns { winningGroup: thirdGroupLetter }.
 * Backtracking perfect-matching; most-constrained slot first. */
function assignThirds(qualifyingGroups) {
  const slots = Object.keys(THIRD_SLOTS).map(w => ({
    w, allowed: THIRD_SLOTS[w].filter(g => qualifyingGroups.includes(g)),
  }));
  slots.sort((a, b) => a.allowed.length - b.allowed.length); // fewest options first
  const assign = {};
  const used = new Set();
  function solve(i) {
    if (i === slots.length) return true;
    for (const g of slots[i].allowed) {
      if (used.has(g)) continue;
      used.add(g); assign[slots[i].w] = g;
      if (solve(i + 1)) return true;
      used.delete(g); delete assign[slots[i].w];
    }
    return false;
  }
  if (solve(0)) return assign;
  // Fallback (shouldn't happen): greedy.
  for (const s of slots) {
    const g = s.allowed.find(x => !used.has(x));
    if (g) { used.add(g); assign[s.w] = g; }
  }
  return assign;
}

/* ------------------------------------------------------------------------- */
/* Run the full Monte Carlo. Returns probability tables.                     */
/* ------------------------------------------------------------------------- */
function runSim(data, N = 20000) {
  const { TEAMS: elo, GROUPS, RESULTS, BRACKET, YOUR_GROUP, OPPONENT_GROUP, YOUR_TEAM } = data;
  const groupLetters = Object.keys(GROUPS);

  // Tally counters
  const reachVan = {};      // team -> times in Vancouver game (either slot)
  const reachM87 = {};      // team -> times filling the Kansas City (Group K) slot
  const reachM85 = {};      // team -> times filling the Vancouver R32 (Group B) slot
  const matchupCount = {};  // "teamA ||| teamB" (sorted) -> times that exact Match 96
  const winGroup = {};      // team -> times won its OWN group
  const wonGroupAndR32 = {}; // team -> times (won group AND won its R32 feeder)
  let yourGroupWins = 0, yourReachVan = 0;

  const inc = (obj, k) => { obj[k] = (obj[k] || 0) + 1; };

  const kSlot = BRACKET.sides[YOUR_GROUP].r32;     // M87
  const bSlot = BRACKET.sides[OPPONENT_GROUP].r32; // M85

  // team -> its group letter (used to label a confirmed R32 opponent)
  const groupOf = {};
  for (const g of groupLetters) for (const t of GROUPS[g]) groupOf[t] = g;

  // If the R32 draw is confirmed (slot.opponent set), we use that exact team
  // instead of simulating which best-third-place team gets assigned.
  const fixedOpp = (slot) => slot.opponent
    ? { team: slot.opponent, elo: elo[slot.opponent], group: groupOf[slot.opponent] }
    : null;
  const kFixed = fixedOpp(kSlot), bFixed = fixedOpp(bSlot);

  for (let n = 0; n < N; n++) {
    const winners = {}, runners = {}, thirds = {};
    const allThirds = [];

    for (const g of groupLetters) {
      const tbl = simGroupTable(g, GROUPS[g], RESULTS, elo);
      winners[g] = tbl[0]; runners[g] = tbl[1]; thirds[g] = tbl[2];
      inc(winGroup, tbl[0].team);
      allThirds.push({ group: g, ...tbl[2] });
    }
    if (winners[YOUR_GROUP].team === YOUR_TEAM) yourGroupWins++;

    // Best 8 thirds (same tiebreak ordering).
    allThirds.sort((x, y) =>
      (y.pts - x.pts) || (y.gd - x.gd) || (y.gf - x.gf) || (y.elo - x.elo));
    const top8 = allThirds.slice(0, 8);
    const qualGroups = top8.map(t => t.group);
    const assign = assignThirds(qualGroups);

    // --- Kansas City R32 feeder (M87): Group K winner vs its opponent ---
    // Opponent is the confirmed draw (kFixed) if set, else a simulated third.
    const kWinner = winners[kSlot.groupWinner];
    const kOpp = kFixed || top8.find(t => t.group === assign[kSlot.groupWinner]);
    let kAdvances;
    if (kOpp) {
      kAdvances = Math.random() < eloWinProb(kWinner.elo, kOpp.elo) ? kWinner : kOpp;
    } else {
      kAdvances = kWinner; // (defensive) shouldn't occur
    }

    // --- Vancouver R32 feeder (M85): Group B winner vs its opponent ---
    const bWinner = winners[bSlot.groupWinner];
    const bOpp = bFixed || top8.find(t => t.group === assign[bSlot.groupWinner]);
    let bAdvances;
    if (bOpp) {
      bAdvances = Math.random() < eloWinProb(bWinner.elo, bOpp.elo) ? bWinner : bOpp;
    } else {
      bAdvances = bWinner;
    }

    // The two teams in the Vancouver game:
    inc(reachVan, kAdvances.team);
    inc(reachVan, bAdvances.team);
    inc(reachM87, kAdvances.team);   // Kansas City side
    inc(reachM85, bAdvances.team);   // Vancouver R32 side
    const mk = kAdvances.team < bAdvances.team
      ? kAdvances.team + " ||| " + bAdvances.team
      : bAdvances.team + " ||| " + kAdvances.team;
    inc(matchupCount, mk);
    if (kAdvances.team === YOUR_TEAM) yourReachVan++;

    if (kWinner.team === kAdvances.team) inc(wonGroupAndR32, kWinner.team);
    if (bWinner.team === bAdvances.team) inc(wonGroupAndR32, bWinner.team);
  }

  // Convert to probabilities
  const pct = (c) => (c || 0) / N;
  const tableFor = (groupLetter) => GROUPS[groupLetter].map(t => ({
    team: t,
    elo: elo[t],
    pWinGroup: pct(winGroup[t]),
    pReachVancouver: pct(reachVan[t]),
  })).sort((a, b) => b.pReachVancouver - a.pReachVancouver);

  // Which team fills each side of Match 96 — ranked across all candidates.
  const buildSide = (counts, feederGroup) => Object.keys(counts).map(t => ({
    team: t,
    elo: elo[t],
    pReach: pct(counts[t]),          // P(this team is the one in Match 96 via this side)
    pWinGroup: pct(winGroup[t]),
    fromGroup: groupOf[t],
    viaThird: !GROUPS[feederGroup].includes(t),  // true = best-third-place wildcard
  })).sort((a, b) => b.pReach - a.pReach);

  // Most likely group winner of each feeder group (and how locked it is).
  const projWinner = (g) => GROUPS[g]
    .map(t => ({ team: t, p: pct(winGroup[t]), elo: elo[t] }))
    .sort((a, b) => b.p - a.p)[0];

  // Most likely exact Match 96 pairings.
  const topMatchups = Object.keys(matchupCount).map(k => {
    const [a, b] = k.split(" ||| ");
    return { a, b, p: pct(matchupCount[k]) };
  }).sort((x, y) => y.p - x.p);

  // Spoiler third-place teams that could steal YOUR slot (win M87 over K winner)
  // and the opponent slot — captured already in reachVan for non-group teams.
  const spoilers = Object.keys(reachVan)
    .filter(t => !GROUPS[YOUR_GROUP].includes(t) && !GROUPS[OPPONENT_GROUP].includes(t))
    .map(t => ({ team: t, pReachVancouver: pct(reachVan[t]) }))
    .sort((a, b) => b.pReachVancouver - a.pReachVancouver)
    .filter(s => s.pReachVancouver > 0.005);

  return {
    N,
    yourTeam: YOUR_TEAM,
    pYourTeamWinsGroup: yourGroupWins / N,
    pYourTeamReachesVancouver: yourReachVan / N,
    pYourTeamWinsR32GivenGroup: yourGroupWins ? yourReachVan / yourGroupWins : 0,
    yourSide: tableFor(YOUR_GROUP),       // Group K teams
    opponentSide: tableFor(OPPONENT_GROUP), // Group B teams
    spoilers,                              // third-place teams that could appear

    // --- General "who reaches Match 96" view (team-agnostic) ---
    m87: {                                 // Kansas City side (feeds Match 96)
      feederGroup: YOUR_GROUP,
      r32: kSlot,
      projWinner: projWinner(YOUR_GROUP),
      rows: buildSide(reachM87, YOUR_GROUP),
    },
    m85: {                                 // Vancouver R32 side (feeds Match 96)
      feederGroup: OPPONENT_GROUP,
      r32: bSlot,
      projWinner: projWinner(OPPONENT_GROUP),
      rows: buildSide(reachM85, OPPONENT_GROUP),
    },
    topMatchups,
  };
}

window.WCsim = { runSim, eloWinProb, simScore };
