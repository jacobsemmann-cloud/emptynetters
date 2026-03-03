console.log("App v8.4.0 - Live ESPN Sportsbook Odds Engine");

var GOOGLE_URL = "https://script.google.com/macros/s/AKfycbyiUE8SnfMzVvqxlqeeoyaWXRyF2bDqEEdqBJ4FMIiMlhyCozsEGAowpwe6iiO-KJxN/exec";
var PROXIES = ["https://api.allorigins.win/raw?url=", "https://corsproxy.io/?"];
var NHL_STANDINGS = "https://api-web.nhle.com/v1/standings/now";
var NHL_SCHEDULE = "https://api-web.nhle.com/v1/schedule/now";

var container = document.getElementById('app');
var cache = { standings: {}, schedule: null, dashboardTeams: null, sheets: {}, teams: {} };
var currentFilter = 'all', sortDir = 1;
const MAP = { "UTAH": "UTA", "UTM": "UTA", "LA": "LAK", "SJ": "SJS", "TB": "TBL", "NJ": "NJD" };

async function smartFetch(url) {
    for (let proxy of PROXIES) {
        try {
            let res = await fetch(proxy + encodeURIComponent(url));
            if (res.ok) return await res.json();
        } catch (e) { console.warn(`Proxy fail: ${proxy}`); }
    }
    return null;
}

/**
 * SPORTSBOOK ODDS API
 * Pulls live Moneyline odds from ESPN's hidden public scoreboard API.
 * We use this because directly scraping FanDuel triggers bot-protection blocks.
 */
async function fetchBettingOdds() {
    let oddsData = {};
    try {
        // ESPN's API natively supports CORS, so we can fetch it directly without a proxy
        let res = await fetch("https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard");
        let data = await res.json();
        
        if (data && data.events) {
            data.events.forEach(event => {
                let comp = event.competitions[0];
                if (comp && comp.odds && comp.odds.length > 0) {
                    let odds = comp.odds[0];
                    let awayAbbrev = comp.competitors.find(c => c.homeAway === 'away').team.abbreviation.toUpperCase();
                    let homeAbbrev = comp.competitors.find(c => c.homeAway === 'home').team.abbreviation.toUpperCase();
                    
                    let awayML = (odds.awayTeamOdds && odds.awayTeamOdds.moneyLine) ? odds.awayTeamOdds.moneyLine : "N/A";
                    let homeML = (odds.homeTeamOdds && odds.homeTeamOdds.moneyLine) ? odds.homeTeamOdds.moneyLine : "N/A";

                    // Format nicely (add + to positive odds, handle Pick'em)
                    if (awayML !== "N/A") {
                        if (awayML > 0) awayML = "+" + awayML;
                        else if (awayML === 0) awayML = "PK";
                    }
                    if (homeML !== "N/A") {
                        if (homeML > 0) homeML = "+" + homeML;
                        else if (homeML === 0) homeML = "PK";
                    }

                    oddsData[awayAbbrev] = awayML;
                    oddsData[homeAbbrev] = homeML;
                }
            });
        }
        
        // ESPN uses slightly different team acronyms than the NHL API
        const espnMap = { "WAS": "WSH", "SJ": "SJS", "TB": "TBL", "NJ": "NJD", "LA": "LAK", "UTAH": "UTA" };
        let normalizedOdds = {};
        for (let key in oddsData) {
            let cleanKey = espnMap[key] || key;
            normalizedOdds[cleanKey] = oddsData[key];
        }
        
        return normalizedOdds;
    } catch (e) {
        console.warn("Failed to fetch odds from ESPN API.", e);
        return {}; 
    }
}

async function init() {
    if (Object.keys(cache.standings).length === 0) {
        const [stdData, schData] = await Promise.all([smartFetch(NHL_STANDINGS), smartFetch(NHL_SCHEDULE)]);
        if (stdData && stdData.standings) {
            stdData.standings.forEach(s => {
                let code = (s.teamAbbrev && s.teamAbbrev.default) ? s.teamAbbrev.default : s.teamAbbrev;
                cache.standings[code.toUpperCase()] = {
                    rec: (s.wins || 0) + "-" + (s.losses || 0) + "-" + (s.otLosses || 0),
                    pts: s.points, gp: s.gamesPlayed, div: s.divisionName, rank: s.divisionSequence, fullName: s.teamName.default
                };
            });
        }
        cache.schedule = schData;
    }
}

