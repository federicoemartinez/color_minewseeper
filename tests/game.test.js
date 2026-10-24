// tests/game.test.js. The mines of EASY_6 are [0, 9, 13, 23, 26, 34].
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, mark, minesFound, isFlawless } from '../js/game.js';
import { EASY_6 as board } from './fixtures.js';

test('a new game', () => {
  const g = createGame(board);
  assert.equal(g.lives, 3); assert.equal(g.status, 'playing'); assert.equal(g.lostBy, null); assert.equal(g.elapsedMs, 0);
  assert.equal(g.marks.length, 36); assert.ok(g.marks.every((m) => m === 'unknown'));
  assert.ok(!('solution' in g));
});
test('safe on a safe square locks it', () => {
  const g = createGame(board);
  assert.equal(mark(g, 1, 'safe'), 'safe'); assert.equal(g.marks[1], 'safe');
  assert.equal(mark(g, 1, 'mine'), 'ignored');
});
test('safe on a mine explodes', () => {
  const g = createGame(board);
  assert.equal(mark(g, 0, 'safe'), 'boom');
  assert.equal(g.status, 'lost'); assert.equal(g.lostBy, 'boom'); assert.equal(g.marks[0], 'boom'); assert.equal(g.lives, 3);
});
test('a wrong flag costs a life and the square turns safe', () => {
  const g = createGame(board);
  assert.equal(mark(g, 1, 'mine'), 'wrong-flag'); assert.equal(g.lives, 2); assert.equal(g.marks[1], 'safe');
});
test('the third wrong flag ends the game', () => {
  const g = createGame(board);
  mark(g, 1, 'mine'); mark(g, 2, 'mine');
  assert.equal(mark(g, 3, 'mine'), 'out-of-lives');
  assert.equal(g.status, 'lost'); assert.equal(g.lostBy, 'lives'); assert.equal(g.lives, 0);
});
test('flagging every mine wins and reveals the rest as safe', () => {
  const g = createGame(board);
  for (const m of [0, 9, 13, 23, 26]) assert.equal(mark(g, m, 'mine'), 'flag');
  assert.equal(minesFound(g), 5);
  assert.equal(mark(g, 34, 'mine'), 'won'); assert.equal(g.status, 'won');
  assert.ok(g.marks.every((m, i) => (board.mines.includes(i) ? m === 'mine' : m === 'safe')));
  assert.ok(isFlawless(g));
});
test('a win after losing a life is not flawless', () => {
  const g = createGame(board);
  mark(g, 1, 'mine');
  for (const m of board.mines) mark(g, m, 'mine');
  assert.equal(g.status, 'won'); assert.ok(!isFlawless(g));
});
test('marks after the game ended are ignored', () => {
  const g = createGame(board);
  mark(g, 0, 'safe');
  assert.equal(mark(g, 1, 'safe'), 'ignored');
});
test('a game survives a JSON round trip (saved dailies)', () => {
  const g = JSON.parse(JSON.stringify(createGame(board)));
  assert.equal(mark(g, 0, 'mine'), 'flag');
});
