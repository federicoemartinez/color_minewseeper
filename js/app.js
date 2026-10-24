import { fnv1a, randomSeed } from './rng.js';
import { BOARD_SIZE, generateBoard } from './generator.js';
import { LIVES, createGame, mark, minesFound, isFlawless, hintFor, takeHint } from './game.js';
import { createTapHandler } from './input.js';
import { dateKey, recordResult, currentStreak } from './stats.js';
import { createStore } from './storage.js';
import { formatTime, shareText } from './share.js';
import { renderBoard } from './board-view.js';
import { GUIDE_BOARD, STEPS, guideStep, guideAllows, guideTip } from './guide.js';
import { playSound, unlockAudio } from './sound.js';

const $ = (id) => document.getElementById(id);
const store = createStore();
const theme = () => document.documentElement.dataset.theme;
// Inside a portal's iframe (CrazyGames): our URL is their CDN's, and an offline cache there would pin old builds.
const embedded = window.top !== window.self;

/** @type {null | { mode: 'daily'|'arena'|'guide', date: string, game: import('./game.js').Game, tap: (i: number) => void,
 *    hint: null | { text: string, squares: number[] }, hintsAsked: number }} hintsAsked counts since the last mark. */
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

// One history entry sits above Home while any other screen shows, so system Back (Android) goes Home.
let pushed = false;
function show(id) {
  if (id !== 'home' && !pushed) { history.pushState(null, ''); pushed = true; }
  for (const s of document.querySelectorAll('main > section')) s.hidden = s.id !== id;
  window.scrollTo(0, 0);
}

const dayLabel = (key, opts = { month: 'short', day: 'numeric' }) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, opts);
};
// Mouse players click: same words, the mouse's verb.
const say = (text) => (matchMedia('(pointer: coarse)').matches ? text : text.replace(/tap/g, 'click').replace(/Tap/g, 'Click'));
const modeLabel = (s) => ({ daily: `Daily · ${dayLabel(s.date)}`, arena: 'Arena', guide: 'How to play' })[s.mode];
const started = (g) => g.marks.some((m) => m !== 'unknown');

function drawHearts(el, lives) {
  el.innerHTML = Array.from({ length: LIVES }, (_, k) =>
    `<svg class="${k < lives ? 'on' : 'off'}" aria-hidden="true"><use href="#${theme()}-heart"/></svg>`).join('');
  el.setAttribute('aria-label', `${lives} of ${LIVES} lives left`);
}

