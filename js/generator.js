import { mulberry32 } from './rng.js';
import { neighbors4, blocks } from './grid.js';
import { solve } from './solver.js';

/** @typedef {{ n: number, regions: number[], mines: number[], hardest: 1|2|3, diagonals?: true }} Board
 *  regions[i] = color 0..n-1 of square i, or -1 for a hole · mines = sorted squares holding a mine ·
 *  hardest = hardest solver rule needed · diagonals (Labs) = at most one mine per diagonal instead of none touching */

export const BOARD_SIZE = 8;
export const FREE_SHARE = 0.2; // share of squares that may join any color, which is what makes boards harder
export const MIN_REGIONS = [1, 2, 3, 4]; // each board picks its smallest allowed color size; 5 gets too slow (~4x per step)
export const MAX_REGION = 16;
export const CONNECTED = [true, true, false]; // each board picks one: a third of boards have colors split into pieces
export const ISLANDS = 3; // starting squares placed away from their color on a split board
export const MAX_PIECES = 3; // most pieces one color may be split into

// Labs board outlines, '.' for a hole. Every one is 8x8 and has room for a mine in each row and column.
export const SHAPES = [
  '..####..' + '.######.' + '########' + '########' + '########' + '########' + '.######.' + '..####..', // octagon
  '..####..' + '..####..' + '########' + '########' + '########' + '########' + '..####..' + '..####..', // cross
  '.##..##.' + '########' + '########' + '########' + '.######.' + '.######.' + '..####..' + '...##...', // heart
  '########' + '########' + '########' + '###..###' + '###..###' + '########' + '########' + '########', // ring
];
export const holesOf = (shape) => [...shape].flatMap((ch, i) => (ch === '.' ? [i] : []));

const pick = (rand, list) => list[Math.floor(rand() * list.length)];

// One mine per row and column, none touching (or none sharing a diagonal), none in a hole.
// Returns squares in placement order.
export const placeMines = (n, rand, diagonals = false, holes = []) => {
  for (;;) {
    const blocked = new Uint8Array(n * n), mines = [];
    for (const h of holes) blocked[h] = 1;
    while (mines.length < n) {
      const open = [];
      for (let i = 0; i < n * n; i++) if (!blocked[i]) open.push(i);
      if (!open.length) break;
      const m = pick(rand, open);
      mines.push(m);
      for (let s = 0; s < n * n; s++) if (blocks(n, m, s, diagonals)) blocked[s] = 1;
    }
    if (mines.length === n) return mines;
  }
};

// Color k grows from mines[k]. A square may join color k if it is free, or if an earlier mine already rules it out
// (then solving in mine order leaves each color a single spot). `islands` extra starting squares go somewhere not
// touching their color, so it can end up in pieces. Holes stay -1. Returns null on a dead end, unless `lenient`:
// then a stuck square joins any color next to it and the solver decides (big boards dead-end ~90% of the time).
export const paintRegions = (n, mines, rand, freeShare, { islands = 0, diagonals = false, holes = [], lenient = false } = {}) => {
  const N = n * n;
  const free = Array.from({ length: N }, () => rand() < freeShare);
  const firstRuledOut = Array.from({ length: N }, (_, i) => mines.findIndex((m) => blocks(n, m, i, diagonals)));
  const regions = new Array(N).fill(null); // null until painted
  for (const h of holes) regions[h] = -1;
  mines.forEach((m, k) => (regions[m] = k));
  for (let s = 0; s < islands; s++) {
    const k = Math.floor(rand() * n), spots = [];
    for (let i = 0; i < N; i++) if (regions[i] === null && (free[i] || firstRuledOut[i] < k)
      && !neighbors4(n, i).some((j) => regions[j] === k)) spots.push(i);
    if (spots.length) regions[pick(rand, spots)] = k;
  }
  for (let left = regions.filter((k) => k === null).length; left; left--) {
    const options = [];
    for (const loose of lenient ? [false, true] : [false]) {
      for (let i = 0; i < N; i++) if (regions[i] === null)
        for (const j of neighbors4(n, i)) {
          const k = regions[j];
          if (k !== null && k >= 0 && (loose || free[i] || firstRuledOut[i] < k)) options.push([i, k]);
        }
      if (options.length) break;
    }
    if (!options.length) return null;
    const [i, k] = pick(rand, options);
    regions[i] = k;
  }
  return regions;
};

