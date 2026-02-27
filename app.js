const GOOGLE_URL = "https://script.google.com/macros/s/AKfycbxYqfqphuMSHm0eJUae7jlNE89UUa70-SSl1bmhBlHoxv-SSZ0q0l7-eVzUHTlh6isC/exec"; 
const NHL_API_STANDINGS = "https://api-web.nhle.com/v1/standings/now";
const container = document.getElementById('app-container');

const NHL_TEAMS = [
    'ANA', 'BOS', 'BUF', 'CAR', 'CBJ', 'CGY', 'CHI', 'COL', 
    'DAL', 'DET', 'EDM', 'FLA', 'LAK', 'MIN', 'MTL', 'NJD', 
    'NSH', 'NYI', 'NYR', 'OTT', 'PHI', 'PIT', 'SEA', 'SJS', 
    'STL', 'TBL', 'TOR', 'UTA', 'VAN', 'VGK', 'WSH', 'WPG'
];

let leagueStandings = {};
let currentData = null;
let sortDir = 1;

// Fetch Live NHL Records
async function fetchStandings() {
    try {
        const res = await fetch(NHL_API_STANDINGS);
        const data = await res.json();
        data.standings.forEach(s => {
            leagueStandings[s.teamAbbrev.default] = {
                wins: s.wins,
                losses: s.losses,
                otl: s.otLosses,
                points: s.points,
                last5: s.l10Record // API provides L10, we'll slice for UI
            };
        });
    } catch (e) { console.error("Standings fetch failed", e); }
}

function getLogo(team) { return `https://assets.nhle.com/logos/nhl/svg/${team}_light.svg`; }

function getDFOLink(team) {
    const dfoMapping = { 'ANA': 'anaheim-ducks', 'BOS': 'boston-bruins', 'BUF': 'buffalo-sabres', 'CAR': 'carolina-hurricanes', 'CBJ': 'columbus-blue-jackets', 'CGY': 'calgary-flames', 'CHI': 'chicago-blackhawks', 'COL': 'colorado-avalanche', 'DAL': 'dallas-stars', 'DET': 'detroit-red-wings', 'EDM': 'edmonton-oilers', 'FLA': 'florida-panthers', 'LAK': 'los-angeles-kings', 'MIN': 'minnesota-wild', 'MTL': 'montreal-canadiens', 'NJD': 'new-jersey-devils', 'NSH': 'nashville-predators', 'NYI': 'new-york-islanders', 'NYR': 'new-york-rangers', 'OTT': 'ottawa-senators', 'PHI': 'philadelphia-flyers', 'PIT': 'pittsburgh-penguins', 'SEA': 'seattle-kraken', 'SJS': 'san-jose-sharks', 'STL': 'st-louis-blues', 'TBL': 'tampa-bay-lightning', 'TOR': 'toronto-maple-leafs', 'UTA': 'utah-hockey-club', 'VAN': 'vancouver-canucks', 'VGK': 'vegas-golden-knights', 'WSH': 'washington-capitals', 'WPG': 'winnipeg-jets' };
    return `https://www.dailyfaceoff.com/teams/${dfoMapping[team]}/line-combinations`;
}

async function loadDashboard() {
    container.innerHTML = "<h1>Loading Stats & Standings...</h1>";
    await fetchStandings();
    
    try {
        const res = await fetch(`${GOOGLE_URL}?action=dashboard`);
        const data = await res.json();
        const filtered = data.filter(item => NHL_TEAMS.includes(item.team));
        filtered.sort((a, b) => a.team.localeCompare(b.team));

        let html = `<h1>NHL Dashboard</h1><div class="team-grid">`;
        html += filtered.map(item => {
            const s = leagueStandings[item.team] || { wins:0, losses:0, otl:0 };
            return `
            <div class="card" onclick="loadTeamData('${item.team}')">
                <img src="${getLogo(item.team)}" class="team-logo">
                <h3>${item.team}</h3>
                <div class="record-text">${s.wins}-${s.losses}-${s.otl}</div>
                <p>${item.players} Players</p>
            </div>`;
        }).join('');
        container.innerHTML = html + `</div>`;
    } catch (e) { container.innerHTML = "<h1>API Error. Check Permissions.</h1>"; }
}

async function loadTeamData(teamName) {
    container.innerHTML = `<h1>Loading ${teamName}...</h1>`;
    try {
        const res = await fetch(`${GOOGLE_URL}?action=team&name=${teamName}`);
        currentData = await res.json();
        renderTable(currentData);
    } catch (e) { container.innerHTML = "<h1>Error loading team.</h1>"; }
}

function renderTable(data) {
    const s = leagueStandings[data.team] || { wins:0, losses:0, otl:0, last5: [] };
    const playerIdx = data.headers.indexOf("Player");
    
    let html = `
        <div class="roster-header">
            <div class="team-info-box">
                <img src="${getLogo(data.team)}" style="width:80px;">
                <div>
                    <h1 style="margin:0;">${data.team} Roster</h1>
                    <div style="font-weight:bold; color:var(--text-dim);">${s.wins}-${s.losses}-${s.otl}</div>
                </div>
            </div>
            <div class="btn-group">
                <a href="${getDFOLink(data.team)}" target="_blank" class="dfo-btn">Daily Faceoff Lines</a>
                <button class="back-btn" onclick="loadDashboard()">Back to Dashboard</button>
            </div>
        </div>
        <div class="table-wrapper">
            <table>
                <thead><tr>${data.headers.map((h, i) => `<th onclick="sortTable(${i})">${h}</th>`).join('')}</tr></thead>
                <tbody>
                    ${data.rows.map(row => `
                        <tr>
                            ${row.map((cell, idx) => idx === playerIdx ? 
                                `<td><div class="player-cell"><div class="player-mug">${cell.split(' ').map(n=>n[0]).join('')}</div>${cell}</div></td>` : 
                                `<td>${cell}</td>`).join('')}
                        </tr>`).join('')}
                </tbody>
            </table>
        </div>`;
    container.innerHTML = html;
}

function sortTable(idx) {
    sortDir *= -1;
    currentData.rows.sort((a, b) => {
        let vA = a[idx], vB = b[idx];
        const nA = parseFloat(vA.toString().replace(/:/g, '')), nB = parseFloat(vB.toString().replace(/:/g, ''));
        return (!isNaN(nA) && !isNaN(nB)) ? (nA - nB) * sortDir : vA.toString().localeCompare(vB.toString()) * sortDir;
    });
    renderTable(currentData);
}

loadDashboard();