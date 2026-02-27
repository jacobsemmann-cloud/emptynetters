console.log("App version 3.2 starting...");

// PASTE YOUR NEW DEPLOYMENT URL HERE
var GOOGLE_URL = "https://script.google.com/macros/s/AKfycbyiUE8SnfMzVvqxlqeeoyaWXRyF2bDqEEdqBJ4FMIiMlhyCozsEGAowpwe6iiO-KJxN/exec";
var STANDINGS_API = "https://api-web.nhle.com/v1/standings/now";
var container = document.getElementById('app');

var standings = {};
var currentData = null;
var sortDir = 1;
var lastSyncTime = "Updating...";

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
                    standings[abbrev] = { rec: w + "-" + l + "-" + ot };
                }
            });
        }
    } catch (e) { 
        console.error("Standings error:", e); 
    }
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
        html += '<h1>NHL Analytics</h1>';
        html += '<span class="sync-time">🟢 Live • ' + lastSyncTime + '</span></div>';
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
    } catch (e) { 
        container.innerHTML = "<h1>API Error</h1><p>Check your GOOGLE_URL or Apps Script deployment.</p>";
    }
}

async function loadTeamData(teamName) {
    container.innerHTML = "<h2>Loading " + teamName + " data...</h2>";
    window.scrollTo(0,0);
    
    try {
        var res = await fetch(GOOGLE_URL + "?action=team&name=" + teamName);
        var raw = await res.json();
        
        // Grab Team FO% from the very first cell (Row 0, Col 0)
        var teamFO = "0.0%";
        if (raw.rows.length > 0) {
            teamFO = raw.rows[0][0]; 
        }

        // Slice off Team FO% (Index 0) and Team Name (Index 1) from the table view
        var rawHeaders = raw.headers.slice(2);
        var rawRows = raw.rows.map(function(row) {
            return row.slice(2);
        });

        // Strip out any blank columns that might have snuck in
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

        currentData = {
            team: teamName,
            teamFO: teamFO,
            headers: cleanHeaders,
            rows: cleanRows
        };
        
        renderTable();
    } catch (e) { 
        container.innerHTML = "<h1>Error loading team.</h1><button class='back-btn' onclick='loadDashboard()'>Go Back</button>"; 
    }
}

function renderTable() {
    var s = standings[currentData.team] || { rec: '0-0-0' };
    
    var html = '<div class="roster-header">';
    html += '<div style="display:flex; align-items:center; gap:20px;">';
    html += '<img src="https://assets.nhle.com/logos/nhl/svg/' + currentData.team + '_light.svg" style="width:80px;">';
    html += '<div><h1 style="margin:0 0 5px 0;">' + currentData.team + '</h1>';
    html += '<div style="display:flex; gap:10px;">';
    html += '<span class="record-badge">' + s.rec + '</span>';
    html += '<span class="team-fo-badge">Team FO: ' + currentData.teamFO + '</span>';
    html += '</div></div></div>';
    html += '<button class="back-btn" onclick="loadDashboard()">← Dashboard</button></div>';
    
    html += '<div class="table-wrapper"><table><thead><tr>';
    currentData.headers.forEach(function(h, i) {
        html += '<th onclick="sortTable(' + i + ')">' + h + ' ↕</th>';
    });
    html += '</tr></thead><tbody>';
    
    currentData.rows.forEach(function(row) {
        html += '<tr>';
        row.forEach(function(cell) { 
            html += '<td>' + cell + '</td>'; 
        });
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
        
        // Handle MM:SS format correctly
        if (valA.includes(":") && valB.includes(":")) {
            var timeA = valA.split(':');
            var timeB = valB.split(':');
            var secsA = (parseInt(timeA[0]) * 60) + parseInt(timeA[1] || 0);
            var secsB = (parseInt(timeB[0]) * 60) + parseInt(timeB[1] || 0);
            return (secsA - secsB) * sortDir;
        }

        // Handle Numbers and Percentages
        var numA = parseFloat(valA.replace(/[%$,]/g, ''));
        var numB = parseFloat(valB.replace(/[%$,]/g, ''));
        
        if (!isNaN(numA) && !isNaN(numB)) {
            return (numA - numB) * sortDir;
        }
        
        // Fallback to Alphabetical
        return valA.localeCompare(valB) * sortDir;
    });
    renderTable();
}

loadDashboard();