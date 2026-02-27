// Version 2.3 - Clean Slate
console.log("App starting...");

var GOOGLE_URL = "https://script.google.com/macros/s/AKfycbyiUE8SnfMzVvqxlqeeoyaWXRyF2bDqEEdqBJ4FMIiMlhyCozsEGAowpwe6iiO-KJxN/exec";
var STANDINGS_API = "https://api-web.nhle.com/v1/standings/now";
var container = document.getElementById('app');

var NHL_TEAMS = ['ANA', 'BOS', 'BUF', 'CAR', 'CBJ', 'CGY', 'CHI', 'COL', 'DAL', 'DET', 'EDM', 'FLA', 'LAK', 'MIN', 'MTL', 'NJD', 'NSH', 'NYI', 'NYR', 'OTT', 'PHI', 'PIT', 'SEA', 'SJS', 'STL', 'TBL', 'TOR', 'UTA', 'VAN', 'VGK', 'WSH', 'WPG'];

var standings = {};
var currentData = null;
var sortDir = 1;

async function fetchStandings() {
    try {
        var res = await fetch(STANDINGS_API);
        var data = await res.json();
        data.standings.forEach(function(s) {
            standings[s.teamAbbrev.default] = {
                rec: s.wins + "-" + s.losses + "-" + s.otLosses,
                streak: s.l10Record ? s.l10Record.split('').slice(0, 5) : []
            };
        });
    } catch (e) { console.error("Standings error", e); }
}

async function loadDashboard() {
    container.innerHTML = "<h2>Loading League Stats...</h2>";
    await fetchStandings();
    try {
        var res = await fetch(GOOGLE_URL + "?action=dashboard");
        var data = await res.json();
        var filtered = data.filter(function(item) {
            return NHL_TEAMS.indexOf(item.team) !== -1;
        }).sort(function(a, b) {
            return a.team.localeCompare(b.team);
        });

        var html = '<h1>NHL Dashboard</h1><div class="team-grid">';
        filtered.forEach(function(item) {
            var s = standings[item.team] || { rec: '0-0-0' };
            html += '<div class="card" onclick="loadTeamData(\'' + item.team + '\')">';
            html += '<img src="https://assets.nhle.com/logos/nhl/svg/' + item.team + '_light.svg" class="team-logo">';
            html += '<div style="font-weight:bold; margin:5px 0;">' + item.team + '</div>';
            html += '<div class="record-badge">' + s.rec + '</div>';
            html += '</div>';
        });
        html += '</div>';
        container.innerHTML = html;
    } catch (e) { container.innerHTML = "<h1>API Error</h1>"; }
}

async function loadTeamData(teamName) {
    container.innerHTML = "<h2>Loading " + teamName + "...</h2>";
    window.scrollTo(0,0);
    try {
        var res = await fetch(GOOGLE_URL + "?action=team&name=" + teamName);
        var raw = await res.json();
        var heads = raw.headers.map(function(h) { return h.toString().trim().toLowerCase(); });
        var playerIdx = heads.indexOf("player");
        var winIdx = heads.indexOf("faceoffs won");
        var lossIdx = heads.indexOf("faceoffs lost");

        var teamWon = 0, teamLost = 0;
        raw.rows.forEach(function(row) {
            teamWon += Number(row[winIdx]) || 0;
            teamLost += Number(row[lossIdx]) || 0;
        });
        var teamFO = teamTotal > 0 ? ((teamWon / (teamWon + teamLost)) * 100).toFixed(1) + "%" : "0.0%";

        var start = playerIdx === -1 ? 0 : playerIdx;
        currentData = {
            team: teamName,
            headers: raw.headers.slice(start),
            rows: raw.rows.map(function(r) { return r.slice(start); }),
            teamFO: teamFO
        };
        renderTable();
    } catch (e) { container.innerHTML = "<h1>Error</h1>"; }
}

function renderTable() {
    var s = standings[currentData.team] || { rec: '0-0-0', streak: [] };
    var html = '<div class="roster-header"><button onclick="loadDashboard()">Back</button><div>';
    html += '<h1>' + currentData.team + '</h1><p>' + s.rec + ' | Team FO: ' + currentData.teamFO + '</p></div></div>';
    html += '<div class="table-wrapper"><table><thead><tr>';
    currentData.headers.forEach(function(h, i) {
        html += '<th onclick="sortTable(' + i + ')">' + h + '</th>';
    });
    html += '</tr></thead><tbody>';
    currentData.rows.forEach(function(row) {
        html += '<tr>';
        row.forEach(function(cell) {