# Minewseeper

A daily logic puzzle in the spirit of Minesweeper: one mine per row, column and color, and every board is solvable without guessing. Daily board plus an endless Arena, three themes (Flat, Pixel, Candy). Plain HTML/CSS/JS, no dependencies, no build step. Installable and works offline.

## Run

```
python3 -m http.server 8000   # then open http://localhost:8000
npm test                      # unit tests (node --test)
```

## Deploy (GitHub Pages)

1. Bump `CACHE` in `sw.js` (e.g. `mws-v2`) on every deploy, or installed clients keep the old files.
2. Create a public GitHub repo `minewseeper` and push `main`.
3. Settings -> Pages -> "Deploy from a branch", `main`, `/ (root)`.
4. Open `https://<user>.github.io/minewseeper/` on a phone and check that it plays, installs to the home screen, and works in airplane mode.

All paths are relative, so it runs under the `/minewseeper/` sub-path. If you add a file the app loads at runtime, add it to `FILES` in `sw.js`.
