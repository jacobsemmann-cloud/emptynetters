const API_URL = "https://script.google.com/macros/s/AKfycbxYqfqphuMSHm0eJUae7jlNE89UUa70-SSl1bmhBlHoxv-SSZ0q0l7-eVzUHTlh6isC/exec"; 
const container = document.getElementById('app-container');

// NHL Logo Helper
function getLogo(team) {
    const mapping = { 'L.A': 'LAK', 'S.J': 'SJS', 'N.J': 'NJD', 'T.B': 'TBL', 'UTA': 'UTA' };
    const key = mapping[team] || team;
    return `https://assets.nhle.com/logos/nhl/svg/${key}_light.svg`;
}

// Player Headshot Logic
function getPlayerImg(name) {
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase();
    return `<div class="player-mug">${initials}</div>`;
}

// 1. Dashboard View
async function loadDashboard() {
    container.innerHTML = "<h1>Loading Dashboard...</h1>";
    try {
        const res = await fetch(`${API_URL}?action=dashboard`);
        const data = await res.json();
        data.sort((a, b) => a.team.localeCompare(b.team));

        let html = `<h1>Empty Netters Dashboard</h1><div class="team-grid">`;
        html += data.map(item => `
            <div class="card" onclick="loadTeamData('${item.team}')">
                <img src="${getLogo(item.team)}" class="team-logo" onerror="this.src='https://placehold.co/100?text=${item.team}'">
                <h3>${item.team}</h3>
                <p style="color: #8b949e;">${item.players} Players</p>
            </div>
        `).join('');
        container.innerHTML = html + `</div>`;
    } catch (e) {
        container.innerHTML = "<h1>Error loading data. Check Permissions.</h1>";
    }
}

// 2. Team View
async function loadTeamData(teamName) {
    window.scrollTo(0,0);
    container.innerHTML = `<h1>Loading ${teamName}...</h1>`;
    
    try {
        const res = await fetch(`${API_URL}?action=team&name=${teamName}`);
        const data = await res.json();

        // Identify the "Player" column for headshots
        const playerIdx = data.headers.indexOf("Player");

        let html = `
            <button class="back-btn" onclick="loadDashboard()">← All Teams</button>
            <div class="roster-header">
                <img src="${getLogo(teamName)}" style="width: 120px;">
                <h1>${teamName} Roster Stats</h1>
            </div>
            <div class="table-wrapper">
                <table>
                    <thead><tr>${data.headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
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
    } catch (e) {
        container.innerHTML = "<h1>Error loading team.</h1>";
    }
}

loadDashboard();