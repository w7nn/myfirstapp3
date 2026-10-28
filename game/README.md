# Merge Command

A merge-army browser game built with [Phaser 3](https://phaser.io). Buy soldiers, tanks and aircraft, drag two identical units together to make a stronger one, and grow your base's gold income.

## Play locally

The game is plain ES modules with no build step. Serve this folder over HTTP (opening `index.html` directly from disk won't load modules):

```bash
cd game
python3 -m http.server 8080
```

Then open http://localhost:8080.

## How it plays

- **Merge:** drag a unit onto an identical one (same type, same level) to get one unit a level higher. Levels go up to 30.
- **Move / swap:** drop a unit on an empty tile to move it, or on a different unit to swap them.
- **Buy:** each shop button places a Lv1 unit in the first free tile. Every purchase raises that type's next price by 7%.
- **Sell:** drag a unit onto the sell strip to get back half its base value and free the tile.
- **Income:** every unit on the board earns gold per second. Each level is worth 2.2x the one below, so merging always raises income.
- **New level bonus:** the first time you reach a level for a type, you get a gold bonus.
- **Saving:** progress saves to the browser automatically.

## Code layout

| File | Purpose |
|---|---|
| `src/config.js` | All balancing numbers (prices, growth, income, layout). Tune the game here. |
| `src/state.js` | Pure game rules: merge, buy, sell, income, save format. No Phaser. |
| `src/scenes/BoardScene.js` | Rendering, drag and drop, HUD, shop and effects. |
| `src/units.js` | Unit art drawn with Phaser Graphics (no image assets yet). |
| `src/theme.js` | Colours, fonts and level tier colours. |
| `src/storage.js` | `localStorage` save/load, guarded against blocked storage. |
| `tests/` | Unit tests for the game rules. |

## Tests

```bash
cd game
npm test
```

Uses Node's built-in test runner (Node 18+), so there's nothing to install.

## Roadmap

1. ~~Prototype: grid, drag, merge, buy, gold, three unit lines, saving~~
2. Buildings: barracks/factory/airfield that spawn free units, gold mine, offline earnings
3. Battle: formation slots, auto-battle, 50 stages
4. Polish: sound, auto-merge, grid expansion, tutorial
5. Mobile build with Capacitor
