console.log("App v8.2.5 - Proxy Fallback + Fail-Safe Engine");

var GOOGLE_URL = "https://script.google.com/macros/s/AKfycbyiUE8SnfMzVvqxlqeeoyaWXRyF2bDqEEdqBJ4FMIiMlhyCozsEGAowpwe6iiO-KJxN/exec";

// PRIMARY PROXY
var P1 = "https://api.allorigins.win/raw?url=";
// BACKUP PROXY (CORSProxy.io)
var P2 = "https://corsproxy.io/?";

var NHL_STANDINGS = "https://api-web.nhle.com/v1/standings/now";
var NHL_SCHEDULE = "https://api-web.nhle.com/v1/schedule/now";

var container = document.getElementById('app');

var cache = {
    standings: {},
    schedule: null,
    dashboardTeams: null,
    sheets: {},
    teams: {}
};

var currentFilter = 'all';
var sortDir = 1;
const MAP = { "UTAH": "UTA", "UTM": "UTA", "LA": "LAK", "SJ": "SJS", "TB": "TBL", "NJ": "NJD" };

/**
 * PROXY FETCHER: Tries Primary, then Backup
 */
async function smartFetch(url) {
    try {
        // Try Proxy 1
        let res = await fetch(P1 + encodeURIComponent(url));
        if (res.ok) return await res.json();
    } catch (e) {
        console.warn("Proxy 1 Failed, trying Proxy 2...");
        try {
            // Try Proxy 2
            let res = await fetch(P2 + encodeURIComponent(url));
            if (res.ok) return await res.json();
        } catch (e2) {
            console.error("All Proxies Failed.");
            return null;
        }
    }
}

async function init() {
    // Only fetch if cache is empty
    if (Object.keys(cache.standings).length === 0) {
        const [stdData, schData] = await Promise.all([
            smartFetch(NHL_STANDINGS),
            smartFetch(NHL_SCHEDULE)
        ]);

        if (stdData && stdData.standings) {
            stdData.standings.forEach(s => {
                let code = (s.teamAbbrev && s.teamAbbrev.default) ? s.teamAbbrev.default : s.teamAbbrev;
                cache.standings[code.toUpperCase()] = {
                    rec: (s.wins || 0) + "-" + (s.losses || 0) + "-" + (s.otLosses || 0),
                    pts: s.points, gp: s.gamesPlayed, div: s.divisionName, rank: s.divisionSequence,
                    fullName: s.teamName.default
                };
            });
        }
        cache.schedule = schData;
    }
}

function setFilter(type) {
    currentFilter = type;
    loadDashboard();
}

