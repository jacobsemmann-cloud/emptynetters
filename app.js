console.log("App v8.2.4 - High-Performance Caching Engine");

var GOOGLE_URL = "https://script.google.com/macros/s/AKfycbyiUE8SnfMzVvqxlqeeoyaWXRyF2bDqEEdqBJ4FMIiMlhyCozsEGAowpwe6iiO-KJxN/exec";
var STANDINGS_API = "https://api.allorigins.win/raw?url=" + encodeURIComponent("https://api-web.nhle.com/v1/standings/now");
var SCHEDULE_API = "https://api.allorigins.win/raw?url=" + encodeURIComponent("https://api-web.nhle.com/v1/schedule/now");

var container = document.getElementById('app');

// GLOBAL CACHE - This is the secret to the speed
var cache = {
    standings: null,
    schedule: null,
    dashboardTeams: null,
    sheets: {}, // Stores RawData, VS Empty, etc.
    teams: {}   // Stores individual team rosters
};

var currentFilter = 'all';
var sortDir = 1;
const MAP = { "UTAH": "UTA", "UTM": "UTA", "LA": "LAK", "SJ": "SJS", "TB": "TBL", "NJ": "NJD" };

/**
 * INITIAL LOAD: Fetch NHL data once and keep it in memory
 */
async function init() {
    if (!cache.standings || !cache.schedule) {
        try {
            const [stdRes, schRes] = await Promise.all([
                fetch(STANDINGS_API).then(r => r.json()),
                fetch(SCHEDULE_API).then(r => r.json())
            ]);
            
            cache.standings = {};
            stdRes.standings.forEach(s => {
                var code = (s.teamAbbrev && s.teamAbbrev.default) ? s.teamAbbrev.default : s.teamAbbrev;
                cache.standings[code.toUpperCase()] = {
                    rec: (s.wins || 0) + "-" + (s.losses || 0) + "-" + (s.otLosses || 0),
                    pts: s.points, gp: s.gamesPlayed, div: s.divisionName, rank: s.divisionSequence,
                    fullName: s.teamName.default
                };
            });
            cache.schedule = schRes;
        } catch (e) { console.warn("NHL API Error", e); }
    }
}

function setFilter(type) {
    currentFilter = type;
    loadDashboard();
}

/**
 * DASHBOARD: Uses cached standings for instant re-render
 */
async function loadDashboard() {
    container.innerHTML = "<h2>Syncing...</h2>";
    await init();
    
    try {
        // Only fetch Google Dashboard list if we don't have it
        if (!cache.dashboardTeams) {
            var res = await fetch(GOOGLE_URL + "?action=dashboard");
            cache.dashboardTeams = await res.json();
        }

        var now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        var html = `<div class="header-section"><h1>EMPTYNETTERS</h1><span style="font-size:0.8rem;color:#8b949e">${now}</span></div>`;
        
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

        var playingToday = [], playingTomorrow = [];
        if (cache.schedule && cache.schedule.gameWeek) {
            cache.schedule.gameWeek[0]?.games.forEach(g => playingToday.push(g.awayTeam.abbrev, g.homeTeam.abbrev));
            cache.schedule.gameWeek[1]?.games.forEach(g => playingTomorrow.push(g.awayTeam.abbrev, g.homeTeam.abbrev));
        }

        var divs = { "Atlantic": [], "Metropolitan": [], "Central": [], "Pacific": [] };
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
    } catch (e) { container.innerHTML = "<h1>Error</h1>"; }
}

/**
 * MATCHUPS: Optimized with Parallel Data Fetching
 */
