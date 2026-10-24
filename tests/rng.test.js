import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32, fnv1a, randomSeed } from '../js/rng.js';

test('fnv1a is pinned (daily boards depend on it)', () => {
  assert.equal(fnv1a('2026-10-24'), 3698842276);
});
test('mulberry32 is pinned and repeatable', () => {
  const a = mulberry32(3698842276), b = mulberry32(3698842276);
  assert.equal(a(), 0.5014588797930628);
  assert.equal(a(), 0.6374095159117132);
  b();
  assert.equal(b(), 0.6374095159117132);
});
test('mulberry32 stays in [0, 1)', () => {
  const r = mulberry32(1);
  for (let k = 0; k < 1000; k++) { const x = r(); assert.ok(x >= 0 && x < 1); }
});
test('randomSeed is an unsigned 32-bit integer', () => {
  const s = randomSeed();
  assert.ok(Number.isInteger(s) && s >= 0 && s < 2 ** 32);
});