async function loadDashboard() {
    container.innerHTML = "<h2>Syncing...</h2>";
    await init();
    
    try {
        if (!cache.dashboardTeams) {
            let res = await fetch(GOOGLE_URL + "?action=dashboard");
            cache.dashboardTeams = await res.json();
        }

        let now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        let html = `<div class="header-section"><h1>EMPTYNETTERS</h1><span style="font-size:0.8rem;color:#8b949e">${now}</span></div>`;
        
        html += `<div class="global-actions">
            <button class="raw-btn" onclick="loadMatchups()">DAILY MATCHUPS</button>
            <button class="raw-btn" onclick="loadRawData('RawData')">PLAYER STATS</button>
            <button class="raw-btn" onclick="loadRawData('VS Empty')">VS EN</button>
            <button class="raw-btn" onclick="loadRawData('Net Empty')">WITH EN</button>
        </div>`;

        html += `<div class="filter-bar">
            <button class="filter-btn ${currentFilter === 'all' ? 'active' : ''}" onclick="setFilter('all')">All Teams</button>
            <button class="filter-btn ${currentFilter === 'today' ? 'active' : ''}" onclick="setFilter('today')">Playing Today</button>
            <button class="filter-btn ${currentFilter === 'tomorrow' ? 'active' : ''}" onclick="setFilter('tomorrow')">Playing Tomorrow</button>
        </div>`;

        let playingToday = [], playingTomorrow = [];
        if (cache.schedule && cache.schedule.gameWeek) {
            cache.schedule.gameWeek[0]?.games.forEach(g => playingToday.push(g.awayTeam.abbrev, g.homeTeam.abbrev));
            cache.schedule.gameWeek[1]?.games.forEach(g => playingTomorrow.push(g.awayTeam.abbrev, g.homeTeam.abbrev));
        }

        let divs = { "Atlantic": [], "Metropolitan": [], "Central": [], "Pacific": [] };
        cache.dashboardTeams.forEach(t => {
            let code = (MAP[t.team.trim().toUpperCase()] || t.team.trim().toUpperCase());
            if (currentFilter === 'today' && !playingToday.includes(code)) return;
            if (currentFilter === 'tomorrow' && !playingTomorrow.includes(code)) return;

            let s = cache.standings[code] || { rec: "-", pts: "-", gp: "-", div: "Other", rank: 99, fullName: code };
            let d = s.div;
            if (code === "UTA") d = "Central";
            if (["FLA","TBL","TOR","BOS","DET","BUF","OTT","MTL"].includes(code)) d = "Atlantic";
            if (["CAR","NJD","NYR","WSH","NYI","PIT","PHI","CBJ"].includes(code)) d = "Metropolitan";
            if (["WPG","MIN","DAL","COL","NSH","STL","CHI","UTA"].includes(code)) d = "Central";
            if (["VAN","VGK","LAK","EDM","SEA","CGY","ANA","SJS"].includes(code)) d = "Pacific";
            if (divs[d]) divs[d].push({ code: code, s: s });
        });

        ["Atlantic", "Metropolitan", "Central", "Pacific"].forEach(dName => {
            if (divs[dName].length === 0) return;
            divs[dName].sort((a,b) => a.s.rank - b.s.rank);
            html += `<div class="div-label">${dName}</div><table class="s-table"><thead><tr><th style="width:30px">#</th><th>TEAM</th><th class="st-cell">GP</th><th class="st-cell">RECORD</th><th class="p-cell">PTS</th></tr></thead><tbody>`;
            divs[dName].forEach(team => {
                html += `<tr onclick="loadTeamData('${team.code}')">
                    <td style="color:#8b949e; text-align:center">${team.s.rank === 99 ? "-" : team.s.rank}</td>
                    <td><div class="t-cell"><img src="https://assets.nhle.com/logos/nhl/svg/${team.code}_light.svg" class="t-logo">${team.s.fullName || team.code}</div></td>
                    <td class="st-cell">${team.s.gp}</td><td class="st-cell">${team.s.rec}</td><td class="p-cell">${team.s.pts}</td>
                </tr>`;
            });
            html += `</tbody></table>`;
        });
        container.innerHTML = html;
    } catch (e) { container.innerHTML = "<h1>Dashboard Sync Error</h1>"; }
}

