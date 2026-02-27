console.log("App version 8.1.5 - Standings Row View");

var GOOGLE_URL = "https://script.google.com/macros/s/AKfycbyiUE8SnfMzVvqxlqeeoyaWXRyF2bDqEEdqBJ4FMIiMlhyCozsEGAowpwe6iiO-KJxN/exec";
var STANDINGS_API = "https://api.allorigins.win/raw?url=" + encodeURIComponent("https://api-web.nhle.com/v1/standings/now");

var container = document.getElementById('app');
var standingsData = {}; 
var currentData = null;
var sortDir = 1;

/**
 * Normalizes common abbreviation mismatches
 */
const TEAM_MAP = { "LA": "LAK", "SJ": "SJS", "TB": "TBL", "NJ": "NJD", "UTA": "UTM" };

async function fetchStandings() {
    try {
        var res = await fetch(STANDINGS_API);
        var data = await res.json();
        if (data && data.standings) {
            data.standings.forEach(s => {
                var abbrev = (s.teamAbbrev && s.teamAbbrev.default) ? s.teamAbbrev.default : s.teamAbbrev;
                standingsData[abbrev.toUpperCase()] = {
                    rec: (s.wins || 0) + "-" + (s.losses || 0) + "-" + (s.otLosses || 0),
                    pts: s.points,
                    gp: s.gamesPlayed,
                    div: s.divisionName,
                    rank: s.divisionSequence
                };
            });
        }
    } catch (e) { console.error("Standings Error", e); }
}

async function loadDashboard() {
    container.innerHTML = "<h2>Updating Standings...</h2>";
    await fetchStandings();
    
    try {
        var res = await fetch(GOOGLE_URL + "?action=dashboard");
        var sheetTeams = await res.json();
        var now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        var html = '<div class="header"><h1>EMPTYNETTERS</h1><span style="font-size:0.7rem; color:#8b949e;">🟢 ' + now + '</span></div>';
        html += '<div class="global-actions">';
        html += '<button class="nav-btn" onclick="loadMatchups()">DAILY MATCHUPS</button>';
        html += '<button class="nav-btn" onclick="loadRawData(\'RawData\')">PLAYER STATS</button>';
        html += '<button class="nav-btn" onclick="loadRawData(\'VS Empty\')">VS EN</button>';
        html += '</div>';

        // Grouping by Division
        var divisions = { "Atlantic": [], "Metropolitan": [], "Central": [], "Pacific": [] };
        sheetTeams.forEach(t => {
            let code = t.team.trim().toUpperCase();
            code = TEAM_MAP[code] || code;
            const stats = standingsData[code] || { rec: "-", pts: "-", gp: "-", div: "Other", rank: "-" };
            const div = stats.div || "Other";
            if (!divisions[div]) divisions[div] = [];
            divisions[div].push({ code: code, stats: stats });
        });

        Object.keys(divisions).forEach(divName => {
            if (divisions[divName].length === 0) return;
            divisions[divName].sort((a,b) => a.stats.rank - b.stats.rank);

            html += `<div class="division-block">
                <div class="division-header">${divName} Division</div>
                <table class="s-table">
                    <thead><tr><th class="num">#</th><th>Team</th><th class="stat">GP</th><th class="stat">W-L-OTL</th><th class="stat">PTS</th></tr></thead>
                    <tbody>`;
            
            divisions[divName].forEach(team => {
                html += `<tr onclick="loadTeamData('${team.code}')">
                    <td class="num">${team.stats.rank}</td>
                    <td><div class="team-cell"><img src="https://assets.nhle.com/logos/nhl/svg/${team.code}_light.svg" class="t-logo">${team.code}</div></td>
                    <td class="stat">${team.stats.gp}</td>
                    <td class="stat" style="font-family:monospace;">${team.stats.rec}</td>
                    <td class="stat pts">${team.stats.pts}</td>
                </tr>`;
            });
            html += `</tbody></table></div>`;
        });

        container.innerHTML = html;
    } catch (e) { container.innerHTML = "<h1>Data Error</h1>"; }
}

async function loadTeamData(team) {
    container.innerHTML = "<h2>Loading " + team + "...</h2>";
    try {
        var res = await fetch(GOOGLE_URL + "?action=team&name=" + team);
        var raw = await res.json();
        currentData = { type: 'team', team: team, headers: raw.headers.slice(2), rows: raw.rows.map(r => r.slice(2)) };
        renderTable();
    } catch (e) { loadDashboard(); }
}

async function loadRawData(name) {
    container.innerHTML = "<h2>Loading...</h2>";
    try {
        var res = await fetch(GOOGLE_URL + "?action=raw&name=" + encodeURIComponent(name));
        var raw = await res.json();
        currentData = { type: 'raw', name: name, headers: raw.headers, rows: raw.rows };
        renderTable();
    } catch (e) { loadDashboard(); }
}

function renderTable() {
    var html = `<div class="header"><h1>${currentData.team || currentData.name}</h1><button class="nav-btn" onclick="loadDashboard()">BACK</button></div>`;
    html += '<div class="table-wrapper"><table><thead><tr>';
    currentData.headers.forEach((h, i) => { html += `<th onclick="sortTable(${i})">${h} ↕</th>`; });
    html += '</tr></thead><tbody>';
    currentData.rows.forEach(row => { html += '<tr>' + row.map(c => `<td>${c}</td>`).join('') + '</tr>'; });
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
    container.innerHTML = "<h2>Matchups Loading...</h2><button class='nav-btn' onclick='loadDashboard()'>BACK</button>";
    // Reuse your previous Matchup logic here...
}

loadDashboard();