const pad = (n) => String(n).padStart(2, '0');

export const dateKey = (date = new Date()) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export function previousDay(key) {
  const [y, m, d] = key.split('-').map(Number);
  return dateKey(new Date(y, m - 1, d - 1, 12)); // noon avoids daylight-saving edges
}

export const emptyStats = () => ({
  daily: { played: 0, won: 0, flawless: 0, streak: 0, bestStreak: 0, lastWonDate: null, bestTimeMs: null },
  arena: { played: 0, won: 0, flawless: 0, bestTimeMs: null },
});

const best = (old, r) => (r.won && (old === null || r.timeMs < old) ? r.timeMs : old);

export function recordResult(stats, r) {
  const next = { daily: { ...stats.daily }, arena: { ...stats.arena } };
  const m = next[r.mode];
  m.played += 1;
  if (r.won) m.won += 1;
  if (r.won && r.flawless) m.flawless += 1;
  m.bestTimeMs = best(m.bestTimeMs, r);
  if (r.mode === 'daily') {
    m.streak = r.won ? (m.lastWonDate === previousDay(r.date) ? m.streak + 1 : 1) : 0;
    m.bestStreak = Math.max(m.bestStreak, m.streak);
    if (r.won) m.lastWonDate = r.date;
  }
  return next;
}

// A streak survives until the day after the next one is missed.
export const currentStreak = (stats, today) =>
  stats.daily.lastWonDate === today || stats.daily.lastWonDate === previousDay(today) ? stats.daily.streak : 0;
