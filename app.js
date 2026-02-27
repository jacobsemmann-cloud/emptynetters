const API_URL = "https://script.google.com/macros/s/AKfycbxYqfqphuMSHm0eJUae7jlNE89UUa70-SSl1bmhBlHoxv-SSZ0q0l7-eVzUHTlh6isC/exec"; // Paste your Web App URL here

async function loadDashboard() {
    const response = await fetch(`${API_URL}?action=dashboard`);
    const data = await response.json();
    
    const container = document.getElementById('dashboard');
    container.innerHTML = data.map(item => `
        <div class="card">
            <h3>${item.team}</h3>
            <p>${item.players} Players</p>
        </div>
    `).join('');
}

loadDashboard();