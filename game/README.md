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
- **Gates:** a pair of gates spans the road (for example **+8 / –5** or **+10 / ×2**). The one on your side when you pass through applies. A bad gate can wipe you out. The squad is capped at 150 soldiers.
- **Stages and bosses:** each stage is a 40-second run, shown by the bar under the HUD. Then a boss marches at you, and the bar becomes its health. Normal spawns stop. If the boss reaches your squad, it keeps crushing soldiers, and harder in later stages. Kill it to rescue soldiers, earn a big score bonus and start the next stage.
- The run ends when your squad hits 0. Your score is distance plus kills, rescues, upgrades and bosses. Your best score is saved in the browser.

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

| Bot | Reaches |
|---|---|
| Stands still (always takes the right-hand gate) | stage 1–2 (15–130 s) |
| Sloppy aim (slow reactions, ±50 px error) | stage 5 (~220 s) |
| Perfect aim, always picks the better gate | stage 5 (~220 s) |

Boss fights take about 4–8 s for an active player. Enemy health has a quadratic term, so every run ends eventually.

## Roadmap

1. ~~Core run: move, auto-fire, raider waves, rescue jars, gun upgrades, score~~
2. ~~Gates (×2, +10, –5) to steer through, and a boss at the end of each stage~~
3. Between-run upgrades bought with coins (start squad size, fire rate, gun level)
4. Sound, real art and haptics
5. Mobile build with Capacitor
