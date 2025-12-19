/**
 * @typedef {Object} Match
 * @property {string} id
 * @property {string} homeTeam
 * @property {string} awayTeam
 * @property {string} [date]
 */

/**
 * @typedef {Object} Slip
 * @property {string} id
 * @property {Array<{matchId: string, outcome: string}>} outcomes
 */

export const MARKET_TYPE = {
    M_1X2: '1x2',
    GOALS: 'goals', // Over/Under 2.5
    CORRECT_SCORE: 'correct_score' // Permutations
};

export const OUTCOME = {
    // 1X2
    HOME: '1',
    DRAW: 'X',
    AWAY: '2',

    // Goals
    OVER: 'Over 2.5',
    UNDER: 'Under 2.5'
};

export const CONSTANTS = {
    DEFAULT_SLIP_COUNT: 5,
    MAX_RETRIES: 100
};
