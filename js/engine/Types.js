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

export const OUTCOME = {
    HOME: '1',
    DRAW: 'X',
    AWAY: '2'
};

export const CONSTANTS = {
    DEFAULT_SLIP_COUNT: 5,
    MAX_RETRIES: 100
};
