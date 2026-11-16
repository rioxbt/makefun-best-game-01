# Lanternkeeper

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/rioxbt/makefun-best-game-01/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/rioxbt/makefun-best-game-01/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

You hold the last light on the abyss shelf. Shades come out of the dark for it and plankton motes
drift in to feed it, and both arrive at the same lantern: swing the shield of light to turn the
shades away, open it to let the motes through, and keep the light alive through twelve waves.

A browser game, played with keyboard and mouse, from static files with no build step and no network
request: aim the shield with the mouse or swing it with **A D** / **← →**, **Space** or a click to
start and restart, **P** to pause, **M** to mute. The sound is synthesised in the game itself, so
the entry ships no audio files. Play it at <https://make.fun/bounty/best-game-01>.

## Run it

```sh
node serve.ts          # serves game/ on http://localhost:8080 — open it in a desktop browser
node main.ts           # the entrypoint: copies game/ and screenshots/ to $MAKEFUN_OUTPUT_DIR
                       # (or /output) and writes dossier.json there
```

## How it plays

- **The lantern** sits at the centre with 100% light. A shade that reaches it drinks 20% or more;
  at 0% the run ends.
- **The shield** is a bloom of light on a ring around the lantern. It is a little thicker than its
  bright rim, so a volley swung at a moment late is still answered rather than lost.
- **Volleys** arrive from rifts that glow a moment before the shade steps through, and a wave spaces
  them so that each one can be answered: two volleys never land from opposite sides at once.
- **Motes** feed the lantern 12% light and 25 points each — and only if they touch the lantern.
  Breaking one on the shield pays 2 points and wastes the light: that choice is the game.
- **Chains** raise a combo to ×8, and a wave taken without a scratch pays double. Twelve waves, and
  the reef wakes.

## Layout

| Path | What it is |
| --- | --- |
| `game/index.html` | the page; its only reference is `./src/main.js` |
| `game/src/config.js` | every tuning number, colour and name, in one place |
| `game/src/world.js` | the rules: waves, volleys, the shield's grip, the light, the combo, the score |
| `game/src/render.js` | the scene and the screens, in the fixed 1280x720 field the window scales to |
| `game/src/draw.js` | drawing primitives: glows, arcs, polygons, text |
| `game/src/input.js` | keyboard and pointer: the shield's aim, and the one-shot presses |
| `game/src/audio.js` | the sound, synthesised from oscillators: no audio files |
| `game/src/pilot.js`, `game/src/shots.js` | the two hands that play the staged screenshot scenes, and the scenes |
| `game/src/random.js` | a seeded generator, so a staged screenshot is the same frame twice |
| `main.ts` | the entrypoint the grader runs (Node 22, standard library only) |
| `vendor/makefun-game.ts` | make.fun's `buildDossier`, unchanged |
| `screenshots/` | four renders of the game: the title, play, the dawn, the dark |

## License

MIT — see [LICENSE](LICENSE).

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
