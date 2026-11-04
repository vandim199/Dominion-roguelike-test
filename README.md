# Coinkeep: Forays

A vanilla-JS deckbuilder and incremental game for browser and phone. This is the `wild/forays-claude` branch, one take on reworking Coinkeep. Your hand makes Powder, your board of Bastions burns it left to right, and each trip out ends when the road gets too strong. Then you go home, spend, and come back with more zeroes.

## Run it

Open `index.html` through any static server, such as `python -m http.server`. There is no build step. It can also be added to a phone's home screen. The older frozen game is in `classic/`, linked from the title screen.

## How it plays

- **Turn:** 3 energy and 5 cards. Powder cards feed the board. A full Bastion fires once a turn and starts filling again. Part-fills carry over.
- **Enemies** show their next two actions. Attacks hit the leftmost Bastion unless they say otherwise. Damage carries on down the line and then to you. A fallen Bastion goes to your discard pile.
- **One swap a turn is free.** It changes who gets fed first and who gets hit first.
- **Stuck cards** (Deeds, Wards, Rubble) stay in hand until you pay 1 energy to file them.
- **Going home:** after any win you can leave with all your coin. If you are beaten you keep 70%. Upgrades are never lost.
- **At home:** three upgrade tracks every card reads from, Deeds that open slots and raise all payouts, a shop that scales with your depth, and Crests from bosses that buy rule changes.

Progress saves automatically, per published version, and survives a reload, including mid-fight.

## Files

- `js/data.js`: content and all tuning numbers (`TUNE`), plus the number formatter
- `js/game.js`: the rules, with no DOM. The browser and the simulator share it
- `js/ui.js`, `js/save.js`, `css/style.css`, `index.html`: the screens and saving
- `js/versions.js`: the version switcher on the title screen
- `sim/decision.js`: fight test (bots, layouts, builds, feed timing, swaps)
- `sim/loop.js`, `sim/results.js`: whole-loop bot and the pacing tables
- `docs/TAKE.md`: design and decision log. `docs/RESULTS.md`: measurements

## Simulate

```
node sim/decision.js --seeds 24
node sim/results.js --seeds 8
node sim/loop.js --seeds 1 --trace --to 1e12
TUNE='{"cLv":2.2}' node sim/loop.js --seeds 3     # try a number without editing data.js
```
