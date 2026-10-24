# Minewseeper v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Minewseeper v1. It's a free, installable web puzzle game (a daily puzzle plus endless Arena boards at 8×8, three themes, a tutorial and local stats) as described in the spec.

**Architecture:** A static site with no build step: `index.html`, plus ES modules in `js/`, plus CSS. The game logic modules (`rng`, `grid`, `solver`, `generator`, `game`, `input`, `stats`, `storage`, `share`) never touch the page and are unit-tested with Node's built-in test runner. The modules that draw the page (`board-view`, `tutorial`, `app`) are checked by hand in a browser. Boards are generated on the device from a seed, and nothing talks to a server.

**Tech Stack:** HTML, CSS, JavaScript ES modules · `node:test` (Node ≥ 22) · `python3 -m http.server` for local serving · GitHub Pages for hosting.

**Spec:** `docs/superpowers/specs/2026-10-24-minewseeper-design.md` (mockups in `docs/superpowers/specs/mockups/`). Read it before starting. It explains *why* behind every rule here.

## Global Constraints

- No dependencies at all (no `npm install`). No framework, no bundler, no build step.
- Every URL in HTML, CSS, JS and the manifest is relative (`./…`), never `/…`. The site is served from a sub-path: `https://<user>.github.io/minewseeper/`.
- No network requests at runtime. **No ads in v1.**
- Squares are indexed `0 … n*n-1` row by row: `row = Math.floor(i / n)`, `col = i % n`.
- Board size **8**. Lives **3**. Double-tap window **250 ms**. Free-square share **0.2**. Color sizes **2 to 16** squares.
- Daily seed = `fnv1a(dateKey())`, where `dateKey()` is the **local** date `YYYY-MM-DD`. Arena seed = `randomSeed()`.
- The generator only uses the seeded `rand` it is given, never `Math.random`, `Date` or `crypto`. That way a seed gives the same board on every device.
- No field or variable is named `solution`. The mine list lives in `board.mines` / `game.hidden`.
- localStorage keys: `mws.stats`, `mws.daily`, `mws.settings`.
- The win banner for a win with no lives lost reads exactly `Flawless victory!`.
- Tests: `npm test` (= `node --test "tests/*.test.js"`). The commit after each task needs green tests.

## Review Focus

1. **Storage unavailable** (Safari private mode or blocked site data, where accessing `localStorage` throws): the game plays normally and stats just don't persist. Tested in Task 6.
2. **Corrupted or outdated saved data** (invalid JSON, missing fields, a daily from an earlier day): fall back to defaults or a fresh daily, and never crash. Tested in Task 6.
3. **Streaks across gaps and midnight:** a missed day shows streak 0, and a daily started before midnight and finished after it counts for the board's own date. Tested in Task 6; the app wiring is in Task 7.
4. **Hosted under a sub-path:** the game loads, installs and works offline at `https://<user>.github.io/minewseeper/`. Checked in Task 10.
5. **Taps on a locked square, after the game has ended, or quick taps on two different squares:** ignored, or treated as two single taps, never as a double tap. Tested in Tasks 4 and 5.

---

## File Structure

```
index.html                  all screens (home, play, result, tutorial) + inline SVG sprite symbols
css/base.css                layout, screens, board grid, color borders, marks shared by all themes
css/themes.css              per-theme look: [data-theme="flat" | "pixel" | "candy"]
js/rng.js                   seeded random, string hash, random seed
js/grid.js                  square geometry: neighbors, borders between colors
js/solver.js                human-style solver (rules 1–3)
js/generator.js             mines → colors → cleanup → Board
js/game.js                  game state machine (marks, lives, win/loss)
js/input.js                 tap vs double-tap detection
js/stats.js                 dates, results, streaks
js/storage.js               localStorage wrapper that never throws
js/share.js                 time format + share text
js/board-view.js            draws a Game into the page
js/tutorial.js              tutorial pages
js/app.js                   entry point: screens, wiring, timer, saving
manifest.webmanifest, sw.js, icons/      installable + offline
tests/*.test.js, tests/fixtures.js, tests/helpers.js
tools/measure-generator.mjs speed + difficulty report
README.md
```

Shared types (write these JSDoc typedefs at the top of `js/generator.js` and `js/game.js`):

```js
/** @typedef {{ n: number, regions: number[], mines: number[], hardest: 1|2|3 }} Board
 *  regions[i] = color 0..n-1 of square i · mines = sorted squares holding a mine · hardest = hardest solver rule needed */
/** @typedef {{ n: number, regions: number[], hidden: number[], marks: ('unknown'|'safe'|'mine'|'boom')[],
 *    lives: number, status: 'playing'|'won'|'lost', lostBy: null|'boom'|'lives', elapsedMs: number }} Game
 *  Plain JSON, with no Sets or classes, so a daily can be saved with JSON.stringify. */
```

---

### Task 1: Project skeleton, seeded random, grid geometry

**Files:**
- Create: `package.json`, `.gitignore`, `js/rng.js`, `js/grid.js`
- Test: `tests/rng.test.js`, `tests/grid.test.js`

