import assert from 'node:assert/strict';
import { neighbors8 } from '../js/grid.js';
import { pieces } from '../js/generator.js';

export const regionSizes = (n, regions) => {
  const sizes = new Array(n).fill(0);
  for (const k of regions) sizes[k]++;
  return sizes;
};

// Throws unless regions/mines form a legal board: one mine per row, column and color, none touching,
// and (when `connected`) every color in one piece.
export const assertValidLayout = (n, regions, mines, connected = true) => {
  assert.equal(regions.length, n * n);
  assert.ok(regions.every((k) => Number.isInteger(k) && k >= 0 && k < n), 'colors must be 0..n-1');
  for (let k = 0; k < n; k++) {
    const squares = regions.flatMap((c, i) => (c === k ? [i] : []));
    assert.ok(squares.length > 0, `color ${k} is empty`);
    if (connected) assert.equal(pieces(n, regions, k), 1, `color ${k} is not connected`);
  }
  assert.equal(mines.length, n);
  assert.equal(new Set(mines.map((m) => Math.floor(m / n))).size, n, 'one mine per row');
  assert.equal(new Set(mines.map((m) => m % n)).size, n, 'one mine per column');
  assert.equal(new Set(mines.map((m) => regions[m])).size, n, 'one mine per color');
  for (const m of mines) for (const j of neighbors8(n, m)) assert.ok(!mines.includes(j), 'mines must not touch');
};