// --- Sound and motion. Each theme's css/themes.css keyframes decide what an fx-* class looks like.
const sfx = (moment) => { if (store.loadSettings().sound) playSound(theme(), moment); };
function fx(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth; // restart the animation if the class was still there
  el.classList.add(cls);
}
const loseHeart = (g) => fx($('hearts').children[g.lives], 'fx-lose');
function confetti() {
  const css = getComputedStyle(document.documentElement), layer = document.createElement('div');
  layer.className = 'confetti';
  layer.setAttribute('aria-hidden', 'true');
  for (let k = 0; k < 70; k++) {
    const bit = document.createElement('i');
    bit.style.left = `${Math.random() * 100}%`;
    bit.style.background = css.getPropertyValue(`--c${k % 8}`);
    bit.style.animationDelay = `${Math.random() * .5}s`;
    bit.style.setProperty('--dx', `${(Math.random() - .5) * 200}px`);
    bit.style.setProperty('--spin', `${(Math.random() - .5) * 1440}deg`);
    layer.append(bit);
  }
  document.body.append(layer);
  setTimeout(() => layer.remove(), 3500);
}
function drawSoundToggle() {
  const on = store.loadSettings().sound;
  $('sound').textContent = on ? '🔊' : '🔇';
  $('sound').setAttribute('aria-pressed', String(on));
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
  else if (!$('home').hidden) showHome(); // resumed, maybe on a new day
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

// The first visit lands here; Back skips it (portals want onboarding skippable). How to play replays it.
function startGuide() {
  $('guide-go').textContent = store.loadSettings().tutorialSeen ? 'Play a board' : 'Play your first board';
  startPlay({ mode: 'guide', date: dateKey(), game: createGame(GUIDE_BOARD) });
}

async function startArena() {
  startPlay({ mode: 'arena', date: dateKey(), game: createGame(await getBoard(BOARD_SIZE, randomSeed())) });
}

function startPlay(s) {
  stopClock();
  s.tap = createTapHandler({ onTap: (i) => act(s, i, 'safe'), onDoubleTap: (i) => act(s, i, 'mine') });
  s.hint = null; s.hintsAsked = 0;
  session = s;
  $('play').classList.toggle('guide', s.mode === 'guide');
  $('mode-label').textContent = modeLabel(s);
  renderPlay();
  show('play');
  if (started(s.game)) startClock();
}

function renderPlay() {
  const g = session.game, guide = session.mode === 'guide';
  const tip = guide && !session.hint ? guideTip(g) : session.hint;
  renderBoard($('board'), g, theme());
  for (const i of tip?.squares ?? []) $('board').children[i].classList.add('hl');
  $('tip').textContent = say(tip?.text ?? 'Tap = safe · Double tap = mine');
  $('tip').classList.toggle('ask', tip !== null);
  $('hint-btn').hidden = guide && guideStep(g) < STEPS.length;
  $('hint-btn').disabled = !guide && g.lives <= 1;
  $('hint-btn').title = guide ? 'Hint' : g.lives > 1 ? 'Hint: costs a life' : 'No hints on your last life';
  $('timer').hidden = guide;
  $('guide-go').hidden = !(guide && g.status === 'won');
  $('play').querySelector('.sub').hidden = guide && g.status === 'won'; // makes room for the way out
  drawHearts($('hearts'), g.lives);
  $('found').textContent = `🚩 ${minesFound(g)} / ${g.hidden.length}`;
  drawTimer();
}

const MOVE_SOUND = { safe: 'tap', flag: 'flag', won: 'flag', 'wrong-flag': 'wrong', 'out-of-lives': 'wrong', boom: 'boom' };
const MOVE_FX = { safe: 'fx-tap', flag: 'fx-flag', won: 'fx-flag', 'wrong-flag': 'fx-wrong', 'out-of-lives': 'fx-wrong' };

function act(s, i, kind) {
  if (s !== session || s.game.status !== 'playing') return; // a tap left pending by Back or a finished game
  if (s.mode === 'guide' && s.game.marks[i] === 'unknown' && !guideAllows(s.game, i, kind)) {
    sfx('wrong'); fx($('board').children[i], 'fx-wrong'); // free in the guide: the move just bounces off
    return;
  }
  startClock();
  const move = mark(s.game, i, kind);
  if (move === 'ignored') return;
  s.hint = null; s.hintsAsked = 0;
  const over = s.game.status !== 'playing';
  if (over) stopClock(); else syncClock();
  saveDaily();
  renderPlay();
  sfx(MOVE_SOUND[move]);
  if (move === 'boom') fx($('board'), 'fx-boom'); else fx($('board').children[i], MOVE_FX[move]);
  if (move === 'wrong-flag' || move === 'out-of-lives') loseHeart(s.game);
  if (over) finish(s);
}

// Each hint asked without marking anything in between shows the next available deduction.
function askHint() {
  const s = session, h = s && hintFor(s.game, s.hintsAsked);
  if (!h || s.game.status !== 'playing') return;
  if (s.mode === 'guide') return giveHint(s, h, true);
  if (s.game.lives <= 1) return;
  const d = $('hint-ask');
  d.returnValue = '';
  d.addEventListener('close', () => {
    if (d.returnValue === 'yes' && s === session && s.game.status === 'playing') giveHint(s, h, false);
  }, { once: true });
  d.showModal();
}

function giveHint(s, h, free) {
  if (!free) takeHint(s.game);
  s.hint = h; s.hintsAsked++;
  saveDaily();
  renderPlay();
  if (!free) { sfx('wrong'); loseHeart(s.game); }
}

function finish(s) {
  if (s.mode === 'guide') return sfx('won'); // no stats; renderPlay already showed the way out
  const g = s.game;
  // For the daily, s.date is the saved record's date, even if the game ends after midnight.
  const stats = recordResult(store.loadStats(), {
    mode: s.mode, date: s.date, won: g.status === 'won', flawless: isFlawless(g), timeMs: g.elapsedMs,
  });
  store.saveStats(stats);
  // A beat to see the last move land before the result screen; Back in the meantime skips it.
  setTimeout(() => { if (s === session) showResult(s, stats); }, 900);
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
  fx($('banner'), 'fx-banner');
  if (won) sfx(flawless ? 'flawless' : 'won');
  if (flawless) confetti();
}

async function share() {
  const g = session.game;
  const text = shareText({
    mode: session.mode, date: session.date, won: g.status === 'won', lostBy: g.lostBy,
    livesLeft: g.lives, timeMs: g.elapsedMs, url: embedded ? undefined : location.origin + location.pathname,
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
// A pointer click (detail >= 1) is ignored: pointerup already counted it. A click with detail 0 is
// assistive tech activating the square; it counts, unless the keydown above already did (a key's own click).
let keyTapped = false;
$('board').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  keyTapped = true;
  const sq = e.target.closest('.sq');
  if (e.repeat || !sq || !session) return;
  e.preventDefault();
  session.tap(Number(sq.dataset.i));
});
$('board').addEventListener('keyup', () => setTimeout(() => { keyTapped = false; })); // after the key's click
$('board').addEventListener('click', (e) => {
  const sq = e.detail === 0 && !keyTapped && e.target.closest('.sq');
  if (sq && session) session.tap(Number(sq.dataset.i));
});
$('daily-play').addEventListener('click', startDaily);
$('arena-play').addEventListener('click', startArena);
$('again').addEventListener('click', startArena);
function goHome() {
  pushed = false;
  if (session?.mode === 'guide') markTutorialSeen(); // system Back out of the guide counts as done
  pause(); session = null;
  showHome();
}
const leave = () => { if (pushed) { pushed = false; history.back(); } else goHome(); }; // popstate then runs goHome
addEventListener('popstate', goHome);
$('back').addEventListener('click', leave);
$('to-home').addEventListener('click', leave);
$('share').addEventListener('click', share);
$('sound').addEventListener('click', () => {
  const settings = store.loadSettings();
  store.saveSettings({ ...settings, sound: !settings.sound });
  drawSoundToggle();
});
// Browsers start audio only inside a user gesture: a mouse press, or a touch or pen lift.
document.addEventListener('pointerdown', unlockAudio);
document.addEventListener('pointerup', unlockAudio);
document.addEventListener('keydown', unlockAudio);
$('hint-btn').addEventListener('click', askHint);

// --- Theme
const THEME_COLOR = { flat: '#fbf8f3', pixel: '#c0c0c0', candy: '#fff4fb' };
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]').content = THEME_COLOR[t];
  document.querySelector('.logo use').setAttribute('href', `#${t}-mine`);
  for (const b of $('themes').children) b.setAttribute('aria-pressed', String(b.dataset.theme === t));
}
$('themes').addEventListener('click', (e) => {
  const b = e.target.closest('.theme-opt');
  if (!b) return;
  applyTheme(b.dataset.theme);
  store.saveSettings({ ...store.loadSettings(), theme: b.dataset.theme });
});

// --- Tutorial
const markTutorialSeen = () => store.saveSettings({ ...store.loadSettings(), tutorialSeen: true });
$('how-to').addEventListener('click', startGuide);
$('guide-go').addEventListener('click', () => { markTutorialSeen(); startArena(); });

applyTheme(store.loadSettings().theme);
drawSoundToggle();
if (store.loadSettings().tutorialSeen) showHome(); else startGuide();

if ('serviceWorker' in navigator && !embedded) navigator.serviceWorker.register('./sw.js');
