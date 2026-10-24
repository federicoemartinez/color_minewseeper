import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dateKey, previousDay, emptyStats, recordResult, currentStreak } from '../js/stats.js';

const withStreak = (streak, lastWonDate) => {
  const s = emptyStats();
  s.daily = { ...s.daily, streak, bestStreak: streak, lastWonDate };
  return s;
};
const daily = (date, won, flawless = won) => ({ mode: 'daily', date, won, flawless, timeMs: 271000 });

test('dateKey is the local date', () => assert.equal(dateKey(new Date(2026, 9, 24, 23, 59)), '2026-10-24'));
test('previousDay crosses months and years', () => {
  assert.equal(previousDay('2026-03-01'), '2026-02-28');
  assert.equal(previousDay('2026-01-01'), '2025-12-31');
});
test('winning the day after a win extends the streak', () => {
  const s = withStreak(4, '2026-10-23');
  const r = recordResult(s, daily('2026-10-24', true));
  assert.deepEqual(r.daily, { played: 1, won: 1, flawless: 1, streak: 5, bestStreak: 5, lastWonDate: '2026-10-24', bestTimeMs: 271000 });
  assert.equal(s.daily.streak, 4);
});
test('a win after a gap restarts the streak at 1', () => {
  const r = recordResult(withStreak(4, '2026-10-21'), daily('2026-10-24', true));
  assert.equal(r.daily.streak, 1); assert.equal(r.daily.bestStreak, 4);
});
test('losing the daily resets the streak', () => {
  const r = recordResult(withStreak(4, '2026-10-23'), daily('2026-10-24', false));
  assert.equal(r.daily.streak, 0); assert.equal(r.daily.bestStreak, 4);
  assert.equal(r.daily.played, 1); assert.equal(r.daily.won, 0); assert.equal(r.daily.bestTimeMs, null);
});
test('arena results never touch the streak', () => {
  const r = recordResult(withStreak(4, '2026-10-23'), { mode: 'arena', date: '2026-10-24', won: true, flawless: false, timeMs: 1000 });
  assert.equal(r.daily.streak, 4); assert.deepEqual(r.arena, { played: 1, won: 1, flawless: 0, bestTimeMs: 1000 });
});
test('currentStreak hides a streak broken by a missed day', () => {
  const s = withStreak(5, '2026-10-23');
  assert.equal(currentStreak(s, '2026-10-23'), 5);
  assert.equal(currentStreak(s, '2026-10-24'), 5);
  assert.equal(currentStreak(s, '2026-10-25'), 0);
});
