/**
 * Match Outcome Slip Generator
 * Single-file bundled version for local file:// compatibility
 */

// ==========================================
// 1. Constants & Types
// ==========================================
const OUTCOME = {
    HOME: '1',
    DRAW: 'X',
    AWAY: '2'
};

const CONSTANTS = {
    DEFAULT_SLIP_COUNT: 5,
    MAX_RETRIES: 100
};

// ==========================================
// 2. Generator Logic
// ==========================================
class Generator {
    constructor() {
        this.matches = [];
    }

    setMatches(matches) {
        this.matches = matches;
    }

    generate(count, config) {
        const slips = [];
        for (let i = 0; i < count; i++) {
            const slip = this._generateSingleSlip(config);
            slips.push({
                id: `SLIP-${Date.now()}-${i + 1}`,
                outcomes: slip
            });
        }
        return slips;
    }

    _generateSingleSlip(config) {
        const outcomes = [];
        let consecutiveCount = 0;
        let lastOutcome = null;

        for (const match of this.matches) {
            let outcome;
            let isValid = false;
            let attempts = 0;

            // Try to generate a valid outcome
            while (!isValid && attempts < 20) {
                outcome = this._weightedRandom(config.distribution);

                // Check consecutive constraint
                if (outcome === lastOutcome) {
                    if (consecutiveCount >= config.maxConsecutive) {
                        attempts++;
                        continue;
                    }
                }
                isValid = true;
            }

            // Fallback
            if (!isValid) {
                outcome = this._forceDifferent(lastOutcome);
            }

            // Update trackers
            if (outcome === lastOutcome) {
                consecutiveCount++;
            } else {
                consecutiveCount = 1;
                lastOutcome = outcome;
            }

            outcomes.push({
                matchId: match.id,
                match: match,
                outcome: outcome
            });
        }
        return outcomes;
    }

    _weightedRandom(dist) {
        let total = dist.home + dist.draw + dist.away;

        // Safety: If all are 0, default to equal chance (1/3 each)
        if (total <= 0) {
            // Implicitly treat as 33/33/33
            const r = Math.random();
            if (r < 0.333) return OUTCOME.HOME;
            if (r < 0.666) return OUTCOME.DRAW;
            return OUTCOME.AWAY;
        }

        const rand = Math.random() * total;

        if (rand < dist.home) return OUTCOME.HOME;
        if (rand < dist.home + dist.draw) return OUTCOME.DRAW;
        return OUTCOME.AWAY;
    }

    _forceDifferent(avoidOutcome) {
        const options = Object.values(OUTCOME).filter(o => o !== avoidOutcome);
        return options[Math.floor(Math.random() * options.length)];
    }
}

// ==========================================
// 3. Application Controller
// ==========================================
class App {
    constructor() {
        this.generator = new Generator();

        // State
        this.allSlips = [];
        this.currentPage = 1;
        this.pageSize = 50;

        // Ensure DOM is loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    init() {
        this.setupEventListeners();
        this.setupPaginationListeners();
    }

    updateMatchCount(count) {
        const badge = document.getElementById('match-count');
        if (badge) {
            badge.textContent = `${count} matches loaded`;
            badge.className = count > 0 ? 'badge gradient' : 'badge';
        }
    }

