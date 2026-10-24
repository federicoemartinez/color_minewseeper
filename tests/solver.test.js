import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solve } from '../js/solver.js';
import { EASY_6, MEDIUM_6, HARD_6, AMBIGUOUS_4 } from './fixtures.js';

for (const b of [EASY_6, MEDIUM_6, HARD_6]) {
  test(`solves a board that needs rule ${b.hardest}`, () => {
    assert.deepEqual(solve(b.n, b.regions), { solved: true, hardest: b.hardest, mines: b.mines });
  });
}
test('gives up on a board with two solutions', () => {
  assert.deepEqual(solve(AMBIGUOUS_4.n, AMBIGUOUS_4.regions), { solved: false });
});
test('does not mutate regions', () => {
  const copy = [...HARD_6.regions];
  solve(HARD_6.n, HARD_6.regions);
  assert.deepEqual(HARD_6.regions, copy);
});
