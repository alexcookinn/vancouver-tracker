/* ============================================================================
 * app.js — wires data + sim + live API into the page.
 *
 * View: team-agnostic. It tracks WHO is most likely to appear in the Vancouver
 * Round-of-16 game (Match 96), what each contender needs, and the key factors.
 * ========================================================================== */
const D = window.WC;          // seed data (mutable RESULTS)
const SIM_N = 20000;

const $ = (id) => document.getElementById(id);
const pctStr = (p) => (p * 100 < 0.5 && p > 0 ? "<1" : Math.round(p * 100)) + "%";

/* ---- Current (actual) standings from finished results only --------------- */
function currentStandings(group) {
  const teams = D.GROUPS[group];
  const tbl = {};
  for (const t of teams) tbl[t] = { team: t, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, elo: D.TEAMS[t] };
  for (const r of D.RESULTS) {
    if (r.group !== group) continue;
    const H = tbl[r.home], A = tbl[r.away];
    if (!H || !A) continue;
    H.p++; A.p++; H.gf += r.hg; H.ga += r.ag; A.gf += r.ag; A.ga += r.hg;
    if (r.hg > r.ag) { H.w++; A.l++; H.pts += 3; }
    else if (r.ag > r.hg) { A.w++; H.l++; A.pts += 3; }
    else { H.d++; A.d++; H.pts++; A.pts++; }
  }
  return Object.values(tbl).sort((x, y) =>
    (y.pts - x.pts) || ((y.gf - y.ga) - (x.gf - x.ga)) || (y.gf - x.gf) || (y.elo - x.elo));
}

function gamesPlayedIn(group) {
  return D.RESULTS.filter(r => r.group === group).length;
}

/* ---- Rendering ----------------------------------------------------------- */
function renderHeadline(sim) {
  const top = sim.topMatchups[0];
  if (top) {
    $("headlineMatchup").textContent = `${top.a} vs ${top.b}`;
    $("headlinePct").textContent = pctStr(top.p);
  }
  $("simN").textContent = sim.N.toLocaleString();
}

/* One side of the bracket: ranked list of every team that could fill it. */
function renderSide(elId, side) {
  const rows = side.rows;
  const max = Math.max(0.01, ...rows.map(r => r.pReach));
  $(elId).innerHTML = rows.map(r => {
    const w = Math.round((r.pReach / max) * 100);
    const tag = r.viaThird
      ? `<span class="sub wild">· 3rd-place wildcard (Grp ${r.fromGroup})</span>`
      : `<span class="sub">· Group ${r.fromGroup} winner</span>`;
    return `
      <div class="prob-row${r.viaThird ? " wildrow" : ""}">
        <div class="fill" style="width:${w}%"></div>
        <div class="row-inner">
          <div><span class="team">${r.team}</span> ${tag}</div>
          <div class="pct">${pctStr(r.pReach)}</div>
        </div>
      </div>`;
  }).join("");
}

/* "What needs to happen" — generated per side from current state + sim. */
function sideNeedItem(side, sideLabel) {
  const w = side.projWinner;                                  // {team, p, elo}
  const winnerRow = side.rows.find(r => r.team === w.team) || { pReach: 0 };
  const r32 = side.r32;
  if (r32.opponent) {
    // R32 draw is confirmed: a single, locked knockout game.
    const oppRow = side.rows.find(r => r.team === r32.opponent) || { pReach: 0 };
    return `<li><b>${sideLabel} — ${w.team} vs ${r32.opponent}</b>
        (${r32.venue}, Jul ${r32.date.slice(-2)}): winner goes to Match 96.
        <span class="pill">${pctStr(winnerRow.pReach)}</span> ${w.team} ·
        <span class="pill">${pctStr(oppRow.pReach)}</span> ${r32.opponent}.</li>`;
  }
  const clinched = w.p > 0.999;
  const groupState = clinched
    ? `<b>${w.team}</b> has clinched Group ${side.feederGroup}`
    : `<b>${w.team}</b> leads Group ${side.feederGroup} to win it <span class="pill">${pctStr(w.p)}</span>`;
  const pThird = 1 - winnerRow.pReach;
  const wildNote = pThird > 0.02
    ? ` A best-third-place team takes this slot instead <span class="pill">${pctStr(pThird)}</span> of the time.`
    : "";
  return `<li><b>${sideLabel} →</b> ${groupState}, then must win the Round of 32
      (${r32.venue}, Jul ${r32.date.slice(-2)}) vs a best-third qualifier.
      Net: <span class="pill">${pctStr(winnerRow.pReach)}</span> to reach Match 96.${wildNote}</li>`;
}