function setFilter(type) { currentFilter = type; loadDashboard(); }

async function loadDashboard() {
    container.innerHTML = "<h2>Syncing League Data...</h2>";
    await init();
    try {
        if (!cache.dashboardTeams) {
            let res = await fetch(GOOGLE_URL + "?action=dashboard");
            cache.dashboardTeams = await res.json();
        }
        let now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        let html = `<div class="header-section"><div class="header-container"><div style="flex:1;"></div><div style="flex:2; text-align:center;"><h1>EMPTYNETTERS</h1><span style="font-size:0.8rem;color:#8b949e">🟢 Live • ${now}</span></div><div style="flex:1;"></div></div></div>
            <div class="global-actions">
                <button class="raw-btn" onclick="loadMatchups()">DAILY MATCHUPS</button>
                <button class="raw-btn" onclick="loadRawData('RawData')">PLAYER STATS</button>
                <button class="raw-btn" onclick="loadRawData('VS Empty')">VS EN</button>
                <button class="raw-btn" onclick="loadRawData('Net Empty')">WITH EN</button>
            </div>
            <div class="filter-bar">
                <button class="filter-btn ${currentFilter === 'all' ? 'active' : ''}" onclick="setFilter('all')">All Teams</button>
                <button class="filter-btn ${currentFilter === 'today' ? 'active' : ''}" onclick="setFilter('today')">Playing Today</button>
                <button class="filter-btn ${currentFilter === 'tomorrow' ? 'active' : ''}" onclick="setFilter('tomorrow')">Playing Tomorrow</button>
            </div>`;

        let pToday = [], pTomorrow = [];
        if (cache.schedule && cache.schedule.gameWeek) {
            cache.schedule.gameWeek[0]?.games.forEach(g => pToday.push(g.awayTeam.abbrev, g.homeTeam.abbrev));
            cache.schedule.gameWeek[1]?.games.forEach(g => pTomorrow.push(g.awayTeam.abbrev, g.homeTeam.abbrev));
        }

        let divs = { "Atlantic": [], "Metropolitan": [], "Central": [], "Pacific": [] };
        cache.dashboardTeams.forEach(t => {
            let code = (MAP[t.team.trim().toUpperCase()] || t.team.trim().toUpperCase());
            if (currentFilter === 'today' && !pToday.includes(code)) return;
            if (currentFilter === 'tomorrow' && !pTomorrow.includes(code)) return;
            let s = cache.standings[code] || { rec: "-", pts: "-", gp: "-", div: "Other", rank: 99, fullName: code };
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
            html += `<div class="div-label">${dName}</div><table class="s-table"><tbody>`;
            divs[dName].forEach(team => {
                html += `<tr onclick="loadTeamData('${team.code}')">
                    <td style="color:#8b949e; width:30px; text-align:center;">${team.s.rank === 99 ? "-" : team.s.rank}</td>
                    <td><div class="t-cell"><img src="https://assets.nhle.com/logos/nhl/svg/${team.code}_light.svg" class="t-logo">${team.s.fullName || team.code}</div></td>
                    <td class="st-cell">${team.s.gp}</td><td class="st-cell">${team.s.rec}</td><td class="p-cell">${team.s.pts}</td>
                </tr>`;
            });
            html += `</tbody></table>`;
        });
        container.innerHTML = html;
    } catch (e) { container.innerHTML = "<h1>Dashboard Sync Error</h1>"; }
}

