const API_URL = "YOUR_GOOGLE_SCRIPT_WEB_APP_URL"; // Make sure your URL is here!

const container = document.getElementById('dashboard');

// 1. Load the main Dashboard
async function loadDashboard() {
    container.innerHTML = "<h2>Loading League Dashboard...</h2>";
    try {
        const response = await fetch(`${API_URL}?action=dashboard`);
        const data = await response.json();
        
        let html = `<h1>NHL Team Overviews</h1><div class="team-grid">`;
        html += data.map(item => `
            <div class="card" onclick="loadTeamData('${item.team}')" style="cursor:pointer">
                <h3>${item.team}</h3>
                <p>${item.players} Players tracked</p>
                <small>Click to view roster →</small>
            </div>
        `).join('');
        html += `</div>`;
        
        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = "Error loading dashboard. Check Google Script permissions.";
    }
}

// 2. Load Specific Team Data
async function loadTeamData(teamName) {
    container.innerHTML = `<h2>Loading ${teamName} stats...</h2>`;
    
    try {
        const response = await fetch(`${API_URL}?action=team&name=${teamName}`);
        const data = await response.json();

        let html = `
            <button onclick="loadDashboard()" style="margin-bottom: 20px; padding: 10px;">← Back to Teams</button>
            <h1>${data.team} Player Stats</h1>
            <div style="overflow-x:auto;">
                <table border="1" style="width:100%; border-collapse: collapse; text-align: left;">
                    <thead>
                        <tr style="background: #444;">
                            ${data.headers.map(h => `<th style="padding: 10px;">${h}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${data.rows.map(row => `
                            <tr>
                                ${row.map(cell => `<td style="padding: 8px; border-bottom: 1px solid #444;">${cell}</td>`).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = "Error loading team data.";
    }
}

// Start the app
loadDashboard();