import { fnv1a, randomSeed } from './rng.js';
import { BOARD_SIZE, generateBoard } from './generator.js';
import { LIVES, createGame, mark, minesFound, isFlawless } from './game.js';
import { createTapHandler } from './input.js';
import { dateKey, recordResult, currentStreak } from './stats.js';
import { createStore } from './storage.js';
import { formatTime, shareText } from './share.js';
import { renderBoard } from './board-view.js';

const $ = (id) => document.getElementById(id);
const store = createStore();
const theme = () => document.documentElement.dataset.theme;

/** @type {null | { mode: 'daily'|'arena', date: string, game: import('./game.js').Game, tap: (i: number) => void }} */
let session = null;
let runningSince = null, ticker = null;

// Generation takes ~20 ms on a laptop (tools/measure-generator.mjs), so it stays on the main thread.
export async function getBoard(n, seed) {
  $('loading').hidden = false;
  try {
    await new Promise((done) => requestAnimationFrame(() => setTimeout(done, 0)));
    return generateBoard(n, seed);
  } finally {
    $('loading').hidden = true;
  }
}

function show(id) {
  for (const s of document.querySelectorAll('main > section')) s.hidden = s.id !== id;
  window.scrollTo(0, 0);
}

const dayLabel = (key, opts = { month: 'short', day: 'numeric' }) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, opts);
};
const modeLabel = (s) => (s.mode === 'daily' ? `Daily · ${dayLabel(s.date)}` : 'Arena');
const started = (g) => g.marks.some((m) => m !== 'unknown');

function drawHearts(el, lives) {
  el.innerHTML = Array.from({ length: LIVES }, (_, k) =>
    `<svg class="${k < lives ? 'on' : 'off'}" aria-hidden="true"><use href="#${theme()}-heart"/></svg>`).join('');
  el.setAttribute('aria-label', `${lives} of ${LIVES} lives left`);
}

// --- Clock: runs from the first mark, pauses while the page is hidden, lives in game.elapsedMs.
const elapsed = () => session.game.elapsedMs + (runningSince === null ? 0 : performance.now() - runningSince);
const drawTimer = () => { $('timer').textContent = `⏱ ${formatTime(elapsed())}`; };

function startClock() {
  if (runningSince !== null || document.hidden) return;
  runningSince = performance.now();
  ticker = setInterval(drawTimer, 250);
}
function syncClock() {
  if (runningSince === null) return;
  const now = performance.now();
  session.game.elapsedMs = Math.round(session.game.elapsedMs + now - runningSince);
  runningSince = now;
}
function stopClock() {
  if (runningSince === null) return;
  syncClock();
  runningSince = null;
  clearInterval(ticker);
}
const saveDaily = () => { if (session?.mode === 'daily') store.saveDaily({ date: session.date, game: session.game }); };

function pause() {
  stopClock();
  if (session?.game.status === 'playing') saveDaily();
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pause();
  else if (session?.game.status === 'playing' && !$('play').hidden && started(session.game)) startClock();
});
addEventListener('pagehide', pause);

// --- Home
function showHome() {
  const today = dateKey(), stats = store.loadStats(), rec = store.loadDaily();
  const daily = rec?.date === today ? rec.game : null;
  const done = daily !== null && daily.status !== 'playing';

  $('daily-date').textContent = `${dayLabel(today, { weekday: 'short', month: 'short', day: 'numeric' })} · same board for everyone`;
  $('daily-streak').textContent = `🔥 ${currentStreak(stats, today)}`;
  $('daily-result').hidden = !done;
  if (done) {
    const verdict = daily.status === 'won' ? (isFlawless(daily) ? 'Flawless victory!' : 'Solved') : 'Lost';
    $('daily-result').textContent = `${verdict} · ⏱ ${formatTime(daily.elapsedMs)}`;
  }
  $('daily-play').disabled = done;
  $('daily-play').textContent = done ? 'Back tomorrow' : daily ? 'Continue' : "Play today's board";

  $('total-played').textContent = stats.daily.played + stats.arena.played;
  $('total-won').textContent = stats.daily.won + stats.arena.won;
  $('total-flawless').textContent = stats.daily.flawless + stats.arena.flawless;
  show('home');
}

