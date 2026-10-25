import { mulberry32 } from './rng.js';
import { neighbors4, neighbors8 } from './grid.js';
import { solve } from './solver.js';

/** @typedef {{ n: number, regions: number[], mines: number[], hardest: 1|2|3 }} Board
 *  regions[i] = color 0..n-1 of square i · mines = sorted squares holding a mine · hardest = hardest solver rule needed */

export const BOARD_SIZE = 8;
export const FREE_SHARE = 0.2; // share of squares that may join any color, which is what makes boards harder
export const MIN_REGIONS = [1, 2, 3, 4]; // each board picks its smallest allowed color size; 5 gets too slow (~4x per step)
export const MAX_REGION = 16;

const pick = (rand, list) => list[Math.floor(rand() * list.length)];

// One mine per row and column, none touching. Returns squares in placement order.
export const placeMines = (n, rand) => {
  for (;;) {
    const blocked = new Uint8Array(n * n), mines = [];
    while (mines.length < n) {
      const open = [];
      for (let i = 0; i < n * n; i++) if (!blocked[i]) open.push(i);
      if (!open.length) break;
      const m = pick(rand, open), r = Math.floor(m / n), c = m % n;
      mines.push(m);
      for (let k = 0; k < n; k++) { blocked[r * n + k] = 1; blocked[k * n + c] = 1; }
      for (const j of neighbors8(n, m)) blocked[j] = 1;
    }
    if (mines.length === n) return mines;
  }
};

// Color k grows from mines[k]. A square may join color k if it is free, or if an earlier mine already rules it out
// (then solving in mine order leaves each color a single spot). Returns null on a dead end.
export const paintRegions = (n, mines, rand, freeShare) => {
  const N = n * n;
  const free = Array.from({ length: N }, () => rand() < freeShare);
  const firstRuledOut = Array.from({ length: N }, (_, i) => mines.findIndex((m) =>
    m % n === i % n || Math.floor(m / n) === Math.floor(i / n) || neighbors8(n, m).includes(i)));
  const regions = new Array(N).fill(-1);
  mines.forEach((m, k) => (regions[m] = k));
  for (let left = N - n; left; left--) {
    const options = [];
    for (let i = 0; i < N; i++) if (regions[i] === -1)
      for (const j of neighbors4(n, i)) {
        const k = regions[j];
        if (k !== -1 && (free[i] || firstRuledOut[i] < k)) options.push([i, k]);
      }
    if (!options.length) return null;
    const [i, k] = pick(rand, options);
    regions[i] = k;
  }
  return regions;
};

// True if color `k` is still 4-connected from `start` once square `skip` is removed from it.
const staysConnected = (n, regions, k, start, skip) => {
  let size = 0;
  for (const c of regions) if (c === k) size++;
  const seen = new Set([start]), stack = [start];
  while (stack.length) for (const j of neighbors4(n, stack.pop()))
    if (j !== skip && regions[j] === k && !seen.has(j)) { seen.add(j); stack.push(j); }
  return seen.size === size - 1;
};

// Moves border squares between colors until every size is within [minSize, maxSize], keeping the board solvable.
// Returns a new array, or null if it gets stuck.
export const rebalance = (n, mines, regions, rand, minSize, maxSize) => {
  let cur = [...regions];
  for (let round = 0; round < 200; round++) {
    const sizes = new Array(n).fill(0);
    for (const k of cur) sizes[k]++;
    if (sizes.every((s) => s >= minSize && s <= maxSize)) return cur;
    const moves = [];
    for (let x = 0; x < n * n; x++) {
      const from = cur[x];
      if (mines.includes(x) || sizes[from] - 1 < minSize) continue;
      for (const j of neighbors4(n, x)) {
        const to = cur[j];
        if (to !== from && sizes[to] + 1 <= maxSize && (sizes[to] < minSize || sizes[from] > maxSize)) moves.push([x, to]);
      }
    }
    for (let i = moves.length - 1; i > 0; i--) { // Fisher-Yates
      const j = Math.floor(rand() * (i + 1));
      [moves[i], moves[j]] = [moves[j], moves[i]];
    }
    let next = null;
    for (const [x, to] of moves) {
      const from = cur[x];
      if (!staysConnected(n, cur, from, mines[from], x)) continue;
      const trial = [...cur];
      trial[x] = to;
      if (solve(n, trial).solved) { next = trial; break; }
    }
    if (!next) return null;
    cur = next;
  }
  return null;
};

/** @returns {Board} */
export const generateBoard = (n, seed) => {
  const rand = mulberry32(seed);
  const minSize = pick(rand, MIN_REGIONS);
  for (let attempt = 0; attempt < 10000; attempt++) {
    const mines = placeMines(n, rand);
    const painted = paintRegions(n, mines, rand, FREE_SHARE);
    if (!painted) continue;
    const first = solve(n, painted);
    if (!first.solved) continue;
    const regions = rebalance(n, mines, painted, rand, minSize, MAX_REGION);
    if (!regions) continue;
    // Rebalancing can change which rules are needed, so report the difficulty of the final board.
    const result = solve(n, regions);
    return { n, regions, mines: [...mines].sort((a, b) => a - b), hardest: result.hardest };
  }
  throw new Error('generateBoard: no board found');
};
