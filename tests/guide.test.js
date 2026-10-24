import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, mark } from '../js/game.js';
import { solve } from '../js/solver.js';
import { GUIDE_BOARD as board, STEPS, guideStep, guideAllows, guideTip } from '../js/guide.js';
import { assertValidLayout } from './helpers.js';

test('the guide board is legal and solvable by logic alone', () => {
  assertValidLayout(board.n, board.regions, board.mines);
  const s = solve(board.n, board.regions);
  assert.ok(s.solved); assert.deepEqual(s.mines, board.mines);
});

test('every step is a right move, and the board can be finished after them', () => {
  const g = createGame(board);
  STEPS.forEach((step, k) => {
    assert.equal(guideStep(g), k);
    assert.deepEqual(guideTip(g).squares, step.squares);
    for (const i of step.squares) assert.ok(['safe', 'flag'].includes(mark(g, i, step.kind)), `step ${k + 1}, square ${i}`);
  });
  assert.equal(guideStep(g), STEPS.length);
  assert.deepEqual(guideTip(g).squares, []);
  for (const i of board.mines) mark(g, i, 'mine');
  assert.equal(g.status, 'won'); assert.equal(g.lives, 3);
});

test('during a step only its squares, with its kind, get through', () => {
  const g = createGame(board);
  const [i] = STEPS[0].squares;
  assert.ok(guideAllows(g, i, 'mine'));
  assert.ok(!guideAllows(g, i, 'safe'));
  assert.ok(!guideAllows(g, STEPS[1].squares[0], 'safe'));
});

test('after the steps, any right move gets through and no wrong one does', () => {
  const g = createGame(board);
  for (const step of STEPS) for (const i of step.squares) mark(g, i, step.kind);
  const open = g.marks.flatMap((m, i) => (m === 'unknown' ? [i] : []));
  for (const i of open) {
    const mine = board.mines.includes(i);
    assert.equal(guideAllows(g, i, 'mine'), mine);
    assert.equal(guideAllows(g, i, 'safe'), !mine);
  }
});