// --- Play
async function startDaily() {
  const today = dateKey(), rec = store.loadDaily();
  let game;
  if (rec?.date === today) {
    game = rec.game;
  } else {
    game = createGame(await getBoard(BOARD_SIZE, fnv1a(today)));
    store.saveDaily({ date: today, game });
  }
  if (game.status !== 'playing') return showHome(); // one try per day
  startPlay({ mode: 'daily', date: today, game });
}

async function startArena() {
  startPlay({ mode: 'arena', date: dateKey(), game: createGame(await getBoard(BOARD_SIZE, randomSeed())) });
}

function startPlay(s) {
  stopClock();
  s.tap = createTapHandler({ onTap: (i) => act(s, i, 'safe'), onDoubleTap: (i) => act(s, i, 'mine') });
  session = s;
  $('mode-label').textContent = modeLabel(s);
  renderPlay();
  show('play');
  if (started(s.game)) startClock();
}

function renderPlay() {
  const g = session.game;
  renderBoard($('board'), g, theme());
  drawHearts($('hearts'), g.lives);
  $('found').textContent = `🚩 ${minesFound(g)} / ${g.hidden.length}`;
  drawTimer();
}

function act(s, i, kind) {
  if (s !== session || s.game.status !== 'playing') return; // a tap left pending by Back or a finished game
  startClock();
  if (mark(s.game, i, kind) === 'ignored') return;
  const over = s.game.status !== 'playing';
  if (over) stopClock(); else syncClock();
  saveDaily();
  if (over) finish(s); else renderPlay();
}

function finish(s) {
  const g = s.game;
  // For the daily, s.date is the saved record's date, even if the game ends after midnight.
  const stats = recordResult(store.loadStats(), {
    mode: s.mode, date: s.date, won: g.status === 'won', flawless: isFlawless(g), timeMs: g.elapsedMs,
  });
  store.saveStats(stats);
  showResult(s, stats);
}

// --- Result
function showResult(s, stats) {
  const g = s.game, won = g.status === 'won', flawless = isFlawless(g);
  $('banner').textContent = won ? (flawless ? 'Flawless victory!' : 'Solved!') : g.lostBy === 'boom' ? 'Boom!' : 'Out of lives';
  $('banner').className = `banner ${flawless ? 'flawless' : won ? 'won' : 'lost'}`;
  $('result-label').textContent = modeLabel(s);
  renderBoard($('result-board'), g, theme());
  $('result-time').textContent = formatTime(g.elapsedMs);
  drawHearts($('result-lives'), g.lives);
  $('result-streak-box').hidden = s.mode !== 'daily';
  $('result-streak').textContent = `🔥 ${currentStreak(stats, dateKey())}`;
  $('share').textContent = 'Share result';
  show('result');
}

async function share() {
  const g = session.game;
  const text = shareText({
    mode: session.mode, date: session.date, won: g.status === 'won', lostBy: g.lostBy,
    livesLeft: g.lives, timeMs: g.elapsedMs, url: location.origin + location.pathname,
  });
  if (navigator.share) {
    try { await navigator.share({ text }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  try {
    await navigator.clipboard.writeText(text);
    $('share').textContent = 'Copied!';
    setTimeout(() => { $('share').textContent = 'Share result'; }, 2000);
  } catch {
    prompt('Copy your result:', text); // no clipboard (e.g. plain http on a LAN)
  }
}

// --- Wiring
$('board').addEventListener('pointerup', (e) => {
  const sq = e.button === 0 && e.target.closest('.sq');
  if (sq && session) session.tap(Number(sq.dataset.i));
});
// Keyboard: Enter or Space on a focused square is a tap, pressed twice quickly a double tap.
// (Not the click event: a pointer click there would count a second time and become a double tap.)
$('board').addEventListener('keydown', (e) => {
  if ((e.key !== 'Enter' && e.key !== ' ') || e.repeat) return;
  const sq = e.target.closest('.sq');
  if (!sq || !session) return;
  e.preventDefault();
  session.tap(Number(sq.dataset.i));
});
$('daily-play').addEventListener('click', startDaily);
$('arena-play').addEventListener('click', startArena);
$('again').addEventListener('click', startArena);
$('back').addEventListener('click', () => { pause(); session = null; showHome(); });
$('to-home').addEventListener('click', () => { session = null; showHome(); });
$('share').addEventListener('click', share);

showHome();