**Interfaces:**
- Produces: `mulberry32(seed: number): () => number` (values in [0, 1)) · `fnv1a(text: string): number` (unsigned 32-bit) · `randomSeed(): number` (unsigned 32-bit, from `crypto.getRandomValues`) · `neighbors8(n, i): number[]` · `neighbors4(n, i): number[]` · `regionBorders(n, regions, i): { top, right, bottom, left }` (booleans: `true` where the neighbor on that side has a different color, `false` at the board edge).

- [ ] **Step 1: Set up the repo**

`git init`. `package.json`:
```json
{ "name": "minewseeper", "private": true, "type": "module", "scripts": { "test": "node --test \"tests/*.test.js\"" } }
```
`.gitignore`: `.superpowers/` and `node_modules/`.

- [ ] **Step 2: Write the failing tests**

```js
// tests/rng.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32, fnv1a, randomSeed } from '../js/rng.js';

test('fnv1a is pinned (daily boards depend on it)', () => {
  assert.equal(fnv1a('2026-10-24'), 3698842276);
});
test('mulberry32 is pinned and repeatable', () => {
  const a = mulberry32(3698842276), b = mulberry32(3698842276);
  assert.equal(a(), 0.5014588797930628);
  assert.equal(a(), 0.6374095159117132);
  b();
  assert.equal(b(), 0.6374095159117132);
});
test('mulberry32 stays in [0, 1)', () => {
  const r = mulberry32(1);
  for (let k = 0; k < 1000; k++) { const x = r(); assert.ok(x >= 0 && x < 1); }
});
test('randomSeed is an unsigned 32-bit integer', () => {
  const s = randomSeed();
  assert.ok(Number.isInteger(s) && s >= 0 && s < 2 ** 32);
});
```

```js
// tests/grid.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { neighbors8, neighbors4, regionBorders } from '../js/grid.js';

const sorted = (a) => [...a].sort((x, y) => x - y);
test('neighbors8', () => {
  assert.deepEqual(sorted(neighbors8(8, 0)), [1, 8, 9]);
  assert.equal(neighbors8(8, 9).length, 8);
});
test('neighbors4', () => {
  assert.deepEqual(sorted(neighbors4(8, 0)), [1, 8]);
  assert.deepEqual(sorted(neighbors4(8, 9)), [1, 8, 10, 17]);
});
test('regionBorders marks color changes, not board edges', () => {
  // 2x2 colors: [0, 1 / 0, 0]
  assert.deepEqual(regionBorders(2, [0, 1, 0, 0], 0), { top: false, right: true, bottom: false, left: false });
  assert.deepEqual(regionBorders(2, [0, 1, 0, 0], 3), { top: true, right: false, bottom: false, left: false });
});
```

- [ ] **Step 3: Run `npm test`.** Expected: FAIL, `Cannot find module '…/js/rng.js'`.

- [ ] **Step 4: Implement `js/rng.js` and `js/grid.js`**

The pinned test values depend on these exact algorithms:
```js
export const mulberry32 = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
export const fnv1a = (text) => {
  let h = 0x811c9dc5;
  for (const ch of text) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
};
```

- [ ] **Step 5: Run `npm test`.** Expected: all PASS.

- [ ] **Step 6: Commit** `git add package.json .gitignore js tests && git commit -m "feat: seeded random and grid geometry"`

---

### Task 2: Solver

**Files:**
- Create: `js/solver.js`, `tests/fixtures.js`
- Test: `tests/solver.test.js`

**Interfaces:**
- Consumes: `neighbors8` (Task 1)
- Produces: `solve(n: number, regions: number[]): { solved: true, hardest: 1|2|3, mines: number[] } | { solved: false }`. The `mines` are sorted ascending, and `regions` is never mutated. Test-only: `parseRegions(digits: string): number[]` and the fixtures below.

- [ ] **Step 1: Write the fixtures and failing tests**

```js
// tests/fixtures.js. Boards found by the 2026-10-24 trial; each was checked by brute force to have exactly one solution.
export const parseRegions = (digits) => [...digits].map(Number);
export const EASY_6 = { n: 6, regions: parseRegions('355522335222555522555511554411444401'), mines: [0, 9, 13, 23, 26, 34], hardest: 1 };
export const MEDIUM_6 = { n: 6, regions: parseRegions('225551220051220555444555444555444535'), mines: [5, 8, 12, 21, 25, 34], hardest: 2 };
export const HARD_6 = { n: 6, regions: parseRegions('033555033555335555555554225114222214'), mines: [2, 6, 15, 23, 25, 34], hardest: 3 };
export const AMBIGUOUS_4 = { n: 4, regions: parseRegions('0000111122223333') }; // every row is its own color: 2 solutions
```

```js
// tests/solver.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solve } from '../js/solver.js';
import { EASY_6, MEDIUM_6, HARD_6, AMBIGUOUS_4 } from './fixtures.js';

for (const b of [EASY_6, MEDIUM_6, HARD_6]) {
  test(`solves a board that needs rule ${b.hardest}`, () => {
    assert.deepEqual(solve(b.n, b.regions), { solved: true, hardest: b.hardest, mines: b.mines });
  });
}
test('gives up on a board with two solutions', () => {
  assert.deepEqual(solve(AMBIGUOUS_4.n, AMBIGUOUS_4.regions), { solved: false });
});
test('does not mutate regions', () => {
  const copy = [...HARD_6.regions];
  solve(HARD_6.n, HARD_6.regions);
  assert.deepEqual(HARD_6.regions, copy);
});
```