    setupEventListeners() {
        // Core Buttons
        const btns = {
            generate: document.getElementById('btn-generate'),
            addMatch: document.getElementById('btn-add-match'),
            clear: document.getElementById('btn-clear')
        };

        // Inputs
        const inputs = {
            mainMatch: document.getElementById('match-input'),
            home: document.getElementById('input-home'),
            away: document.getElementById('input-away')
        };

        // 1. Generation Logic
        if (btns.generate) {
            btns.generate.addEventListener('click', () => this.handleGenerate());
        }

        // 2. Clear Logic
        if (btns.clear && inputs.mainMatch) {
            btns.clear.addEventListener('click', () => {
                inputs.mainMatch.value = '';
                this.updateMatchCount(0);
            });
        }

        // 3. Manual Input Logic
        if (inputs.mainMatch) {
            inputs.mainMatch.addEventListener('input', (e) => {
                this.handleInput(e);
                this.recalcSmartFormula();
            });
        }

        // 4. Quick Add Logic (Match Builder)
        if (btns.addMatch) {
            btns.addMatch.addEventListener('click', () => this.addMatchFromBuilder());
        }

        // 5. Keyboard Support (Navigating between home -> away -> add)
        const handleEnter = (e) => {
            if (e.key === 'Enter') {
                if (e.target.id === 'input-home' && inputs.away) {
                    inputs.away.focus();
                } else if (e.target.id === 'input-away') {
                    this.addMatchFromBuilder();
                }
            }
        };

        if (inputs.home) inputs.home.addEventListener('keydown', handleEnter);
        if (inputs.away) inputs.away.addEventListener('keydown', handleEnter);

        // Initial State
        this.populateTeamList();
    }

    autoFetchMatches(count = 15, region = 'all') {
        // Teams Database Categorized
        const db = {
            epl: [
                "Arsenal", "Aston Villa", "Bournemouth", "Brentford", "Brighton", "Burnley",
                "Chelsea", "Crystal Palace", "Everton", "Fulham", "Liverpool", "Luton Town",
                "Man City", "Man Utd", "Newcastle", "Nottm Forest", "Sheffield Utd", "Tottenham", "West Ham", "Wolves"
            ],
            laliga: [
                "Alaves", "Almeria", "Athletic Bilbao", "Atletico Madrid", "Barcelona", "Cadiz",
                "Celta Vigo", "Getafe", "Girona", "Granada", "Las Palmas", "Mallorca", "Osasuna",
                "Rayo Vallecano", "Real Betis", "Real Madrid", "Real Sociedad", "Sevilla", "Valencia", "Villarreal"
            ],
            africa: [
                "Vipers SC", "KCCA FC", "SC Villa", "Express FC", "URA FC", "Simba SC", "Young Africans", "Azam FC",
                "Gor Mahia", "AFC Leopards", "Mamelodi Sundowns", "Orlando Pirates", "Kaizer Chiefs", "Al Ahly", "Zamalek", "Raja Casablanca"
            ],
            usa: [
                "Inter Miami", "LA Galaxy", "LAFC", "New York City FC", "NY Red Bulls", "Seattle Sounders",
                "Atlanta United", "Orlando City", "Columbus Crew"
            ],
            rest: [
                "Bayern Munich", "Dortmund", "PSG", "Marseille", "Juventus", "AC Milan", "Inter Milan", "Napoli",
                "Ajax", "PSV", "Porto", "Benfica", "Al Hilal", "Al Nassr"
            ]
        };

        // Select Pool
        let pool = [];
        if (region === 'all') {
            pool = [].concat(...Object.values(db));
        } else if (db[region]) {
            pool = db[region];
        } else {
            pool = db.epl;
        }

        // Generate Fixtures
        const fixtures = [];
        const getRand = () => pool[Math.floor(Math.random() * pool.length)];

        for (let i = 0; i < count; i++) {
            let home = getRand();
            let away = getRand();

            let tries = 0;
            while (home === away && tries < 10) {
                away = getRand();
                tries++;
            }

            fixtures.push(`${home} vs ${away}`);
        }

        const input = document.getElementById('match-input');
        const currentText = input.value.trim();
        const newText = fixtures.join('\n');

        if (currentText.length > 0) {
            input.value = currentText + '\n' + newText;
        } else {
            input.value = newText;
        }

        this.handleInput({ target: input });

        // Feedback
        const btn = document.getElementById('btn-bulk-generate');
        if (btn) {
            const originalHTML = btn.innerHTML;
            btn.innerHTML = `<i data-lucide="check"></i> Done`;
            setTimeout(() => {
                btn.innerHTML = originalHTML;
                lucide.createIcons();
            }, 1000);
        }
        lucide.createIcons();
    }

