// Speed gate for generateBoard. Run: node tools/measure-generator.mjs
// Measured 2026-10-25 (laptop, node), minimum color size 1-4 and a third of boards with split colors:
// median ~25 ms, p90 ~135 ms, max ~400 ms per 8x8 board. Minimum 4 boards dominate the tail. Target was median <= 100 ms.
// Difficulty mix for seeds 1-50: rule 1 = 4, rule 2 = 7, rule 3 = 39 boards.
import { generateBoard } from '../js/generator.js';

const times = [], mix = { 1: 0, 2: 0, 3: 0 };
for (let seed = 1; seed <= 50; seed++) {
  const t0 = performance.now();
  const board = generateBoard(8, seed);
  times.push(performance.now() - t0);
  mix[board.hardest]++;
}
times.sort((a, b) => a - b);
const at = (p) => times[Math.min(times.length - 1, Math.floor(p * times.length))];
console.log(`8x8, seeds 1-50: median ${at(0.5).toFixed(1)} ms, p90 ${at(0.9).toFixed(1)} ms, max ${times.at(-1).toFixed(1)} ms`);
console.log(`hardest rule needed: 1 = ${mix[1]}, 2 = ${mix[2]}, 3 = ${mix[3]}`);
