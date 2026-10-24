# Minewseeper

A daily logic puzzle in the spirit of Minesweeper: one mine per row, column and color, and every board is solvable without guessing. Daily board plus an endless Arena, three themes (Flat, Pixel, Candy). Plain HTML/CSS/JS, no dependencies, no build step. Installable and works offline.

## Run

```
python3 -m http.server 8000   # then open http://localhost:8000
npm test                      # unit tests (node --test; needs Node 22 or newer)
```

## Deploy (GitHub Pages)

1. Bump `CACHE` in `sw.js` (e.g. `mws-v2`) on every deploy, or installed clients keep the old files. There is no `skipWaiting`, so an update reaches a player only after the app is fully closed (all tabs or windows) and reopened.
2. Push `main` to https://github.com/federicoemartinez/color_minewseeper.
3. GitHub Pages serves `main` from `/ (root)`.
4. Open https://federicoemartinez.github.io/color_minewseeper/ on a phone and check that it plays, installs to the home screen, and works in airplane mode.

All paths are relative, so it runs under the `/color_minewseeper/` sub-path. If you add a file the app loads at runtime, add it to `FILES` in `sw.js`.

## License

[PolyForm Noncommercial 1.0.0](LICENSE.md): free to play, read, modify and share for noncommercial purposes. Commercial use requires permission from the author.
