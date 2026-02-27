console.log("App version 7.1 starting...");

// PASTE YOUR GOOGLE WEB APP URL HERE
var GOOGLE_URL = "https://script.google.com/macros/s/AKfycbyiUE8SnfMzVvqxlqeeoyaWXRyF2bDqEEdqBJ4FMIiMlhyCozsEGAowpwe6iiO-KJxN/exec";
var STANDINGS_API = "https://api-web.nhle.com/v1/standings/now";
var SCHEDULE_API = "https://api-web.nhle.com/v1/schedule/now";
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
                var w = s.wins || 0;
                var l = s.losses || 0;
                var ot = s.otLosses || 0;
                var abbrev = (s.teamAbbrev && s.teamAbbrev.default) ? s.teamAbbrev.default : s.teamAbbrev;
                if (abbrev) { standings[abbrev] = { rec: w + "-" + l + "-" + ot }; }
            });
        }
    } catch (e) { console.error("Standings error:", e); }
}

async function loadDashboard() {
    container.innerHTML = "<h2>Loading League Stats...</h2>";
    await fetchStandings();
    
    try {
        var res = await fetch(GOOGLE_URL + "?action=dashboard");
        var data = await res.json();
        
        var now = new Date();
        lastSyncTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        var html = '<div class="header-section">';
        html += '<h1>EMPTYNETTERS</h1>';
        html += '<span class="sync-time"> Live - ' + lastSyncTime + '</span></div>';
        
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
    } catch (e) { container.innerHTML = "<h1>API Error</h1><p>Check your GOOGLE_URL or Apps Script deployment.</p>"; }
}

async function loadMatchups() {
    container.innerHTML = "<h2>Loading Schedule...</h2>";
    window.scrollTo(0,0);
    
    if (Object.keys(standings).length === 0) {
        await fetchStandings();
    }

    try {
        var res = await fetch(SCHEDULE_API);
        var data = await res.json();
        
        var html = '<div class="roster-header">';
        html += '<div style="display:flex; align-items:center; gap:20px;">';
        html += '<div><h1 style="margin:0;">Upcoming Matchups</h1></div>';
        html += '</div><button class="back-btn" onclick="loadDashboard()">Back</button></div>';
        
        if (data && data.gameWeek) {
            data.gameWeek.forEach(function(day) {
                if (day.games && day.games.length > 0) {
                    var dateParts = day.date.split("-");
                    var niceDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

                    html += '<h3 style="margin-top: 30px; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">' + niceDate + '</h3>';
                    html += '<div class="team-grid" style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));">';
                    
                    day.games.forEach(function(game) {
                        var away = game.awayTeam.abbrev;
                        var home = game.homeTeam.abbrev;
                        var awayRec = standings[away] ? standings[away].rec : "";
                        var homeRec = standings[home] ? standings[home].rec : "";
                        
                        var startTime = new Date(game.startTimeUTC).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                        html += '<div class="card" style="display:flex; justify-content:space-between; align-items:center; padding: 20px;">';
                        html += '<div><img src="https://assets.nhle.com/logos/nhl/svg/' + away + '_light.svg" style="width:50px; height:50px; margin-bottom:5px;"><br><b style="font-size:1.2rem;">' + away + '</b><br><span class="sync-time">' + awayRec + '</span></div>';
                        html += '<div style="text-align:center;"><b>@</b><br><span style="font-size:0.85rem; color:var(--accent-color); font-weight:bold;">' + startTime + '</span></div>';
                        html += '<div><img src="https://assets.nhle.com/logos/nhl/svg/' + home + '_light.svg" style="width:50px; height:50px; margin-bottom:5px;"><br><b style="font-size:1.2rem;">' + home + '</b><br><span class="sync-time">' + homeRec + '</span></div>';
                        html += '</div>';
                    });
                    
                    html += '</div>';
                }
            });
        } else {
            html += "<p>No games found for this week.</p>";
        }
        
        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = "<h1>Error loading matchups.</h1><button class='back-btn' onclick='loadDashboard()'>Go Back</button>";
    }
}

async function loadTeamData(teamName) {
    container.innerHTML = "<h2>Loading " + teamName + " data...</h2>";
    window.scrollTo(0,0);
    
    try {
        var res = await fetch(GOOGLE_URL + "?action=team&name=" + teamName);
        var raw = await res.json();
        
        var teamFO = "0.0%";
        if (raw.rows && raw.rows.length > 0) { teamFO = raw.rows[0][0]; }

        var rawHeaders = raw.headers.slice(2);
        var rawRows = raw.rows.map(function(row) { return row.slice(2); });

        var cleanHeaders = [];
        var validIndices = [];
        rawHeaders.forEach(function(h, idx) {
            if (h && h.trim() !== "") {
                cleanHeaders.push(h);
                validIndices.push(idx);
            }
        });

        var cleanRows = rawRows.map(function(row) {
            return validIndices.map(function(idx) { return row[idx]; });
        });

        currentData = { type: 'team', team: teamName, teamFO: teamFO, headers: cleanHeaders, rows: cleanRows };
        renderTable();
    } catch (e) { container.innerHTML = "<h1>Error loading team.</h1><button class='back-btn' onclick='loadDashboard()'>Go Back</button>"; }
}

