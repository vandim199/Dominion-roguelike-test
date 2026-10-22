# Coinkeep

A pocket roguelike deckbuilder. You're the steward of a little hilltop town, and trouble arrives in endless waves: tax collectors, ogres, pirates, blizzards, ghosts. Build one deck for the whole run and use it to pay off, outlast or blow up every threat. Between waves you pick charms that bend the rules and visit the Inn to upgrade, copy or trash cards.

## Playing

Open `index.html` in a browser, or serve the folder (e.g. GitHub Pages, or `python -m http.server`). No build step. It can be added to a phone's home screen (web app manifest included).

Works on desktop, tablets and phones in either orientation. Use **⚙ Settings** to change the UI size (or `+` / `−` on a keyboard). On touch screens, tap a card to read it before playing or buying it, and press and hold a card in a picker to read it.

**📜 Log → ⬇ Save** (also in Settings and on the game-over screen) downloads the whole run's log as a text file, not just the last 200 lines on screen.

## Simulator

`sim/` plays the game headless with bots, so balance changes can be measured instead of guessed. It needs Node.js and loads `js/data.js` and `js/game.js` exactly as they are, so edit the game and rerun:

```
node sim/sim.js                          # all bots, 100 runs each
node sim/sim.js --bot engine --runs 500  # one bot, more runs
node sim/sim.js --mode classic
node sim/sim.js --bot money --log run.txt --json runs.json
```

Bots: **engine** (villages, draw, upgrades), **money** (Big Money: Treasures and a couple of Map Rooms) and **random** (a floor any strategy should beat). Runs are seeded: the same `--seed` plays the same game. A run ends when the town falls, after `--waves` waves (30), after `--turns` turns (2000, "stalled") or when the deck passes `--deckcap` cards (400, "runaway deck").

The report shows, per bot: waves cleared; how runs end and which threat ended them; per wave, the coin, spare Actions, cards seen and how often a turn drew the whole deck, next to what the wave's coin threats and the market ask (as turns of income); each threat's clear and detonation rate; and for every card, charm and splice, how often it was taken and how those runs did.

## Files

- `index.html` — page structure, title screen, how-to-play
- `css/style.css` — styles; all sizes in `rem`, so the UI scale is the root font-size
- `js/data.js` — tuning, cards, charms and threats
- `js/game.js` — rules: waves, turns, threats, attacks, the Inn
- `js/ui.js` — rendering, modals, inspector, effects, layout and scaling, settings
- `manifest.webmanifest`, `icon.svg` — install-to-home-screen metadata
- `sim/sim.js` — the simulator: options, sandbox, report
- `sim/bots.js` — runs inside the sandbox: stand-ins for `ui.js`, the bots, the recording