function renderWhatNeeds(sim) {
  $("scenarioList").innerHTML =
    sideNeedItem(sim.m85, "Vancouver R32 side") +
    sideNeedItem(sim.m87, "Kansas City side");

  const top3 = sim.topMatchups.slice(0, 3)
    .map(m => `${m.a} vs ${m.b} <span class="muted">(${pctStr(m.p)})</span>`).join(" · ");
  $("scenarioNote").innerHTML =
    `Most likely Match 96 pairings: ${top3}. No single matchup is a lock — ` +
    `the field is split across both sides' R32 games.`;
}

/* "Key factors" — what actually swings the outcome. */
function renderKeyFactors(sim) {
  const locked = sim.m85.r32.opponent && sim.m87.r32.opponent;
  const wA = sim.m85.rows.find(r => r.team === sim.m85.projWinner.team) || { pReach: 0 };
  const wB = sim.m87.rows.find(r => r.team === sim.m87.projWinner.team) || { pReach: 0 };

  if (locked) {
    const oppA = sim.m85.rows.find(r => r.team === sim.m85.r32.opponent) || { pReach: 0 };
    const oppB = sim.m87.rows.find(r => r.team === sim.m87.r32.opponent) || { pReach: 0 };
    const pBothFav = wA.pReach * wB.pReach;
    const items = [
      `<b>The draw is set — 4 teams, 2 games.</b> Match 96 is the winner of
         <b>${sim.m85.projWinner.team} vs ${sim.m85.r32.opponent}</b> (Vancouver, Jul 2) against the winner of
         <b>${sim.m87.projWinner.team} vs ${sim.m87.r32.opponent}</b> (Kansas City, Jul 3). No wildcards left.`,
      `<b>Vancouver R32 is the tighter game:</b> ${sim.m85.projWinner.team}
         <span class="pill">${pctStr(wA.pReach)}</span> vs ${sim.m85.r32.opponent}
         <span class="pill">${pctStr(oppA.pReach)}</span> — close to a coin flip.`,
      `<b>Kansas City R32 is more lopsided:</b> ${sim.m87.projWinner.team}
         <span class="pill">${pctStr(wB.pReach)}</span> vs ${sim.m87.r32.opponent}
         <span class="pill">${pctStr(oppB.pReach)}</span>.`,
      `<b>Chalk result:</b> both favourites winning gives ${sim.m87.projWinner.team} vs
         ${sim.m85.projWinner.team} — the single most likely Match 96 at
         <span class="pill">${pctStr(pBothFav)}</span>.`,
    ];
    $("keyFactors").innerHTML = items.map(t => `<li>${t}</li>`).join("");
    return;
  }

  const pUpset = 1 - wA.pReach * wB.pReach;
  const wilds = [...sim.m85.rows, ...sim.m87.rows]
    .filter(r => r.viaThird)
    .sort((a, b) => b.pReach - a.pReach)
    .slice(0, 4)
    .map(r => `${r.team} (Grp ${r.fromGroup}) <span class="muted">${pctStr(r.pReach)}</span>`)
    .join(" · ");
  const items = [
    `<b>The two favourites:</b> ${sim.m85.projWinner.team} and ${sim.m87.projWinner.team}
       are the front-runners — but both still have to win an R32 knockout to actually appear.`,
    `<b>Wildcard risk:</b> there's a <span class="pill">${pctStr(pUpset)}</span> chance at least one
       favourite is knocked out in the R32 by a best-third-place team, changing the matchup.`,
    `<b>Biggest spoilers to watch:</b> ${wilds || "none of note"}.`,
    `<b>Why it stays open:</b> each side is a single-elimination R32 game, and the third-place
       qualifiers aren't fixed until every group finishes.`,
  ];
  $("keyFactors").innerHTML = items.map(t => `<li>${t}</li>`).join("");
}

