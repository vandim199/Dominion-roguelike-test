# Coinkeep: Forays (tap the deck)

A branch-only rework of Coinkeep into an incremental enemy battler. Vanilla JavaScript, no build step, works on phone and desktop. Published from this branch at `v/wild-forays-yours/`. The frozen original stays in `classic/`, reachable from the title screen.

This branch used to be a turn-based game with a hand and energy. That version is in the git history at `c38cf26`, and its closest living relative is `wild/forays-merged`. Why it changed, and what the tests said: `docs/TAPDECK.md`.

## The game

You leave the Keep with a deck, tap through fights until you go home or get beaten, then spend coin and go again.

- **Tap the deck.** Each tap draws the top card and plays it for free. There is no hand and no energy. Fast tapping does more, and holding the deck draws steadily.
- **Bastions** land on your field when drawn, in the order you set at home. The field starts every trip empty and stays built for the trip. A destroyed bastion goes back in your deck.
- **Powder** runs left to right. A full bastion fires, and the Powder moves on to the next, looping back to the first with no limit per swing. Some cards and the Wheel make Powder.
- **Combos.** Every card and firing builds Combo, up to ×3 on everything, and it fades if you stop. The same card in a row pays ×2, ×3 and on up to ×5. A Crossfire, an attack card right after a gun or a gun right after an attack card, pays ×2. A crit is one in twenty and pays ×5. Cards such as Whetstone, Field Anvil, War Horn and Rolling Barrel build on these.
- **Enemies** swing on a timer: that is your "turn". Block empties after each swing. Aimed hits strike the leftmost bastion (a Gatehouse first), archers the rightmost, and some go straight for you.
- **Trips.** Between fights the clock stops: tap to press on, or go home and keep all your coin. Being beaten, or running mid-fight, keeps 70%. From the second trip, the March sweeps anything that would die well before its first swing, at a tenth of the pay. Nothing else is ever lost.
- **Growth.** The real decisions happen at home: what you pack (5 to 15 cards), which bastions you field and in what order, and what you level and socket. Levels multiply a card, with triple pay every 10 levels. Levels 5, 20 and 40 open sockets, free to rearrange. Caravans stop once every 7 fights and sell one card, which joins your deck at once if there is room. Bosses every 12 fights grant a permanent rule change. A Title Deed must be packed for each slot past two, and it does nothing when drawn.
- **Saving.** Automatic, every few seconds and after each fight, in one slot per published version. A reloaded fight waits for your first tap.

## Files

| File | What it holds |
|---|---|
| `index.html`, `css/style.css` | The page and its look |
| `js/data.js` | Tuning, cards, perks, enemies, rewards, number formatting, seeded randomness, `slotKey` |
| `js/game.js` | All rules, no DOM: profile, trip, real-time fight, purchases, test firing |
| `js/save.js` | Autosave and load validation |
| `js/sfx.js` | Every sound, made on the spot with no files |
| `js/ui.js` | Screens, the clock and the effects |
| `js/versions.js` | The title screen's version switcher |
| `sim/load.js` | Loads the browser scripts into Node |
| `sim/check.js` | The rules the brief asked for, checked directly |
| `sim/loop.js` | Whole-game bots: careful and naive upgraders |
| `sim/results.js` | The numbers in `docs/RESULTS.md` |

## Running

Open `index.html` through any static server, for example `python -m http.server 8772`.

```
node sim/check.js
node sim/results.js pacing
```

Other tests: `skill`, `tap`, `rules`, `decks`, `share`. Pass `TUNEX='{"crossX":1}'` to change any tuning value for a run.
