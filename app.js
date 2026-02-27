console.log("App version 8.1.2 - Fixed & Robust Unified Engine");

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
 * FIX: Added robust error handling and abbreviation mapping
 */
async function fetchStandings() {
    try {
        var res = await fetch(STANDINGS_API);
        var data = await res.json();
        if (data && data.standings) {
            data.standings.forEach(function(s) {
                var abbrev = (s.teamAbbrev && s.teamAbbrev.default) ? s.teamAbbrev.default : s.teamAbbrev;
                if (abbrev) { 
                    standings[abbrev.toUpperCase()] = { 
                        rec: (s.wins || 0) + "-" + (s.losses || 0) + "-" + (s.otLosses || 0) 
                    }; 
                }
            });
            // Handle Utah specific variations for 2026
            if (standings["UTM"]) standings["UTA"] = standings["UTM"];
        }
    } catch (e) { console.warn("Standings API timeout or error - proceeding with default records."); }
}

async function loadDashboard() {
    container.innerHTML = "<h2>Syncing Teams...</h2>";
    await fetchStandings();
    
    try {
        var res = await fetch(GOOGLE_URL + "?action=dashboard");
        var data = await res.json();
        
        var now = new Date();
        lastSyncTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        var html = '<div class="header-section"><h1>EMPTYNETTERS</h1><span class="sync-time">🟢 Live • ' + lastSyncTime + '</span></div>';
        html += '<div class="global-actions">';
        html += '<button class="raw-btn" onclick="loadMatchups()">Daily Matchups</button>';
        html += '<button class="raw-btn" onclick="loadRawData(\'RawData\')">Player ENG Stats</button>';
        html += '<button class="raw-btn" onclick="loadRawData(\'VS Empty\')">Team Stats vs Empty Net</button>';
        html += '<button class="raw-btn" onclick="loadRawData(\'Net Empty\')">Team Stats with Net Empty</button></div>';

        html += '<div class="team-grid">';
        data.forEach(function(item) {
            var code = item.team.trim().toUpperCase();
            // Fallback to 0-0-0 if the API missed this team
            var s = standings[code] || { rec: '0-0-0' };
            
            html += '<div class="card" onclick="loadTeamData(\'' + item.team + '\')">';
            html += '<img src="https://assets.nhle.com/logos/nhl/svg/' + code + '_light.svg" class="team-logo" alt="' + code + '">';
            html += '<div style="font-weight:bold; font-size:1.2rem;">' + code + '</div>';
            html += '<div class="record-badge">' + s.rec + '</div></div>';
        });
        
        html += '</div>';
        container.innerHTML = html;
    } catch (e) { 
        container.innerHTML = "<h1>Data Error</h1><p>Check Google Apps Script deployment.</p>"; 
    }
}

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

        var html = '<div class="roster-header"><h1>Upcoming Matchups</h1><button class="back-btn" onclick="loadDashboard()">Back</button></div>';
        schedData.gameWeek.forEach(day => {
            if (day.games.length > 0) {
                var dParts = day.date.split("-");
                var niceDate = new Date(dParts[0], dParts[1] - 1, dParts[2]).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
                html += '<h3 style="margin-top: 30px; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">' + niceDate + '</h3><div class="team-grid" style="grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));">';
                day.games.forEach(game => {
                    var away = game.awayTeam.abbrev, home = game.homeTeam.abbrev;
                    var time = new Date(game.startTimeUTC).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    var awayCloser = (playerENG[away] || []).sort((a,b) => b.score - a.score)[0];
                    var homeCloser = (playerENG[home] || []).sort((a,b) => b.score - a.score)[0];
                    var awayTrap = teamVuln[away] || 0, homeTrap = teamVuln[home] || 0;
                    html += '<div class="card" style="padding: 15px; text-align: left;"><div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;"><span><img src="https://assets.nhle.com/logos/nhl/svg/'+away+'_light.svg" style="width:30px;"> <b>'+away+'</b></span><span style="color:var(--accent-color); font-size:0.8rem;">'+time+'</span><span><b>'+home+'</b> <img src="https://assets.nhle.com/logos/nhl/svg/'+home+'_light.svg" style="width:30px;"></span></div><div style="background: rgba(88, 166, 255, 0.05); border: 1px dashed var(--accent-color); border-radius: 4px; padding: 10px; font-size: 0.85rem;"><div style="color: var(--accent-color); font-weight: bold; margin-bottom:5px;">🎯 PROJECTED CLOSER:</div>';
                    if (homeTrap > awayTrap && awayCloser) { html += '<b>' + awayCloser.name + '</b> (' + away + ')'; } 
                    else if (homeCloser) { html += '<b>' + homeCloser.name + '</b> (' + home + ')'; } 
                    else { html += 'Calculating...'; }
                    html += '</div></div>';
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
        var headers = raw.headers.slice(2), rows = raw.rows.map(r => r.slice(2));
        currentData = { type: 'team', team: teamName, teamFO: raw.rows[0][0], headers: headers, rows: rows };
        renderTable();
    } catch (e) { loadDashboard(); }
}

async function loadRawData(sheetName) {
    container.innerHTML = "<h2>Loading...</h2>";
    try {
        var res = await fetch(GOOGLE_URL + "?action=raw&name=" + encodeURIComponent(sheetName));
        var raw = await res.json();
        currentData = { type: 'raw', team: sheetName, displayName: displayNames[sheetName] || sheetName, headers: raw.headers, rows: raw.rows };
        renderTable();
    } catch (e) { loadDashboard(); }
}

function renderTable() {
    var html = '<div class="roster-header"><h1>' + (currentData.type === 'team' ? currentData.team : currentData.displayName) + '</h1><button class="back-btn" onclick="loadDashboard()">Back</button></div>';
    html += '<div class="table-wrapper"><table><thead><tr>';
    currentData.headers.forEach((h, i) => { html += '<th onclick="sortTable(' + i + ')">' + h + ' ↕</th>'; });
    html += '</tr></thead><tbody>';
    currentData.rows.forEach(row => { html += '<tr>' + row.map(cell => '<td>' + cell + '</td>').join('') + '</tr>'; });
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

function sortTable(idx) {
    sortDir *= -1;
    currentData.rows.sort((a, b) => {
        var valA = a[idx] || "0", valB = b[idx] || "0";
        if (valA.includes(":") && valB.includes(":")) {
            var tA = valA.split(':'), tB = valB.split(':');
            return ((parseInt(tA[0]) * 60 + parseInt(tA[1])) - (parseInt(tB[0]) * 60 + parseInt(tB[1]))) * sortDir;
        }
        var nA = parseFloat(valA.replace(/[%$,]/g, '')), nB = parseFloat(valB.replace(/[%$,]/g, ''));
        return (!isNaN(nA) && !isNaN(nB)) ? (nA - nB) * sortDir : valA.localeCompare(valB) * sortDir;
    });
    renderTable();
}

loadDashboard();