const API_URL = "https://script.google.com/macros/s/AKfycbxYqfqphuMSHm0eJUae7jlNE89UUa70-SSl1bmhBlHoxv-SSZ0q0l7-eVzUHTlh6isC/exec"; 
const container = document.getElementById('app-container');

// Standard 32 NHL Teams (2025-2026)
const NHL_TEAMS = [
    'ANA', 'BOS', 'BUF', 'CAR', 'CBJ', 'CGY', 'CHI', 'COL', 
    'DAL', 'DET', 'EDM', 'FLA', 'LAK', 'MIN', 'MTL', 'NJD', 
    'NSH', 'NYI', 'NYR', 'OTT', 'PHI', 'PIT', 'SEA', 'SJS', 
    'STL', 'TBL', 'TOR', 'UTA', 'VAN', 'VGK', 'WSH', 'WPG'
];

function getLogo(team) {
    return `https://assets.nhle.com/logos/nhl/svg/${team}_light.svg`;
}

function getPlayerImg(name) {
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase();
    return `<div class="player-mug">${initials}</div>`;
}

// Global state for sorting
let currentData = null;
let sortDirection = 1;

async function loadDashboard() {
    container.innerHTML = "<h1>Loading Dashboard...</h1>";
    try {
        const res = await fetch(`${API_URL}?action=dashboard`);
        const data = await res.json();
        
        // Filter to only show the standard 32 teams
        const filteredData = data.filter(item => NHL_TEAMS.includes(item.team));
        filteredData.sort((a, b) => a.team.localeCompare(b.team));

        let html = `<h1>NHL Dashboard</h1><div class="team-grid">`;
        html += filteredData.map(item => `
            <div class="card" onclick="loadTeamData('${item.team}')">
                <img src="${getLogo(item.team)}" class="team-logo">
                <h3>${item.team}</h3>
                <p>${item.players} Players</p>
            </div>
        `).join('');
        container.innerHTML = html + `</div>`;
    } catch (e) {
        container.innerHTML = "<h1>Error loading data.</h1>";
    }
}

async function loadTeamData(teamName) {
    container.innerHTML = `<h1>Loading ${teamName}...</h1>`;
    try {
        const res = await fetch(`${API_URL}?action=team&name=${teamName}`);
        currentData = await res.json();
        renderTable(currentData);
    } catch (e) {
        container.innerHTML = "<h1>Error loading team.</h1>";
    }
}

function renderTable(data) {
    const playerIdx = data.headers.indexOf("Player");
    let html = `
        <button class="back-btn" onclick="loadDashboard()">← All Teams</button>
        <div style="display:flex; align-items:center; gap:15px; margin-bottom:20px;">
            <img src="${getLogo(data.team)}" style="width:60px;">
            <h1 style="margin:0;">${data.team} Roster</h1>
        </div>
        <div class="table-wrapper">
            <table id="rosterTable">
                <thead>
                    <tr>${data.headers.map((h, i) => `<th onclick="sortTable(${i})">${h}</th>`).join('')}</tr>
                </thead>
                <tbody>
                    ${data.rows.map(row => `
                        <tr>
                            ${row.map((cell, idx) => {
                                if (idx === playerIdx) {
                                    return `<td><div class="player-cell">${getPlayerImg(cell)}<span>${cell}</span></div></td>`;
                                }
                                return `<td>${cell}</td>`;
                            }).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>`;
    container.innerHTML = html;
}

function sortTable(colIndex) {
    sortDirection *= -1;
    currentData.rows.sort((a, b) => {
        let valA = a[colIndex];
        let valB = b[colIndex];

        // Handle numbers/times vs strings
        const numA = parseFloat(valA.toString().replace(/:/g, ''));
        const numB = parseFloat(valB.toString().replace(/:/g, ''));

        if (!isNaN(numA) && !isNaN(numB)) {
            return (numA - numB) * sortDirection;
        }
        return valA.toString().localeCompare(valB.toString()) * sortDirection;
    });
    renderTable(currentData);
}

loadDashboard();