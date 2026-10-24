import { regionBorders } from './grid.js';

const LABEL = { unknown: 'unknown', safe: 'safe', mine: 'mine', boom: 'exploded' };
const icon = (id) => `<svg aria-hidden="true"><use href="#${id}"/></svg>`;

/** Draws `game` into `el` as n×n `<button class="sq" data-i>`. Reuses existing squares so focus survives. */
export function renderBoard(el, game, theme) {
  const { n, regions, marks } = game;
  let squares = [...el.children];
  if (squares.length !== n * n) {
    squares = marks.map(() => document.createElement('button'));
    el.replaceChildren(...squares);
  }
  el.style.setProperty('--n', n);
  const lost = game.status === 'lost';

  squares.forEach((sq, i) => {
    const m = marks[i], r = Math.floor(i / n), c = i % n;
    const b = regionBorders(n, regions, i);
    const revealed = lost && m === 'unknown' && game.hidden.includes(i);
    sq.type = 'button';
    sq.dataset.i = i;
    sq.className = [
      'sq', m, revealed && 'revealed',
      c === n - 1 ? 'r0' : b.right && 'r3',
      r === n - 1 ? 'b0' : b.bottom && 'b3',
    ].filter(Boolean).join(' ');
    sq.style.background = m === 'boom' ? 'var(--boom)' : `var(--c${regions[i]})`;
    sq.setAttribute('aria-label', `Row ${r + 1}, column ${c + 1}, ${LABEL[m]}`);
    sq.innerHTML = m === 'mine' ? icon(`${theme}-flag`) : m === 'boom' || revealed ? icon(`${theme}-mine`) : '';
  });
}
