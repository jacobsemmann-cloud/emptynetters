// STEP 0: Check if script loaded
console.log("App.js version 2.1 loaded");

const GOOGLE_URL = "https://script.google.com/macros/s/AKfycbyiUE8SnfMzVvqxlqeeoyaWXRyF2bDqEEdqBJ4FMIiMlhyCozsEGAowpwe6iiO-KJxN/exec";
const STANDINGS_API = "https://api-web.nhle.com/v1/standings/now";
const container = document.getElementById('app');

const NHL_TEAMS = ['ANA', 'BOS', 'BUF', 'CAR', 'CBJ', 'CGY', 'CHI', 'COL', 'DAL', 'DET', 'EDM', 'FLA', 'LAK', 'MIN', 'MTL', 'NJD', 'NSH', 'NYI', 'NYR', 'OTT', 'PHI', 'PIT', 'SEA', 'SJS', 'STL', 'TBL', 'TOR', 'UTA', 'VAN', 'VGK', 'WSH', 'WPG'];

let standings = {};
let currentData = null;
let sortDir = 1;

async function fetchStandings() {
    console.log("Step 1: Fetching NHL Standings...");
    try {
        const res = await fetch(STANDINGS_API);
        const data = await res.json();
        data.standings.forEach(s => {
            standings[s.teamAbbrev.default] = {
                rec: `${s.wins}-${s.losses}-${s.otLosses}`,
                streak: s.l10Record ? s.l10Record.split('').slice(0, 5) : []
            };
        });
        console.log("Step 1 Success: Standings loaded");
    } catch (e) { 
        console.error("Step 1 Fail: Standings API down", e); 
    }
}

async function loadDashboard() {
    container.innerHTML = "<h2>Loading League Stats...</h2>";
    await fetchStandings();
    
    console.log("Step 2: Fetching Google Sheet Data...");
    try {
        const res = await fetch(`${GOOGLE_URL}?action=dashboard`);
        if (!res.ok) throw new Error("Google Script returned an error status");
        
        const data = await res.json();
        console.log("Step 2 Success: Data received", data);

        const filtered = data.filter(item => NHL_TEAMS.includes(item.team)).sort((a, b) => a.team.localeCompare(b.team));

        let html = `<h1>NHL Dashboard</h1><div class="team-grid">`;
        html += filtered.map(item => {
            const s = standings[item.team] || { rec: '0-0-0' };
            return `<div class="card" onclick="loadTeamData('${item.team}')">
                <img src="https://assets.nhle.com/logos/nhl/svg/${item.team}_light.svg" class="team-logo">
                <div style="font-weight:bold; margin:5px 0;">${item.team}</div>
                <div class="record-badge">${s.rec}</div>
            </div>`;
        }).join('');
        container.innerHTML = html + `</div>`;
    } catch (e) { 
        console.error("Step 2 Fail: Google Fetch Error", e);
        container.innerHTML = `<h1>Connection Error</h1><p>Check if your Google Web App URL is correct and deployed to 'Anyone'.</p>`;
    }
}

async function loadTeamData(teamName) {
    container.innerHTML = `<h2>Loading ${teamName}...</h2>`;
    window.scrollTo(0,0);
    try {
        const res = await fetch(`${GOOGLE_URL}?action=team&name=${teamName}`);
        const raw = await res.json();
        
        const heads = raw.headers.map(h => h.toString().trim().toLowerCase());
        const playerIdx = heads.indexOf("player");
        const winIdx = heads.indexOf("faceoffs won");
        const lossIdx = heads.indexOf("faceoffs lost");

        let teamWon = 0, teamLost = 0;
        raw.rows.forEach(row => {
            teamWon += Number(row[winIdx]) || 0;
            teamLost += Number(row[lossIdx]) || 0;
        });
        const teamTotal = teamWon + teamLost;
        const teamFO = teamTotal > 0 ? ((teamWon / teamTotal) * 100).toFixed(1) + "%" : "0.0%";

        const start = playerIdx === -1 ? 0 : playerIdx;

        currentData = {
            team: teamName,
            headers: raw.headers.slice(start),
            rows: raw.rows.map(r => r.slice(start)),
            teamFO: teamFO
        };
        renderTable();
    } catch (e) { 
        console.error("Error loading team data", e);
        container.innerHTML = "<h1>Error loading team.</h1>"; 
    }
}

function renderTable() {
    const s = standings[currentData.team] || { rec: '0-0-0', streak: [] };
    container.innerHTML = `
        <div class="roster-header">
            <div style="display:flex; align-items:center; gap:15px;">
                <img src="https://assets.nhle.com/logos/nhl/svg/${currentData.team}_light.svg" style="width:70px;">
                <div>
                    <h1 style="margin:0;">${currentData.team}</h1>
                    <div style="display:flex; gap:10px; align-items:center;">
                        <span class="record-badge">${s.rec}</span>
                        <span class="team-fo-badge">Team FO: ${currentData.teamFO}</span>
                    </div>
                    <div class="last-5">${s.streak.map(g => `<div class="pill ${g}">${g}</div>`).join('')}</div>
                </div>
            </div>
            <button onclick="loadDashboard()" style="padding:10px; cursor:pointer; background:#21262d; color:white; border:1px solid #30363d; border-radius:4px;">Back</button>
        </div>
        <div class="table-wrapper">
            <table>
                <thead><tr>${currentData.headers.map((h, i) => `<th onclick="sortTable(${i})">${h}</th>`).join('')}</tr></thead>
                <tbody>
                    ${currentData.rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}
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

// START THE APP
loadDashboard();