async function loadMatchups() {
    container.innerHTML = "<h2>Analyzing...</h2>";
    window.scrollTo(0,0);
    try {
        if (!cache.sheets["VS Empty"] || !cache.sheets["RawData"]) {
            const [vsRes, rawRes] = await Promise.all([
                fetch(GOOGLE_URL + "?action=raw&name=VS Empty").then(r => r.json()),
                fetch(GOOGLE_URL + "?action=raw&name=RawData").then(r => r.json())
            ]);
            cache.sheets["VS Empty"] = vsRes; cache.sheets["RawData"] = rawRes;
        }
        let vsEmpty = cache.sheets["VS Empty"], rawPlayers = cache.sheets["RawData"];
        let teamVuln = {};
        vsEmpty.rows.forEach(row => {
            let team = row[vsEmpty.headers.indexOf("Team")], ga = parseFloat(row[vsEmpty.headers.indexOf("GA")]) || 0;
            let toiStr = row[vsEmpty.headers.indexOf("TOI")] || "0:00", p = toiStr.split(":");
            let mins = (parseInt(p[0]) || 0) + (parseInt(p[1]) / 60 || 0);
            teamVuln[team] = mins > 0 ? (ga / mins) : 0;
        });
        let playerENG = {};
        rawPlayers.rows.forEach(row => {
            let team = row[rawPlayers.headers.indexOf("Team")];
            if (!playerENG[team]) playerENG[team] = [];
            let g = parseFloat(row[rawPlayers.headers.indexOf("G")]) || 0, t = parseFloat(row[rawPlayers.headers.indexOf("TOI")]) || 0, f = parseFloat(row[rawPlayers.headers.indexOf("Team FO%")]) || 0;
            playerENG[team].push({ name: row[rawPlayers.headers.indexOf("Player")], score: (g * 5) + (t * 1.5) + (f / 10) });
        });

        let html = '<div class="header-section"><h1></h1><button class="back-btn" onclick="loadDashboard()">BACK</button></div>';
        if (cache.schedule && cache.schedule.gameWeek) {
            cache.schedule.gameWeek.forEach(day => {
                if (day.games.length > 0) {
                    html += `<h3 style="margin-top: 30px; border-bottom: 1px solid var(--brd); padding-bottom: 5px;">${day.date}</h3><div class="matchup-grid">`;
                    day.games.forEach(game => {
                        let away = game.awayTeam.abbrev, home = game.homeTeam.abbrev;
                        let time = new Date(game.startTimeUTC).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        let aC = (playerENG[away] || []).sort((a,b) => b.score - a.score)[0], hC = (playerENG[home] || []).sort((a,b) => b.score - a.score)[0];
                        let aT = teamVuln[away] || 0, hT = teamVuln[home] || 0;
                        html += `<div class="m-card"><div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;"><span><img src="https://assets.nhle.com/logos/nhl/svg/${away}_light.svg" style="width:25px;"> <b>${away}</b></span><span style="color:var(--acc); font-size:0.8rem;">${time}</span><span><b>${home}</b> <img src="https://assets.nhle.com/logos/nhl/svg/${home}_light.svg" style="width:25px;"></span></div><div style="background: rgba(88, 166, 255, 0.05); border: 1px dashed var(--acc); border-radius: 4px; padding: 10px; font-size: 0.9rem;"><div style="color: var(--acc); font-weight: bold; margin-bottom:5px;">🎯 PROJECTED CLOSER:</div>`;
                        if (hT > aT && aC) { html += `<b>${aC.name}</b> (${away})`; } 
                        else if (hC) { html += `<b>${hC.name}</b> (${home})`; } 
                        else { html += 'Calculating...'; }
                        html += `</div></div>`;
                    });
                    html += `</div>`;
                }
            });
        }
        container.innerHTML = html;
    } catch (e) { loadDashboard(); }
}

async function loadRawData(name) {
    if (cache.sheets[name]) { renderTable({ name: name, headers: cache.sheets[name].headers, rows: cache.sheets[name].rows }); return; }
    container.innerHTML = "<h2>Fetching...</h2>";
    try {
        let res = await fetch(GOOGLE_URL + "?action=raw&name=" + encodeURIComponent(name)).then(r => r.json());
        cache.sheets[name] = res; renderTable({ name: name, headers: res.headers, rows: res.rows });
    } catch (e) { loadDashboard(); }
}

async function loadTeamData(team) {
    if (cache.teams[team]) { renderTable(cache.teams[team]); return; }
    container.innerHTML = `<h2>Loading ${team}...</h2>`;
    try {
        let res = await fetch(GOOGLE_URL + "?action=team&name=" + team).then(r => r.json());
        let data = { type: 'team', team: team, headers: res.headers.slice(2), rows: res.rows.map(r => r.slice(2)) };
        cache.teams[team] = data; renderTable(data);
    } catch (e) { loadDashboard(); }
}

function renderTable(data) {
    let title = data.team || (data.name === "RawData" ? "" : data.name);
    currentData = data;
    let html = `<div class="header-section"><h1>${title}</h1><button class="back-btn" onclick="loadDashboard()">BACK</button></div>`;
    html += '<div class="table-wrapper"><table><thead><tr>';
    data.headers.forEach((h, i) => { html += `<th onclick="sortTable(${i})">${h}</th>`; });
    html += '</tr></thead><tbody>';
    data.rows.forEach(row => { html += '<tr>' + row.map(c => `<td>${c}</td>`).join('') + '</tr>'; });
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

function sortTable(idx) {
    sortDir *= -1;
    currentData.rows.sort((a, b) => {
        let nA = parseFloat(a[idx].toString().replace(/[%$,]/g, '')), nB = parseFloat(b[idx].toString().replace(/[%$,]/g, ''));
        return (!isNaN(nA) && !isNaN(nB)) ? (nA - nB) * sortDir : a[idx].toString().localeCompare(b[idx].toString()) * sortDir;
    });
    renderTable(currentData);
}

loadDashboard();