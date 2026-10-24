import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTapHandler } from '../js/input.js';

function setup(t) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const taps = [], doubles = [];
  const tap = createTapHandler({ onTap: (s) => taps.push(s), onDoubleTap: (s) => doubles.push(s) });
  return { tap, taps, doubles, tick: (ms) => t.mock.timers.tick(ms) };
}
test('a single tap fires after the delay', (t) => {
  const { tap, taps, doubles, tick } = setup(t);
  tap(5); tick(249); assert.deepEqual(taps, []);
  tick(1); assert.deepEqual(taps, [5]); assert.deepEqual(doubles, []);
});
test('two taps on one square within the delay are a double tap', (t) => {
  const { tap, taps, doubles, tick } = setup(t);
  tap(5); tick(200); tap(5); tick(1000);
  assert.deepEqual(taps, []); assert.deepEqual(doubles, [5]);
});
test('quick taps on two squares are two single taps', (t) => {
  const { tap, taps, doubles, tick } = setup(t);
  tap(5); tick(100); tap(6);
  assert.deepEqual(taps, [5]);
  tick(250); assert.deepEqual(taps, [5, 6]); assert.deepEqual(doubles, []);
});
test('a slow second tap is another single tap', (t) => {
  const { tap, taps, doubles, tick } = setup(t);
  tap(5); tick(300); tap(5); tick(250);
  assert.deepEqual(taps, [5, 5]); assert.deepEqual(doubles, []);
});
