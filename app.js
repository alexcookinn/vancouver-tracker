/* ============================================================================
 * app.js — wires data + sim + live API into the page.
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
  $("headlinePct").textContent = pctStr(sim.pYourTeamReachesVancouver);
  $("simN").textContent = sim.N.toLocaleString();
}

function renderScenario(sim) {
  const stand = currentStandings(D.YOUR_GROUP);
  const me = stand.find(s => s.team === D.YOUR_TEAM);
  const pos = stand.indexOf(me) + 1;
  const played = me.p;
  const total = 3; // each team plays 3 group games

  // Biggest rival in group by Elo (excluding Portugal)
  const rival = D.GROUPS[D.YOUR_GROUP]
    .filter(t => t !== D.YOUR_TEAM)
    .sort((a, b) => D.TEAMS[b] - D.TEAMS[a])[0];

  const winGroup = pctStr(sim.pYourTeamWinsGroup);
  const winR32 = pctStr(sim.pYourTeamWinsR32GivenGroup);
  const net = pctStr(sim.pYourTeamReachesVancouver);

  $("scenarioList").innerHTML = `
    <li><b>Finish 1st in Group K</b> — currently <span class="pill">${winGroup}</span> likely.
        <span class="muted">2nd place isn't enough: the runner-up is routed to Toronto → Dallas, away from your game.</span></li>
    <li><b>Win the Round of 32 game</b> in Kansas City (Jul 3) vs a third-place qualifier —
        <span class="pill">${winR32}</span> likely <i>if</i> they top the group.</li>
    <li><b>→ Net result:</b> <span class="pill">${net}</span> chance Portugal is in your Vancouver seat.</li>
  `;

  $("scenarioNote").innerHTML =
    `Right now Portugal sit <b>${ordinal(pos)}</b> in Group K with <b>${me.pts} pt${me.pts === 1 ? "" : "s"}</b> ` +
    `after ${played}/${total} games. Their toughest group rival is <b>${rival}</b> ` +
    `(Elo ${D.TEAMS[rival]} vs Portugal ${D.TEAMS[D.YOUR_TEAM]}).`;
}

function renderSide(elId, rows, highlightTeam) {
  const max = Math.max(0.01, ...rows.map(r => r.pReachVancouver));
  $(elId).innerHTML = rows.map(r => {
    const you = r.team === highlightTeam ? " you" : "";
    const w = Math.round((r.pReachVancouver / max) * 100);
    return `
      <div class="prob-row${you}">
        <div class="fill" style="width:${w}%"></div>
        <div class="row-inner">
          <div><span class="team">${r.team}</span>
               <span class="sub">· wins group ${pctStr(r.pWinGroup)}</span></div>
          <div class="pct">${pctStr(r.pReachVancouver)}</div>
        </div>
      </div>`;
  }).join("");
}

function renderSpoilers(sim) {
  if (!sim.spoilers.length) { $("spoilerNote").textContent = ""; return; }
  const list = sim.spoilers.slice(0, 5)
    .map(s => `${s.team} ${pctStr(s.pReachVancouver)}`).join(" · ");
  $("spoilerNote").innerHTML =
    `<b>Wildcard:</b> a best-third-place team can knock out a group winner in the Round of 32 ` +
    `and take a Vancouver slot instead — most likely: ${list}.`;
}

function renderStandings(group, elId) {
  const stand = currentStandings(group);
  const played = gamesPlayedIn(group);
  const rows = stand.map((s, i) => {
    const youCls = s.team === D.YOUR_TEAM ? " you" : "";
    const qualCls = i < 2 ? " qual" : "";
    return `<tr class="${youCls}">
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
  $(elId).innerHTML = pairings(group).map(([a, b], i) => {
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
  // Remove existing manual results for K & B, then read inputs.
  document.querySelectorAll(".edit-game").forEach(row => {
    const g = row.dataset.g, a = row.dataset.a, b = row.dataset.b;
    const sa = row.querySelector(".sa").value, sb = row.querySelector(".sb").value;
    // drop any existing
    D.RESULTS = D.RESULTS.filter(r => !(r.group === g &&
      ((r.home === a && r.away === b) || (r.home === b && r.away === a))));
    if (sa !== "" && sb !== "") {
      D.RESULTS.push({ group: g, home: a, away: b, hg: +sa, ag: +sb });
    }
  });
  recompute();
}

/* ---- Helpers ------------------------------------------------------------- */
function ordinal(n) { return ["", "1st", "2nd", "3rd", "4th"][n] || n + "th"; }

/* ---- Run + render -------------------------------------------------------- */
function recompute() {
  const sim = window.WCsim.runSim(D, SIM_N);
  renderHeadline(sim);
  renderScenario(sim);
  renderSide("yourSide", sim.yourSide, D.YOUR_TEAM);
  renderSide("opponentSide", sim.opponentSide, null);
  renderSpoilers(sim);
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