async function loadMatchups() {
    container.innerHTML = "<h2>Analyzing Matchups & Fetching Odds...</h2>";
    window.scrollTo(0,0);
    try {
        let gameOdds = {};
        if (!cache.sheets["VS Empty"] || !cache.sheets["RawData"]) {
            const [vsRes, rawRes, oddsRes] = await Promise.all([
                fetch(GOOGLE_URL + "?action=raw&name=VS Empty").then(r => r.json()),
                fetch(GOOGLE_URL + "?action=raw&name=RawData").then(r => r.json()),
                fetchBettingOdds()
            ]);
            cache.sheets["VS Empty"] = vsRes; cache.sheets["RawData"] = rawRes; gameOdds = oddsRes;
        } else {
            gameOdds = await fetchBettingOdds(); 
        }

        let vsE = cache.sheets["VS Empty"], rawP = cache.sheets["RawData"], teamV = {};
        vsE.rows.forEach(row => {
            let t = row[vsE.headers.indexOf("Team")], ga = parseFloat(row[vsE.headers.indexOf("GA")]) || 0;
            let toiS = row[vsE.headers.indexOf("TOI")] || "0:00", p = toiS.split(":");
            let m = (parseInt(p[0]) || 0) + (parseInt(p[1]) / 60 || 0);
            teamV[t] = m > 0 ? (ga / m) : 0;
        });
        let playerE = {};
        rawP.rows.forEach(row => {
            let t = row[rawP.headers.indexOf("Team")];
            if (!playerE[t]) playerE[t] = [];
            let g = parseFloat(row[rawP.headers.indexOf("G")]) || 0, toi = parseFloat(row[rawP.headers.indexOf("TOI")]) || 0, f = parseFloat(row[rawP.headers.indexOf("Team FO%")]) || 0;
            playerE[t].push({ name: row[rawP.headers.indexOf("Player")], score: (g * 5) + (toi * 1.5) + (f / 10) });
        });

        let html = `<div class="header-section"><div class="header-container"><div style="flex: 1; text-align: left;"><button class="back-btn" onclick="loadDashboard()">BACK</button></div><div style="flex: 2; text-align: center;"><h1></h1></div><div style="flex: 1;"></div></div></div>`;
        if (cache.schedule && cache.schedule.gameWeek) {
            cache.schedule.gameWeek.forEach(day => {
                if (day.games.length > 0) {
                    html += `<h3 style="margin-top: 30px; border-bottom: 1px solid var(--brd); padding-bottom: 5px;">${day.date}</h3><div class="matchup-grid">`;
                    day.games.forEach(game => {
                        let away = game.awayTeam.abbrev, home = game.homeTeam.abbrev, time = new Date(game.startTimeUTC).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        let aC = (playerE[away] || []).sort((a,b) => b.score - a.score)[0], hC = (playerE[home] || []).sort((a,b) => b.score - a.score)[0], aT = teamV[away] || 0, hT = teamV[home] || 0;
                        
                        let awayOdds = gameOdds[away] || "N/A", homeOdds = gameOdds[home] || "N/A";

                        html += `
                            <div class="m-card">
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                                    <span style="display:flex; flex-direction:column; align-items:flex-start;">
                                        <span><img src="https://assets.nhle.com/logos/nhl/svg/${away}_light.svg" style="width:25px; vertical-align:middle;"> <b>${away}</b></span>
                                        <span style="font-size:0.75rem; color:#8b949e; margin-top:3px;">ML: <span style="color:var(--txt)">${awayOdds}</span></span>
                                    </span>
                                    <span style="color:var(--acc); font-size:0.8rem; font-weight:bold;">${time}</span>
                                    <span style="display:flex; flex-direction:column; align-items:flex-end;">
                                        <span><b>${home}</b> <img src="https://assets.nhle.com/logos/nhl/svg/${home}_light.svg" style="width:25px; vertical-align:middle;"></span>
                                        <span style="font-size:0.75rem; color:#8b949e; margin-top:3px;">ML: <span style="color:var(--txt)">${homeOdds}</span></span>
                                    </span>
                                </div>
                                <div style="background: rgba(88, 166, 255, 0.05); border: 1px dashed var(--acc); border-radius: 4px; padding: 10px; font-size: 0.9rem;">
                                    <div style="color: var(--acc); font-weight: bold; margin-bottom:5px;">🎯 PROJECTED CLOSER:</div>`;
                        if (hT > aT && aC) { html += `<b>${aC.name}</b> (${away})`; } else if (hC) { html += `<b>${hC.name}</b> (${home})`; } else { html += 'Calculating...'; }
                        html += `</div></div>`;
                    });
                    html += `</div>`;
                }
            });
        }
        container.innerHTML = html;
    } catch (e) { loadDashboard(); }
}