    populateTeamList() {
        // Extensive list for autocomplete
        const teams = [
            // EPL
            "Arsenal", "Aston Villa", "Bournemouth", "Brentford", "Brighton", "Burnley",
            "Chelsea", "Crystal Palace", "Everton", "Fulham", "Liverpool", "Luton Town",
            "Man City", "Man Utd", "Newcastle", "Nottm Forest", "Sheffield Utd", "Tottenham",
            "West Ham", "Wolves",
            // La Liga
            "Alaves", "Almeria", "Athletic Bilbao", "Atletico Madrid", "Barcelona", "Cadiz",
            "Celta Vigo", "Getafe", "Girona", "Granada", "Las Palmas", "Mallorca", "Osasuna",
            "Rayo Vallecano", "Real Betis", "Real Madrid", "Real Sociedad", "Sevilla", "Valencia", "Villarreal",
            // Serie A
            "AC Milan", "Atalanta", "Bologna", "Cagliari", "Empoli", "Fiorentina", "Frosinone",
            "Genoa", "Inter Milan", "Juventus", "Lazio", "Lecce", "Monza", "Napoli", "Roma",
            "Salernitana", "Sassuolo", "Sassuolo", "Torino", "Udinese", "Verona",
            // Bundesliga
            "Augsburg", "Bayern Munich", "Bochum", "Darmstadt", "Dortmund", "Frankfurt",
            "Freiburg", "Heidenheim", "Hoffenheim", "Koln", "Leipzig", "Leverkusen",
            "Mainz", "Gladbach", "Union Berlin", "Stuttgart", "Werder Bremen", "Wolfsburg",
            // Ligue 1
            "Brest", "Clermont", "Le Havre", "Lens", "Lille", "Lorient", "Lyon", "Marseille",
            "Metz", "Monaco", "Montpellier", "Nantes", "Nice", "PSG", "Reims", "Rennes",
            "Strasbourg", "Toulouse",

            // --- Requested Expansions ---
            // Uganda (UPL)
            "Vipers SC", "KCCA FC", "SC Villa", "Express FC", "URA FC", "BUL FC", "Kitara FC",
            "Maroons FC", "NEC FC", "Wakiso Giants", "Gaddafi FC", "Bright Stars", "UPDF FC",
            // Tanzania (Ligi Kuu Bara)
            "Young Africans (Yanga)", "Simba SC", "Azam FC", "Namungo FC", "Coastal Union",
            "Singida Fountain Gate", "Dodoma Jiji", "KMC FC", "Tanzania Prisons", "Ihefu FC",
            // USA (MLS)
            "Inter Miami", "LA Galaxy", "LAFC", "New York City FC", "NY Red Bulls", "Seattle Sounders",
            "Atlanta United", "Orlando City", "Columbus Crew", "FC Cincinnati", "Philadelphia Union",
            // South Africa (PSL)
            "Mamelodi Sundowns", "Orlando Pirates", "Kaizer Chiefs", "SuperSport United", "Cape Town City",
            // Kenya (KPL)
            "Gor Mahia", "AFC Leopards", "Tusker FC", "Kenya Police", "Bandari",
            // Global Giants
            "Al Hilal", "Al Nassr", "Al Ahly", "Zamalek", "Raja Casablanca", // Middle East/North Africa
            "Boca Juniors", "River Plate", "Flamengo", "Palmeiras", "Santos", // South America
            "Galatasaray", "Fenerbahce", "Besiktas", "Ajax", "PSV", "Feyenoord", "Porto", "Benfica", "Sporting CP" // Rest of Europe
        ].sort();

        const datalist = document.getElementById('team-list');
        datalist.innerHTML = teams.map(t => `<option value="${t}">`).join('');
    }

