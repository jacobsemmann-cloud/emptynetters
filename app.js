console.log("App version 8.1.7 - Parallel Engine + Condensed View");

var GOOGLE_URL = "https://script.google.com/macros/s/AKfycbyiUE8SnfMzVvqxlqeeoyaWXRyF2bDqEEdqBJ4FMIiMlhyCozsEGAowpwe6iiO-KJxN/exec";
var STANDINGS_API = "https://api.allorigins.win/raw?url=" + encodeURIComponent("https://api-web.nhle.com/v1/standings/now");
var SCHEDULE_API = "https://api.allorigins.win/raw?url=" + encodeURIComponent("https://api-web.nhle.com/v1/schedule/now");

var container = document.getElementById('app');
var dataCache = { standings: null, matchups: null, raw: {} };
var standings = {};
var sortDir = 1;

var displayNames = {
    "RawData": "Player Stats",
    "VS Empty": "Vs Empty Net",
    "Net Empty": "With Net Empty"
};

function refreshApp() {
    dataCache = { standings: null, matchups: null, raw: {} };
    loadDashboard();
}

async function fetchStandings() {
    if (dataCache.standings) return dataCache.standings;
    try {
        var res = await fetch(STANDINGS_API);
        var data = await res.json();
        if (data && data.standings) {
            data.standings.forEach(function(s) {
                var abbrev = (s.teamAbbrev && s.teamAbbrev.default) ? s.teamAbbrev.default : s.teamAbbrev;
                if (abbrev) { 
                    standings[abbrev] = { 
                        rec: (s.wins || 0) + "-" + (s.losses || 0) + "-" + (s.otLosses || 0),
                        gp: s.gamesPlayed,
                        pts: s.points,
                        div: s.divisionName,
                        rank: s.divisionSequence
                    }; 
                }
            });
            dataCache.standings = standings;
            return standings;
        }
    } catch (e) { console.error("Standings error", e); }
}

async function loadDashboard() {
    container.innerHTML = "<h2>Syncing...</h2>";
    
    try {
        const [standingResult, dashboardRes] = await Promise.all([
            fetchStandings(),
            fetch(GOOGLE_URL + "?action=dashboard")
        ]);

        var data = await dashboardRes.json();
        var now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        var html = '<div class="header-section"><h1>EMPTYNETTERS</h1><span class="sync-time">🟢 Live • ' + now + '</span>';
        html += ' <button onclick="refreshApp()" style="background:none; border:none; color:var(--accent-color); cursor:pointer; font-size:0.6rem;">[Refresh]</button></div>';
        
        // ALL 4 BUTTONS RESTORED
        html += '<div class="global-actions">';
        html += '<button class="raw-btn" onclick="loadMatchups()">Matchups</button>';
        html += '<button class="raw-btn" onclick="loadRawData(\'RawData\')">Player Stats</button>';
        html += '<button class="raw-btn" onclick="loadRawData(\'VS Empty\')">Vs Empty</button>';
        html += '<button class="raw-btn" onclick="loadRawData(\'Net Empty\')">With Empty</button>';
        html += '</div>';

        var divisions = {};
        data.forEach(function(item) {
            var s = standings[item.team] || { rec: '0-0-0', div: 'Other', pts: 0, rank: '-', gp: 0 };
            if (!divisions[s.div]) divisions[s.div] = [];
            divisions[s.div].push({ team: item.team, s: s });
        });

        ["Atlantic", "Metropolitan", "Central", "Pacific"].forEach(divName => {
            if (!divisions[divName]) return;
            divisions[divName].sort((a,b) => a.s.rank - b.s.rank);

            html += '<div class="division-header">' + divName + '</div>';
            html += '<table class="standings-table"><thead><tr><th class="rank-cell">#</th><th>Team</th><th class="stat-cell">GP</th><th class="stat-cell">Record</th><th class="stat-cell">PTS</th></tr></thead><tbody>';
            
            divisions[divName].forEach(obj => {
                html += '<tr onclick="loadTeamData(\'' + obj.team + '\')">';
                html += '<td class="rank-cell">' + obj.s.rank + '</td>';
                html += '<td><div class="team-cell"><img src="https://assets.nhle.com/logos/nhl/svg/' + obj.team + '_light.svg" class="team-logo-small">' + obj.team + '</div></td>';
                html += '<td class="stat-cell">' + obj.s.gp + '</td>';
                html += '<td class="stat-cell" style="font-family:monospace;">' + obj.s.rec + '</td>';
                html += '<td class="stat-cell pts-cell">' + obj.s.pts + '</td>';
                html += '</tr>';
            });
            html += '</tbody></table>';
        });

        container.innerHTML = html;
    } catch (e) { container.innerHTML = "<h1>API Error</h1>"; }
}

async function loadMatchups() {
    if (dataCache.matchups) {
        renderMatchupsUI(dataCache.matchups.sched, dataCache.matchups.vs, dataCache.matchups.raw);
    } else {
        container.innerHTML = "<h2>Analyzing...</h2>";
    }
    window.scrollTo(0,0);
    
    try {
        const [schedRes, vsEmptyRes, rawDataRes] = await Promise.all([
            fetch(SCHEDULE_API),
            fetch(GOOGLE_URL + "?action=raw&name=VS Empty"),
            fetch(GOOGLE_URL + "?action=raw&name=RawData")
        ]);

        const sched = await schedRes.json();
        const vs = await vsEmptyRes.json();
        const raw = await rawDataRes.json();
        dataCache.matchups = { sched, vs, raw };
        renderMatchupsUI(sched, vs, raw);
    } catch (e) { loadDashboard(); }
}

