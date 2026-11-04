# Coinkeep: Forays

A branch-only rework of Coinkeep into an incremental enemy battler. Vanilla JavaScript, no build step, works on phone and desktop. Published from this branch at `v/wild-forays-yours/`. The frozen original stays in `classic/`, reachable from the title screen.

## The game

You leave the Keep with a small pack of cards and a row of bastions, fight deeper until you go home or get beaten, then spend coin and go again.

- **Hand.** Five cards and three energy. Each card can be played for its effect, or burned for Powder (its cost + 1).
- **Board.** Powder runs left to right. A full bastion fires at once, once a turn. The Wheel adds Powder every turn. Spare Powder waits in the Magazine.
- **Charge.** A socketed perk: the next bastion or attack card pays triple, and chains multiply. A chain has to complete inside one turn, so the late game is about counting Powder.
- **Enemies** show their intents. Aimed hits strike the leftmost bastion (a Gatehouse first), archers the rightmost, some go straight for you. A destroyed bastion returns to the discard and must be drawn and paid for again.
- **Trips.** The March sweeps what your machine clears on Wheel Powder alone, or anything you utterly outclass. Then you play by hand. Marched fights pay a tenth. Going home keeps all coin, defeat keeps 70%. Nothing else is ever lost.
- **Growth.** Levels multiply a card, with triple pay every 10 levels. Levels 5, 20 and 40 open sockets, free to rearrange. Caravans stop once every 7 fights and sell one card. Bosses every 12 fights grant a permanent rule change. A Title Deed must be packed for each slot past two, and it is dead in your hand.
- **Saving.** Automatic, after every action, in one slot per published version.

## Files

| File | What it holds |
|---|---|
| `index.html`, `css/style.css` | The page and its look |
| `js/data.js` | Tuning, cards, perks, enemies, rewards, number formatting, seeded randomness, `slotKey` |
| `js/game.js` | All rules, no DOM: profile, trip, fight, purchases, power estimate |
| `js/save.js` | Autosave and load validation |
| `js/ui.js` | Screens and animation |
| `js/versions.js` | The title screen's version switcher |
| `sim/load.js` | Loads the browser scripts into Node |
| `sim/bots.js` | Fight bots: random, fixed (`fixedTurn` in `game.js`, also the Auto button), think |
| `sim/loop.js` | Whole-game bots: careful and naive upgraders |
| `sim/feedtest.js` | The first test of the riskiest idea, plus Deed and Ward tests |
| `sim/results.js` | Every number in `docs/RESULTS.md` |

## Running

Open `index.html` through any static server, for example `python -m http.server 8772`.

Reproduce the measurements with `node sim/results.js all`, or `node sim/feedtest.js 10 deeds` for the Deed test. See `docs/RESULTS.md`.

Design notes and decision log: `docs/TAKE.md`.
