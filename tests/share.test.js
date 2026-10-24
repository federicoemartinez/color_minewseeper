import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatTime, shareText } from '../js/share.js';

test('formatTime', () => {
  assert.equal(formatTime(0), '0:00'); assert.equal(formatTime(65000), '1:05'); assert.equal(formatTime(271999), '4:31');
});
test('flawless daily', () => {
  assert.equal(shareText({ mode: 'daily', date: '2026-10-24', won: true, lostBy: null, livesLeft: 3, timeMs: 271000 }),
    'Color Minefield Daily 2026-10-24\nFlawless! ❤️❤️❤️ ⏱ 4:31');
});
test('a win with a lost life', () => {
  assert.equal(shareText({ mode: 'daily', date: '2026-10-24', won: true, lostBy: null, livesLeft: 2, timeMs: 271000 }),
    'Color Minefield Daily 2026-10-24\nSolved ❤️❤️🤍 ⏱ 4:31');
});
test('an arena explosion with a link', () => {
  assert.equal(shareText({ mode: 'arena', won: false, lostBy: 'boom', livesLeft: 2, timeMs: 125000, url: 'https://x.github.io/minewseeper/' }),
    'Color Minefield Arena\nBoom 💥 ❤️❤️🤍 ⏱ 2:05\nhttps://x.github.io/minewseeper/');
});
test('out of lives', () => {
  assert.equal(shareText({ mode: 'daily', date: '2026-10-24', won: false, lostBy: 'lives', livesLeft: 0, timeMs: 60000 }),
    'Color Minefield Daily 2026-10-24\nOut of lives 💔 🤍🤍🤍 ⏱ 1:00');
});