function renderMatchupsUI(schedData, vsEmpty, rawPlayers) {
    var teamVuln = {};
    var vsHeaders = vsEmpty.headers;
    var tIdx = vsHeaders.indexOf("Team"), gaIdx = vsHeaders.indexOf("GA");
    vsEmpty.rows.forEach(row => { teamVuln[row[tIdx]] = parseFloat(row[gaIdx]) || 0; });

    var playerPool = {};
    var anchors = {};
    var pHeaders = rawPlayers.headers;
    var nameIdx = pHeaders.indexOf("Player"), teamIdx = pHeaders.indexOf("Team"), gIdx = pHeaders.indexOf("G"), 
        foIdx = pHeaders.indexOf("FO_eng"), toiIdx = pHeaders.indexOf("TOI"), pkIdx = pHeaders.indexOf("PK_Status");

    rawPlayers.rows.forEach(row => {
        var t = row[teamIdx];
        if (!playerPool[t]) playerPool[t] = [];
        var p = { name: row[nameIdx], g: parseFloat(row[gIdx]) || 0, fo: parseFloat(row[foIdx]) || 0, toi: parseFloat(row[toiIdx]) || 0, isPk: row[pkIdx] === "TRUE" };
        playerPool[t].push(p);
        if (!anchors[t] || p.fo > anchors[t].fo) anchors[t] = { name: p.name, fo: p.fo };
    });

    var html = '<div class="roster-header"><h1>Matchups</h1><button class="back-btn" onclick="loadDashboard()">Back</button></div>';

    schedData.gameWeek.forEach(day => {
        if (day.games.length === 0) return;
        html += '<h3 style="margin: 10px 0; border-bottom: 1px solid #333; font-size: 0.9rem;">' + day.date + '</h3>';
        html += '<div class="matchup-grid">';

        day.games.forEach(game => {
            var teams = [game.awayTeam.abbrev, game.homeTeam.abbrev];
            html += '<div class="unit-card">';
            html += '<div style="text-align:center; font-size:0.65rem; color:#888; margin-bottom:5px;">' + teams[0] + ' @ ' + teams[1] + '</div>';

            teams.forEach(team => {
                var opp = (team === teams[0]) ? teams[1] : teams[0];
                var oppAllowed = teamVuln[opp] || 0;
                var anchor = anchors[team] ? anchors[team].name : "";

                var scored = (playerPool[team] || []).map(p => {
                    var synergy = (p.name === anchor) ? 5 : 0;
                    var score = (p.g * 15) + (p.fo * 5) + synergy + (oppAllowed * 2);
                    return { ...p, score };
                }).sort((a,b) => b.score - a.score);

                if (scored.length > 0) {
                    var c1 = scored[0], c2 = scored[1] || {name: "N/A", score: 0};
                    var sleeper = scored.find(p => p.isPk && p.name !== c1.name && p.name !== c2.name) || scored[2] || {name: "N/A"};

                    html += '<div style="display:flex; justify-content:space-between; align-items:center;"><span class="unit-team">' + team + '</span><span class="rating-badge">' + (c1.score/15).toFixed(1) + '</span></div>';
                    html += '<div style="font-size: 0.85rem;">🎯 <b>' + c1.name + '</b></div>';
                    html += '<div style="font-size: 0.8rem; color: #8b949e;">🥈 ' + c2.name + '</div>';
                    html += '<div class="sleeper-tag">🛡️ SLEEPER: ' + sleeper.name + '</div>';
                    if (team === teams[0]) html += '<div style="margin: 8px 0; border-top: 1px dashed #444;"></div>';
                }
            });
            html += '</div>';
        });
        html += '</div>';
    });
    container.innerHTML = html;
}

async function loadTeamData(teamName) {
    container.innerHTML = "<h2>Loading " + teamName + "...</h2>";
    try {
        var res = await fetch(GOOGLE_URL + "?action=team&name=" + teamName);
        var raw = await res.json();
        var headers = raw.headers.slice(2), rows = raw.rows.map(r => r.slice(2));
        currentData = { type: 'team', team: teamName, headers: headers, rows: rows };
        renderTable();
    } catch (e) { loadDashboard(); }
}

async function loadRawData(sheetName) {
    if (dataCache.raw[sheetName]) { currentData = dataCache.raw[sheetName]; renderTable(); return; }
    container.innerHTML = "<h2>Loading...</h2>";
    try {
        var res = await fetch(GOOGLE_URL + "?action=raw&name=" + encodeURIComponent(sheetName));
        var raw = await res.json();
        currentData = { type: 'raw', displayName: displayNames[sheetName], headers: raw.headers, rows: raw.rows };
        dataCache.raw[sheetName] = currentData;
        renderTable();
    } catch (e) { loadDashboard(); }
}

function renderTable() {
    var html = '<div class="roster-header"><h1>' + (currentData.type === 'team' ? currentData.team : currentData.displayName) + '</h1>';
    html += '<button class="back-btn" onclick="loadDashboard()">Back</button></div>';
    html += '<div class="table-wrapper"><table><thead><tr>';
    currentData.headers.forEach((h, i) => { html += '<th onclick="sortTable(' + i + ')">' + h + ' ↕</th>'; });
    html += '</tr></thead><tbody>';
    currentData.rows.forEach(row => { html += '<tr>' + row.map(c => '<td>' + c + '</td>').join('') + '</tr>'; });
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

function sortTable(idx) {
    sortDir *= -1;
    currentData.rows.sort((a, b) => {
        var nA = parseFloat(a[idx].toString().replace(/[%$,]/g, '')), nB = parseFloat(b[idx].toString().replace(/[%$,]/g, ''));
        return (!isNaN(nA) && !isNaN(nB)) ? (nA - nB) * sortDir : a[idx].toString().localeCompare(b[idx].toString()) * sortDir;
    });
    renderTable();
}

loadDashboard();