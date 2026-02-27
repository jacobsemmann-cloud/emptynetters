console.log("App version 8.1.8 - Ultra Condensed Engine");

var GOOGLE_URL = "https://script.google.com/macros/s/AKfycbyiUE8SnfMzVvqxlqeeoyaWXRyF2bDqEEdqBJ4FMIiMlhyCozsEGAowpwe6iiO-KJxN/exec";
var STANDINGS_API = "https://api.allorigins.win/raw?url=" + encodeURIComponent("https://api-web.nhle.com/v1/standings/now");
var SCHEDULE_API = "https://api.allorigins.win/raw?url=" + encodeURIComponent("https://api-web.nhle.com/v1/schedule/now");

var container = document.getElementById('app');
var dataCache = { standings: null, matchups: null, raw: {} };
var standings = {};
var currentData = null;
var sortDir = 1;

var displayNames = {
    "RawData": "Player ENG Stats",
    "VS Empty": "Team Stats vs Empty Net",
    "Net Empty": "Team Stats with Net Empty"
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
    container.innerHTML = "<h2>...</h2>";
    try {
        const [standingResult, dashboardRes] = await Promise.all([
            fetchStandings(),
            fetch(GOOGLE_URL + "?action=dashboard")
        ]);

        var data = await dashboardRes.json();
        var now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        var html = '<div class="header-section"><h1>EMPTYNETTERS</h1><span class="sync-time">🟢 ' + now + '</span>';
        html += ' <button onclick="refreshApp()" style="background:none; border:none; color:var(--accent-color); cursor:pointer; font-size:0.55rem;">[R]</button></div>';
        
        html += '<div class="global-actions">';
        html += '<button class="raw-btn" onclick="loadMatchups()">Matchups</button>';
        html += '<button class="raw-btn" onclick="loadRawData(\'RawData\')">Players</button>';
        html += '<button class="raw-btn" onclick="loadRawData(\'VS Empty\')">Vs EN</button>';
        html += '<button class="raw-btn" onclick="loadRawData(\'Net Empty\')">With EN</button>';
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
    } catch (e) { container.innerHTML = "<h1>Error</h1>"; }
}

async function loadMatchups() {
    container.innerHTML = "<h2>Analyzing...</h2>";
    try {
        const [schedRes, vsEmptyRes, rawDataRes] = await Promise.all([
            fetch(SCHEDULE_API),
            fetch(GOOGLE_URL + "?action=raw&name=VS Empty"),
            fetch(GOOGLE_URL + "?action=raw&name=RawData")
        ]);
        const sched = await schedRes.json();
        const vs = await vsEmptyRes.json();
        const raw = await rawDataRes.json();
        renderMatchupsUI(sched, vs, raw);
    } catch (e) { loadDashboard(); }
}

function renderMatchupsUI(schedData, vsEmpty, rawPlayers) {
    var html = '<div class="roster-header"><h1>Matchups</h1><button class="back-btn" onclick="loadDashboard()">Back</button></div>';
    schedData.gameWeek.forEach(day => {
        if (day.games.length === 0) return;
        html += '<h3 style="margin: 5px 0; border-bottom: 1px solid #333; font-size: 0.7rem;">' + day.date + '</h3>';
        day.games.forEach(game => {
            html += '<div style="padding: 4px; border-bottom: 1px solid #222; font-size: 0.75rem; display: flex; justify-content: space-between;">';
            html += '<span><b>' + game.awayTeam.abbrev + '</b> @ <b>' + game.homeTeam.abbrev + '</b></span>';
            html += '<span style="color:var(--accent-color);">' + new Date(game.startTimeUTC).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + '</span>';
            html += '</div>';
        });
    });
    container.innerHTML = html;
}

async function loadTeamData(teamName) {
    container.innerHTML = "<h2>Loading...</h2>";
    try {
        var res = await fetch(GOOGLE_URL + "?action=team&name=" + teamName);
        var raw = await res.json();
        var headers = raw.headers.slice(2), rows = raw.rows.map(r => r.slice(2));
        currentData = { type: 'team', team: teamName, headers: headers, rows: rows };
        renderTable();
    } catch (e) { loadDashboard(); }
}

async function loadRawData(sheetName) {
    container.innerHTML = "<h2>Loading...</h2>";
    try {
        var res = await fetch(GOOGLE_URL + "?action=raw&name=" + encodeURIComponent(sheetName));
        var raw = await res.json();
        currentData = { type: 'raw', displayName: displayNames[sheetName], headers: raw.headers, rows: raw.rows };
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