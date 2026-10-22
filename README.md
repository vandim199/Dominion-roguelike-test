# Coinkeep

A pocket roguelike deckbuilder. You're the steward of a little hilltop town, and trouble arrives in endless waves: tax collectors, ogres, pirates, blizzards, ghosts. Build one deck for the whole run and use it to pay off, outlast or blow up every threat. Between waves you pick charms that bend the rules and visit the Inn to upgrade, copy or trash cards.

## Playing

Open `index.html` in a browser, or serve the folder (e.g. GitHub Pages, or `python -m http.server`). No build step. It can be added to a phone's home screen (web app manifest included).

Works on desktop, tablets and phones in either orientation. Use **⚙ Settings** to change the UI size (or `+` / `−` on a keyboard). On touch screens, tap a card to read it before playing or buying it, and press and hold a card in a picker to read it.

**📜 Log → ⬇ Save** (also in Settings and on the game-over screen) downloads the whole run's log as a text file, not just the last 200 lines on screen.

## Modes

**Play** is merge mode. Cards are played with ⚡ Energy (1 a turn; each card's play cost is in its blue pip). Your Anvil merges a pair of identical cards from anywhere in your deck (discard pile first, then draw pile, then hand) into one a level higher, which goes to your discard pile. A card's play cost never changes as it levels; its effect goes up by one: Copper → Silver → Gold (+1, +2, +3 Coin), Spark +1/+2/+3 ⚡ for 0, Scout +1/+2/+3 Cards for 1 ⚡. The Anvil isn't sold; the Twin Hammers charm lets it merge 2 pairs. The market stocks each card one level below the best you've merged it to (`TUNE.marketLag`), and cards that cost more ⚡ to play arrive in later waves (`TUNE.energyFrom`). The Ward stays in your hand and only works once it's in your discard pile. Threats have fuses: one that runs out detonates, attacks and costs a heart. Clearing one offers a free level-one card. The cards are `mdef`s in `js/data.js`; merge mode's threat curves are `TUNE.merge`.

**Classic mode** is the original game: Dominion-style Actions, market tiers that climb every wave, and threats that attack every few turns until paid. Splice mode (keywords grafted onto cards) is still in the code but off the title screen.

## Simulator

`sim/` plays the game headless with bots, so balance changes can be measured instead of guessed. It needs Node.js and loads `js/data.js` and `js/game.js` exactly as they are, so edit the game and rerun:

```
node sim/sim.js                          # all bots, 100 runs each, merge mode
node sim/sim.js --bot engine --runs 500  # one bot, more runs
node sim/sim.js --mode classic           # or splice
node sim/sim.js --bot money --log run.txt --json runs.json
```

Bots: **engine** (Sparks, Scouts and the other Actions, kept within its ⚡ budget; villages and draw in classic), **money** (mostly Coins, merged; Big Money in classic) and **random** (a floor any strategy should beat). Both heuristic bots merge every pair an Anvil lets them. Runs are seeded: the same `--seed` plays the same game. A run ends when the town falls, after `--waves` waves (30), after `--turns` turns (2000, "stalled") or when the deck passes `--deckcap` cards (400, "runaway deck").

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
