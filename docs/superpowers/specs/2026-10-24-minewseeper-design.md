# Minewseeper — design

*Working title, taken from the project folder name.*

## Intent

A free, mobile-friendly web puzzle game. It's a minesweeper-style take on the Star Battle / LinkedIn "Queens" puzzle: the rules decide where the mines are, and the minesweeper layer adds stakes, because marking a mine square as "safe" blows you up.

The owner wants it to:
- play well on phones and desktop browsers,
- cost nothing to host,
- earn some money from ads if possible,
- **never need a guess.** Every board must be solvable by logic alone. This is the core promise of the game.

## Rules (decided by the owner)

- The board is an **N×N grid** split into **N colored regions**. Hidden underneath are **N mines**: exactly one per row, one per column and one per color.
- **No two mines touch.** One mine per row and column already rules out side-by-side mines, so in practice this rule bans diagonal touching. *(Diagonals counting was my reading. The owner didn't object.)*
- Every square starts unknown. The player marks squares:
  - **Tap = safe, double tap = mine.** On desktop, click and double-click do the same.
  - **Safe on a mine → game over** (explosion).
  - **Mine on a safe square → lose a life.** The square flips to safe.
  - **Correct marks are locked** and can't be changed.
- **3 lives per board.** The third wrong mine flag ends the game. *(Exactly when the game ends was my reading. The owner didn't object.)*
- **The board is won when all N mines are flagged.** The remaining squares are then known to be safe and get revealed automatically. *(My recommendation. The owner first said every square must be marked, then didn't object to this change.)*
- Winning without losing a life shows a **"Flawless victory!"** banner.

## Modes

- **Daily puzzle:** the board is generated from today's **local date** (`YYYY-MM-DD`) as the seed, so everyone gets the same board that day without a server.
  - **One try per day** (owner): once today's board is won or lost, it's locked until tomorrow, and Home shows today's result.
  - **The streak counts consecutive days won** (owner). A loss or a missed day resets it to 0.
- **Arena:** endless boards, each generated from a random seed.
- **Size:** 8×8 for both modes in v1 *(my call)*. Difficulty settings and other sizes come later (owner).

## Screens

These are the mockups the owner reviewed (screen-by-screen layout is the builder's call): `docs/superpowers/specs/mockups/session-flow.html`. The mockup is older than two decisions: it shows a Safe/Mine switch and a red ✕ on a wrong flag. **The rules in this document take priority**: tap/double tap, and a wrong flag turns into a safe square.

1. **Home:** the daily puzzle card (date, streak, play button), the Arena card (new board), stats (played, wins, flawless), a "How to play" link and a theme selector.
2. **Board:** back button, mode and date, lives as hearts, a mines-found counter (`3 / 8`), a timer, and the grid.
3. **Result:** the win screen (Flawless banner when earned, time, lives left, streak, Share and Play arena buttons) or the game-over screen. A game over is final: v1 has no continue.
4. **Tutorial:** static pages with images explaining the rules and the controls. It opens automatically on the first visit and can be reopened from Home (owner).

## Look

- **Three themes the player can choose** (owner): *Clean and flat* (close to Queens), *Retro pixel* (classic Minesweeper with raised and pressed-in squares), *Candy* (glossy squares and a cartoon bomb). The reviewed mockup is `docs/superpowers/specs/mockups/visual-style.html`.
- The sprites are hand-drawn SVG, as in the mockup. Kenney.nl's CC0 packs are an acceptable source if art is needed (CC0 allows commercial use).
- **Thick borders between colors** so color-blind players can read the board *(my call)*.
- Default theme: Clean and flat *(my call)*. The player's choice is remembered.

## Board generation (validated by a throwaway trial: `spike/generator-spike.mjs`)

Generate the board, then check it with a solver that reasons like a player, and repeat until a board passes.

1. **Place the mines** (owner's idea): pick a random free square, put a mine there, block its row, column and 8 neighbors, and repeat. Restart on a dead end (about one restart per board).
2. **Paint the colors with the "relaxed constructive" method.** Each mine starts its own color, and the mines are numbered in the order they were placed. Color *k* may only grow into squares already ruled out by mines 1…k−1, except that about **20% of squares (p ≈ 0.2) are "free"** and may join any color. Colors grow one random neighboring square at a time until the board is full. If painting gets stuck, start over.
3. **Solve like a player**, using only these rules, until the board is done or the solver is stuck:
   1. A row, column or color with exactly one possible square left → that square is a mine. It rules out its row, column, color and its 8 neighbors.
   2. Confinement: if k units of one kind (rows, columns or colors) have all their possible squares inside k units of another kind, the other squares in those units are safe.
   3. One-step lookahead: if a mine on a square would leave some row, column or color with no possible square, that square is safe.
4. **Accept the board if the solver finishes.** Since every step was forced, the solution is guaranteed to be the only one. The hardest rule used is recorded as the board's difficulty for later use.

What the trial measured on 8×8 boards (laptop, solver not optimized):

| Method | Boards that pass | Time per good board | Hardest rule needed (out of 30) |
|---|---|---|---|
| Random coloring | about 1 in 1,500 | about 17 s | n/a |
| Strict constructive | about 1 in 3 | under 1 ms | rule 1 only, 30 of 30 |
| Relaxed, p = 0.2 | about 1 in 15 | about 25 ms | rule 1: 17, rule 2: 8, rule 3: 5 |

**Known problems the builder must solve:**
- **One-square colors.** Almost every accepted board has a color that's a single square, which gives away the first mine. Growing colors more evenly didn't fix it.
- **Uneven colors.** One color often covers about a third of the board.
- **Fix: a cleanup pass (tested in a scratch run on 2026-10-24).** After a board passes, move one border square at a time from one color to a neighboring color, but only when the move grows a too-small color or shrinks a too-large one. Keep a move only if the color it leaves stays connected and the solver still finishes the board. With limits of **at least 2 and at most 16 squares**, 30 of 84 solvable 8×8 boards were cleaned up. That took about **290 ms per finished board** on a laptop with the unoptimized solver. A minimum of 3 squares cleaned up only about 1 board in 10.
- **Requirement for v1:** no color smaller than 2 squares or larger than 16 squares (a quarter of the board).

**Difficulty in v1** *(my call; the owner wants difficulty settings later)*: there's no minimum. Any board that passes the solver and the color-size limits can be used. **Side effect of the cleanup:** all 30 cleaned boards needed rule 2 or 3, and 22 of them needed rule 3. That's because one-square colors were what made boards easy. So v1 boards will lean hard. An easier mode later could skip the cleanup. Log the mix of difficulties during development.

**Determinism:** the generator uses a small seeded random function (`Math.random` can't be seeded). With the same seed the whole process runs the same way, failed attempts included, so every player gets the same board. If the generator changes later, the boards it produces for a given date change too, which is acceptable.

**Performance target:** a board is ready in well under a second on a mid-range phone. At about 290 ms on a laptop (which means 1 to 1.5 s on a phone), **the solver must be optimized**, and moving generation to a Web Worker is the fallback.

## Tech (my calls)

- **Plain HTML, CSS and JavaScript.** No game framework (the game is a grid of tappable squares, and an engine would add about 1 MB for nothing) and no build step.
- **Installable on phones (a PWA)**, with a manifest and a service worker so it works offline. No app stores (Apple charges $99/year).
- **Hosting:** GitHub Pages or Cloudflare Pages, both free.
- The squares are real HTML elements (buttons), so tapping, focus and zooming work without extra code. `touch-action: manipulation` turns off double-tap zoom on the board.
- **Double-tap detection:** a single tap waits about 250 ms in case a second tap follows. **Known risk:** a slow double tap on a correctly found mine is read as "safe" and explodes. Tune the timing on a real phone. The fallback, if needed, is long-press for "mine".

## Data (no server)

- **`localStorage`** keeps: played, wins, flawless wins, the current and best daily streak, best times, the chosen theme, and whether the tutorial has been seen. Stats live on one device and in one browser, and are lost if the browser data is cleared. The owner accepted this.
- **Today's daily is saved whether it's in progress, won or lost**, so reloading can't reset lives or retry a lost board *(my call, following from one try per day)*. The Arena board in progress isn't saved.
- **Share result:** a button copies a short emoji summary to the clipboard. The format is the builder's call.
- **No anti-cheat.** The board itself fully determines the solution, so anyone can solve it with an online Queens solver. Just don't keep an obvious `solution` variable in plain sight.

## Money (later, not v1)

**v1 has no ads and no ad placeholders** (owner). These notes are for a later phase:
- **Ideas discussed:** a reward ad to continue after a game over, an ad between Arena boards, and a banner on Home (own website only). Before building the continue, decide what it does after an explosion compared with running out of lives, how many continues a board allows (unlimited continues would let players find mines by trial and error), and how a continued board counts in stats and streaks.
- **Two routes; the same game files serve both:**
  - **Game portals** (CrazyGames, Poki, GameDistribution): free hosting, their own players and their own ad system, with revenue shared. Each has its own developer kit and review process.
  - **Own site + Google AdSense:** probably needs a custom domain (about $10/year), since AdSense likely won't approve `*.github.io`. Reward ads probably need a separate approval.

## Goals / non-goals / anti-goals

**Goals for v1:** the daily puzzle and Arena at 8×8, the rules above, three selectable themes, the static tutorial, local stats and streaks, the share button, an installable PWA, and free hosting.

**Not in v1:** ads (and any continue after a game over), difficulty settings, other board sizes, animations (losing a life, explosions, etc.; wanted later, and CSS animations or sprite sheets will do), sound, leaderboards, accounts or cross-device sync, native app store builds.

**Anti-goals (failure even if everything else works):**
- any board that needs a guess,
- paying for hosting,
- a slow first load,
- the controls ending a game unfairly (an accidental or misread tap that the player couldn't reasonably avoid).

## Left to the builder

File layout, solver optimization, exact visuals within each theme, the share text format, the tap timing value, the tutorial content and images, the limits on color sizes, timer behavior, and how stats are split between Daily and Arena.
