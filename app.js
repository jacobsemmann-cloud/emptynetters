console.log("App version 8.0 - Prediction Engine Live");

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
        html += '<button class="raw-btn" onclick="loadMatchups()">🗓️ Daily Matchups</button>';
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
    container.innerHTML = "<h2>Generating Predictions...</h2>";
    window.scrollTo(0,0);
    
    try {
        // 1. Fetch All Necessary Data in Parallel
        const [schedRes, vsEmptyRes, rawDataRes] = await Promise.all([
            fetch(SCHEDULE_API),
            fetch(GOOGLE_URL + "?action=raw&name=VS Empty"),
            fetch(GOOGLE_URL + "?action=raw&name=RawData")
        ]);

        const schedData = await schedRes.json();
        const vsEmpty = await vsEmptyRes.json();
        const rawPlayers = await rawDataRes.json();

        // 2. Map Team Vulnerability (GA / TOI)
        var teamVuln = {};
        var teamFO = {};
        var vsHeaders = vsEmpty.headers;
        var tIdx = vsHeaders.indexOf("Team");
        var gaIdx = vsHeaders.indexOf("GA");
        var toiIdx = vsHeaders.indexOf("TOI");

        vsEmpty.rows.forEach(row => {
            var team = row[tIdx];
            var ga = parseFloat(row[gaIdx]) || 0;
            var toiParts = row[toiIdx].split(":");
            var toiMins = (parseInt(toiParts[0]) || 0) + (parseInt(toiParts[1]) / 60 || 0);
            teamVuln[team] = toiMins > 0 ? (ga / toiMins) : 0;
        });

        // 3. Map Top Players (The Closers)
        var playerENG = {};
        var pHeaders = rawPlayers.headers;
        var pNameIdx = pHeaders.indexOf("Player");
        var pTeamIdx = pHeaders.indexOf("Team");
        var pToiIdx = pHeaders.indexOf("TOI");
        var pGIdx = pHeaders.indexOf("G"); // ENGs are in G column for this sit
        var pFoIdx = pHeaders.indexOf("Team FO%");

        rawPlayers.rows.forEach(row => {
            var team = row[pTeamIdx];
            var name = row[pNameIdx];
            var g = parseFloat(row[pGIdx]) || 0;
            var toi = parseFloat(row[pToiIdx]) || 0;
            var fo = parseFloat(row[pFoIdx]) || 0;

            if (!playerENG[team]) playerENG[team] = [];
            // Basic Score Formula: Goals * Minutes * Faceoff Advantage
            var score = (g * 5) + (toi * 1.5) + (fo / 10);
            playerENG[team].push({ name: name, score: score });
        });

        // 4. Build the Matchup UI
        var html = '<div class="roster-header">';
        html += '<h1>Upcoming Matchups & Predictions</h1>';
        html += '<button class="back-btn" onclick="loadDashboard()">Back</button></div>';

        schedData.gameWeek.forEach(day => {
            if (day.games.length > 0) {
                var dateParts = day.date.split("-");
                var niceDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
                html += '<h3 style="margin-top: 30px; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">' + niceDate + '</h3>';
                html += '<div class="team-grid" style="grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));">';

                day.games.forEach(game => {
                    var away = game.awayTeam.abbrev;
                    var home = game.homeTeam.abbrev;
                    var startTime = new Date(game.startTimeUTC).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                    // Find Top Closer for both sides
                    var awayCloser = (playerENG[away] || []).sort((a,b) => b.score - a.score)[0];
                    var homeCloser = (playerENG[home] || []).sort((a,b) => b.score - a.score)[0];
                    
                    // Determine which team is the "Vulnerability Trap"
                    var awayTrap = teamVuln[away] || 0;
                    var homeTrap = teamVuln[home] || 0;

                    html += '<div class="card" style="padding: 15px; text-align: left;">';
                    html += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">';
                    html += '<span><img src="https://assets.nhle.com/logos/nhl/svg/'+away+'_light.svg" style="width:30px;"> <b>'+away+'</b></span>';
                    html += '<span style="color:var(--accent-color); font-size:0.8rem;">'+startTime+'</span>';
                    html += '<span><b>'+home+'</b> <img src="https://assets.nhle.com/logos/nhl/svg/'+home+'_light.svg" style="width:30px;"></span>';
                    html += '</div>';

                    // Prediction Row
                    html += '<div style="background: rgba(88, 166, 255, 0.05); border: 1px dashed var(--accent-color); border-radius: 4px; padding: 10px; font-size: 0.85rem;">';
                    html += '<div style="color: var(--accent-color); font-weight: bold; margin-bottom:5px;">🎯 PROJECTED CLOSER:</div>';
                    
                    if (homeTrap > awayTrap && awayCloser) {
                        html += '<b>' + awayCloser.name + '</b> (' + away + ')';
                        html += '<div style="color:#8b949e; font-size:0.75rem;">Targeting ' + home + '\'s high-risk empty net defense.</div>';
                    } else if (homeCloser) {
                        html += '<b>' + homeCloser.name + '</b> (' + home + ')';
                        html += '<div style="color:#8b949e; font-size:0.75rem;">Targeting ' + away + '\'s high-risk empty net defense.</div>';
                    } else {
                        html += 'Data Pending...';
                    }
                    html += '</div></div>';
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

// ... (Rest of existing loadTeamData, loadRawData, renderTable, sortTable functions remain identical to version 7.2)
// I will omit them for brevity, but ensure they are in your final file.