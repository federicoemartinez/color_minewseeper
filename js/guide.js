// The guided first game: one fixed board, each step teaching the rule that unlocks its squares.
// tests/guide.test.js checks every step is a right move and the board stays solvable by logic.

export const GUIDE_BOARD = { n: 5, regions: [...'0011100111233113331433114'].map(Number), mines: [1, 8, 10, 17, 24] };

export const STEPS = [
  { kind: 'mine', squares: [10],
    text: 'Every color hides exactly one mine. This color has a single square: double-tap it to flag the mine.' },
  { kind: 'safe', squares: [5, 6, 15, 16],
    text: 'Mines never touch, not even diagonally. Tap the squares around the flag to clear them.' },
  { kind: 'safe', squares: [11, 12, 13, 14, 0, 20],
    text: 'Each row and column hides exactly one mine too. These have theirs: tap the rest.' },
  { kind: 'safe', squares: [4, 9],
    text: "The bottom-right color fits in the last column, so that column's mine is in it. Tap the rest of the column." },
];
const FREE = "Now finish the board. Mistakes are free here; in real games a wrong flag costs a life and tapping a mine ends it.";
const DONE = 'Solved! Every board can be solved by logic: no guessing needed.';

/** Index of the first step with a square left to mark; STEPS.length once all are done. */
export const guideStep = (game) => {
  const k = STEPS.findIndex((s) => s.squares.some((i) => game.marks[i] === 'unknown'));
  return k < 0 ? STEPS.length : k;
};

/** Whether the guide lets a move through: during a step only its squares with its kind, afterwards any right move. */
export const guideAllows = (game, square, kind) => {
  const step = STEPS[guideStep(game)];
  if (step) return step.kind === kind && step.squares.includes(square);
  return game.hidden.includes(square) === (kind === 'mine');
};

/** What the guide says now, and the squares it lights up. */
export const guideTip = (game) => {
  const step = STEPS[guideStep(game)];
  if (step) return { text: step.text, squares: step.squares };
  return { text: game.status === 'won' ? DONE : FREE, squares: [] };
};
