const GOOGLE_URL = "YOUR_GOOGLE_SCRIPT_WEB_APP_URL"; 
const STANDINGS_API = "https://api-web.nhle.com/v1/standings/now";
const container = document.getElementById('app');

const NHL_TEAMS = [
    'ANA', 'BOS', 'BUF', 'CAR', 'CBJ', 'CGY', 'CHI', 'COL', 
    'DAL', 'DET', 'EDM', 'FLA', 'LAK', 'MIN', 'MTL', 'NJD', 
    'NSH', 'NYI', 'NYR', 'OTT', 'PHI', 'PIT', 'SEA', 'SJS', 
    'STL', 'TBL', 'TOR', 'UTA', 'VAN', 'VGK', 'WSH', 'WPG'
];

let standings = {};
let currentData = null;
let sortDir = 1;

async function fetchStandings() {
    try {
        const res = await fetch(STANDINGS_API);
        const data = await res.json();
        data.standings.forEach(s => {
            standings[s.teamAbbrev.default] = {
                rec: `${s.wins}-${s.losses}-${s.otLosses}`,
                streak: s.l10Record ? s.l10Record.split('').slice(0, 5) : [] 
            };
        });
    } catch (e) { console.error("Standings fetch failed", e); }
}

function getLogo(t) { return `https://assets.nhle.com/logos/nhl/svg/${t}_light.svg`; }

function getDFOLink(team) {
    const dfoMapping = { 'ANA': 'anaheim-ducks', 'BOS': 'boston-bruins', 'BUF': 'buffalo-sabres', 'CAR': 'carolina-hurricanes', 'CBJ': 'columbus-blue-jackets', 'CGY': 'calgary-flames', 'CHI': 'chicago-blackhawks', 'COL': 'colorado-avalanche', 'DAL': 'dallas-stars', 'DET': 'detroit-red-wings', 'EDM': 'edmonton-oilers', 'FLA': 'florida-panthers', 'LAK': 'los-angeles-kings', 'MIN': 'minnesota-wild', 'MTL': 'montreal-canadiens', 'NJD': 'new-jersey-devils', 'NSH': 'nashville-predators', 'NYI': 'new-york-islanders', 'NYR': 'new-york-rangers', 'OTT': 'ottawa-senators', 'PHI': 'philadelphia-flyers', 'PIT': 'pittsburgh-penguins', 'SEA': 'seattle-kraken', 'SJS': 'san-jose-sharks', 'STL': 'st-louis-blues', 'TBL': 'tampa-bay-lightning', 'TOR': 'toronto-maple-leafs', 'UTA': 'utah-hockey-club', 'VAN': 'vancouver-canucks', 'VGK': 'vegas-golden-knights', 'WSH': 'washington-capitals', 'WPG': 'winnipeg-jets' };
    return `https://www.dailyfaceoff.com/teams/${dfoMapping[team]}/line-combinations`;
}

async function loadDashboard() {
    container.innerHTML = "<h2>Loading Stats & Standings...</h2>";
    await fetchStandings();
    try {
        const res = await fetch(`${GOOGLE_URL}?action=dashboard`);
        const data = await res.json();
        const filtered = data.filter(item => NHL_TEAMS.includes(item.team));
        filtered.sort((a, b) => a.team.localeCompare(b.team));

        let html = `<h1>NHL Dashboard</h1><div class="team-grid">`;
        html += filtered.map(item => {
            const s = standings[item.team] || { rec: '0-0-0' };
            return `
            <div class="card" onclick="loadTeamData('${item.team}')">
                <img src="${getLogo(item.team)}" class="team-logo">
                <div style="font-weight:bold; margin:5px 0;">${item.team}</div>
                <div class="record-badge">${s.rec}</div>
            </div>`;
        }).join('');
        container.innerHTML = html + `</div>`;
    } catch (e) { container.innerHTML = "<h1>API Error. Check Permissions.</h1>"; }
}

async function loadTeamData(teamName) {
    container.innerHTML = `<h2>Loading ${teamName}...</h2>`;
    try {
        const res = await fetch(`${GOOGLE_URL}?action=team&name=${teamName}`);
        const raw = await res.json();
        
        // Find Column Indices
        const playerColIdx = raw.headers.indexOf("Player");
        const winIdx = raw.headers.indexOf("Faceoffs Won");
        const lossIdx = raw.headers.indexOf("Faceoffs Lost");

        // 1. Calculate Team FO% before any slicing
        let teamWon = 0; let teamLost = 0;
        raw.rows.forEach(row => {
            teamWon += Number(row[winIdx]) || 0;
            teamLost += Number(row[lossIdx]) || 0;
        });
        const teamTotal = teamWon + teamLost;
        const teamFOPercent = teamTotal > 0 ? ((teamWon / teamTotal) * 100).toFixed(1) + "%" : "0.0%";

        // 2. DYNAMIC SLICE: Start the table exactly where the "Player" column is found
        // This removes the blank column and any unwanted columns to the left.
        const cleanedHeaders = raw.headers.slice(playerColIdx); 
        const cleanedRows = raw.rows.map(row => row.slice(playerColIdx));

        currentData = {
            team: teamName,
            headers: cleanedHeaders,
            rows: cleanedRows,
            teamFO: teamFOPercent
        };

        renderTable();
    } catch (e) { container.innerHTML = "<h1>Error loading team.</h1>"; }
}

function renderTable() {
    const s = standings[currentData.team] || { rec: '0-0-0', streak: [] };
    
    container.innerHTML = `
        <div class="roster-header">
            <div style="display:flex; align-items:center; gap:15px;">
                <img src="${getLogo(currentData.team)}" style="width:70px;">
                <div>
                    <h1 style="margin:0;">${currentData.team}</h1>
                    <div style="display:flex; gap:10px; align-items:center;">
                        <span class="record-badge">${s.rec}</span>
                        <span class="team-fo-badge">Team FO: ${currentData.teamFO}</span>
                    </div>
                    <div class="last-5">${s.streak.map(g => `<div class="pill ${g}">${g}</div>`).join('')}</div>
                </div>
            </div>
            <div style="display:flex; gap:10px;">
                <a href="${getDFOLink(currentData.team)}" target="_blank" class="dfo-btn">Daily Faceoff Lines</a>
                <button onclick="loadDashboard()" style="padding:10px; cursor:pointer; background:#21262d; color:white; border:1px solid #30363d; border-radius:4px;">Back</button>
            </div>
        </div>
        <div class="table-wrapper">
            <table>
                <thead><tr>${currentData.headers.map((h, i) => `<th onclick="sortTable(${i})">${h}</th>`).join('')}</tr></thead>
                <tbody>
                    ${currentData.rows.map(row => `
                        <tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>
                    `).join('')}
                </tbody>
            </table>
        </div>`;
}

function sortTable(idx) {
    sortDir *= -1;
    currentData.rows.sort((a, b) => {
        const nA = parseFloat(a[idx].toString().replace(/[%:]/g, ''));
        const nB = parseFloat(b[idx].toString().replace(/[%:]/g, ''));
        return (!isNaN(nA) && !isNaN(nB)) ? (nA - nB) * sortDir : a[idx].toString().localeCompare(b[idx].toString()) * sortDir;
    });
    renderTable();
}

loadDashboard();