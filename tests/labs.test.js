import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../js/rng.js';
import { blocks, neighbors8 } from '../js/grid.js';
import { solve } from '../js/solver.js';
import { generateBoard, placeMines, SHAPES, holesOf } from '../js/generator.js';
import { createGame, mark, hintFor } from '../js/game.js';
import { shareText } from '../js/share.js';
import { EASY_6 } from './fixtures.js';

const row = (n, i) => Math.floor(i / n), col = (n, i) => i % n;

// One mine per row, column and (non-hole) color, none in a hole, plus the board's own spacing rule.
const assertLabBoard = (b, diagonals) => {
  const { n, regions, mines } = b;
  assert.equal(mines.length, n);
  assert.equal(new Set(mines.map((m) => row(n, m))).size, n, 'one mine per row');
  assert.equal(new Set(mines.map((m) => col(n, m))).size, n, 'one mine per column');
  assert.ok(mines.every((m) => regions[m] >= 0), 'no mine in a hole');
  assert.equal(new Set(mines.map((m) => regions[m])).size, n, 'one mine per color');
  assert.ok(regions.every((k) => k >= -1 && k < n));
  for (const m of mines) for (const o of mines) if (m !== o) {
    if (diagonals) {
      assert.notEqual(row(n, m) - col(n, m), row(n, o) - col(n, o), 'two mines on a ↘ diagonal');
      assert.notEqual(row(n, m) + col(n, m), row(n, o) + col(n, o), 'two mines on a ↗ diagonal');
    } else assert.ok(!neighbors8(n, m).includes(o), 'mines must not touch');
  }
  assert.deepEqual(solve(n, regions, diagonals), { solved: true, hardest: b.hardest, mines });
};

test('blocks: touching by default, whole diagonals with the Labs rule', () => {
  assert.ok(blocks(8, 0, 9) && !blocks(8, 0, 18)); // (0,0) touches (1,1) but not (2,2)
  assert.ok(blocks(8, 0, 18, true) && blocks(8, 7, 56, true)); // same ↘ diagonal; same ↗ diagonal, corner to corner
  assert.ok(!blocks(8, 0, 10, true)); // (0,0) and (1,2): a knight's move apart
});
test('Diagonals boards follow the diagonal rule and solve with it', () => {
  for (let seed = 1; seed <= 8; seed++) {
    const b = generateBoard(8, seed, { diagonals: true });
    assert.equal(b.diagonals, true);
    assertLabBoard(b, true);
  }
});
test('every shape has room for its mines, and Shapes boards keep mines and colors out of the holes', () => {
  for (const shape of SHAPES) assert.equal(placeMines(8, mulberry32(1), false, holesOf(shape)).length, 8);
  const seen = new Set();
  for (let seed = 1; seed <= 12; seed++) {
    const b = generateBoard(8, seed, { shaped: true });
    const holes = b.regions.flatMap((k, i) => (k < 0 ? [i] : []));
    seen.add(SHAPES.findIndex((s) => holesOf(s).join() === holes.join()));
    assertLabBoard(b, false);
  }
  assert.ok(!seen.has(-1), 'holes match a shape');
});
test('XL boards are 9x9 and valid', () => {
  for (let seed = 1; seed <= 3; seed++) assertLabBoard(generateBoard(9, seed, { lenient: true }), false);
});
test('holes start as holes and ignore taps; hints never point at them', () => {
  const b = generateBoard(8, 1, { shaped: true }), g = createGame(b);
  const hole = b.regions.indexOf(-1);
  assert.equal(g.marks[hole], 'hole');
  assert.equal(mark(g, hole, 'safe'), 'ignored');
  assert.ok(!hintFor(g, 0).squares.includes(hole));
});
test('autoClear: a right flag clears its row, column, color and neighbors; a wrong one clears nothing', () => {
  const g = createGame(EASY_6, { autoClear: true }); // EASY_6 mines: [0, 9, 13, 23, 26, 34]
  assert.equal(mark(g, 1, 'mine'), 'wrong-flag');
  assert.equal(g.marks.filter((m) => m === 'safe').length, 1);
  assert.equal(mark(g, 0, 'mine'), 'flag');
  g.marks.forEach((m, s) => {
    const ruled = s !== 0 && (blocks(6, 0, s) || EASY_6.regions[s] === EASY_6.regions[0]);
    assert.equal(m, s === 0 ? 'mine' : ruled || s === 1 ? 'safe' : 'unknown', `square ${s}`);
  });
  assert.ok(!createGame(EASY_6).autoClear);
});
test('a Labs share names the lab', () => {
  assert.equal(shareText({ mode: 'labs', lab: 'Shapes', won: true, lostBy: null, livesLeft: 3, timeMs: 61000 }),
    'Color Minefield Labs · Shapes\nFlawless! ❤️❤️❤️ ⏱ 1:01');
});