function renderStandings(group, elId) {
  const stand = currentStandings(group);
  const played = gamesPlayedIn(group);
  const rows = stand.map((s, i) => {
    const qualCls = i < 2 ? " qual" : "";
    return `<tr>
      <td class="${i === 0 ? "pos1" : ""}">${i + 1}</td>
      <td class="${qualCls}">${s.team}</td>
      <td>${s.p}</td><td>${s.w}-${s.d}-${s.l}</td>
      <td>${s.gf - s.ga > 0 ? "+" : ""}${s.gf - s.ga}</td>
      <td><b>${s.pts}</b></td>
    </tr>`;
  }).join("");
  $(elId).innerHTML = `
    <table>
      <thead><tr><th>#</th><th>Team</th><th>P</th><th>W-D-L</th><th>GD</th><th>Pts</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="note">${played}/6 group games played. Top 2 (highlighted) advance automatically; 3rd may advance as a wildcard.</p>`;
}

/* ---- Edit panel ---------------------------------------------------------- */
function pairings(group) {
  const t = D.GROUPS[group], out = [];
  for (let i = 0; i < t.length; i++)
    for (let j = i + 1; j < t.length; j++) out.push([t[i], t[j]]);
  return out;
}
function existingResult(group, a, b) {
  return D.RESULTS.find(r => r.group === group &&
    ((r.home === a && r.away === b) || (r.home === b && r.away === a)));
}
function buildEdit(group, elId) {
  $(elId).innerHTML = pairings(group).map(([a, b]) => {
    const r = existingResult(group, a, b);
    const ha = r ? (r.home === a ? r.hg : r.ag) : "";
    const hb = r ? (r.home === a ? r.ag : r.hg) : "";
    return `<div class="edit-game ${r ? "played" : ""}" data-g="${group}" data-a="${a}" data-b="${b}">
      <span class="tn-a">${a}</span>
      <input type="number" min="0" class="sa" value="${ha}" />
      <span>–</span>
      <input type="number" min="0" class="sb" value="${hb}" />
      <span>${b}</span>
    </div>`;
  }).join("");
}
function applyEdits() {
  document.querySelectorAll(".edit-game").forEach(row => {
    const g = row.dataset.g, a = row.dataset.a, b = row.dataset.b;
    const sa = row.querySelector(".sa").value, sb = row.querySelector(".sb").value;
    D.RESULTS = D.RESULTS.filter(r => !(r.group === g &&
      ((r.home === a && r.away === b) || (r.home === b && r.away === a))));
    if (sa !== "" && sb !== "") {
      D.RESULTS.push({ group: g, home: a, away: b, hg: +sa, ag: +sb });
    }
  });
  recompute();
}

/* ---- Run + render -------------------------------------------------------- */
function recompute() {
  const sim = window.WCsim.runSim(D, SIM_N);
  renderHeadline(sim);
  renderWhatNeeds(sim);
  renderKeyFactors(sim);
  renderSide("m85Side", sim.m85);
  renderSide("m87Side", sim.m87);
  renderStandings(D.YOUR_GROUP, "groupKTable");
  renderStandings(D.OPPONENT_GROUP, "groupBTable");
  buildEdit(D.YOUR_GROUP, "editK");
  buildEdit(D.OPPONENT_GROUP, "editB");
}

async function loadLive() {
  $("dataSource").textContent = "fetching live…";
  $("dataSource").className = "chip";
  const live = await window.WCapi.fetchLiveResults(D.GROUPS);
  if (live) {
    D.RESULTS = window.WCapi.mergeResults(D.RESULTS, live);
    $("dataSource").textContent = "● live data";
    $("dataSource").className = "chip live";
  } else {
    $("dataSource").textContent = "seed / manual data";
    $("dataSource").className = "chip seed";
  }
  $("lastUpdated").textContent = "updated " + new Date().toLocaleTimeString();
  recompute();
}

/* ---- Boot ---------------------------------------------------------------- */
$("refreshBtn").addEventListener("click", loadLive);
$("applyEdits").addEventListener("click", applyEdits);
$("editBtn").addEventListener("click", () => $("editPanel").classList.toggle("hidden"));

recompute();   // instant render from seed
loadLive();    // then pull live data
