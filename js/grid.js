// Board is n x n; cell i sits at row floor(i / n), column i % n.
const around = (n, i, deltas) => {
  const r = Math.floor(i / n), c = i % n;
  return deltas.flatMap(([dr, dc]) => {
    const rr = r + dr, cc = c + dc;
    return rr >= 0 && rr < n && cc >= 0 && cc < n ? [rr * n + cc] : [];
  });
};

export const neighbors8 = (n, i) =>
  around(n, i, [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]);

export const neighbors4 = (n, i) => around(n, i, [[-1, 0], [1, 0], [0, -1], [0, 1]]);

// True where the neighbor on that side has a different region color; false at the edge.
export const regionBorders = (n, regions, i) => {
  const differs = (dr, dc) => {
    const r = Math.floor(i / n) + dr, c = (i % n) + dc;
    return r >= 0 && r < n && c >= 0 && c < n && regions[r * n + c] !== regions[i];
  };
  return { top: differs(-1, 0), right: differs(0, 1), bottom: differs(1, 0), left: differs(0, -1) };
};
