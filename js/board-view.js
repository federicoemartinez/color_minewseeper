import { regionBorders } from './grid.js';

const LABEL = { unknown: 'unknown', safe: 'safe', mine: 'mine', boom: 'exploded' };
const icon = (id) => `<svg aria-hidden="true"><use href="#${id}"/></svg>`;
// Candy's exploded bomb sits on a burst; the other themes reuse their mine.
const boomIcon = (theme) => theme !== 'candy' ? icon(`${theme}-mine`)
  : '<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#candy-burst" width="24" height="24"/><use href="#candy-mine" x="3" y="3" width="18" height="18"/></svg>';

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
    sq.style.backgroundColor = m === 'boom' ? 'var(--boom)' : `var(--c${regions[i]})`;
    sq.setAttribute('aria-label', `Row ${r + 1}, column ${c + 1}, color ${regions[i] + 1}, ${LABEL[m]}`);
    sq.innerHTML = m === 'mine' ? icon(`${theme}-flag`) : m === 'boom' ? boomIcon(theme) : revealed ? icon(`${theme}-mine`) : '';
  });
}