- [ ] **Step 2: Run `npm test`.** Expected: FAIL, `js/solver.js` is missing.

- [ ] **Step 3: Implement `solve` in `js/solver.js`**

A *unit* is a row, a column or a color. Placing a mine on square `m` rules out every candidate in m's row, column and color, plus its 8 neighbors. Start with every square as a candidate and repeat until n mines are placed:
1. **Rule 1:** if a unit without a mine has exactly one candidate left, place a mine there. Go back to the start.
2. **Rule 2 (confinement):** for each ordered pair of different unit kinds (A, B), and each non-empty proper subset S of the A-units still without a mine, let C be the set of B-units that contain a candidate of S. If `|C| == |S|`, rule out every candidate inside C that isn't in S. If anything was ruled out, note "2" and go back to rule 1.
3. **Rule 3 (lookahead):** for each candidate c, if a mine on c would leave some other unit without a mine and with no candidates, rule out c. If anything was ruled out, note "3" and go back to rule 1.
4. Otherwise return `{ solved: false }`.

`hardest` is the highest rule noted, or 1. The result doesn't depend on the order in which rules are tried; the order only affects speed.

**Speed matters** (Task 3 measures it): a candidate array (`Uint8Array`), the units' square lists computed once, and the list of squares each placement rules out, also computed once. For rule 2, give each A-unit a bitmask of the B-units its candidates touch (n ≤ 9, so it fits in an int). A subset's C is the OR of those masks, and `|C|` is a popcount. Don't create arrays inside the subset loop.

- [ ] **Step 4: Run `npm test`.** Expected: all PASS.

- [ ] **Step 5: Commit** `git add js/solver.js tests && git commit -m "feat: human-style solver"`

---

### Task 3: Board generator

**Files:**
- Create: `js/generator.js`, `tests/helpers.js`, `tools/measure-generator.mjs`
- Test: `tests/generator.test.js`
- Delete: `spike/` (its job moves to `tools/measure-generator.mjs`)

**Interfaces:**
- Consumes: `mulberry32` · `neighbors4`, `neighbors8` · `solve`
- Produces: `BOARD_SIZE = 8`, `FREE_SHARE = 0.2`, `MIN_REGION = 2`, `MAX_REGION = 16` · `placeMines(n, rand): number[]` (in placement order) · `paintRegions(n, mines, rand, freeShare): number[] | null` (color k grows from `mines[k]`) · `rebalance(n, mines, regions, rand, minSize, maxSize): number[] | null` (returns a new array) · `generateBoard(n: number, seed: number): Board`. Test-only (`tests/helpers.js`): `assertValidLayout(n, regions, mines)` and `regionSizes(n, regions): number[]`.

- [ ] **Step 1: Write `tests/helpers.js`**

`assertValidLayout` throws an `AssertionError` unless: `regions` has n·n entries, all in 0..n-1; every color is 4-connected; there is exactly one mine per row, per column and per color; and no two mines are 8-neighbors.

- [ ] **Step 2: Write the failing tests**

```js
// tests/generator.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../js/rng.js';
import { neighbors8 } from '../js/grid.js';
import { solve } from '../js/solver.js';
import { placeMines, paintRegions, rebalance, generateBoard, FREE_SHARE, MIN_REGION, MAX_REGION } from '../js/generator.js';
import { assertValidLayout, regionSizes } from './helpers.js';

const sorted = (a) => [...a].sort((x, y) => x - y);

test('placeMines: one per row and column, none touching', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const mines = placeMines(8, mulberry32(seed));
    assert.equal(mines.length, 8);
    assert.equal(new Set(mines.map((m) => Math.floor(m / 8))).size, 8);
    assert.equal(new Set(mines.map((m) => m % 8)).size, 8);
    for (const m of mines) for (const j of neighbors8(8, m)) assert.ok(!mines.includes(j));
  }
});
test('paintRegions: color k grows from mines[k] and stays connected', () => {
  let painted = 0;
  for (let seed = 1; seed <= 50; seed++) {
    const rand = mulberry32(seed), mines = placeMines(8, rand);
    const regions = paintRegions(8, mines, rand, FREE_SHARE);
    if (!regions) continue;
    painted++;
    mines.forEach((m, k) => assert.equal(regions[m], k));
    assertValidLayout(8, regions, mines);
  }
  assert.ok(painted > 0);
});
test('paintRegions with no free squares is always solvable with rule 1', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const rand = mulberry32(seed), mines = placeMines(8, rand);
    const regions = paintRegions(8, mines, rand, 0);
    if (regions) assert.deepEqual(solve(8, regions), { solved: true, hardest: 1, mines: sorted(mines) });
  }
});
test('rebalance: sizes within limits, still solvable, input untouched', () => {
  let cleaned = 0;
  for (let seed = 1; cleaned < 3 && seed <= 2000; seed++) {
    const rand = mulberry32(seed), mines = placeMines(8, rand);
    const regions = paintRegions(8, mines, rand, FREE_SHARE);
    if (!regions || !solve(8, regions).solved) continue;
    const before = [...regions];
    const fixed = rebalance(8, mines, regions, rand, MIN_REGION, MAX_REGION);
    assert.deepEqual(regions, before);
    if (!fixed) continue;
    cleaned++;
    assertValidLayout(8, fixed, mines);
    assert.ok(regionSizes(8, fixed).every((s) => s >= MIN_REGION && s <= MAX_REGION));
    assert.deepEqual(solve(8, fixed).mines, sorted(mines));
  }
  assert.equal(cleaned, 3);
});
test('generateBoard: valid, solvable, within limits, repeatable', () => {
  for (const seed of [1, 2, 3, 3698842276]) {
    const board = generateBoard(8, seed);
    assertValidLayout(8, board.regions, board.mines);
    assert.ok(regionSizes(8, board.regions).every((s) => s >= MIN_REGION && s <= MAX_REGION));
    assert.deepEqual(solve(8, board.regions), { solved: true, hardest: board.hardest, mines: board.mines });
    assert.deepEqual(generateBoard(8, seed), board);
  }
});
```

