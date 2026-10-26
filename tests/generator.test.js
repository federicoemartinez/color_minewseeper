import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32, fnv1a } from '../js/rng.js';
import { neighbors8 } from '../js/grid.js';
import { solve } from '../js/solver.js';
import { placeMines, paintRegions, rebalance, generateBoard, FREE_SHARE, MIN_REGIONS, MAX_REGION, MAX_PIECES, pieces } from '../js/generator.js';
import { assertValidLayout, regionSizes } from './helpers.js';

const sorted = (a) => [...a].sort((x, y) => x - y);

test('placeMines: one per row and column, none touching', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const mines = placeMines(8, mulberry32(seed));
    assert.equal(mines.length, 8);
    assert.equal(new Set(mines.map((m) => Math.floor(m / 8))).size, 8);
    assert.equal(new Set(mines.map((m) => m % 8)).size, 8);
    for (const m of mines) for (const j of neighbors8(8, m)) assert.ok(!mines.includes(j));
  }
});
test('paintRegions: color k grows from mines[k] and stays connected', () => {
  let painted = 0;
  for (let seed = 1; seed <= 50; seed++) {
    const rand = mulberry32(seed), mines = placeMines(8, rand);
    const regions = paintRegions(8, mines, rand, FREE_SHARE);
    if (!regions) continue;
    painted++;
    mines.forEach((m, k) => assert.equal(regions[m], k));
    assertValidLayout(8, regions, mines);
  }
  assert.ok(painted > 0);
});
test('paintRegions with no free squares is always solvable with rule 1', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const rand = mulberry32(seed), mines = placeMines(8, rand);
    const regions = paintRegions(8, mines, rand, 0);
    if (regions) assert.deepEqual(solve(8, regions), { solved: true, hardest: 1, mines: sorted(mines) });
  }
});
test('rebalance: sizes within limits, still solvable, input untouched', () => {
  let cleaned = 0;
  for (let seed = 1; cleaned < 3 && seed <= 2000; seed++) {
    const rand = mulberry32(seed), mines = placeMines(8, rand);
    const regions = paintRegions(8, mines, rand, FREE_SHARE);
    if (!regions || !solve(8, regions).solved) continue;
    const before = [...regions];
    const fixed = rebalance(8, mines, regions, rand, 2, MAX_REGION);
    assert.deepEqual(regions, before);
    if (!fixed) continue;
    cleaned++;
    assertValidLayout(8, fixed, mines);
    assert.ok(regionSizes(8, fixed).every((s) => s >= 2 && s <= MAX_REGION));
    assert.deepEqual(solve(8, fixed).mines, sorted(mines));
  }
  assert.equal(cleaned, 3);
});
test('generateBoard: valid, solvable, within limits, repeatable', () => {
  for (const seed of [1, 2, 3, 3698842276]) {
    const board = generateBoard(8, seed);
    assertValidLayout(8, board.regions, board.mines, false);
    assert.ok(regionSizes(8, board.regions).every((s) => s >= MIN_REGIONS[0] && s <= MAX_REGION));
    assert.deepEqual(solve(8, board.regions), { solved: true, hardest: board.hardest, mines: board.mines });
    assert.deepEqual(generateBoard(8, seed), board);
  }
});
test('generateBoard: across seeds, every minimum color size shows up, and some boards split colors into 2 to MAX_PIECES pieces', () => {
  const smallest = new Set();
  let split = 0, whole = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const { regions } = generateBoard(8, seed);
    smallest.add(Math.min(...regionSizes(8, regions)));
    const counts = [...Array(8).keys()].map((k) => pieces(8, regions, k));
    assert.ok(counts.every((c) => c >= 1 && c <= MAX_PIECES));
    if (counts.some((c) => c > 1)) split++; else whole++;
  }
  for (const min of MIN_REGIONS) assert.ok(smallest.has(min), `no board with smallest color ${min}`);
  assert.ok(split > 0 && whole > 0, `split ${split}, whole ${whole}`);
});
test('the 2026-10-24 daily board is pinned (a generator change must be deliberate)', () => {
  assert.deepEqual(generateBoard(8, fnv1a('2026-10-24')), {
    n: 8,
    regions: [7,7,7,7,7,5,5,5,7,7,7,7,7,7,5,5,7,7,1,7,7,6,5,5,1,1,1,1,1,6,3,5,1,0,0,0,1,6,3,3,6,6,6,6,6,6,6,6,6,2,2,2,6,6,4,4,2,2,2,2,6,6,4,4],
    mines: [5, 8, 18, 30, 33, 44, 55, 59],
    hardest: 2,
  });
});
