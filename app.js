console.log("App version 8.1.5 - Optimized Parallel Engine");

var GOOGLE_URL = "https://script.google.com/macros/s/AKfycbyiUE8SnfMzVvqxlqeeoyaWXRyF2bDqEEdqBJ4FMIiMlhyCozsEGAowpwe6iiO-KJxN/exec";

// Proxies to bypass CORS
var STANDINGS_API = "https://api.allorigins.win/raw?url=" + encodeURIComponent("https://api-web.nhle.com/v1/standings/now");
var SCHEDULE_API = "https://api.allorigins.win/raw?url=" + encodeURIComponent("https://api-web.nhle.com/v1/schedule/now");

var container = document.getElementById('app');

// Memory Cache to prevent redundant API hits
var dataCache = {
    standings: null,
    dashboard: null,
    matchups: null,
    rawData: {}
};

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
 * REFRESH CACHE
 * Allows manual clearing of the cache to pull fresh data from Google Sheets
 */
function refreshApp() {
    dataCache = { standings: null, dashboard: null, matchups: null, rawData: {} };
    loadDashboard();
}

async function fetchStandings() {
    if (dataCache.standings) return dataCache.standings;
    try {
        var res = await fetch(STANDINGS_API);
        var data = await res.json();
        if (data && data.standings) {
            data.standings.forEach(function(s) {
                var w = s.wins || 0;
                var l = s.losses || 0;
                var ot = s.otLosses || 0;
                var abbrev = (s.teamAbbrev && s.teamAbbrev.default) ? s.teamAbbrev.default : s.teamAbbrev;
                if (abbrev) { standings[abbrev] = { rec: w + "-" + l + "-" + ot }; }
            });
            dataCache.standings = standings;
            return standings;
        }
    } catch (e) { console.error("Standings error:", e); }
}

async function loadDashboard() {
    container.innerHTML = "<h2>Loading League Stats...</h2>";
    
    try {
        // PARALLEL FETCH: Fetch standings and dashboard data simultaneously
        const [standingResult, dashboardRes] = await Promise.all([
            fetchStandings(),
            fetch(GOOGLE_URL + "?action=dashboard")
        ]);

        var data = await dashboardRes.json();
        dataCache.dashboard = data;
        
        var now = new Date();
        lastSyncTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        var html = '<div class="header-section">';
        html += '<h1>EMPTYNETTERS</h1>';
        html += '<span class="sync-time">🟢 Live • ' + lastSyncTime + '</span>';
        html += ' <button onclick="refreshApp()" style="background:none; border:none; color:var(--accent-color); cursor:pointer; font-size:0.8rem;">[Refresh]</button></div>';
        
        html += '<div class="global-actions">';
        html += '<button class="raw-btn" onclick="loadMatchups()">Daily Matchups</button>';
        html += '<button class="raw-btn" onclick="loadRawData(\'RawData\')">Player ENG Stats</button>';
        html += '<button class="raw-btn" onclick="loadRawData(\'VS Empty\')">Team Stats vs Empty Net</button>';
        html += '<button class="raw-btn" onclick="loadRawData(\'Net Empty\')">Team Stats with Net Empty</button>';
        html += '</div>';

        html += '<div class="team-grid">';
        data.forEach(function(item) {
            var s = standings[item.team] || { rec: '0-0-0' };
            html += '<div class="card" onclick="loadTeamData(\'' + item.team + '\')">';
            html += '<img src="https://assets.nhle.com/logos/nhl/svg/' + item.team + '_light.svg" class="team-logo" alt="' + item.team + '">';
            html += '<div style="font-weight:bold; font-size:1.2rem;">' + item.team + '</div>';
            html += '<div class="record-badge">' + s.rec + '</div>';
            html += '</div>';
        });
        
        html += '</div>';
        container.innerHTML = html;
    } catch (e) { container.innerHTML = "<h1>API Error</h1><p>Check Google URL or deployment.</p>"; }
}

