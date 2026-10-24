import { LIVES, createGame, mark } from './game.js';
import { renderBoard } from './board-view.js';

// Pictures are real game states on this board, drawn in the chosen theme.
const BOARD = { n: 5, regions: [...'0011101122033223344234444'].map(Number), mines: [0, 7, 14, 16, 23] };
// Page 5 needs its own board: color 2 (squares 7 and 12) lies entirely inside column 2.
const CONFINED = { n: 5, regions: [...'0001100211332443334433444'].map(Number), mines: [3, 5, 12, 19, 21] };

const picture = (board, edit) => { const g = createGame(board); edit(g); return g; };
const setMarks = (g, kind, squares) => squares.forEach((i) => { g.marks[i] = kind; });

const PAGES = [
  { text: 'Each row, each column and each color hides exactly one mine.',
    game: () => picture(BOARD, (g) => setMarks(g, 'mine', BOARD.mines)) },
  { text: 'Mines never touch, not even diagonally.',
    game: () => picture(BOARD, (g) => { setMarks(g, 'safe', [1, 2, 3, 6, 8, 11, 12, 13]); setMarks(g, 'mine', [7]); }) },
  { text: 'Tap a square to mark it safe. If it is a mine, boom: game over.',
    game: () => picture(BOARD, (g) => { setMarks(g, 'safe', [6, 8, 12]); setMarks(g, 'boom', [7]); }) },
  { text: 'Double-tap to flag a mine. A wrong flag costs one of your 3 lives.',
    hearts: true,
    game: () => picture(BOARD, (g) => { mark(g, 0, 'mine'); mark(g, 7, 'mine'); mark(g, 12, 'mine'); }) },
  { text: "If a color fits entirely inside one row or column, its mine is that row's or column's mine, so every other square in that row or column is safe.",
    game: () => picture(CONFINED, (g) => setMarks(g, 'safe', [2, 17, 22])), highlight: [7, 12] },
  { text: 'Flag every mine to win, and lose no lives for a Flawless victory. Every board can be solved by logic, so you never need to guess.',
    hearts: true,
    game: () => picture(BOARD, (g) => BOARD.mines.forEach((i) => mark(g, i, 'mine'))) },
];

const theme = () => document.documentElement.dataset.theme;
const hearts = (lives) => Array.from({ length: LIVES }, (_, k) =>
  `<svg class="${k < lives ? 'on' : 'off'}" aria-hidden="true"><use href="#${theme()}-heart"/></svg>`).join('');

/** Fills #tutorial (the caller shows it). Done or Skip calls `onDone`. */
export function openTutorial(onDone) {
  const root = document.getElementById('tutorial');
  let page = 0;

  const draw = () => {
    const p = PAGES[page], g = p.game(), last = page === PAGES.length - 1;
    root.innerHTML = `
      <div class="tut-dots" role="img" aria-label="Page ${page + 1} of ${PAGES.length}">${PAGES.map((_, k) => `<i${k === page ? ' class="on"' : ''}></i>`).join('')}</div>
      ${p.hearts ? `<div class="hearts tut-hearts" role="img" aria-label="${g.lives} of ${LIVES} lives left">${hearts(g.lives)}</div>` : '<div class="tut-hearts"></div>'}
      <div class="board tut-board" inert></div>
      <p class="tut-text">${p.text}</p>
      <div class="tut-nav">
        ${page === 0 ? '<button class="btn ghost" data-act="done" type="button">Skip</button>'
          : '<button class="btn alt" data-act="back" type="button">Back</button>'}
        <button class="btn" data-act="${last ? 'done' : 'next'}" type="button">${last ? 'Done' : 'Next'}</button>
      </div>`;
    const board = root.querySelector('.tut-board');
    renderBoard(board, g, theme());
    p.highlight?.forEach((i) => board.children[i].classList.add('hl'));
    root.querySelector('.tut-nav .btn:last-child').focus({ preventScroll: true });
  };

  root.onclick = (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'next') page++;
    else if (act === 'back') page--;
    else if (act === 'done') return onDone();
    else return;
    draw();
  };
  draw();
}
