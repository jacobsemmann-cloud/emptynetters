const GOOGLE_URL = "https://script.google.com/macros/s/AKfycbxYqfqphuMSHm0eJUae7jlNE89UUa70-SSl1bmhBlHoxv-SSZ0q0l7-eVzUHTlh6isC/exec"; 
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
    const dfoMapping = { 'ANA': 'anaheim-ducks', 'BOS': 'boston-bruins', 'BUF': 'buffalo-sabres', 'CAR': 'carolina-hurricanes', 'CBJ': 'columbus-blue-jackets', 'CGY': 'calgary-flames', 'CHI': 'chicago-blackhawks', 'COL': 'colorado-avalanche', 'DAL': 'dallas-stars', 'DET': 'detroit-red-wings', 'EDM': 'edmonton-oilers', 'FLA': 'florida-panthers', 'LAK': 'los-angeles-kings', 'MIN': 'minnesota-wild', 'MTL': 'montreal-canadiens', 'NJD': 'new-jersey-devils', 'NSH': 'nashville-predators', 'NYI': 'new-york-islanders', 'NYR': 'new-york-rangers', 'OTT': 'ottawa-senators', 'PHI': 'philadelphia-flyers', 'PIT': 'pittsburgh-penguins', 'SEA': 'seattle-kraken', 'SJS': 'san-jose-sharks', 'STL': 'st-louis-blues', 'TBL': 'tampa-bay-lightning', 'TOR