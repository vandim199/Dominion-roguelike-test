# Spellkeep

A pocket roguelike deckbuilder for wizards, grown out of Coinkeep. Foes come one at a time and each must fall within **5 turns**. Every card costs **1 Mana** to play, and every hit is **multiplied by the Mana you still hold** when it lands. So the order you cast in is the game: gain Mana first and hit while it's high. Half the Mana you don't spend carries over to your next turn. New spells are scarce: after each win you pick one of three, rolled common, uncommon or rare.

The full design, card list and balance results are in [`docs/SPELLBOOK.md`](docs/SPELLBOOK.md).

## Playing

Open `index.html` in a browser, or serve the folder (e.g. GitHub Pages, or `python -m http.server`). No build step. It can be added to a phone's home screen.

Each card in your hand shows what it would do if played now: damage ⚔, Burn 🔥, and your Mana before and after. When Twincast, Empower or a relic will boost the next card, the cards it would change glow and carry a gold **2×** seal. Tap or click to play; right-click (or turn on "tap to read" in Settings) to read a card first. Keys: **E** ends the turn, **1–9** play a card, **+ / −** change the UI size.

Reward choices can be taken back: raising a card shows it before and after and has a Back button, relics are confirmed, and skipping a reward takes two taps.

**Saving is automatic.** The run is saved in the browser whenever the game waits for you and at each stop between fights. **Continue** on the title screen picks it up. Randomness is seeded and saved with the run, so a reload can't reroll anything. The save is deleted when the run ends.

**Classic Coinkeep** (the 22 October 2026 version) is still in `classic/`, linked from the title screen. The merge-mode Coinkeep that was on `main` before Spellkeep lives on the `wild/merge` branch, published beside it.

## Published versions

GitHub Pages is built by `.github/workflows/pages.yml` (Settings → Pages → Source must be **GitHub Actions**). It publishes `main` at the site's root and every `wild/*` branch under `v/<branch>/` (`wild/mult` → `v/wild-mult/`), and writes `versions.json`, which the title screen's **Versions** row (`js/versions.js`) lists. A push to `main` or to any `wild/*` branch rebuilds the whole site. Each version keeps its own save and best run (`SLOT` in `js/game.js`). Opened as a local file, the Versions row stays hidden.

## Simulator

`sim/` plays the game headless with bots, so balance changes can be measured instead of guessed. It needs Node.js and loads `js/data.js` and `js/game.js` exactly as they are:

```
node sim/sim.js                            # every bot, 100 runs each (about 3 minutes)
node sim/sim.js --bot mage --runs 500      # one bot, more runs
node sim/sim.js --endless 1 --fights 60    # play on after the 8th Boss
node sim/sim.js --bot mage --log run.txt --json runs.json
node sim/sim.js --tune '{"growth":1.5,"carry":1}'   # try other TUNE values without editing
```

Bots: **mage** (looks ahead over every order of its hand and picks a balanced deck), **naive** (picks cards exactly like mage but plays its hand in a random order: the gap between the two is what sequencing is worth), **burner** (Burn and big spells) and **random** (the floor). Runs are seeded: the same `--seed` plays the same game.

The report shows, per bot: fights won and how many runs beat the 8th Boss; on which turn fights end; for each fight, its health, how often it was reached and won, on which turn, and the deck size; each Boss's win rate; and for every relic and card, how often it was taken and how those runs did.

## Files

- `index.html` — page structure, title screen, how to play
- `css/style.css` — styles; all sizes in `rem`, so the UI scale is the root font-size
- `js/data.js` — tuning (`TUNE`), cards, relics, foes and Bosses
- `js/game.js` — rules: fights, turns, card resolution, card rewards, the Sanctum
- `js/ui.js` — rendering, choices, card previews, effects, settings
- `js/save.js` — automatic saving and loading
- `js/versions.js` — the title screen's version switcher on the published site
- `classic/` — Coinkeep as it was on 22 October 2026, frozen
- `sim/sim.js`, `sim/bots.js` — the simulator and its bots
