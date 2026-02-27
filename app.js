console.log("App version 8.1.6 - Utah Fix & Compact Engine");

var GOOGLE_URL = "https://script.google.com/macros/s/AKfycbyiUE8SnfMzVvqxlqeeoyaWXRyF2bDqEEdqBJ4FMIiMlhyCozsEGAowpwe6iiO-KJxN/exec";
var STANDINGS_API = "https://api.allorigins.win/raw?url=" + encodeURIComponent("https://api-web.nhle.com/v1/standings/now");

var container = document.getElementById('app');
var standingsData = {}; 
var currentData = null;
var sortDir = 1;

/**
 * Normalization Map: Ensures Utah and other teams match the NHL API keys
 */
const TEAM_MAP = { 
    "UTAH": "UTA", 
    "UTM": "UTA", 
    "LA": "LAK", 
    "SJ": "SJS", 
    "TB": "TBL", 
    "NJ": "NJD",
    "NSH": "NSH"
};

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
    } catch (e) { console.error("Standings Offline", e); }
}

async function loadDashboard() {
    container.innerHTML = "<h2>Syncing Data...</h2>";
    await fetchStandings();
    
    try {
        var res = await fetch(GOOGLE_URL + "?action=dashboard");
        var sheetTeams = await res.json();
        var now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        var html = `
            <div class="header">
                <h1>EMPTYNETTERS</h1>
                <div class="nav-group">
                    <button class="btn" onclick="loadMatchups()">MATCHUPS</button>
                    <button class="btn" onclick="loadRawData('RawData')">PLAYERS</button>
                    <button class="btn" onclick="loadRawData('VS Empty')">VS EN</button>
                    <span style="font-size:10px; color:#8b949e; align-self:center; margin-left:10px;">🟢 ${now}</span>
                </div>
            </div>`;

        // Grouping by Division
        var divisions = { "Atlantic": [], "Metropolitan": [], "Central": [], "Pacific": [] };
        
        sheetTeams.forEach(t => {
            let code = t.team.trim().toUpperCase();
            code = TEAM_MAP[code] || code;
            
            const stats = standingsData[code] || { rec: "-", pts: "-", gp: "-", div: "Other", rank: "-" };
            const div = stats.div || "Other";
            
            if (divisions[div]) {
                divisions[div].push({ code: code, stats: stats });
            } else {
                if (!divisions["Other"]) divisions["Other"] = [];
                divisions["Other"].push({ code: code, stats: stats });
            }
        });

        ["Atlantic", "Metropolitan", "Central", "Pacific"].forEach(divName => {
            if (divisions[divName].length === 0) return;
            divisions[divName].sort((a,b) => a.stats.rank - b.stats.rank);

            html += `
                <div class="div-section">
                    <div class="div-title">${divName} Division</div>
                    <table class="compact-table">
                        <thead>
                            <tr>
                                <th style="width:20px;">#</th>
                                <th>TEAM</th>
                                <th class="center">GP</th>
                                <th class="center">RECORD</th>
                                <th class="center">PTS</th>
                            </tr>
                        </thead>
                        <tbody>`;
            
            divisions[divName].forEach(team => {
                html += `
                    <tr onclick="loadTeamData('${team.code}')">
                        <td class="center" style="color:#8b949e;">${team.stats.rank}</td>
                        <td>
                            <div class="team-box">
                                <img src="https://assets.nhle.com/logos/nhl/svg/${team.code}_light.svg" class="logo">
                                ${team.code}
                            </div>
                        </td>
                        <td class="center">${team.stats.gp}</td>
                        <td class="center" style="font-family:monospace;">${team.stats.rec}</td>
                        <td class="center pts">${team.stats.pts}</td>
                    </tr>`;
            });
            html += `</tbody></table></div>`;
        });

        container.innerHTML = html;
    } catch (e) { container.innerHTML = "<h1>API Sync Error</h1>"; }
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
    container.innerHTML = "<h2>Fetching...</h2>";
    try {
        var res = await fetch(GOOGLE_URL + "?action=raw&name=" + encodeURIComponent(name));
        var raw = await res.json();
        currentData = { type: 'raw', name: name, headers: raw.headers, rows: raw.rows };
        renderTable();
    } catch (e) { loadDashboard(); }
}

function renderTable() {
    var html = `
        <div class="header">
            <h1>${currentData.team || currentData.name}</h1>
            <button class="btn" onclick="loadDashboard()">BACK</button>
        </div>
        <div class="table-wrapper">
            <table>
                <thead><tr>${currentData.headers.map((h, i) => `<th onclick="sortTable(${i})">${h} ↕</th>`).join('')}</tr></thead>
                <tbody>${currentData.rows.map(row => `<tr>${row.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
            </table>
        </div>`;
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
    container.innerHTML = "<h2>Matchups analysis pending...</h2><button class='btn' onclick='loadDashboard()'>BACK</button>";
}

loadDashboard();