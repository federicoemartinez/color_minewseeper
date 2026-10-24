/** @typedef {{ n: number, regions: number[], hidden: number[], marks: ('unknown'|'safe'|'mine'|'boom')[],
 *    lives: number, status: 'playing'|'won'|'lost', lostBy: null|'boom'|'lives', elapsedMs: number }} Game
 *  Plain JSON, with no Sets or classes, so a daily can be saved with JSON.stringify. */

export const LIVES = 3;

/** @param {{ n: number, regions: number[], mines: number[] }} board @returns {Game} */
export const createGame = (board) => ({
  n: board.n,
  regions: [...board.regions],
  hidden: [...board.mines],
  marks: Array(board.n * board.n).fill('unknown'),
  lives: LIVES,
  status: 'playing',
  lostBy: null,
  elapsedMs: 0,
});

/** Applies one tap ('safe') or double tap ('mine') to a square. Mutates `game`. */
export const mark = (game, square, kind) => {
  if (game.status !== 'playing' || game.marks[square] !== 'unknown') return 'ignored';
  const isMine = game.hidden.includes(square);
  if (kind === 'safe') {
    if (!isMine) { game.marks[square] = 'safe'; return 'safe'; }
    game.marks[square] = 'boom';
    game.status = 'lost'; game.lostBy = 'boom';
    return 'boom';
  }
  if (!isMine) {
    game.marks[square] = 'safe';
    game.lives--;
    if (game.lives > 0) return 'wrong-flag';
    game.status = 'lost'; game.lostBy = 'lives';
    return 'out-of-lives';
  }
  game.marks[square] = 'mine';
  if (minesFound(game) < game.hidden.length) return 'flag';
  game.status = 'won';
  game.marks = game.marks.map((m) => (m === 'unknown' ? 'safe' : m));
  return 'won';
};

/** @param {Game} game @returns {number} */
export const minesFound = (game) => game.marks.filter((m) => m === 'mine').length;

/** @param {Game} game @returns {boolean} */
export const isFlawless = (game) => game.status === 'won' && game.lives === LIVES;