async function loadMatchups() {
    // If we have cached matchup data, show it immediately
    if (dataCache.matchups) {
        renderMatchupsUI(dataCache.matchups.sched, dataCache.matchups.vs, dataCache.matchups.raw);
        return;
    }
    
    container.innerHTML = "<h2>Generating Predictions...</h2>";
    window.scrollTo(0,0);
    
    try {
        // PARALLEL FETCH for Matchup Data
        const [schedRes, vsEmptyRes, rawDataRes] = await Promise.all([
            fetch(SCHEDULE_API),
            fetch(GOOGLE_URL + "?action=raw&name=VS Empty"),
            fetch(GOOGLE_URL + "?action=raw&name=RawData")
        ]);

        const schedData = await schedRes.json();
        const vsEmpty = await vsEmptyRes.json();
        const rawPlayers = await rawDataRes.json();

        // Update Cache
        dataCache.matchups = { sched: schedData, vs: vsEmpty, raw: rawPlayers };

        renderMatchupsUI(schedData, vsEmpty, rawPlayers);
    } catch (e) {
        container.innerHTML = "<h1>Error loading predictions.</h1><button class='back-btn' onclick='loadDashboard()'>Go Back</button>";
    }
}

/**
 * UI Rendering logic separated for caching support
 */
function renderMatchupsUI(schedData, vsEmpty, rawPlayers) {
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

    var html = '<div class="roster-header">';
    html += '<h1>Upcoming Matchups</h1>';
    html += '<button class="back-btn" onclick="loadDashboard()">Back</button></div>';

    schedData.gameWeek.forEach(day => {
        if (day.games.length > 0) {
            var dParts = day.date.split("-");
            var niceDate = new Date(dParts[0], dParts[1] - 1, dParts[2]).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
            html += '<h3 style="margin-top: 30px; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">' + niceDate + '</h3>';
            html += '<div class="team-grid" style="grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));">';

            day.games.forEach(game => {
                var away = game.awayTeam.abbrev;
                var home = game.homeTeam.abbrev;
                var time = new Date(game.startTimeUTC).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                var awayCloser = (playerENG[away] || []).sort((a,b) => b.score - a.score)[0];
                var homeCloser = (playerENG[home] || []).sort((a,b) => b.score - a.score)[0];
                var awayTrap = teamVuln[away] || 0;
                var homeTrap = teamVuln[home] || 0;

                html += '<div class="card" style="padding: 15px; text-align: left;">';
                html += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">';
                html += '<span><img src="https://assets.nhle.com/logos/nhl/svg/'+away+'_light.svg" style="width:30px;"> <b>'+away+'</b></span>';
                html += '<span style="color:var(--accent-color); font-size:0.8rem;">'+time+'</span>';
                html += '<span><b>'+home+'</b> <img src="https://assets.nhle.com/logos/nhl/svg/'+home+'_light.svg" style="width:30px;"></span>';
                html += '</div>';

                html += '<div style="background: rgba(88, 166, 255, 0.05); border: 1px dashed var(--accent-color); border-radius: 4px; padding: 10px; font-size: 0.85rem;">';
                html += '<div style="color: var(--accent-color); font-weight: bold; margin-bottom:5px;">🎯 PROJECTED CLOSER:</div>';
                
                if (homeTrap > awayTrap && awayCloser) {
                    html += '<b>' + awayCloser.name + '</b> (' + away + ')';
                } else if (homeCloser) {
                    html += '<b>' + homeCloser.name + '</b> (' + home + ')';
                } else {
                    html += 'Calculating...';
                }
                html += '</div></div>';
            });
            html += '</div>';
        }
    });
    container.innerHTML = html;
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
    if (dataCache.rawData[sheetName]) {
        currentData = dataCache.rawData[sheetName];
        renderTable();
        return;
    }
    container.innerHTML = "<h2>Loading...</h2>";
    try {
        var res = await fetch(GOOGLE_URL + "?action=raw&name=" + encodeURIComponent(sheetName));
        var raw = await res.json();
        
        var headers = raw.headers;
        var rows = raw.rows;

        if (sheetName === 'VS Empty' || sheetName === 'Net Empty') {
            var ptPctIdx = headers.indexOf("Point %");
            var gfIdx = headers.indexOf("GF");
            var gaIdx = headers.indexOf("GA");
            if (ptPctIdx !== -1 && gfIdx !== -1 && gaIdx !== -1) {
                var order = [];
                for (var i = 0; i < headers.length; i++) {
                    if (i === gfIdx || i === gaIdx) continue;
                    order.push(i);
                    if (i === ptPctIdx) { order.push(gfIdx); order.push(gaIdx); }
                }
                headers = order.map(i => headers[i]);
                rows = rows.map(r => order.map(i => r[i]));
            }
        }
        currentData = { type: 'raw', team: sheetName, displayName: displayNames[sheetName] || sheetName, headers: headers, rows: rows };
        dataCache.rawData[sheetName] = currentData;
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