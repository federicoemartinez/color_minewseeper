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

test('hints: always some, simplest first, and every rule-3 square really is safe', async () => {
  const { hints } = await import('../js/solver.js');
  const { generateBoard } = await import('../js/generator.js');
  for (let seed = 1; seed <= 20; seed++) {
    const { n, regions, mines } = generateBoard(8, seed);
    const marks = Array(n * n).fill('unknown');
    for (const m of mines) { // flag the mines one by one, marking each hint-proved square safe on the way
      const found = hints(n, regions, marks);
      assert.ok(found.length > 0, `seed ${seed}: no hint`);
      assert.deepEqual(found.map((h) => h.rule), found.map((h) => h.rule).sort());
      for (const h of found) if (h.rule === 3) { assert.ok(!mines.includes(h.square)); marks[h.square] = 'safe'; }
      marks[m] = 'mine';
    }
  }
});
test('hints: a unit down to one spot is rule 1', async () => {
  const { hints } = await import('../js/solver.js');
  const marks = Array(36).fill('unknown');
  for (const m of EASY_6.mines.slice(1)) marks[m] = 'mine'; // only the mine on square 0 is left
  const ones = hints(6, EASY_6.regions, marks).filter((h) => h.rule === 1);
  assert.ok(ones.length > 0);
  assert.ok(ones.every((h) => [0, 6, 12 + EASY_6.regions[0]].includes(h.units[0]))); // square 0's row, column or color
});
