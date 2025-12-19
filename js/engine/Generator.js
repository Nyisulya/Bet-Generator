import { OUTCOME, CONSTANTS } from './Types.js';

export class Generator {
    constructor() {
        this.matches = [];
    }

    setMatches(matches) {
        this.matches = matches;
    }

    /**
     * Generate slips based on constraints
     * @param {number} count Number of slips to generate
     * @param {Object} config Configuration object
     * @param {Object} config.distribution { home: number, draw: number, away: number }
     * @param {number} config.maxConsecutive Max consecutive identical outcomes
     */
    generate(count, config) {
        const slips = [];

        // Correct Score generates ALL permutations at once, ignoring 'count' loop
        if (config.market === 'correct_score') {
            return this._generateCorrectScoreCoverage(config);
        }

        for (let i = 0; i < count; i++) {
            // Switch logic based on market type
            const slip = config.market === 'goals'
                ? this._generateGoalsSlip(config)
                : this._generateSingleSlip(config);

            slips.push({
                id: `SLIP-${Date.now()}-${i + 1}`,
                outcomes: slip
            });
        }

        return slips;
    }

    _generateCorrectScoreCoverage(config) {
        const slips = [];
        const maxGoals = config.maxGoals || 5;

        // Generate scores (0-0 to N-M where N+M <= maxGoals)
        // e.g. Max 2: 0-0, 0-1, 0-2, 1-0, 1-1, 2-0
        const scores = [];
        for (let h = 0; h <= maxGoals; h++) {
            for (let a = 0; a <= maxGoals; a++) {
                if (h + a <= maxGoals) {
                    scores.push(`${h}-${a}`);
                }
            }
        }

        let slipCounter = 1;

        // Create Single Bets for every match and every score
        for (const match of this.matches) {
            for (const score of scores) {
                slips.push({
                    id: `CS-${Date.now()}-${slipCounter++}`,
                    outcomes: [{
                        matchId: match.id,
                        match: match,
                        outcome: score
                    }]
                });
            }
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

            // Try to generate a valid outcome for this match
            while (!isValid && attempts < 20) {
                outcome = this._weightedRandom(config);

                // Check consecutive constraint
                if (outcome === lastOutcome) {
                    if (consecutiveCount >= config.maxConsecutive) {
                        attempts++;
                        continue; // try again
                    }
                }

                isValid = true;
            }

            // Fallback if stuck (should be rare with loose constraints)
            if (!isValid) {
                outcome = this._forceDifferent(lastOutcome, [OUTCOME.HOME, OUTCOME.DRAW, OUTCOME.AWAY]);
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
                match: match, // Store ref for UI
                outcome: outcome
            });
        }

        return outcomes;
    }

    _generateGoalsSlip(config) {
        const outcomes = [];
        let consecutiveCount = 0;
        let lastOutcome = null;

        for (const match of this.matches) {
            let outcome;
            let isValid = false;
            let attempts = 0;

            while (!isValid && attempts < 20) {
                outcome = this._weightedRandomGoals(config);

                if (outcome === lastOutcome) {
                    if (consecutiveCount >= config.maxConsecutive) {
                        attempts++;
                        continue;
                    }
                }
                isValid = true;
            }

            if (!isValid) {
                outcome = this._forceDifferent(lastOutcome, [OUTCOME.OVER, OUTCOME.UNDER]);
            }

            if (outcome === lastOutcome) consecutiveCount++;
            else {
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
        const total = dist.home + dist.draw + dist.away;
        const rand = Math.random() * total;

        if (rand < dist.home) return OUTCOME.HOME;
        if (rand < dist.home + dist.draw) return OUTCOME.DRAW;
        return OUTCOME.AWAY;
    }

    _weightedRandomGoals(dist) {
        const total = dist.over + dist.under;
        const rand = Math.random() * total;

        if (rand < dist.over) return OUTCOME.OVER;
        return OUTCOME.UNDER;
    }

    _forceDifferent(avoidOutcome, optionsSource) {
        const options = optionsSource.filter(o => o !== avoidOutcome);
        return options[Math.floor(Math.random() * options.length)];
    }
}