- [ ] **Step 3: Run `npm test`.** Expected: FAIL, `js/generator.js` is missing.

- [ ] **Step 4: Implement `js/generator.js`**

- `placeMines` (the owner's method): pick a random square that isn't blocked, put a mine there, and block its row, its column and its 8 neighbors. On a dead end, start over, continuing with the same `rand`.
- `paintRegions`: first decide which squares are free, with one `rand() < freeShare` call per square in index order. Let `firstRuledOut[i]` be the smallest k such that `mines[k]` shares square i's row or column or is one of its 8 neighbors. Square i may join color k if it's free or `firstRuledOut[i] < k`. Then repeat: collect every allowed pair (an unpainted square, the color of one of its painted 4-neighbors). If there are none, return `null`; otherwise pick one with `rand` and paint it.
- `rebalance` (this version was tested on 2026-10-24):
  ```
  repeat up to 200 times:
    sizes = squares per color
    if every size is within [minSize, maxSize]: return regions
    moves = every (x, to) where x is not a mine, `to` is the color of one of x's 4-neighbors, to ≠ from = regions[x],
            (sizes[to] < minSize or sizes[from] > maxSize), sizes[from] − 1 ≥ minSize and sizes[to] + 1 ≤ maxSize
    shuffle moves with rand (Fisher–Yates)
    apply the first move for which color `from` stays 4-connected without x (flood fill from mines[from])
      and solve(n, regions with x moved).solved; if there is no such move, return null
  return null
  ```
- `generateBoard`: `rand = mulberry32(seed)`. Make up to 10,000 attempts of: `placeMines`, then `paintRegions(…, FREE_SHARE)`, skipping the attempt if that returns `null` or the board isn't solvable, then `rebalance(…, MIN_REGION, MAX_REGION)`, skipping if `null`. The first success returns `{ n, regions, mines: sorted, hardest }`. After 10,000 failures, throw `Error('generateBoard: no board found')`.

- [ ] **Step 5: Run `npm test`.** Expected: all PASS.

- [ ] **Step 6: Write `tools/measure-generator.mjs` and run `node tools/measure-generator.mjs`**

It generates boards for seeds 1–50 at n = 8 and prints the median and 90th-percentile milliseconds per board, plus how many boards needed each rule (1, 2 or 3). **Target: median ≤ 100 ms on a laptop** (roughly under 500 ms on a mid-range phone). The unoptimized trial needed about 290 ms. If the median is above target, optimize the solver (see Task 2, Step 3) and measure again. Write the final median and the difficulty mix in a comment at the top of the tool, because Task 7 reads it.

- [ ] **Step 7: Delete the spike and commit**

`rm -r spike && git add js tests tools && git commit -m "feat: board generator with cleanup pass (median <N> ms)"`

---

### Task 4: Game state machine

**Files:**
- Create: `js/game.js`
- Test: `tests/game.test.js`

**Interfaces:**
- Consumes: `Board`
- Produces: `LIVES = 3` · `createGame(board: Board): Game` (copies the arrays) · `mark(game: Game, square: number, kind: 'safe'|'mine'): 'ignored'|'safe'|'flag'|'wrong-flag'|'boom'|'out-of-lives'|'won'` (mutates `game`) · `minesFound(game): number` · `isFlawless(game): boolean` (won with 3 lives left).

- [ ] **Step 1: Write the failing tests**

```js
// tests/game.test.js. The mines of EASY_6 are [0, 9, 13, 23, 26, 34].
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, mark, minesFound, isFlawless } from '../js/game.js';
import { EASY_6 as board } from './fixtures.js';

test('a new game', () => {
  const g = createGame(board);
  assert.equal(g.lives, 3); assert.equal(g.status, 'playing'); assert.equal(g.lostBy, null); assert.equal(g.elapsedMs, 0);
  assert.equal(g.marks.length, 36); assert.ok(g.marks.every((m) => m === 'unknown'));
  assert.ok(!('solution' in g));
});
test('safe on a safe square locks it', () => {
  const g = createGame(board);
  assert.equal(mark(g, 1, 'safe'), 'safe'); assert.equal(g.marks[1], 'safe');
  assert.equal(mark(g, 1, 'mine'), 'ignored');
});
test('safe on a mine explodes', () => {
  const g = createGame(board);
  assert.equal(mark(g, 0, 'safe'), 'boom');
  assert.equal(g.status, 'lost'); assert.equal(g.lostBy, 'boom'); assert.equal(g.marks[0], 'boom'); assert.equal(g.lives, 3);
});
test('a wrong flag costs a life and the square turns safe', () => {
  const g = createGame(board);
  assert.equal(mark(g, 1, 'mine'), 'wrong-flag'); assert.equal(g.lives, 2); assert.equal(g.marks[1], 'safe');
});
test('the third wrong flag ends the game', () => {
  const g = createGame(board);
  mark(g, 1, 'mine'); mark(g, 2, 'mine');
  assert.equal(mark(g, 3, 'mine'), 'out-of-lives');
  assert.equal(g.status, 'lost'); assert.equal(g.lostBy, 'lives'); assert.equal(g.lives, 0);
});
test('flagging every mine wins and reveals the rest as safe', () => {
  const g = createGame(board);
  for (const m of [0, 9, 13, 23, 26]) assert.equal(mark(g, m, 'mine'), 'flag');
  assert.equal(minesFound(g), 5);
  assert.equal(mark(g, 34, 'mine'), 'won'); assert.equal(g.status, 'won');
  assert.ok(g.marks.every((m, i) => (board.mines.includes(i) ? m === 'mine' : m === 'safe')));
  assert.ok(isFlawless(g));
});
test('a win after losing a life is not flawless', () => {
  const g = createGame(board);
  mark(g, 1, 'mine');
  for (const m of board.mines) mark(g, m, 'mine');
  assert.equal(g.status, 'won'); assert.ok(!isFlawless(g));
});
test('marks after the game ended are ignored', () => {
  const g = createGame(board);
  mark(g, 0, 'safe');
  assert.equal(mark(g, 1, 'safe'), 'ignored');
});
test('a game survives a JSON round trip (saved dailies)', () => {
  const g = JSON.parse(JSON.stringify(createGame(board)));
  assert.equal(mark(g, 0, 'mine'), 'flag');
});
```

- [ ] **Step 2: Run `npm test`.** Expected: FAIL, `js/game.js` is missing.
- [ ] **Step 3: Implement `js/game.js`** (store the mines as `hidden`, and keep the game as plain arrays and values).
- [ ] **Step 4: Run `npm test`.** Expected: all PASS.
- [ ] **Step 5: Commit** `git add js/game.js tests/game.test.js && git commit -m "feat: game rules"`

---

### Task 5: Tap vs double tap

**Files:**
- Create: `js/input.js`
- Test: `tests/input.test.js`

**Interfaces:**
- Produces: `TAP_DELAY_MS = 250` · `createTapHandler({ onTap, onDoubleTap, delayMs = TAP_DELAY_MS }): (square: number) => void`. Call the returned function once per tap (`pointerup`) on a square. It uses the global `setTimeout`/`clearTimeout`.

- [ ] **Step 1: Write the failing tests**

```js
// tests/input.test.js
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
```

- [ ] **Step 2: Run `npm test`.** Expected: FAIL, `js/input.js` is missing.
- [ ] **Step 3: Implement `createTapHandler`.** Keep one pending tap (its square and timer). A tap on a different square fires the pending one immediately. Look up `setTimeout`/`clearTimeout` when a tap happens; don't save references when the module loads, or the mocked timers in the tests won't apply.
- [ ] **Step 4: Run `npm test`.** Expected: all PASS.
- [ ] **Step 5: Commit** `git add js/input.js tests/input.test.js && git commit -m "feat: tap and double-tap detection"`

---

### Task 6: Stats, streaks, storage, share text

**Files:**
- Create: `js/stats.js`, `js/storage.js`, `js/share.js`
- Test: `tests/stats.test.js`, `tests/storage.test.js`, `tests/share.test.js`

**Interfaces:**
- Consumes: `Game` (only as data to store)
- Produces:
  - `stats.js`: `dateKey(date: Date = new Date()): string` (local `YYYY-MM-DD`) · `previousDay(key: string): string` · `emptyStats(): Stats` · `recordResult(stats: Stats, r: { mode: 'daily'|'arena', date: string, won: boolean, flawless: boolean, timeMs: number }): Stats` (returns a new object) · `currentStreak(stats: Stats, today: string): number`.
    `Stats = { daily: { played, won, flawless, streak, bestStreak, lastWonDate: string|null, bestTimeMs: number|null }, arena: { played, won, flawless, bestTimeMs: number|null } }`. The number fields start at 0 and the others at `null`. `bestTimeMs` only counts wins, and `flawless` only counts flawless wins.
  - `storage.js`: `createStore(storage?)` returns `{ loadStats(): Stats, saveStats(s), loadDaily(): { date: string, game: Game } | null, saveDaily(record), loadSettings(): { theme: 'flat'|'pixel'|'candy', tutorialSeen: boolean }, saveSettings(s) }`. The default is `localStorage` if it can be accessed (test by writing and removing a key); otherwise an in-memory Map. **No method ever throws.**
  - `share.js`: `formatTime(ms: number): string` (`m:ss`) · `shareText(r: { mode, date, won, lostBy, livesLeft, timeMs, url? }): string`.

- [ ] **Step 1: Write the failing tests**

```js
// tests/stats.test.js
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
```

```js
// tests/storage.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../js/storage.js';
import { emptyStats } from '../js/stats.js';

const fakeStorage = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};
const deny = () => { throw new Error('denied'); };
const throwing = { getItem: deny, setItem: deny, removeItem: deny };

test('defaults when empty', () => {
  const st = createStore(fakeStorage());
  assert.deepEqual(st.loadStats(), emptyStats());
  assert.equal(st.loadDaily(), null);
  assert.deepEqual(st.loadSettings(), { theme: 'flat', tutorialSeen: false });
});
test('round trip', () => {
  const st = createStore(fakeStorage());
  const daily = { date: '2026-10-24', game: { n: 6, marks: ['unknown'] } };
  st.saveDaily(daily); st.saveSettings({ theme: 'pixel', tutorialSeen: true });
  assert.deepEqual(st.loadDaily(), daily); assert.deepEqual(st.loadSettings(), { theme: 'pixel', tutorialSeen: true });
});
test('corrupted data falls back to defaults', () => {
  const fs = fakeStorage();
  fs.setItem('mws.stats', '{oops'); fs.setItem('mws.daily', '"nope"'); fs.setItem('mws.settings', '{"theme":"neon"}');
  const st = createStore(fs);
  assert.deepEqual(st.loadStats(), emptyStats()); assert.equal(st.loadDaily(), null);
  assert.deepEqual(st.loadSettings(), { theme: 'flat', tutorialSeen: false });
});
test('partial stats are filled in from defaults', () => {
  const fs = fakeStorage();
  fs.setItem('mws.stats', '{"daily":{"played":3}}');
  const s = createStore(fs).loadStats();
  assert.equal(s.daily.played, 3); assert.equal(s.daily.streak, 0); assert.deepEqual(s.arena, emptyStats().arena);
});
test('storage that throws never throws and keeps working in memory', () => {
  const st = createStore(throwing);
  st.saveSettings({ theme: 'candy', tutorialSeen: true });
  assert.equal(st.loadSettings().theme, 'candy');
});
```

```js
// tests/share.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatTime, shareText } from '../js/share.js';

test('formatTime', () => {
  assert.equal(formatTime(0), '0:00'); assert.equal(formatTime(65000), '1:05'); assert.equal(formatTime(271999), '4:31');
});
test('flawless daily', () => {
  assert.equal(shareText({ mode: 'daily', date: '2026-10-24', won: true, lostBy: null, livesLeft: 3, timeMs: 271000 }),
    'Minewseeper Daily 2026-10-24\nFlawless! ❤️❤️❤️ ⏱ 4:31');
});
test('a win with a lost life', () => {
  assert.equal(shareText({ mode: 'daily', date: '2026-10-24', won: true, lostBy: null, livesLeft: 2, timeMs: 271000 }),
    'Minewseeper Daily 2026-10-24\nSolved ❤️❤️🤍 ⏱ 4:31');
});
test('an arena explosion with a link', () => {
  assert.equal(shareText({ mode: 'arena', won: false, lostBy: 'boom', livesLeft: 2, timeMs: 125000, url: 'https://x.github.io/minewseeper/' }),
    'Minewseeper Arena\nBoom 💥 ❤️❤️🤍 ⏱ 2:05\nhttps://x.github.io/minewseeper/');
});
test('out of lives', () => {
  assert.equal(shareText({ mode: 'daily', date: '2026-10-24', won: false, lostBy: 'lives', livesLeft: 0, timeMs: 60000 }),
    'Minewseeper Daily 2026-10-24\nOut of lives 💔 🤍🤍🤍 ⏱ 1:00');
});
```

- [ ] **Step 2: Run `npm test`.** Expected: FAIL, the modules are missing.
- [ ] **Step 3: Implement the three modules.** `previousDay`: build `new Date(y, m - 1, d - 1, 12)` (noon avoids daylight-saving edges) and format it with `dateKey`. `loadDaily`: return `null` unless the stored value has a `YYYY-MM-DD` `date` and a `game` with a `marks` array.
- [ ] **Step 4: Run `npm test`.** Expected: all PASS.
- [ ] **Step 5: Commit** `git add js tests && git commit -m "feat: stats, streaks, storage and share text"`

---

### Task 7: Playable game: screens, board view, flat theme

**Files:**
- Create: `index.html`, `css/base.css`, `css/themes.css`, `js/board-view.js`, `js/app.js`
- Maybe create: `js/generator-worker.js` (Step 2)

**Interfaces:**
- Consumes: everything from Tasks 1–6.
- Produces: `renderBoard(el: HTMLElement, game: Game, theme: 'flat'|'pixel'|'candy'): void` · the SVG `<symbol>` ids `${theme}-flag`, `${theme}-mine`, `${theme}-heart` in `index.html` · region colors as CSS custom properties `--c0 … --c7` under `[data-theme="…"]` · `<html data-theme>` holding the current theme · `getBoard(n, seed): Promise<Board>` in `app.js`.

- [ ] **Step 1: Build the page and the board view**

- `index.html`: `<section id="home">`, `#play`, `#result`, `#tutorial` (left empty until Task 9). Only one section is visible at a time (the others have the `hidden` attribute). Include `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` and `<script type="module" src="./js/app.js">`. Port the flat symbols from `docs/superpowers/specs/mockups/visual-style.html` (`f-flag`, `f-mine`, `f-heart`) as `flat-flag`, `flat-mine`, `flat-heart`.
- Board: a CSS grid `repeat(n, 1fr)` with square cells, `width: min(100vw - 32px, 480px)`. Each square is a `<button class="sq" data-i="…">` with the background `var(--c{k})`. A 3 px border goes on each side where `regionBorders` is true, a 1 px line elsewhere. On the board, set `touch-action: manipulation; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent`.
- Each square gets `aria-label` "Row r, column c, unknown|safe|mine|exploded" (1-based).
- Marks: unknown is plain; safe shows the theme's safe mark (flat: `×` via CSS); mine shows the flag symbol; boom shows the mine symbol on red. When `status === 'lost'`, unflagged mines show the mine symbol.
- Flat colors (from the mockup): `--c0 #f4a6a6 · --c1 #f7c98b · --c2 #f3e48a · --c3 #a8d8a0 · --c4 #9fc9ee · --c5 #c3a8e8 · --c6 #f2b8d8 · --c7 #95d5cf`.

- [ ] **Step 2: Implement `getBoard(n, seed)` in `js/app.js`.** Show "Shuffling mines…", wait for a frame (`requestAnimationFrame` then `setTimeout(…, 0)`), then return `generateBoard(n, seed)`. **If the median recorded in Task 3 is above 100 ms**, generate in a module worker instead: `new Worker(new URL('./generator-worker.js', import.meta.url), { type: 'module' })`, where the message `{ n, seed }` gets a `Board` back.

- [ ] **Step 3: Wire up the screens in `js/app.js`**

- **Home:** the daily card shows one of three states. Not started: "Play today's board". In progress: "Continue". Finished: the result (`Flawless victory!` / `Solved` / `Lost`) and "Back tomorrow", with no replay. It also shows `🔥 N` from `currentStreak(stats, dateKey())`. The Arena card has "New board". Totals show played, wins and flawless (Daily + Arena). Recompute `dateKey()` every time Home is shown.
- **Daily:** `today = dateKey()`. If `loadDaily()?.date === today`, resume it; otherwise create `createGame(await getBoard(8, fnv1a(today)))` and save it immediately. Call `saveDaily({ date, game })` after every mark.
- **Arena:** `createGame(await getBoard(8, randomSeed()))`. Leaving with Back abandons the board (it isn't counted or saved).
- **Play screen:** Back; the label "Daily · Oct 24" (`toLocaleDateString(undefined, { month: 'short', day: 'numeric' })`) or "Arena"; 3 hearts with lost ones dimmed; `🚩 found / 8`; a timer `m:ss`. The timer starts at the first mark, pauses while the page is hidden (`visibilitychange`), and stops at the end. It's kept in `game.elapsedMs`.
- **Marks:** board `pointerup` goes to `createTapHandler`. Tap means `mark(game, i, 'safe')` and double tap means `mark(game, i, 'mine')`; re-render after each. On `'won'`, `'boom'` or `'out-of-lives'`: `recordResult(stats, { mode, date, won, flawless: isFlawless(game), timeMs })`, where for the daily **`date` is the saved record's date, not today's**. Then save the stats and show the result.
- **Result:** the banner reads `Flawless victory!`, `Solved!`, `Boom!` or `Out of lives`. Below it: the read-only board with all mines visible, the time, the lives and (for the daily) the streak. Buttons: Share (`navigator.share({ text })` when available, otherwise `navigator.clipboard.writeText(text)` followed by "Copied!"), plus "New arena board" and "Home". Pass `url: location.origin + location.pathname` to `shareText`.
- Register nothing else yet: the theme picker, tutorial and service worker come in Tasks 8–10.

- [ ] **Step 4: Run `npm test`.** Expected: all PASS (nothing in the logic modules changed).

- [ ] **Step 5: Check by hand.** Run `python3 -m http.server 8000` and open http://localhost:8000.
  1. Play today's board: 8 colors with thick borders between them.
  2. Tap: about ¼ s later a `×` appears. Double tap: a flag, or a lost heart with the square turning `×`.
  3. Reload in the middle of the daily: same board, same marks, same lives, and the timer continues.
  4. Lose the daily: Home shows "Lost" with no replay, and the streak is 0.
  5. Arena: each "New board" gives a different board.
  6. DevTools device toolbar at 375×667: no horizontal scrolling, and double tap doesn't zoom.
  7. **Real phone** (on the same Wi-Fi run `python3 -m http.server 8000 --bind 0.0.0.0` and open `http://<laptop-ip>:8000`): play a full board. If deliberate double taps sometimes register as single taps, raise `TAP_DELAY_MS` (no higher than 350) and note it in the commit.
  8. In a private window with site data blocked, the game still plays.

- [ ] **Step 6: Commit** `git add index.html css js && git commit -m "feat: playable daily and arena with flat theme"`

---

### Task 8: Pixel and Candy themes + theme picker

**Files:**
- Modify: `index.html` (symbols, picker), `css/themes.css`, `js/app.js`

**Interfaces:**
- Consumes: `renderBoard`, the symbol ids and `--c0…--c7` (Task 7) · `loadSettings`/`saveSettings` (Task 6)

- [ ] **Step 1: Port the two themes from `docs/superpowers/specs/mockups/visual-style.html`.** Symbols: `pixel-flag|mine|heart` and `candy-flag|mine|heart` (candy-mine is the bomb, and the burst behind an exploded bomb is `candy-burst`). Each theme needs 8 region colors, `--c0…--c7`: the 4 from the mockup plus 4 more of the same intensity. Safe marks: Pixel shows a pressed-in square with no symbol; Candy shows a white dot. Pixel squares are raised until marked.
- [ ] **Step 2: Add the theme picker on Home:** three buttons (Flat · Pixel · Candy). A choice sets `document.documentElement.dataset.theme`, re-renders and calls `saveSettings`. At startup, apply the saved theme before the first screen shows.
- [ ] **Step 3: Check by hand.** Switch themes on every screen; the board stays readable in each. In DevTools, go to Rendering → "Emulate vision deficiencies" → Deuteranopia: the color borders still separate the colors.
- [ ] **Step 4: Commit** `git commit -am "feat: pixel and candy themes with picker"`

---

### Task 9: Tutorial

**Files:**
- Create: `js/tutorial.js`
- Modify: `index.html` (`#tutorial`), `js/app.js`

**Interfaces:**
- Consumes: `renderBoard`, `createGame` · `loadSettings`/`saveSettings`
- Produces: `openTutorial(onDone: () => void): void`

- [ ] **Step 1: Build five pages.** Each has a picture drawn with `renderBoard` from a hand-made game state on this 5×5 board (regions `'0011101122033223344234444'`, mines `[0, 7, 14, 16, 23]`), so the pictures follow the chosen theme and need no image files. Each page has one or two sentences and Back / Next / Done buttons (Skip on page 1).
  1. Each row, each column and each color hides exactly one mine. (Picture: all mines flagged.)
  2. Mines never touch, not even diagonally. (Picture: one mine with its 8 neighbors marked safe.)
  3. Tap a square to mark it safe. If it's a mine, boom, game over. (Picture: an exploded square.)
  4. Double-tap to flag a mine. A wrong flag costs one of your 3 lives. (Picture: one wrong flag, 2 hearts.)
  5. Flag every mine to win; lose no lives for a Flawless victory. Every board can be solved by logic, so you never need to guess. (Picture: a solved board.)
- [ ] **Step 2: Wire it up.** If `!settings.tutorialSeen`, show the tutorial before Home. Done or Skip saves `tutorialSeen: true`. The "How to play" button on Home opens it again.
- [ ] **Step 3: Check by hand.** Clear the site data and reload: the tutorial appears. Done takes you to Home. Reload: no tutorial. How to play: it opens again. Check it in all three themes.
- [ ] **Step 4: Commit** `git add js/tutorial.js && git commit -am "feat: tutorial"`

---

### Task 10: Installable, offline, README, deploy

**Files:**
- Create: `manifest.webmanifest`, `sw.js`, `icons/icon.svg`, `icons/icon-192.png`, `icons/icon-512.png`, `icons/apple-touch-icon.png` (180 px), `README.md`
- Modify: `index.html` (manifest link, `theme-color`, apple-touch-icon), `js/app.js` (register the service worker)

- [ ] **Step 1: Create the manifest:** `name`/`short_name` "Minewseeper", `start_url: "./"`, `scope: "./"`, `display: "standalone"`, `background_color: "#fbf8f3"`, `theme_color: "#222222"`, and the 192 and 512 PNG icons plus the SVG.
- [ ] **Step 2: Create `sw.js`:** `const CACHE = 'mws-v1'` (**bump it on every deploy**). On install, `addAll` every file the app uses (`./`, `./index.html`, the CSS, every module in `js/`, the manifest and the icons). On activate, delete other caches. On fetch, serve from the cache first and fall back to the network. Register it from `app.js` with `if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js')`.
- [ ] **Step 3: Create the icons:** an SVG of a flagged square in the flat style. Render the PNGs with whatever tool is available (`rsvg-convert -w 192 icons/icon.svg -o icons/icon-192.png`, `magick -background none icons/icon.svg -resize 512x512 icons/icon-512.png`, or Inkscape).
- [ ] **Step 4: Check for absolute paths.** Run `grep -rnE "(href|src)=\"/|url\(/|['\"]/(js|css|icons)/" index.html css js sw.js manifest.webmanifest`. Expected: no output.
- [ ] **Step 5: Check by hand** with `python3 -m http.server 8000`. DevTools → Application → Manifest shows no errors and offers install. Service worker is "activated". Network → Offline → reload: the game loads, and a new Arena board can still be generated.
- [ ] **Step 6: Write `README.md`:** what the game is, `npm test`, `python3 -m http.server 8000`, the deploy steps below, and "bump `CACHE` in `sw.js` on every deploy".
- [ ] **Step 7: Commit** `git add . && git commit -m "feat: installable offline PWA"`
- [ ] **Step 8: Deploy. Ask the owner before doing anything public.** Create a public GitHub repo `minewseeper` and push. Under Settings → Pages, choose "Deploy from a branch", `main`, `/ (root)`. Then open `https://<user>.github.io/minewseeper/` on a phone and check that it plays, installs to the home screen, and works in airplane mode.
