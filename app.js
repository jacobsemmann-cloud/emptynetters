console.log("App v8.2.1 - 2X UI + Matchups Engine Restored");

var GOOGLE_URL = "https://script.google.com/macros/s/AKfycbyiUE8SnfMzVvqxlqeeoyaWXRyF2bDqEEdqBJ4FMIiMlhyCozsEGAowpwe6iiO-KJxN/exec";
var STANDINGS_API = "https://api.allorigins.win/raw?url=" + encodeURIComponent("https://api-web.nhle.com/v1/standings/now");
var SCHEDULE_API = "https://api.allorigins.win/raw?url=" + encodeURIComponent("https://api-web.nhle.com/v1/schedule/now");

var container = document.getElementById('app');
var standings = {}; 
var currentData = null;
var sortDir = 1;

const MAP = { "UTAH": "UTA", "UTM": "UTA", "LA": "LAK", "SJ": "SJS", "TB": "TBL", "NJ": "NJD" };

async function fetchStandings() {
    try {
        var res = await fetch(STANDINGS_API);
        var data = await res.json();
        if (data && data.standings) {
            data.standings.forEach(s => {
                var code = (s.teamAbbrev && s.teamAbbrev.default) ? s.teamAbbrev.default : s.teamAbbrev;
                standings[code.toUpperCase()] = {
                    rec: (s.wins || 0) + "-" + (s.losses || 0) + "-" + (s.otLosses || 0),
                    pts: s.points, gp: s.gamesPlayed, div: s.divisionName, rank: s.divisionSequence
                };
            });
        }
    } catch (e) { console.warn("API Delay"); }
}

async function loadDashboard() {
    container.innerHTML = "<h2>Syncing League Data...</h2>";
    await fetchStandings();
    
    try {
        var res = await fetch(GOOGLE_URL + "?action=dashboard");
        var teams = await res.json();
        var now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        var html = '<div class="header-section"><h1>EMPTYNETTERS</h1><span style="font-size:0.8rem;color:#8b949e">' + now + '</span></div>';
        html += '<div class="global-actions">';
        html += '<button class="raw-btn" onclick="loadMatchups()">DAILY MATCHUPS</button>';
        html += '<button class="raw-btn" onclick="loadRawData(\'RawData\')">PLAYER STATS</button>';
        html += '<button class="raw-btn" onclick="loadRawData(\'VS Empty\')">VS EN</button>';
        html += '<button class="raw-btn" onclick="loadRawData(\'Net Empty\')">WITH EN</button>';
        html += '</div>';

        var divs = { "Atlantic": [], "Metropolitan": [], "Central": [], "Pacific": [] };
        
        teams.forEach(t => {
            let code = t.team.trim().toUpperCase();
            code = MAP[code] || code;
            let s = standings[code] || { rec: "-", pts: "-", gp: "-", div: "Other", rank: 99 };
            
            let d = s.div;
            if (code === "UTA") d = "Central";
            if (["FLA","TBL","TOR","BOS","DET","BUF","OTT","MTL"].includes(code)) d = "Atlantic";
            if (["CAR","NJD","NYR","WSH","NYI","PIT","PHI","CBJ"].includes(code)) d = "Metropolitan";
            if (["WPG","MIN","DAL","COL","NSH","STL","CHI","UTA"].includes(code)) d = "Central";
            if (["VAN","VGK","LAK","EDM","SEA","CGY","ANA","SJS"].includes(code)) d = "Pacific";

            if (divs[d]) divs[d].push({ code: code, s: s });
        });

        ["Atlantic", "Metropolitan", "Central", "Pacific"].forEach(dName => {
            if (divs[dName].length === 0) return;
            divs[dName].sort((a,b) => a.s.rank - b.s.rank);

            html += '<div class="div-label">' + dName + '</div>';
            html += '<table class="s-table"><thead><tr><th style="width:30px">#</th><th>TEAM</th><th class="st-cell">GP</th><th class="st-cell">RECORD</th><th class="p-cell">PTS</th></tr></thead><tbody>';
            
            divs[dName].forEach(team => {
                html += '<tr onclick="loadTeamData(\'' + team.code + '\')">';
                html += '<td style="color:#8b949e; text-align:center">' + (team.s.rank === 99 ? "-" : team.s.rank) + '</td>';
                html += '<td><div class="t-cell"><img src="https://assets.nhle.com/logos/nhl/svg/' + team.code + '_light.svg" class="t-logo">' + team.code + '</div></td>';
                html += '<td class="st-cell">' + team.s.gp + '</td>';
                html += '<td class="st-cell">' + team.s.rec + '</td>';
                html += '<td class="p-cell">' + team.s.pts + '</td>';
                html += '</tr>';
            });
            html += '</tbody></table>';
        });

        container.innerHTML = html;
    } catch (e) { container.innerHTML = "<h1>Error</h1>"; }
}

async function loadMatchups() {
    container.innerHTML = "<h2>Analyzing Matchups...</h2>";
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

        var html = '<div class="header-section"><h1>Predictions</h1><button class="back-btn" onclick="loadDashboard()">BACK</button></div>';

        schedData.gameWeek.forEach(day => {
            if (day.games.length > 0) {
                html += '<h3 style="margin-top: 30px; border-bottom: 1px solid var(--brd); padding-bottom: 5px;">' + day.date + '</h3>';
                html += '<div class="matchup-grid">';

                day.games.forEach(game => {
                    var away = game.awayTeam.abbrev;
                    var home = game.homeTeam.abbrev;
                    var time = new Date(game.startTimeUTC).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                    var awayCloser = (playerENG[away] || []).sort((a,b) => b.score - a.score)[0];
                    var homeCloser = (playerENG[home] || []).sort((a,b) => b.score - a.score)[0];
                    var awayTrap = teamVuln[away] || 0;
                    var homeTrap = teamVuln[home] || 0;

                    html += '<div class="m-card">';
                    html += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">';
                    html += '<span><img src="https://assets.nhle.com/logos/nhl/svg/'+away+'_light.svg" style="width:25px;"> <b>'+away+'</b></span>';
                    html += '<span style="color:var(--acc); font-size:0.8rem;">'+time+'</span>';
                    html += '<span><b>'+home+'</b> <img src="https://assets.nhle.com/logos/nhl/svg/'+home+'_light.svg" style="width:25px;"></span>';
                    html += '</div>';

                    html += '<div style="background: rgba(88, 166, 255, 0.05); border: 1px dashed var(--acc); border-radius: 4px; padding: 10px; font-size: 0.9rem;">';
                    html += '<div style="color: var(--acc); font-weight: bold; margin-bottom:5px;">🎯 PROJECTED CLOSER:</div>';
                    
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
    } catch (e) { loadDashboard(); }
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

loadDashboard();