function reorderTeamStats(data) {
    const h = data.headers, pIdx = h.indexOf("Point %"), gaIdx = h.indexOf("GA"), gfIdx = h.indexOf("GF");
    if (pIdx !== -1 && gaIdx !== -1 && gfIdx !== -1) {
        let newHeaders = [...h], colsToMove = [];
        [gaIdx, gfIdx].sort((a,b) => b-a).forEach(idx => colsToMove.push(newHeaders.splice(idx, 1)[0]));
        colsToMove.reverse();
        newHeaders.splice(newHeaders.indexOf("Point %") + 1, 0, ...colsToMove);
        let newRows = data.rows.map(row => {
            let rowGA = row[gaIdx], rowGF = row[gfIdx], newRow = [...row];
            [gaIdx, gfIdx].sort((a,b) => b-a).forEach(idx => newRow.splice(idx, 1));
            newRow.splice(newRow.indexOf(row[pIdx]) + 1, 0, rowGA, rowGF);
            return newRow;
        });
        return { ...data, headers: newHeaders, rows: newRows };
    }
    return data;
}

async function loadRawData(name) {
    if (cache.sheets[name]) {
        let data = cache.sheets[name];
        if (name === "VS Empty" || name === "Net Empty") data = reorderTeamStats(data);
        renderTable({ name: name, headers: data.headers, rows: data.rows }); return;
    }
    container.innerHTML = "<h2>Fetching Stats...</h2>";
    try {
        let res = await fetch(GOOGLE_URL + "?action=raw&name=" + encodeURIComponent(name)).then(r => r.json());
        cache.sheets[name] = res; let data = res;
        if (name === "VS Empty" || name === "Net Empty") data = reorderTeamStats(data);
        renderTable({ name: name, headers: data.headers, rows: data.rows });
    } catch (e) { loadDashboard(); }
}

async function loadTeamData(team) {
    if (cache.teams[team]) { renderTable(cache.teams[team]); return; }
    container.innerHTML = `<h2>Loading ${team}...</h2>`;
    try {
        let res = await fetch(GOOGLE_URL + "?action=team&name=" + team).then(r => r.json());
        let data = { type: 'team', team: team, headers: res.headers.slice(2), rows: res.rows.map(r => r.slice(2)) };
        cache.teams[team] = data; renderTable(data);
    } catch (e) { loadDashboard(); }
}

function renderTable(data) {
    let title = data.team || (data.name === "RawData" ? "" : data.name);
    currentData = data;
    let html = `<div class="header-section"><div class="header-container"><div style="flex: 1; text-align: left;"><button class="back-btn" onclick="loadDashboard()">BACK</button></div><div style="flex: 2; text-align: center;"><h1>${title}</h1></div><div style="flex: 1;"></div></div></div>
        <div class="table-wrapper"><table><thead><tr>${data.headers.map((h, i) => `<th onclick="sortTable(${i})">${h}</th>`).join('')}</tr></thead><tbody>
        ${data.rows.map(row => `<tr>${row.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    container.innerHTML = html;
}

function sortTable(idx) {
    sortDir *= -1;
    currentData.rows.sort((a, b) => {
        let nA = parseFloat(a[idx].toString().replace(/[%$,]/g, '')), nB = parseFloat(b[idx].toString().replace(/[%$,]/g, ''));
        return (!isNaN(nA) && !isNaN(nB)) ? (nA - nB) * sortDir : a[idx].toString().localeCompare(b[idx].toString()) * sortDir;
    });
    renderTable(currentData);
}

loadDashboard();