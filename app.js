console.log("App version 8.1.4 - Unified Engine (Row View)");

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

/**
 * FETCH LIVE STANDINGS
 */
async function fetchStandings() {
    try {
        var res = await fetch(STANDINGS_API);
        var data = await res.json();
        if (data && data.standings) {
            data.standings.forEach(function(s) {
                var w = s.wins || 0;
                var l = s.losses || 0;
                var ot = s.otLosses || 0;
                var abbrev = (s.teamAbbrev && s.teamAbbrev.default) ? s.teamAbbrev.default : s.teamAbbrev;
                if (abbrev) { 
                    standings[abbrev.toUpperCase()] = { rec: w + "-" + l + "-" + ot }; 
                }
            });
        }
    } catch (e) { 
        console.error("Standings error:", e); 
    }
}

/**
 * RENDER MAIN DASHBOARD (ROW FORMAT)
 */
async function loadDashboard() {
    container.innerHTML = "<h2>Syncing League Data...</h2>";
    await fetchStandings();
    
    try {
        var res = await fetch(GOOGLE_URL + "?action=dashboard");
        var data = await res.json();
        
        var now = new Date();
        lastSyncTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        var html = '<div class="header-section">';
        html += '<h1>EMPTYNETTERS</h1>';
        html += '<span class="sync-time">🟢 Live • ' + lastSyncTime + '</span></div>';
        
        html += '<div class="global-actions">';
        html += '<button class="raw-btn" onclick="loadMatchups()">Daily Matchups</button>';
        html += '<button class="raw-btn" onclick="loadRawData(\'RawData\')">Player ENG Stats</button>';
        html += '<button class="raw-btn" onclick="loadRawData(\'VS Empty\')">Team Stats vs Empty Net</button>';
        html += '<button class="raw-btn" onclick="loadRawData(\'Net Empty\')">Team Stats with Net Empty</button>';
        html += '</div>';

        html += '<div class="team-list">'; // New container for rows
        data.forEach(function(item) {
            var teamCode = item.team.trim().toUpperCase();
            var s = standings[teamCode] || { rec: '0-0-0' };
            
            html += '<div class="team-row" onclick="loadTeamData(\'' + item.team + '\')">';
            html += '<div class="team-identity">';
            html += '<img src="https://assets.nhle.com/logos/nhl/svg/' + teamCode + '_light.svg" class="team-logo" alt="' + teamCode + '">';
            html += '<div class="team-name">' + teamCode + '</div>';
            html += '</div>';
            html += '<div class="record-text">' + s.rec + '</div>';
            html += '</div>';
        });
        
        html += '</div>';
        container.innerHTML = html;
    } catch (e) { 
        container.innerHTML = "<h1>API Error</h1><p>Check Google URL or deployment.</p>"; 
    }
}

/**
 * RENDER DAILY MATCHUPS
 */
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

        var html = '<div class="roster-header">';
        html += '<h1>Upcoming Matchups</h1>';
        html += '<button class="back-btn" onclick="loadDashboard()">Back</button></div>';

        schedData.gameWeek.forEach(day => {
            if (day.games.length > 0) {
                var dParts = day.date.split("-");
                var niceDate = new Date(dParts[0], dParts[1] - 1, dParts[2]).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
                html += '<h3 style="margin-top: 30px; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">' + niceDate + '</h3>';
                html += '<div class="team-list">'; // Use row format for matchups too

                day.games.forEach(game => {
                    var away = game.awayTeam.abbrev;
                    var home = game.homeTeam.abbrev;
                    var time = new Date(game.startTimeUTC).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                    var awayCloser = (playerENG[away] || []).sort((a,b) => b.score - a.score)[0];
                    var homeCloser = (playerENG[home] || []).sort((a,b) => b.score - a.score)[0];
                    var awayTrap = teamVuln[away] || 0;
                    var homeTrap = teamVuln[home] || 0;

                    html += '<div class="team-row" style="cursor: default; grid-template-columns: 1fr auto 1fr; gap: 10px; padding: 15px;">';
                    html += '<div style="display:flex; align-items:center; gap:10px;">';
                    html += '<img src="https://assets.nhle.com/logos/nhl/svg/'+away+'_light.svg" style="width:25px;">';
                    html += '<span><b>'+away+'</b></span>';
                    html += '</div>';
                    html += '<div style="color:var(--accent-color); font-size:0.8rem;">'+time+'</div>';
                    html += '<div style="display:flex; align-items:center; gap:10px; justify-content: flex-end;">';
                    html += '<span><b>'+home+'</b></span>';
                    html += '<img src="https://assets.nhle.com/logos/nhl/svg/'+home+'_light.svg" style="width:25px;">';
                    html += '</div>';
                    html += '</div>';
                });
                html += '</div>';
            }
        });
        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = "<h1>Error loading predictions.</h1><button class='back-btn' onclick='loadDashboard()'>Go Back</button>";
    }
}

/**
 * RENDER INDIVIDUAL TEAM VIEW
 */
async function loadTeamData(teamName) {
    container.innerHTML = "<h2>Loading " + teamName + "...</h2>";
    try {
        var res = await fetch(GOOGLE_URL + "?action=team&name=" + teamName);
        var raw = await res.json();
        var teamFO = (raw.rows && raw.rows.length > 0) ? raw.rows[0][0] : "0.0%";
        var headers = raw.headers.slice(2);
        var rows = raw.rows.map(r => r.slice(2));
        currentData = { type: 'team', team: teamName, teamFO: teamFO, headers: headers, rows: rows };
        renderTable();
    } catch (e) { loadDashboard(); }
}

/**
 * RENDER RAW SHEET DATA
 */
async function loadRawData(sheetName) {
    container.innerHTML = "<h2>Loading...</h2>";
    try {
        var res = await fetch(GOOGLE_URL + "?action=raw&name=" + encodeURIComponent(sheetName));
        var raw = await res.json();
        currentData = { type: 'raw', team: sheetName, displayName: displayNames[sheetName] || sheetName, headers: raw.headers, rows: raw.rows };
        renderTable();
    } catch (e) { loadDashboard(); }
}

/**
 * HELPER: GENERATE HTML TABLES
 */
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
        html += '<tr>' + row.map(cell => '<td>' + cell + '</td>').join('') + '</tr>';
    });
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

/**
 * HELPER: SORTING ENGINE
 */
function sortTable(idx) {
    sortDir *= -1;
    currentData.rows.sort((a, b) => {
        var valA = a[idx] || "0";
        var valB = b[idx] || "0";
        var nA = parseFloat(valA.replace(/[%$,]/g, ''));
        var nB = parseFloat(valB.replace(/[%$,]/g, ''));
        return (!isNaN(nA) && !isNaN(nB)) ? (nA - nB) * sortDir : valA.localeCompare(valB) * sortDir;
    });
    renderTable();
}

// Initialization
loadDashboard();