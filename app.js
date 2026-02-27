console.log("App version 9.0 - Saturday Slate Engine");

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

// --- DATA FETCHING ---

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
        html += '<span class="sync-time">🟢 Live • ' + lastSyncTime + '</span></div>';
        
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

// --- NEW PREDICTION LOGIC ---

async function loadMatchups() {
    container.innerHTML = "<h2>Generating Saturday Slate...</h2>";
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

        // 1. Map Opponent Vulnerability (ENG Allowed)
        var engAllowed = {};
        var vsHeaders = vsEmpty.headers;
        var tIdx = vsHeaders.indexOf("Team");
        var gaIdx = vsHeaders.indexOf("GA"); // Total goals allowed vs empty net

        vsEmpty.rows.forEach(row => {
            var team = row[tIdx];
            var ga = parseFloat(row[gaIdx]) || 0;
            engAllowed[team] = ga; 
        });

        // 2. Parse Players & Find Team Faceoff Anchors
        var teamPlayers = {};
        var teamAnchors = {}; // Holds the Name of the player with most FO_eng
        
        var pHeaders = rawPlayers.headers;
        var pNameIdx = pHeaders.indexOf("Player");
        var pTeamIdx = pHeaders.indexOf("Team");
        var pGIdx = pHeaders.indexOf("G"); 
        var pFoIdx = pHeaders.indexOf("FO_eng"); // Specifically looking at Net Empty FOs
        var pToiIdx = pHeaders.indexOf("TOI");
        var pPkIdx = pHeaders.indexOf("PK_Status"); // Boolean or Flag in your sheet

        rawPlayers.rows.forEach(row => {
            var team = row[pTeamIdx];
            if (!teamPlayers[team]) teamPlayers[team] = [];
            
            var pData = {
                name: row[pNameIdx],
                g: parseFloat(row[pGIdx]) || 0,
                fo: parseFloat(row[pFoIdx]) || 0,
                toi: parseFloat(row[pToiIdx]) || 0,
                isPK: row[pPkIdx] === "TRUE" || row[pPkIdx] === "1"
            };
            
            teamPlayers[team].push(pData);

            // Track Anchor
            if (!teamAnchors[team] || pData.fo > teamAnchors[team].fo) {
                teamAnchors[team] = { name: pData.name, fo: pData.fo };
            }
        });

        var html = '<div class="roster-header"><h1>Closer Unit Predictions</h1><button class="back-btn" onclick="loadDashboard()">Back</button></div>';

        schedData.gameWeek.forEach(day => {
            if (day.games.length > 0) {
                var dParts = day.date.split("-");
                var niceDate = new Date(dParts[0], dParts[1] - 1, dParts[2]).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
                html += '<h3 style="margin-top: 30px; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">' + niceDate + '</h3>';
                html += '<div class="team-grid" style="grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));">';

                day.games.forEach(game => {
                    var away = game.awayTeam.abbrev;
                    var home = game.homeTeam.abbrev;
                    var time = new Date(game.startTimeUTC).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                    const processTeam = (team, opp) => {
                        var players = teamPlayers[team] || [];
                        var anchorName = teamAnchors[team] ? teamAnchors[team].name : "";
                        var oppAllowed = engAllowed[opp] || 0;

                        return players.map(p => {
                            // SYNERGY: Same line as anchor (Placeholder: in this script we assume top 3 players share ice)
                            // Ideally, cross-reference with your 'Lines' data if available
                            var synergyBonus = (p.name === anchorName) ? 5 : 0; 
                            
                            // FORMULA: (G*15) + (FO*5) + (Syn*5) + (OppAllowed*2)
                            var rawScore = (p.g * 15) + (p.fo * 5) + synergyBonus + (oppAllowed * 2);
                            return { ...p, finalScore: rawScore };
                        }).sort((a,b) => b.finalScore - a.finalScore);
                    };

                    var awayClosers = processTeam(away, home);
                    var homeClosers = processTeam(home, away);

                    html += '<div class="card" style="padding: 15px; text-align: left; border-left: 4px solid var(--accent-color);">';
                    html += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom: 1px solid #333; padding-bottom: 8px;">';
                    html += '<span><b>'+away+'</b> vs <b>'+home+'</b></span>';
                    html += '<span style="color:var(--accent-color); font-size:0.8rem; font-weight:bold;">'+time+'</span>';
                    html += '</div>';

                    const renderUnit = (team, closers) => {
                        if (closers.length === 0) return '<div>No Data</div>';
                        var c1 = closers[0];
                        var c2 = closers[1] || { name: "N/A" };
                        // Sleeper: High TOI PKer not in top 2
                        var sleeper = closers.find(p => p.isPK && p.name !== c1.name && p.name !== c2.name) || closers[2] || { name: "N/A" };
                        
                        var res = '<div style="margin-bottom:10px;">';
                        res += '<div style="font-size:0.75rem; color:#888; text-transform:uppercase;">'+team+' CLOSERS:</div>';
                        res += '<div style="font-size:1.1rem;">🎯 <b>'+c1.name+'</b> <small>('+(c1.finalScore/15).toFixed(1)+')</small></div>';
                        res += '<div style="font-size:1rem; color:#ccc;">🥈 '+c2.name+'</div>';
                        res += '<div style="margin-top:5px; padding:4px 8px; background:rgba(56,189,248,0.1); border-radius:4px; font-size:0.85rem; color:var(--accent-color);">';
                        res += '🛡️ SLEEPER: '+sleeper.name+'</div>';
                        res += '</div>';
                        return res;
                    };

                    html += renderUnit(away, awayClosers);
                    html += '<div style="height:1px; background:#444; margin:10px 0;"></div>';
                    html += renderUnit(home, homeClosers);
                    
                    html += '</div>';
                });
                html += '</div>';
            }
        });
        container.innerHTML = html;
    } catch (e) {
        console.error(e);
        container.innerHTML = "<h1>Error loading predictions.</h1><button class='back-btn' onclick='loadDashboard()'>Go Back</button>";
    }
}

// --- TABLE & SORTING (KEEPING YOUR EXISTING CODE) ---

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