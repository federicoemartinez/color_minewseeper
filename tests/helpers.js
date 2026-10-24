import assert from 'node:assert/strict';
import { neighbors4, neighbors8 } from '../js/grid.js';

export const regionSizes = (n, regions) => {
  const sizes = new Array(n).fill(0);
  for (const k of regions) sizes[k]++;
  return sizes;
};

// Throws unless regions/mines form a legal board: connected colors, one mine per row, column and color, none touching.
export const assertValidLayout = (n, regions, mines) => {
  assert.equal(regions.length, n * n);
  assert.ok(regions.every((k) => Number.isInteger(k) && k >= 0 && k < n), 'colors must be 0..n-1');
  for (let k = 0; k < n; k++) {
    const squares = regions.flatMap((c, i) => (c === k ? [i] : []));
    assert.ok(squares.length > 0, `color ${k} is empty`);
    const seen = new Set([squares[0]]), stack = [squares[0]];
    while (stack.length) for (const j of neighbors4(n, stack.pop())) if (regions[j] === k && !seen.has(j)) { seen.add(j); stack.push(j); }
    assert.equal(seen.size, squares.length, `color ${k} is not connected`);
  }
  assert.equal(mines.length, n);
  assert.equal(new Set(mines.map((m) => Math.floor(m / n))).size, n, 'one mine per row');
  assert.equal(new Set(mines.map((m) => m % n)).size, n, 'one mine per column');
  assert.equal(new Set(mines.map((m) => regions[m])).size, n, 'one mine per color');
  for (const m of mines) for (const j of neighbors8(n, m)) assert.ok(!mines.includes(j), 'mines must not touch');
};