    addMatchFromBuilder() {
        const homeInput = document.getElementById('input-home');
        const awayInput = document.getElementById('input-away');
        const odd1Input = document.getElementById('input-odd-1');
        const oddXInput = document.getElementById('input-odd-x');
        const odd2Input = document.getElementById('input-odd-2');
        const textarea = document.getElementById('match-input');
        const btn = document.getElementById('btn-add-match');

        const home = homeInput?.value?.trim();
        const away = awayInput?.value?.trim();

        if (!home || !away || !textarea) return;

        // Normalize commas to dots for math
        const normalizeOdd = (v) => (v || '').toString().replace(',', '.').trim();
        const o1 = normalizeOdd(odd1Input?.value);
        const ox = normalizeOdd(oddXInput?.value);
        const o2 = normalizeOdd(odd2Input?.value);

        // Format: Team A vs Team B [1.50 | 3.20 | 2.10]
        let matchLine = `${home} vs ${away}`;
        if (o1 || ox || o2) {
            matchLine += ` [${o1 || '1.0'} | ${ox || '1.0'} | ${o2 || '1.0'}]`;
        }

        if (textarea.value.trim().length > 0) {
            textarea.value += '\n' + matchLine;
        } else {
            textarea.value = matchLine;
        }

        // Clear and Reset
        if (homeInput) homeInput.value = '';
        if (awayInput) awayInput.value = '';
        if (odd1Input) odd1Input.value = '';
        if (oddXInput) oddXInput.value = '';
        if (odd2Input) odd2Input.value = '';
        homeInput?.focus();

        // Updates
        this.updateMatchCount(this.parseMatches().length);
        this.recalcSmartFormula();
        this.handleInput({ target: textarea });

        // Visual Feedback
        if (btn) {
            const originalText = btn.innerHTML;
            btn.innerHTML = `<i data-lucide="check" style="width:14px; height:14px;"></i> Added!`;
            setTimeout(() => {
                btn.innerHTML = originalText;
                if (window.lucide) lucide.createIcons();
            }, 800);
        }
        if (window.lucide) lucide.createIcons();
    }

    setupPaginationListeners() {
        const btnPrev = document.getElementById('btn-prev');
        const btnNext = document.getElementById('btn-next');

        if (btnPrev) btnPrev.addEventListener('click', () => this.changePage(-1));
        if (btnNext) btnNext.addEventListener('click', () => this.changePage(1));
    }

    changePage(delta) {
        const totalPages = Math.ceil(this.allSlips.length / this.pageSize);
        const newPage = this.currentPage + delta;

        if (newPage >= 1 && newPage <= totalPages) {
            this.currentPage = newPage;
            this.renderPage();
        }
    }

    autoFetchMatches() {
        const premierLeagueTeams = [
            "Arsenal", "Aston Villa", "Bournemouth", "Brentford", "Brighton", "Chelsea",
            "Crystal Palace", "Everton", "Fulham", "Liverpool", "Luton Town", "Man City",
            "Man Utd", "Newcastle", "Nottm Forest", "Sheffield Utd", "Tottenham", "West Ham",
            "Wolves", "Burnley"
        ];

        const laLigaTeams = [
            "Real Madrid", "Barcelona", "Atletico Madrid", "Sevilla", "Real Sociedad",
            "Real Betis", "Villarreal", "Athletic Bilbao", "Valencia", "Girona"
        ];

        const allTeams = [...premierLeagueTeams, ...laLigaTeams];

        // Shuffle
        const shuffled = allTeams.sort(() => 0.5 - Math.random());

        // Create 10-15 random fixtures
        const fixtureCount = 10 + Math.floor(Math.random() * 6);
        const fixtures = [];
        for (let i = 0; i < fixtureCount; i++) {
            if (shuffled.length < 2) break;
            const home = shuffled.pop();
            const away = shuffled.pop();
            fixtures.push(`${home} vs ${away}`);
        }

        const input = document.getElementById('match-input');
        input.value = fixtures.join('\n');

        this.handleInput({ target: input });

        const btn = document.getElementById('btn-load-sample');
        const originalText = btn.textContent;
        btn.textContent = "✅ Fetched!";
        setTimeout(() => btn.textContent = originalText, 1500);
    }

