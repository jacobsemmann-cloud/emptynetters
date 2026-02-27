console.log("App version 8.3 - Standings Row View");

var GOOGLE_URL = "https://script.google.com/macros/s/AKfycbyiUE8SnfMzVvqxlqeeoyaWXRyF2bDqEEdqBJ4FMIiMlhyCozsEGAowpwe6iiO-KJxN/exec";

// Proxies to bypass CORS
var STANDINGS_API = "https://api.allorigins.win/raw?url=" + encodeURIComponent("https://api-web.nhle.com/v1/standings/now");
var SCHEDULE_API = "https://api.allorigins.win/raw?url=" + encodeURIComponent("https://api-web.nhle.com/v1/schedule/now");

var container = document.getElementById('app');

var standings = {};
var currentData = null;
var sortDir = 1;
var lastSyncTime = "Updating...";

var displayNames = {
    "RawData": "Player ENG Stats",
    "VS Empty": "Team Stats vs Empty Net",
    "Net Empty": "Team Stats with Net Empty"
};

async function fetchStandings() {
    try {
        var res = await fetch(STANDINGS_API);
        var data = await res.json();
        if (data && data.standings) {
            data.standings.forEach(function(s) {
                var abbrev = (s.teamAbbrev && s.teamAbbrev.default) ? s.teamAbbrev.default : s.teamAbbrev;
                if (abbrev) { 
                    standings[abbrev] = { 
                        rec: (s.wins || 0) + "-" + (s.losses || 0) + "-" + (s.otLosses || 0),
                        division: s.divisionName,
                        points: s.points,
                        rank: s.divisionSequence
                    }; 
                }
            });
        }
    } catch (e) { console.error("Standings error:", e); }
}

async function loadDashboard() {
    container.innerHTML = "<h2>Loading League Standings...</h2>";
    await fetchStandings();
    
    try {
        var res = await fetch(GOOGLE_URL + "?action=dashboard");
        var data = await res.json();
        
        var now = new Date();
        lastSyncTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        var html = '<div class="header-section"><h1>EMPTYNETTERS</h1><span class="sync-time">🟢 Live • ' + lastSyncTime + '</span></div>';
        
        html += '<div class="global-actions">';
        html += '<button class="raw-btn" onclick="loadMatchups()">Daily Matchups</button>';
        html += '<button class="raw-btn" onclick="loadRawData(\'RawData\')">Player Stats</button>';
        html += '<button class="raw-btn" onclick="loadRawData(\'VS Empty\')">Vs Empty Net</button>';
        html += '<button class="raw-btn" onclick="loadRawData(\'Net Empty\')">With Net Empty</button>';
        html += '</div>';

        // Grouping
        var divisions = {};
        data.forEach(function(item) {
            var s = standings[item.team] || { rec: '0-0-0', division: 'Other', points: 0, rank: '-' };
            var divName = s.division || 'Other';
            if (!divisions[divName]) divisions[divName] = [];
            divisions[divName].push({ item: item, s: s });
        });

        // Sorting by rank
        for (var div in divisions) {
            divisions[div].sort((a, b) => a.s.rank - b.s.rank);
        }

        var divOrder = ["Atlantic", "Metropolitan", "Central", "Pacific"];
        divOrder.forEach(function(divName) {
            if (divisions[divName]) {
                html += '<div class="division-header">' + divName + '</div>';
                html += '<div class="team-list">'; // New container class for Rows
                divisions[divName].forEach(function(obj) {
                    var item = obj.item;
                    var s = obj.s;
                    html += '<div class="team-row" onclick="loadTeamData(\'' + item.team + '\')">';
                    html += '<div class="rank">' + s.rank + '</div>';
                    html += '<img src="https://assets.nhle.com/logos/nhl/svg/' + item.team + '_light.svg" class="team-logo">';
                    html += '<div class="team-info">' + item.team + '</div>';
                    html += '<div class="points">' + s.points + ' Pts</div>';
                    html += '<div class="record">' + s.rec + '</div>';
                    html += '</div>';
                });
                html += '</div>';
            }
        });
        
        container.innerHTML = html;
    } catch (e) { container.innerHTML = "<h1>API Error</h1>"; }
}

// ... rest of your code (loadMatchups, loadTeamData, loadRawData, renderTable, sortTable) stays exactly the same as 8.1/8.2
// Ensure those functions are present below this line in your actual file.

