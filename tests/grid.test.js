import { test } from 'node:test';
import assert from 'node:assert/strict';
import { neighbors8, neighbors4, regionBorders } from '../js/grid.js';

const sorted = (a) => [...a].sort((x, y) => x - y);
test('neighbors8', () => {
  assert.deepEqual(sorted(neighbors8(8, 0)), [1, 8, 9]);
  assert.equal(neighbors8(8, 9).length, 8);
});
test('neighbors4', () => {
  assert.deepEqual(sorted(neighbors4(8, 0)), [1, 8]);
  assert.deepEqual(sorted(neighbors4(8, 9)), [1, 8, 10, 17]);
});
test('regionBorders marks color changes, not board edges', () => {
  // 2x2 colors: [0, 1 / 0, 0]
  assert.deepEqual(regionBorders(2, [0, 1, 0, 0], 0), { top: false, right: true, bottom: false, left: false });
  assert.deepEqual(regionBorders(2, [0, 1, 0, 0], 3), { top: true, right: false, bottom: false, left: false });
});