    recalcSmartFormula() {
        // We use the EXACT same logic as updateMatchCount to be consistent
        const input = document.getElementById('match-input');
        if (!input) return;

        const count = input.value.split('\n').filter(line => line.trim().length > 0).length;

        const slipInput = document.getElementById('slip-count');
        const label = document.querySelector('label[for="slip-count"]');

        if (count === 0) {
            if (slipInput) slipInput.value = '0';
            if (label) label.innerHTML = `Slips to Generate <span style="color:var(--color-primary); font-size:0.8em">(Formula 3<sup>n</sup>)</span>`;
            return;
        }

        let theoretical = Math.pow(3, count);
        const MAX_SAFE_LIMIT = 100000;
        let suggestedSlips = Math.min(theoretical, MAX_SAFE_LIMIT);
        let isCapped = theoretical > MAX_SAFE_LIMIT;

        if (slipInput) {
            slipInput.value = suggestedSlips;
            if (label) {
                if (isCapped) {
                    label.innerHTML = `Slips (3<sup>${count}</sup> = ${theoretical.toLocaleString()}) <span style="color:var(--color-danger); font-size:0.8em">⚠️ Capped at ${MAX_SAFE_LIMIT.toLocaleString()}</span>`;
                } else {
                    label.innerHTML = `Slips to Generate <span style="color:var(--color-primary); font-size:0.8em">(Formula 3<sup>${count}</sup>: ${theoretical.toLocaleString()})</span>`;
                }
            }
        }
    }

    handleInput(e) {
        const text = e.target.value;
        const count = text.split('\n').filter(line => line.trim().length > 0).length;
        this.updateMatchCount(count);
        this.recalcSmartFormula();
    }

    generateBetPawaScript(slip) {
        // Prepare the script payload
        const slipData = JSON.stringify(slip.outcomes.map(o => ({
            home: o.match.homeTeam,
            away: o.match.awayTeam,
            choice: o.outcome // 1, X, 2
        })));

        const script = `
/**
 * BETPAWA AUTO-FILLER SCRIPT
 * 1. Open BetPawa matches page.
 * 2. Paste this into Console (F12 -> Console).
 * 3. Press Enter.
 */
(async function() {
    const slip = ${slipData};
    console.log("🚀 Starting Auto-Fill for " + slip.length + " matches...");

    const findAndClick = async (match) => {
        const normalize = (s) => s.toLowerCase().replace(/fc|sc|utd|st\.|real|city|united/g, '').replace(/[^a-z0-9]/g, '').trim();
        const home = normalize(match.home);
        const away = normalize(match.away);
        
        console.log("Searching for: " + match.home + " vs " + match.away);

        // Strategy: Find a container that has BOTH team names
        // We look for elements that are likely "rows"
        const potentialRows = document.querySelectorAll('div, tr, [class*="event"], [class*="match"]');
        let targetRow = null;

        for (let row of potentialRows) {
            // We only care about "small" containers (not the whole page) 
            // but big enough to hold both teams.
            if (row.children.length > 100) continue; 
            
            const text = normalize(row.innerText);
            if (text.includes(home) && text.includes(away)) {
                targetRow = row;
                // If we found a row that's already small enough, we stop
                if (row.innerText.length < 300) break;
            }
        }

        if (targetRow) {
            // Find buttons or clickable odds elements in this row
            // BetPawa uses .event-odds-selection or just generic buttons
            const buttons = targetRow.querySelectorAll('.event-odds-selection, .odds-button, button, [class*="selection"]');

            let targetBtn = null;
            if (match.choice === '1') targetBtn = buttons[0];
            if (match.choice === 'X') targetBtn = buttons[1];
            if (match.choice === '2') targetBtn = buttons[2];

            if (targetBtn) {
                targetBtn.click();
                console.log("✅ Clicked: " + match.choice + " for " + match.home);
                targetRow.style.outline = "2px solid #00ff00";
                return true;
            }
        }
        
        console.warn("❌ Could not find reliable row or buttons for: " + match.home);
        return false;
    };

    // Run sequentially to avoid browser lag/bans
    for (const match of slip) {
        await findAndClick(match);
        await new Promise(r => setTimeout(r, 200)); // Sleep 200ms
    }
    
    alert("Done! Check your slip.");
})();
`;

        // Copy to clipboard
        navigator.clipboard.writeText(script).then(() => {
            alert('Script copied to clipboard! \n\n1. Go to BetPawa.\n2. Press F12 (Console).\n3. Paste and Enter.');
        }).catch(err => {
            console.error(err);
            alert('Failed to copy. See console.');
        });
    }

