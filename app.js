// Version 2.4 - Sync Timestamp & Robust Standings
console.log("App version 2.4 starting...");

var GOOGLE_URL = "https://script.google.com/macros/s/AKfycbyiUE8SnfMzVvqxlqeeoyaWXRyF2bDqEEdqBJ4FMIiMlhyCozsEGAowpwe6iiO-KJxN/exec";
var STANDINGS_API = "https://api-web.nhle.com/v1/standings/now";
var container = document.getElementById('app');

var NHL_TEAMS = ['ANA', 'BOS', 'BUF', 'CAR', 'CBJ', 'CGY', 'CHI', 'COL', 'DAL', 'DET', 'EDM', 'FLA', 'LAK', 'MIN', 'MTL', 'NJD', 'NSH', 'NYI', 'NYR', 'OTT', 'PHI', 'PIT', 'SEA', 'SJS', 'STL', 'TBL', 'TOR', 'UTA', 'VAN', 'VGK', 'WSH', 'WPG'];

var standings = {};
var currentData = null;
var sortDir = 1;
var lastSyncTime = "Never";

async function fetchStandings() {
    console.log("Fetching NHL standings...");
    try {
        var res = await fetch(STANDINGS_API);
        var data = await res.json();
        if (data && data.standings) {
            data.standings.forEach(function(s) {
                var w = s.wins || 0;
                var l = s.losses || 0;
                var ot = s.otLosses || 0;
                
                // Handle different possible API structures for team abbreviation
                var abbrev = "";
                if (s.teamAbbrev && typeof s.teamAbbrev === 'object') {
                    abbrev = s.teamAbbrev.default;
                } else {
                    abbrev = s.teamAbbrev;
                }
                
                if (abbrev) {
                    standings[abbrev] = {
                        rec: w + "-" + l + "-" + ot,
                        streak: s.l10Record ? s.l10Record.toString().split('').slice(0, 5) : []
                    };
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
        
        // Update the Sync Time
        var now = new Date();
        lastSyncTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        var filtered = data.filter(function(item) {
            return NHL_TEAMS.indexOf(item.team) !== -1;
        }).sort(function(a, b) {
            return a.team.localeCompare(b.team);
        });

        var html = '<div style="display:flex; justify-content:space-between; align-items:baseline;">';
        html += '<h1>NHL Dashboard</h1>';
        html += '<p style="color:#8b949e; font-size:0.8rem;">Last Sync: ' + lastSyncTime + '</p></div>';
        html += '<div class="team-grid">';
        
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
    } catch (e) { 
        container.innerHTML = "<h1>API Error</h1><p>Check Google Apps Script permissions.</p>";
    }
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
        
        var total = teamWon + teamLost;
        var teamFO = total > 0 ? ((teamWon / total) * 100).toFixed(1) + "%" : "0.0%";

        var start = playerIdx === -1 ? 0 : playerIdx;

        currentData = {
            team: teamName,
            headers: raw.headers.slice(start),
            rows: raw.rows.map(function(r) { return r.slice(start); }),
            teamFO: teamFO
        };
        renderTable();
    } catch (e) { 
        container.innerHTML = "<h1>Error loading team.</h1>"; 
    }
}

function renderTable() {
    var s = standings[currentData.team] || { rec: '0-0-0', streak: [] };
    
    var html = '<div class="roster-header"><div style="display:flex; align-items:center; gap:15px;">';
    html += '<img src="https://assets.nhle.com/logos/nhl/svg/' + currentData.team + '_light.svg" style="width:70px;">';
    html += '<div><h1 style="margin:0;">' + currentData.team + '</h1>';
    html += '<div style="display:flex; gap:10px; align-items:center;"><span class="record-badge">' + s.rec + '</span>';
    html += '<span class="team-fo-badge">Team FO: ' + currentData.teamFO + '</span></div>';
    html += '</div></div>';
    html += '<button onclick="loadDashboard()" style="padding:10px; cursor:pointer; background:#21262d; color:white; border:1px solid #30363d; border-radius:4px;">Back</button></div>';
    
    html += '<div class="table-wrapper"><table><thead><tr>';
    currentData.headers.forEach(function(h, i) {
        html += '<th onclick="sortTable(' + i + ')" style="cursor:pointer;">' + h + '</th>';
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
        var nA = parseFloat(a[idx].toString().replace(/[%:]/g, ''));
        var nB = parseFloat(b[idx].toString().replace(/[%:]/g, ''));
        if (!isNaN(nA) && !isNaN(nB)) return (nA - nB) * sortDir;
        return a[idx].toString().localeCompare(b[idx].toString()) * sortDir;
    });
    renderTable();
}

loadDashboard();