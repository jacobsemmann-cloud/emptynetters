console.log("App v8.1.9 - Ultra Compressed + Fail-Safe");

var GOOGLE_URL = "https://script.google.com/macros/s/AKfycbyiUE8SnfMzVvqxlqeeoyaWXRyF2bDqEEdqBJ4FMIiMlhyCozsEGAowpwe6iiO-KJxN/exec";
var STANDINGS_API = "https://api.allorigins.win/raw?url=" + encodeURIComponent("https://api-web.nhle.com/v1/standings/now");

var container = document.getElementById('app');
var standings = {}; 
var currentData = null;
var sortDir = 1;

async function fetchStandings() {
    try {
        var res = await fetch(STANDINGS_API);
        var data = await res.json();
        if (data && data.standings) {
            data.standings.forEach(s => {
                var code = (s.teamAbbrev && s.teamAbbrev.default) ? s.teamAbbrev.default : s.teamAbbrev;
                standings[code] = { 
                    rec: (s.wins || 0) + "-" + (s.losses || 0) + "-" + (s.otLosses || 0),
                    pts: s.points || 0,
                    div: s.divisionName || "NHL",
                    rank: s.divisionSequence || "-"
                };
            });
        }
    } catch (e) { console.error("Standings Offline"); }
}

async function loadDashboard() {
    container.innerHTML = "<h2>...</h2>";
    await fetchStandings();
    
    try {
        var res = await fetch(GOOGLE_URL + "?action=dashboard");
        var teams = await res.json();
        var now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        var html = '<div class="header-section"><h1>EMPTYNETTERS</h1><span class="sync-time">' + now + '</span></div>';
        html += '<div class="global-actions">';
        html += '<button class="raw-btn" onclick="loadMatchups()">MATCHUPS</button>';
        html += '<button class="raw-btn" onclick="loadRawData(\'RawData\')">PLAYERS</button>';
        html += '<button class="raw-btn" onclick="loadRawData(\'VS Empty\')">VS EN</button>';
        html += '<button class="raw-btn" onclick="loadRawData(\'Net Empty\')">WITH EN</button>';
        html += '</div>';

        // Fail-Safe Grouping: Every team in 'teams' will be rendered
        var groups = {};
        teams.forEach(t => {
            var s = standings[t.team] || { rec: "-", pts: "-", div: "Other", rank: "-" };
            var d = s.div;
            if (!groups[d]) groups[d] = [];
            groups[d].push({ team: t.team, s: s });
        });

        var order = ["Atlantic", "Metropolitan", "Central", "Pacific", "Other"];
        order.forEach(dName => {
            if (!groups[dName]) return;
            groups[dName].sort((a,b) => (a.s.rank === "-" ? 1 : a.s.rank - b.s.rank));

            html += '<div class="div-head">' + dName + '</div>';
            html += '<table class="s-table"><thead><tr><th class="r-cell">#</th><th>TEAM</th><th class="st-cell">PTS</th><th class="st-cell">RECORD</th></tr></thead><tbody>';
            
            groups[dName].forEach(obj => {
                html += '<tr onclick="loadTeamData(\'' + obj.team + '\')">';
                html += '<td class="r-cell">' + obj.s.rank + '</td>';
                html += '<td><div class="t-cell"><img src="https://assets.nhle.com/logos/nhl/svg/' + obj.team + '_light.svg" class="t-logo">' + obj.team + '</div></td>';
                html += '<td class="st-cell p-cell">' + obj.s.pts + '</td>';
                html += '<td class="st-cell">' + obj.s.rec + '</td>';
                html += '</tr>';
            });
            html += '</tbody></table>';
        });

        container.innerHTML = html;
    } catch (e) { container.innerHTML = "<h1>Data Error</h1>"; }
}

async function loadTeamData(team) {
    container.innerHTML = "<h2>Loading...</h2>";
    try {
        var res = await fetch(GOOGLE_URL + "?action=team&name=" + team);
        var raw = await res.json();
        currentData = { type: 'team', team: team, headers: raw.headers.slice(2), rows: raw.rows.map(r => r.slice(2)) };
        renderTable();
    } catch (e) { loadDashboard(); }
}

async function loadRawData(name) {
    container.innerHTML = "<h2>...</h2>";
    try {
        var res = await fetch(GOOGLE_URL + "?action=raw&name=" + encodeURIComponent(name));
        var raw = await res.json();
        currentData = { type: 'raw', name: name, headers: raw.headers, rows: raw.rows };
        renderTable();
    } catch (e) { loadDashboard(); }
}

function renderTable() {
    var html = '<div class="header-section"><h1>' + (currentData.team || currentData.name) + '</h1><button class="back-btn" onclick="loadDashboard()">BACK</button></div>';
    html += '<div class="table-wrapper"><table><thead><tr>';
    currentData.headers.forEach((h, i) => { html += '<th onclick="sortTable(' + i + ')">' + h + '</th>'; });
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

async function loadMatchups() {
    container.innerHTML = "<h2>Coming Soon</h2><button class='back-btn' onclick='loadDashboard()'>BACK</button>";
}

loadDashboard();