    parseMatches() {
        const text = document.getElementById('match-input').value;
        if (!text) return [];
        return text.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .map((line, idx) => {
                let odds = { "1": 1.0, "X": 1.0, "2": 1.0 };
                let cleanLine = line;

                // 1. Extract odds from brackets if they exist [1.5 | 3.2 | 2.1]
                const bracketsMatch = line.match(/\[([^\]]+)\]/);
                if (bracketsMatch) {
                    cleanLine = line.replace(bracketsMatch[0], '').trim();
                    const parts = bracketsMatch[1].replace(/,/g, '.').split(/[|/\s,;]+/).filter(v => v.length > 0);
                    if (parts[0]) odds["1"] = parseFloat(parts[0]) || 1.0;
                    if (parts[1]) odds["X"] = parseFloat(parts[1]) || 1.0;
                    if (parts[2]) odds["2"] = parseFloat(parts[2]) || 1.0;
                } else {
                    // 2. Fuzzy Extraction: Find all numbers that look like odds (e.g. 1.5, 2.20, 11 etc)
                    // We look for numbers with dots or standalone numbers > 1
                    const numbers = line.match(/\d+([.,]\d+)?/g) || [];
                    const floatNumbers = numbers.map(n => parseFloat(n.replace(',', '.'))).filter(n => n > 1 || line.includes('.' + n) || line.includes(',' + n));

                    if (floatNumbers.length >= 3) {
                        odds["1"] = floatNumbers[0];
                        odds["X"] = floatNumbers[1];
                        odds["2"] = floatNumbers[2];
                    } else if (floatNumbers.length === 2) {
                        // Likely Home and Away odds (Draw = 3.0 typical or just 1.0 fallback)
                        odds["1"] = floatNumbers[0];
                        odds["2"] = floatNumbers[1];
                    }

                    // Remove these numbers from the cleaned name
                    floatNumbers.forEach(n => {
                        const escaped = n.toString().replace('.', '\\.');
                        const regex = new RegExp(`\\b${escaped}\\b|\\s${escaped}|${escaped}\\s`, 'g');
                        cleanLine = cleanLine.replace(regex, ' ');
                    });
                }

                // 3. Split teams
                const parts = cleanLine.split(/\s+(vs\.?|v\.?|-|–)\s+/gi);
                return {
                    id: `m-${idx}`,
                    homeTeam: (parts[0] ? parts[0].trim() : cleanLine).replace(/\s+/g, ' ').trim(),
                    awayTeam: (parts[2] ? parts[2].trim() : 'Away').replace(/\s+/g, ' ').trim(),
                    odds: odds,
                    raw: line
                };
            });
    }

    getBetPawaBonus(legs) {
        if (legs < 3) return 0;
        const bonusTable = {
            3: 3, 4: 5, 5: 10, 6: 15, 7: 20, 8: 25, 9: 30, 10: 35,
            11: 40, 12: 45, 13: 50, 14: 60, 15: 70, 16: 80, 17: 90, 18: 100,
            19: 110, 20: 120, 21: 130, 22: 140, 23: 150, 24: 160, 25: 170,
            26: 180, 27: 190, 28: 200, 29: 215, 30: 230, 31: 245, 32: 260,
            33: 280, 34: 300, 35: 325, 36: 350, 37: 375, 38: 400, 39: 450, 40: 500
        };
        // Cap for huge accumulators
        if (legs > 40) return 1000;
        return bonusTable[legs] || 0;
    }

    getConfig() {
        return {
            distribution: {
                home: parseInt(document.getElementById('dist-home').value) || 33,
                draw: parseInt(document.getElementById('dist-draw').value) || 33,
                away: parseInt(document.getElementById('dist-away').value) || 33
            },
            maxConsecutive: parseInt(document.getElementById('max-consecutive').value) || 3
        };
    }

    handleGenerate() {
        const matches = this.parseMatches();

        if (matches.length === 0) {
            alert('Please load or enter matches first.');
            this.autoFetchMatches();
            return;
        }

        const count = parseInt(document.getElementById('slip-count').value) || Math.pow(3, matches.length);
        const config = this.getConfig();

        // Show loading state for large generations
        const btn = document.getElementById('btn-generate');
        const originalText = btn.innerHTML;
        btn.innerHTML = `<i data-lucide="loader-2" class="animate-spin"></i> Generating ${count.toLocaleString()}...`;
        btn.disabled = true;

        const stake = parseFloat(document.getElementById('global-stake').value) || 0;

        // Use setTimeout to allow UI render
        setTimeout(() => {
            this.generator.setMatches(matches);

            // Generate All!
            this.allSlips = this.generator.generate(count, config);

            // Calculate financial details for each slip
            this.allSlips.forEach(slip => {
                let totalOdds = 1.0;
                slip.outcomes.forEach(o => {
                    const matchOdds = o.match.odds || { "1": 1.0, "X": 1.0, "2": 1.0 };
                    totalOdds *= (matchOdds[o.outcome] || 1.0);
                });

                const legs = slip.outcomes.length;
                const bonusPercent = this.getBetPawaBonus(legs);
                const grossProfit = (totalOdds * stake) - stake;
                const winBonus = Math.max(0, grossProfit * (bonusPercent / 100));
                const grossWinnings = grossProfit + winBonus;
                const tax = grossWinnings > 0 ? grossWinnings * 0.12 : 0;
                const payout = (grossWinnings - tax) + stake;

                slip.totalOdds = totalOdds;
                slip.stake = stake;
                slip.legs = legs;
                slip.bonusPercent = bonusPercent;
                slip.winBonus = winBonus;
                slip.tax = tax;
                slip.payout = payout;
            });

            this.currentPage = 1;
            this.renderPage();

            // Reset Button
            btn.innerHTML = originalText;
            btn.disabled = false;
            lucide.createIcons(); // Refresh icons
        }, 50);
    }

    renderPage() {
        const container = document.getElementById('results-area');
        const paginationControls = document.getElementById('pagination-controls');

        container.innerHTML = '';

        if (this.allSlips.length === 0) {
            container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; color:gray">No slips generated</div>`;
            if (paginationControls) paginationControls.style.display = 'none';
            return;
        }

        // Pagination Logic
        const start = (this.currentPage - 1) * this.pageSize;
        const end = start + this.pageSize;
        const pageSlips = this.allSlips.slice(start, end);
        const totalPages = Math.ceil(this.allSlips.length / this.pageSize);

        // Update Controls
        if (paginationControls) {
            if (this.allSlips.length > this.pageSize) {
                paginationControls.style.display = 'flex';
                document.getElementById('page-info').textContent = `Page ${this.currentPage} of ${totalPages} (${this.allSlips.length.toLocaleString()} Total)`;
                document.getElementById('btn-prev').disabled = this.currentPage === 1;
                document.getElementById('btn-next').disabled = this.currentPage === totalPages;
            } else {
                paginationControls.style.display = 'none';
            }
        }

        // Render Items
        pageSlips.forEach((slip, idx) => {
            const card = document.createElement('div');
            card.className = 'slip-card';

            // Header
            const header = document.createElement('div');
            header.className = 'slip-header';
            header.style.display = 'flex';
            header.style.justifyContent = 'space-between';
            header.style.alignItems = 'center';

            const title = document.createElement('div');
            title.innerHTML = `<span>Slip #${start + idx + 1}</span> <span>ID: ${slip.id.slice(-6)}</span>`;

            // Script Button
            const btnScript = document.createElement('button');
            btnScript.className = 'btn btn-sm btn-secondary';
            btnScript.style.fontSize = '0.75rem';
            btnScript.style.padding = '0.2rem 0.6rem';
            btnScript.innerHTML = `<i data-lucide="code-2" style="width:12px; height:12px;"></i> Script`;
            btnScript.title = "Copy Console Script for BetPawa";
            btnScript.onclick = (e) => {
                e.stopPropagation();
                this.generateBetPawaScript(slip);
            };

            header.appendChild(title);
            header.appendChild(btnScript);
            card.appendChild(header);

            // Matches
            slip.outcomes.forEach(item => {
                const row = document.createElement('div');
                row.className = 'slip-row';

                const matchLabel = item.match.homeTeam && item.match.awayTeam !== 'Away'
                    ? `${item.match.homeTeam} vs ${item.match.awayTeam}`
                    : item.match.raw;

                let outcomeClass = '';
                if (item.outcome === '1') outcomeClass = 'WIN-HOME';
                if (item.outcome === 'X') outcomeClass = 'DRAW';
                if (item.outcome === '2') outcomeClass = 'WIN-AWAY';
                row.innerHTML = `
                    <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:200px;" title="${matchLabel}">${matchLabel}</span>
                    <span class="outcome ${outcomeClass}">${item.outcome}</span>
                `;
                card.appendChild(row);
            });

            // Footer: Detailed Breakdown
            if (slip.payout > 0) {
                const footer = document.createElement('div');
                footer.className = 'slip-footer';
                footer.style.marginTop = '0.75rem';
                footer.style.paddingTop = '0.75rem';
                footer.style.borderTop = '1px dashed rgba(255,255,255,0.1)';
                footer.style.fontSize = '0.75rem';

                footer.innerHTML = `
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.3rem;">
                        <div style="color:var(--color-text-muted)">Odds: <span style="color:white">x${slip.totalOdds.toFixed(2)}</span></div>
                        <div style="color:var(--color-text-muted); text-align:right;">Stake: <span style="color:white">${slip.stake.toLocaleString()}</span></div>
                        
                        <div style="color:#4ade80">Bonus (${slip.bonusPercent}%):</div>
                        <div style="color:#4ade80; text-align:right;">+${Math.floor(slip.winBonus).toLocaleString()}</div>
                        
                        <div style="color:#f87171">Tax (12%):</div>
                        <div style="color:#f87171; text-align:right;">-${Math.floor(slip.tax).toLocaleString()}</div>
                    </div>
                    <div style="margin-top:0.5rem; padding-top:0.5rem; border-top:1px solid rgba(255,255,255,0.05); display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-weight:bold; color:var(--color-text-muted)">PAYOUT:</span>
                        <span style="font-weight:700; color:var(--color-primary); font-size:1rem;">${(Math.floor(slip.payout)).toLocaleString()} TSH</span>
                    </div>
                `;
                card.appendChild(footer);
            }

            // No animation for large lists to stay snappy
            container.appendChild(card);
        });

        // Refresh icons if any (not used in cards currently but good practice)
        // lucide.createIcons(); 
    }
}

// Start App
new App();
