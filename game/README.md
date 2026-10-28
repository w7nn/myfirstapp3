# Squad Rush

A squad runner-shooter for the browser, built with [Phaser 3](https://phaser.io). Your squad holds the bottom of a bridge, and raiders keep charging down the middle. Slide left and right to aim while your soldiers fire on their own.

## Play locally

The game is plain ES modules with no build step. Serve this folder over HTTP (opening `index.html` directly from disk won't load modules):

```bash
cd game
python3 -m http.server 8080
```

Then open http://localhost:8080.

## How it plays

- **Move:** drag anywhere on the screen, or hold ←/→ (or A/D). The squad follows your finger's movement, so your finger never covers the action.
- **Shoot:** the squad fires automatically. More soldiers means more bullets.
- **Raiders** pour down from the centre of the road in growing waves, get tougher over time and steer toward you. Each one that reaches the squad takes out one soldier.
- **Rescue jars (+N):** shoot a jar open to add those soldiers to your squad.
- **Ice blocks:** shoot them to break them for a gun upgrade (more damage per bullet). If one reaches you, it crushes 3 soldiers.
- The run ends when your squad hits 0. Your score is distance plus kills, rescues and upgrades. Your best score is saved in the browser.

## Code layout

| File | Purpose |
|---|---|
| `src/config.js` | All tuning: speeds, fire rate, sizes and the `difficulty(t)` curve. |
| `src/sim.js` | Pure game simulation (movement, spawning, shooting, collisions, scoring). No Phaser, so it's unit-tested. |
| `src/scenes/GameScene.js` | Draws the simulation, handles input, effects, HUD and the start and game-over screens. |
| `src/textures.js` | All sprites drawn with Phaser Graphics at startup (no image files yet). |
| `src/theme.js` | Colours and fonts. |
| `tests/` | Unit tests for the simulation. |

## Tests

```bash
cd game
npm test
```

Uses Node's built-in test runner (Node 18+), so there's nothing to install.

## Balancing

The difficulty curve was tuned with bots playing the simulation headlessly (6 runs each):

| Bot | Survives |
|---|---|
| Stands still | ~20–80 s |
| Sloppy aim (slow reactions, ±50 px error) | ~40–150 s |
| Perfect aim | ~150 s, with 100+ soldiers and gun Lv 16 |

Enemy health has a quadratic term, so every run ends eventually.

## Roadmap

1. ~~Core run: move, auto-fire, raider waves, rescue jars, gun upgrades, score~~
2. Gates (×2, +10, −5) to steer through, and a boss at the end of each stage
3. Stages with a finish line and between-run upgrades (start squad size, fire rate)
4. Sound, real art and haptics
5. Mobile build with Capacitor