// How many 4-connected pieces color `k` is in.
export const pieces = (n, regions, k) => {
  const seen = new Set();
  let count = 0;
  regions.forEach((c, i) => {
    if (c !== k || seen.has(i)) return;
    count++;
    const stack = [i];
    seen.add(i);
    while (stack.length) for (const j of neighbors4(n, stack.pop()))
      if (regions[j] === k && !seen.has(j)) { seen.add(j); stack.push(j); }
  });
  return count;
};

// Moves border squares between colors until every size is within [minSize, maxSize], keeping the board solvable
// (and every color in one piece when `connected`). Holes stay put. Returns a new array, or null if it gets stuck.
export const rebalance = (n, mines, regions, rand, minSize, maxSize, connected = true, diagonals = false) => {
  let cur = [...regions];
  for (let round = 0; round < 200; round++) {
    const sizes = new Array(n).fill(0);
    for (const k of cur) if (k >= 0) sizes[k]++;
    if (sizes.every((s) => s >= minSize && s <= maxSize)) return cur;
    const moves = [];
    for (let x = 0; x < n * n; x++) {
      const from = cur[x];
      if (from < 0 || mines.includes(x) || sizes[from] - 1 < minSize) continue;
      for (const j of neighbors4(n, x)) {
        const to = cur[j];
        if (to >= 0 && to !== from && sizes[to] + 1 <= maxSize && (sizes[to] < minSize || sizes[from] > maxSize)) moves.push([x, to]);
      }
    }
    for (let i = moves.length - 1; i > 0; i--) { // Fisher-Yates
      const j = Math.floor(rand() * (i + 1));
      [moves[i], moves[j]] = [moves[j], moves[i]];
    }
    let next = null;
    for (const [x, to] of moves) {
      const from = cur[x];
      const trial = [...cur];
      trial[x] = to;
      if (connected && pieces(n, trial, from) > 1) continue;
      if (solve(n, trial, diagonals).solved) { next = trial; break; }
    }
    if (!next) return null;
    cur = next;
  }
  return null;
};

/** Labs options: `diagonals` swaps the touching rule for the diagonal one; `shaped` cuts the board to one of SHAPES (8x8).
 *  @returns {Board} */
export const generateBoard = (n, seed, { diagonals = false, shaped = false, lenient = false } = {}) => {
  const rand = mulberry32(seed);
  const minSize = pick(rand, MIN_REGIONS);
  const connected = pick(rand, CONNECTED);
  const holes = shaped ? holesOf(pick(rand, SHAPES)) : [];
  for (let attempt = 0; attempt < 10000; attempt++) {
    const mines = placeMines(n, rand, diagonals, holes);
    const painted = paintRegions(n, mines, rand, FREE_SHARE, { islands: connected ? 0 : ISLANDS, diagonals, holes, lenient });
    if (!painted) continue;
    const first = solve(n, painted, diagonals);
    if (!first.solved) continue;
    const regions = rebalance(n, mines, painted, rand, minSize, MAX_REGION, connected, diagonals);
    if (!regions) continue;
    const counts = mines.map((_, k) => pieces(n, regions, k));
    if (!connected && (counts.every((c) => c === 1) || counts.some((c) => c > MAX_PIECES))) continue;
    // Rebalancing can change which rules are needed, so report the difficulty of the final board.
    const result = solve(n, regions, diagonals);
    return { n, regions, mines: [...mines].sort((a, b) => a - b), hardest: result.hardest, ...(diagonals && { diagonals }) };
  }
  throw new Error('generateBoard: no board found');
};
