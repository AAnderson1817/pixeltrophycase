# Loot Pixel Vault

A pixel-art loot-card opener. Press and hold the card, it bursts open, and one of 30 armor pieces from six sets is revealed and dropped into your bag. Collect every set.

Plain JavaScript ES modules on Canvas 2D and Web Audio; no runtime dependencies. The production build is a single self-contained HTML file.

Live: https://claude.ai/artifact/8HDrep1914chbqv6oSGF8w

## Quick start

Requires Node 22.13+ (or 24+).

```sh
npm install
npx playwright install chromium   # once, for tests and the benchmark
npm run dev                       # http://localhost:5173
```

## Scripts

```sh
npm run build          # dist/index.html (self-contained) + dist/artifact.html (for claude.ai)
npm test               # behaviour tests + golden frames (Playwright, Chromium)
npm run test:dist      # same tests against the built file
npm run lint           # ESLint, including the project's rendering/determinism rules
npm run format         # Prettier (format:check to verify)
npm run bench          # frame-cost benchmark on dist/index.html
npm run sprites        # rebuild the armor atlas from art/sheets (Python 3.11, see below)
```

The sprite pipeline needs `pip install -r tools/sprites/requirements.txt -c tools/sprites/constraints.txt`; the pinned
versions reproduce the committed atlas byte for byte.

CI (GitHub Actions, every push) runs the format check, lint, both test suites and the atlas reproduction check.

## Controls

- Hold the card (pointer, Space or Enter) to charge; release early to let it settle. A quick tap auto-charges.
- After a reveal: tap the card to fidget, **Draw another** to collect it and deal the next card.
- HUD: rarity pills force a tier (Random by default), **Reset** clears the collection (press twice), **Sound on/off**.

The collection is saved in `localStorage` under `loot-pixel-armor-v1`.

## Layout

```
index.html            page markup
src/                  game modules (see CLAUDE.md for the module map)
src/assets, src/data  generated armor atlas (PNG + JSON)
art/sheets/           source concept sheets for the six armor sets
tools/sprites/        sprite extraction pipeline
tests/                Playwright tests and golden frame hashes
scripts/              artifact export, dist test runner, benchmark
.github/workflows/    CI
docs/DESIGN.md        visual constraints, loot tables, card flow
```