async function loadRawData(sheetName) {
    var displayName = displayNames[sheetName] || sheetName;
    container.innerHTML = "<h2>Loading " + displayName + "...</h2>";
    window.scrollTo(0,0);
    
    try {
        var res = await fetch(GOOGLE_URL + "?action=raw&name=" + encodeURIComponent(sheetName));
        var raw = await res.json();

        var cleanHeaders = [];
        var validIndices = [];
        raw.headers.forEach(function(h, idx) {
            if (h && h.trim() !== "") {
                cleanHeaders.push(h);
                validIndices.push(idx);
            }
        });

        var cleanRows = raw.rows.map(function(row) {
            return validIndices.map(function(idx) { return row[idx]; });
        });

        if (sheetName === 'VS Empty' || sheetName === 'Net Empty') {
            var ptPctIdx = cleanHeaders.findIndex(function(h) { return h.trim() === "Point %" || h.trim() === "PTS%"; });
            var gfIdx = cleanHeaders.findIndex(function(h) { return h.trim() === "GF"; });
            var gaIdx = cleanHeaders.findIndex(function(h) { return h.trim() === "GA"; });

            if (ptPctIdx !== -1 && gfIdx !== -1 && gaIdx !== -1) {
                var newOrder = [];
                for (var i = 0; i < cleanHeaders.length; i++) {
                    if (i === gfIdx || i === gaIdx) continue;
                    newOrder.push(i);
                    if (i === ptPctIdx) {
                        newOrder.push(gfIdx);
                        newOrder.push(gaIdx);
                    }
                }
                
                cleanHeaders = newOrder.map(function(i) { return cleanHeaders[i]; });
                cleanRows = cleanRows.map(function(row) { return newOrder.map(function(i) { return row[i]; }); });
            }
        }

        currentData = { type: 'raw', team: sheetName, displayName: displayName, headers: cleanHeaders, rows: cleanRows };
        renderTable();
    } catch (e) { container.innerHTML = "<h1>Error loading data.</h1><button class='back-btn' onclick='loadDashboard()'>Go Back</button>"; }
}

function renderTable() {
    var html = '<div class="roster-header">';
    html += '<div style="display:flex; align-items:center; gap:20px;">';
    
    if (currentData.type === 'team') {
        var s = standings[currentData.team] || { rec: '0-0-0' };
        html += '<img src="https://assets.nhle.com/logos/nhl/svg/' + currentData.team + '_light.svg" style="width:80px;">';
        html += '<div><h1 style="margin:0 0 5px 0;">' + currentData.team + '</h1>';
        html += '<div style="display:flex; gap:10px;">';
        html += '<span class="record-badge">' + s.rec + '</span>';
        html += '<span class="team-fo-badge">Team FO: ' + currentData.teamFO + '</span>';
        html += '</div></div>';
    } else {
        html += '<div><h1 style="margin:0;">' + currentData.displayName + '</h1></div>';
    }
    
    html += '</div><button class="back-btn" onclick="loadDashboard()">Back</button></div>';
    
    html += '<div class="table-wrapper"><table><thead><tr>';
    currentData.headers.forEach(function(h, i) {
        html += '<th onclick="sortTable(' + i + ')">' + h + ' ↕</th>';
    });
    html += '</tr></thead><tbody>';
    
    currentData.rows.forEach(function(row) {
        html += '<tr>';
        row.forEach(function(cell) { html += '<td>' + cell + '</td>'; });
        html += '</tr>';
    });
    
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

function sortTable(idx) {
    sortDir *= -1;
    currentData.rows.sort(function(a, b) {
        var valA = a[idx] ? a[idx].toString() : "0";
        var valB = b[idx] ? b[idx].toString() : "0";
        
        if (valA.includes(":") && valB.includes(":")) {
            var timeA = valA.split(':');
            var timeB = valB.split(':');
            var secsA = (parseInt(timeA[0]) * 60) + parseInt(timeA[1] || 0);
            var secsB = (parseInt(timeB[0]) * 60) + parseInt(timeB[1] || 0);
            return (secsA - secsB) * sortDir;
        }

        var numA = parseFloat(valA.replace(/[%$,]/g, ''));
        var numB = parseFloat(valB.replace(/[%$,]/g, ''));
        if (!isNaN(numA) && !isNaN(numB)) { return (numA - numB) * sortDir; }
        
        return valA.localeCompare(valB) * sortDir;
    });
    renderTable();
}

loadDashboard();