async function loadMatchups() {
    container.innerHTML = "<h2>Analyzing...</h2>";
    window.scrollTo(0,0);
    
    try {
        // Fetch only if not in cache
        if (!cache.sheets["VS Empty"] || !cache.sheets["RawData"]) {
            const [vsRes, rawRes] = await Promise.all([
                fetch(GOOGLE_URL + "?action=raw&name=VS Empty").then(r => r.json()),
                fetch(GOOGLE_URL + "?action=raw&name=RawData").then(r => r.json())
            ]);
            cache.sheets["VS Empty"] = vsRes;
            cache.sheets["RawData"] = rawRes;
        }

        var vsEmpty = cache.sheets["VS Empty"];
        var rawPlayers = cache.sheets["RawData"];
        var teamVuln = {};
        vsEmpty.rows.forEach(row => {
            var team = row[vsEmpty.headers.indexOf("Team")];
            var ga = parseFloat(row[vsEmpty.headers.indexOf("GA")]) || 0;
            var toiStr = row[vsEmpty.headers.indexOf("TOI")] || "0:00";
            var toiParts = toiStr.split(":");
            var toiMins = (parseInt(toiParts[0]) || 0) + (parseInt(toiParts[1]) / 60 || 0);
            teamVuln[team] = toiMins > 0 ? (ga / toiMins) : 0;
        });

        var playerENG = {};
        rawPlayers.rows.forEach(row => {
            var team = row[rawPlayers.headers.indexOf("Team")];
            if (!playerENG[team]) playerENG[team] = [];
            var g = parseFloat(row[rawPlayers.headers.indexOf("G")]) || 0;
            var toi = parseFloat(row[rawPlayers.headers.indexOf("TOI")]) || 0;
            var fo = parseFloat(row[rawPlayers.headers.indexOf("Team FO%")]) || 0;
            var score = (g * 5) + (toi * 1.5) + (fo / 10);
            playerENG[team].push({ name: row[rawPlayers.headers.indexOf("Player")], score: score });
        });

        // Blank header as requested
        var html = '<div class="header-section"><h1></h1><button class="back-btn" onclick="loadDashboard()">BACK</button></div>';
        if (cache.schedule && cache.schedule.gameWeek) {
            cache.schedule.gameWeek.forEach(day => {
                if (day.games.length > 0) {
                    html += `<h3 style="margin-top: 30px; border-bottom: 1px solid var(--brd); padding-bottom: 5px;">${day.date}</h3><div class="matchup-grid">`;
                    day.games.forEach(game => {
                        var away = game.awayTeam.abbrev, home = game.homeTeam.abbrev;
                        var time = new Date(game.startTimeUTC).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        var awayCloser = (playerENG[away] || []).sort((a,b) => b.score - a.score)[0];
                        var homeCloser = (playerENG[home] || []).sort((a,b) => b.score - a.score)[0];
                        var awayTrap = teamVuln[away] || 0, homeTrap = teamVuln[home] || 0;
                        html += `<div class="m-card"><div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;"><span><img src="https://assets.nhle.com/logos/nhl/svg/${away}_light.svg" style="width:25px;"> <b>${away}</b></span><span style="color:var(--acc); font-size:0.8rem;">${time}</span><span><b>${home}</b> <img src="https://assets.nhle.com/logos/nhl/svg/${home}_light.svg" style="width:25px;"></span></div><div style="background: rgba(88, 166, 255, 0.05); border: 1px dashed var(--acc); border-radius: 4px; padding: 10px; font-size: 0.9rem;"><div style="color: var(--acc); font-weight: bold; margin-bottom:5px;">🎯 PROJECTED CLOSER:</div>`;
                        if (homeTrap > awayTrap && awayCloser) { html += `<b>${awayCloser.name}</b> (${away})`; } 
                        else if (homeCloser) { html += `<b>${homeCloser.name}</b> (${home})`; } 
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

/**
 * DATA SHEETS: Instant load if cached
 */
async function loadRawData(name) {
    if (cache.sheets[name]) {
        renderTable({ name: name, headers: cache.sheets[name].headers, rows: cache.sheets[name].rows });
        return;
    }
    container.innerHTML = "<h2>Fetching...</h2>";
    try {
        var res = await fetch(GOOGLE_URL + "?action=raw&name=" + encodeURIComponent(name)).then(r => r.json());
        cache.sheets[name] = res;
        renderTable({ name: name, headers: res.headers, rows: res.rows });
    } catch (e) { loadDashboard(); }
}

async function loadTeamData(team) {
    if (cache.teams[team]) {
        renderTable(cache.teams[team]);
        return;
    }
    container.innerHTML = `<h2>Loading ${team}...</h2>`;
    try {
        var res = await fetch(GOOGLE_URL + "?action=team&name=" + team).then(r => r.json());
        var data = { type: 'team', team: team, headers: res.headers.slice(2), rows: res.rows.map(r => r.slice(2)) };
        cache.teams[team] = data;
        renderTable(data);
    } catch (e) { loadDashboard(); }
}

function renderTable(data) {
    var title = data.team || (data.name === "RawData" ? "" : data.name);
    currentData = data; // For sorting
    var html = `<div class="header-section"><h1>${title}</h1><button class="back-btn" onclick="loadDashboard()">BACK</button></div>`;
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
        var nA = parseFloat(a[idx].toString().replace(/[%$,]/g, '')), nB = parseFloat(b[idx].toString().replace(/[%$,]/g, ''));
        return (!isNaN(nA) && !isNaN(nB)) ? (nA - nB) * sortDir : a[idx].toString().localeCompare(b[idx].toString()) * sortDir;
    });
    renderTable(currentData);
}

loadDashboard();