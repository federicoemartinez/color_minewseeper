import { neighbors8 } from './grid.js';

// Human-style solver. A "unit" is a row, a column or a color; unit ids are
// row r -> r, column c -> n + c, color k -> 2n + k (regions must be 0..n-1).
// Tables that only depend on n are built once and shared by every solve() call.
const tables = new Map();

const tablesFor = (n) => {
  let t = tables.get(n);
  if (t) return t;
  const N = n * n;
  // base[m * N + s] = 1 when a mine on m rules out s by row, column or adjacency (colors are added per board).
  const base = new Uint8Array(N * N);
  for (let m = 0; m < N; m++) {
    for (let s = 0; s < N; s++) if (Math.floor(s / n) === Math.floor(m / n) || s % n === m % n) base[m * N + s] = 1;
    for (const j of neighbors8(n, m)) base[m * N + j] = 1;
  }
  const popcount = new Uint8Array(1 << n);
  for (let s = 1; s < popcount.length; s++) popcount[s] = popcount[s >> 1] + (s & 1);
  t = { N, base, popcount };
  tables.set(n, t);
  return t;
};

// Board state plus the three rules. A rule given a `found` array lists every deduction it sees there
// and changes nothing; without one it applies the first deduction it finds.
function setup(n, regions) {
  const { N, base, popcount } = tablesFor(n);
  const U = 3 * n;
  // kindOf[k][s] = unit id of square s for kind k (0 row, 1 column, 2 color); units[u] = squares of unit u.
  const kindOf = [new Uint8Array(N), new Uint8Array(N), new Uint8Array(N)];
  const units = Array.from({ length: U }, () => []);
  for (let i = 0; i < N; i++) {
    kindOf[0][i] = Math.floor(i / n);
    kindOf[1][i] = n + (i % n);
    kindOf[2][i] = 2 * n + regions[i];
    for (let k = 0; k < 3; k++) units[kindOf[k][i]].push(i);
  }
  // ruled[m * N + s] = 1 when a mine on m rules out square s.
  const ruled = base.slice();
  for (let u = 2 * n; u < U; u++) for (const m of units[u]) for (const s of units[u]) ruled[m * N + s] = 1;

  const cand = new Uint8Array(N).fill(1);
  const hasMine = new Uint8Array(U);
  const mines = [];
  const count = new Uint8Array(U);
  const masks = new Int32Array(3 * n * 3); // masks[(a * 3 + b) * n + (unit index within kind a)] = kind-b units touched
  const orMask = new Int32Array(1 << n);
  const place = (m) => {
    mines.push(m);
    for (let k = 0; k < 3; k++) hasMine[kindOf[k][m]] = 1;
    for (let s = 0; s < N; s++) if (ruled[m * N + s]) cand[s] = 0;
  };

  // Rule 1: a unit without a mine and exactly one candidate. Returns that square or -1.
  const findSingle = (found) => {
    count.fill(0);
    for (let s = 0; s < N; s++) if (cand[s]) for (let k = 0; k < 3; k++) count[kindOf[k][s]]++;
    for (let u = 0; u < U; u++) {
      if (hasMine[u] || count[u] !== 1) continue;
      if (found) { found.push({ rule: 1, units: [u] }); continue; }
      for (const s of units[u]) if (cand[s]) return s;
    }
    return -1;
  };

  // Rule 2: S = some A-units, C = the B-units their candidates touch; |C| == |S| clears the rest of C.
  const confine = (found) => {
    masks.fill(0);
    for (let s = 0; s < N; s++) {
      if (!cand[s]) continue;
      for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
        if (a !== b) masks[(a * 3 + b) * n + kindOf[a][s] - a * n] |= 1 << (kindOf[b][s] - b * n);
      }
    }
    for (let a = 0; a < 3; a++) {
      let open = 0;
      for (let v = 0; v < n; v++) if (!hasMine[a * n + v]) open |= 1 << v;
      const full = open;
      for (let b = 0; b < 3; b++) {
        if (a === b) continue;
        const base = (a * 3 + b) * n;
        const listed = []; // with `found`, only subsets with no smaller listed subset (those come first: ascending walk)
        // Ascending walk over the non-empty subsets of the open A-units; orMask[sub] extends the one without its lowest bit.
        for (let sub = (0 - open) & open; sub !== 0; sub = (sub - open) & open) {
          const low = sub & -sub;
          orMask[sub] = orMask[sub ^ low] | masks[base + 31 - Math.clz32(low)];
          if (sub === full || popcount[orMask[sub]] !== popcount[sub]) continue;
          if (found && listed.some((m) => (m & sub) === m)) continue;
          let cleared = false;
          for (let v = 0; v < n; v++) {
            if (!((orMask[sub] >> v) & 1)) continue;
            for (const s of units[b * n + v]) {
              if (cand[s] && !((sub >> (kindOf[a][s] - a * n)) & 1)) { if (!found) cand[s] = 0; cleared = true; }
            }
          }
          if (cleared && !found) return true;
          if (cleared) {
            listed.push(sub);
            const us = [];
            for (let v = 0; v < n; v++) if ((sub >> v) & 1) us.push(a * n + v);
            found.push({ rule: 2, units: us, across: b });
          }
        }
      }
    }
    return false;
  };

  // Rule 3: a mine on c that leaves another mine-less unit with no candidates is impossible.
  const lookahead = (found) => {
    let cleared = false;
    for (let c = 0; c < N; c++) {
      if (!cand[c]) continue;
      const u0 = kindOf[0][c], u1 = kindOf[1][c], u2 = kindOf[2][c];
      for (let u = 0; u < U; u++) {
        if (hasMine[u] || u === u0 || u === u1 || u === u2) continue;
        let alive = false;
        for (const s of units[u]) if (cand[s] && !ruled[c * N + s]) { alive = true; break; }
        if (!alive) { if (found) found.push({ rule: 3, square: c }); else cand[c] = 0; cleared = true; break; }
      }
    }
    return cleared;
  };

  return { N, units, cand, mines, place, findSingle, confine, lookahead };
}

export function solve(n, regions) {
  const { mines, place, findSingle, confine, lookahead } = setup(n, regions);
  let hardest = 1;
  while (mines.length < n) {
    const single = findSingle();
    if (single >= 0) { place(single); continue; }
    if (confine()) { hardest = Math.max(hardest, 2); continue; }
    if (lookahead()) { hardest = 3; continue; }
    return { solved: false };
  }
  return { solved: true, hardest, mines: mines.sort((x, y) => x - y) };
}

/** Every deduction the player could make next from their marks, simplest rule first. Steps are
 *  { rule: 1, units: [u] } (u's only spot), { rule: 2, units, across: kind } (units confined to as many
 *  units of `across`: 0 rows, 1 columns, 2 colors; fewest units first) or { rule: 3, square } (a mine there leaves a unit empty).
 *  Marks must be true (a wrong flag already shows as 'safe'), as in game.js. */
export function hints(n, regions, marks) {
  const st = setup(n, regions);
  marks.forEach((m, s) => { if (m === 'mine') st.place(s); });
  marks.forEach((m, s) => { if (m === 'safe') st.cand[s] = 0; });
  const found = [];
  st.findSingle(found);
  st.confine(found);
  st.lookahead(found);
  // A rule-2 step over more than half the units has a smaller twin (the remaining units of both kinds), so drop it.
  return found.filter((h) => h.rule !== 2 || h.units.length * 2 <= n)
    .sort((x, y) => x.rule - y.rule || (x.units?.length ?? 0) - (y.units?.length ?? 0));
}