async function loadMatchups() {
    container.innerHTML = "<h2>Generating Predictions...</h2>";
    window.scrollTo(0,0);
    try {
        const [schedRes, vsEmptyRes, rawDataRes] = await Promise.all([
            fetch(SCHEDULE_API),
            fetch(GOOGLE_URL + "?action=raw&name=VS Empty"),
            fetch(GOOGLE_URL + "?action=raw&name=RawData")
        ]);
        const schedData = await schedRes.json();
        const vsEmpty = await vsEmptyRes.json();
        const rawPlayers = await rawDataRes.json();
        var teamVuln = {};
        var vsHeaders = vsEmpty.headers;
        var tIdx = vsHeaders.indexOf("Team");
        var gaIdx = vsHeaders.indexOf("GA");
        var toiIdx = vsHeaders.indexOf("TOI");
        vsEmpty.rows.forEach(row => {
            var team = row[tIdx];
            var ga = parseFloat(row[gaIdx]) || 0;
            var toiStr = row[toiIdx] || "0:00";
            var toiParts = toiStr.split(":");
            var toiMins = (parseInt(toiParts[0]) || 0) + (parseInt(toiParts[1]) / 60 || 0);
            teamVuln[team] = toiMins > 0 ? (ga / toiMins) : 0;
        });
        var playerENG = {};
        var pHeaders = rawPlayers.headers;
        var pNameIdx = pHeaders.indexOf("Player");
        var pTeamIdx = pHeaders.indexOf("Team");
        var pToiIdx = pHeaders.indexOf("TOI");
        var pGIdx = pHeaders.indexOf("G"); 
        var pFoIdx = pHeaders.indexOf("Team FO%");
        rawPlayers.rows.forEach(row => {
            var team = row[pTeamIdx];
            if (!playerENG[team]) playerENG[team] = [];
            var g = parseFloat(row[pGIdx]) || 0;
            var toi = parseFloat(row[pToiIdx]) || 0;
            var fo = parseFloat(row[pFoIdx]) || 0;
            var score = (g * 5) + (toi * 1.5) + (fo / 10);
            playerENG[team].push({ name: row[pNameIdx], score: score });
        });
        var html = '<div class="roster-header"><h1>Matchups</h1><button class="back-btn" onclick="loadDashboard()">Back</button></div>';
        schedData.gameWeek.forEach(day => {
            if (day.games.length > 0) {
                var dParts = day.date.split("-");
                var niceDate = new Date(dParts[0], dParts[1] - 1, dParts[2]).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
                html += '<h3 style="margin-top: 30px; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">' + niceDate + '</h3>';
                html += '<div class="team-list">';
                day.games.forEach(game => {
                    var away = game.awayTeam.abbrev;
                    var home = game.homeTeam.abbrev;
                    var time = new Date(game.startTimeUTC).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    var awayCloser = (playerENG[away] || []).sort((a,b) => b.score - a.score)[0];
                    var homeCloser = (playerENG[home] || []).sort((a,b) => b.score - a.score)[0];
                    var awayTrap = teamVuln[away] || 0;
                    var homeTrap = teamVuln[home] || 0;
                    html += '<div class="team-row" style="grid-template-columns: 1fr 60px 1fr; text-align:center;">';
                    html += '<span><b>'+away+'</b></span>';
                    html += '<span style="color:var(--accent-color); font-size:0.8rem;">'+time+'</span>';
                    html += '<span><b>'+home+'</b></span>';
                    html += '</div>';
                });
                html += '</div>';
            }
        });
        container.innerHTML = html;
    } catch (e) { loadDashboard(); }
}

async function loadTeamData(teamName) {
    container.innerHTML = "<h2>Loading " + teamName + "...</h2>";
    try {
        var res = await fetch(GOOGLE_URL + "?action=team&name=" + teamName);
        var raw = await res.json();
        var teamFO = raw.rows.length > 0 ? raw.rows[0][0] : "0.0%";
        var headers = raw.headers.slice(2);
        var rows = raw.rows.map(r => r.slice(2));
        currentData = { type: 'team', team: teamName, teamFO: teamFO, headers: headers, rows: rows };
        renderTable();
    } catch (e) { loadDashboard(); }
}

async function loadRawData(sheetName) {
    container.innerHTML = "<h2>Loading...</h2>";
    try {
        var res = await fetch(GOOGLE_URL + "?action=raw&name=" + encodeURIComponent(sheetName));
        var raw = await res.json();
        var headers = raw.headers;
        var rows = raw.rows;
        currentData = { type: 'raw', team: sheetName, displayName: displayNames[sheetName] || sheetName, headers: headers, rows: rows };
        renderTable();
    } catch (e) { loadDashboard(); }
}

function renderTable() {
    var html = '<div class="roster-header">';
    if (currentData.type === 'team') {
        html += '<div><h1>' + currentData.team + '</h1><span class="team-fo-badge">Team FO: ' + currentData.teamFO + '</span></div>';
    } else {
        html += '<h1>' + currentData.displayName + '</h1>';
    }
    html += '<button class="back-btn" onclick="loadDashboard()">Back</button></div>';
    html += '<div class="table-wrapper"><table><thead><tr>';
    currentData.headers.forEach((h, i) => { html += '<th onclick="sortTable(' + i + ')">' + h + ' ↕</th>'; });
    html += '</tr></thead><tbody>';
    currentData.rows.forEach(row => {
        html += '<tr>';
        row.forEach(cell => { html += '<td>' + cell + '</td>'; });
        html += '</tr>';
    });
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

function sortTable(idx) {
    sortDir *= -1;
    currentData.rows.sort((a, b) => {
        var valA = a[idx] || "0";
        var valB = b[idx] || "0";
        if (valA.includes(":") && valB.includes(":")) {
            var tA = valA.split(':'); var tB = valB.split(':');
            return ((parseInt(tA[0]) * 60 + parseInt(tA[1])) - (parseInt(tB[0]) * 60 + parseInt(tB[1]))) * sortDir;
        }
        var nA = parseFloat(valA.replace(/[%$,]/g, ''));
        var nB = parseFloat(valB.replace(/[%$,]/g, ''));
        return (!isNaN(nA) && !isNaN(nB)) ? (nA - nB) * sortDir : valA.localeCompare(valB) * sortDir;
    });
    renderTable();
}

loadDashboard();