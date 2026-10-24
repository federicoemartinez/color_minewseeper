export function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const MAX_LIVES = 3;

export function shareText({ mode, date, won, lostBy, livesLeft, timeMs, url }) {
  const title = mode === 'daily' ? `Color Minefield Daily ${date}` : 'Color Minefield Arena';
  const verdict = won ? (livesLeft === MAX_LIVES ? 'Flawless!' : 'Solved') : lostBy === 'boom' ? 'Boom 💥' : 'Out of lives 💔';
  const hearts = '❤️'.repeat(livesLeft) + '🤍'.repeat(MAX_LIVES - livesLeft);
  return [title, `${verdict} ${hearts} ⏱ ${formatTime(timeMs)}`, ...(url ? [url] : [])].join('\n');
}
