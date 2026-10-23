# Coinkeep

A pocket roguelike deckbuilder. You're the steward of a little hilltop town, and trouble arrives in endless waves: tax collectors, ogres, pirates, blizzards, ghosts. Build one deck for the whole run and use it to pay off, outlast or blow up every threat. Between waves you pick charms that bend the rules and visit the Inn to upgrade, copy or trash cards.

## Playing

Open `index.html` in a browser, or serve the folder (e.g. GitHub Pages, or `python -m http.server`). No build step. It can be added to a phone's home screen (web app manifest included).

Works on desktop, tablets and phones in either orientation. Use **⚙ Settings** to change the UI size (or `+` / `−` on a keyboard). On touch screens, tap a card to read it before playing or buying it, and press and hold a card in a picker to read it.

**Saving is automatic.** The run is saved in the browser (localStorage) whenever the game is waiting for you, and between waves before the charm draft and the Inn. **Continue** on the title screen picks it up, log included. Randomness is seeded and saved with the run, so reloading can't reroll a draw, a shuffle or an offer. The save is deleted when the town falls. Starting a new run while one is saved asks first. The Classic version keeps its own save.

**📜 Log → ⬇ Save** (also in Settings and on the game-over screen) downloads the whole run's log as a text file, not just the last 200 lines on screen.

## Modes

**Play** is merge mode. Cards are played with ⚡ Energy (1 a turn; each card's play cost is in its blue pip). Your Anvil merges a pair of identical cards from anywhere in your deck (discard pile and cards already played this turn first, then draw pile, then hand) into one a level higher, which goes to your discard pile. A card's play cost never changes as it levels; its effect goes up by one: Copper → Silver → Gold (+1, +2, +3 Coin), Spark +1/+2/+3 ⚡ for 0, Scout +1/+2/+3 Cards for 1 ⚡. The market sells the Anvil, but rarely (`TUNE.rareWeight`); the Twin Hammers charm lets it merge 2 pairs. Each of a Patron's upgrades picks any market card, so one card can go up several levels at once. The market stocks each card one level below the best you've merged it to (`TUNE.marketLag`), and cards that cost more ⚡ to play arrive in later waves (`TUNE.energyFrom`). The Ward stays in your hand and only works once it's in your discard pile. At the Inn between waves, **Merge** combines two different cards into one that does both and costs their average ⚡, rounded up (a fusion is a card of its own, so two copies of one can be merged by the Anvil, raising every part a level). Every Inn service has a Back button. In your hand a card shows only its ⚡ cost; the market and the close-up view show its price too. Threats have fuses: one that runs out detonates, attacks and costs a heart (merge mode has 3, and the Inn's rest mends 1). Clearing one offers a free level-one card. Any threat that doesn't want Coin can also be **bought off** with Coin (`TUNE.merge.bribe` × the wave's coin scale, less as it's worn down). The cards are `mdef`s in `js/data.js`; merge mode's threat curves are `TUNE.merge`: coin demands grow ×1.3 a wave and, from wave 6, steeper every wave (like antes), so a deck that only grows linearly hits a wall around wave 8–12 and only decks that compound break through.

Merge mode is built to start slow and end explosively. **Growing cards** keep what they grow on the card (🌱, `c.grow`, extra Coin), and it survives merging: two twins merge whatever they've grown, and the new card keeps the sum. *Nest Egg* (+X−1 Coin, grows +X for good each play), *Snowball* (grows 12+5X% each play, compounding: tiny for a while, then absurd, especially when an Encore replays it), *Sapling* (grows +X at the start of every wave, played or not). *Warren* (1 ⚡) breeds a plain copy of itself and then merges a pair of Warrens, so copies pyramid into levels without bloating the deck. **Cracked** cards (`TUNE.crackSpoils`, `crackMarket`) turn up in the spoils and the market: they play two levels higher but shatter (are trashed) 1 time in 4 when played; two Cracked twins merge into a stable card at the level they played at, plus one. **The Vault** (🏦 in the resource bar, key V) saves the Coin you don't spend at the end of a turn and pays 10% interest a turn, up to `TUNE.vaultCap` (1 + the wave); tap it to take everything out. Alchemists don't multiply Vault coin. Charms for all this: Hiker (every card you play gets +1 Coin for good), Mitosis (a merge may leave one of the pair behind), Phoenix (a shattered card may come back a level higher), Ossuary (Coin each turn for the cards you've trashed), Avalanche (Snowballs grow faster), Golden Goose (Nest Eggs and Saplings grow twice as much), Savings Jar and Dragon's Hoard (Vault interest and cap). Numbers are shown compactly (12.3K, 4.5M, 6.7B, 8.9T, then 1.2e15).

**Classic mode** opens `classic/`, a frozen copy of the game as it was on 22 October 2026 (commit 1e687d5), before Energy and merging. Its own title screen offers that version's Play (splice mode) and Classic. It keeps its own best-run record and has a link back. Changes to `js/` don't touch it. The current code still has classic and splice mode too (the simulator's `--mode classic` / `--mode splice`), but they are no longer on the title screen.

## Published versions

GitHub Pages is built by `.github/workflows/pages.yml` (Settings → Pages → Source must be **GitHub Actions**). It publishes `main` at the site's root and every `wild/*` branch under `v/<branch>/` (`wild/mult` → `v/wild-mult/`), and writes `versions.json`, which the title screen's **Versions** row (`js/versions.js`) lists, so every version is a tap away. A push to `main` or to any `wild/*` branch rebuilds the whole site; a new `wild/*` branch appears on its own. Each version keeps its own save and best run (`SLOT` in `js/game.js`). Opened as a local file, the Versions row stays hidden.

## Simulator

`sim/` plays the game headless with bots, so balance changes can be measured instead of guessed. It needs Node.js and loads `js/data.js` and `js/game.js` exactly as they are, so edit the game and rerun:

```
node sim/sim.js                          # all bots, 100 runs each, merge mode
node sim/sim.js --bot engine --runs 500  # one bot, more runs
node sim/sim.js --mode classic           # or splice
node sim/sim.js --bot money --log run.txt --json runs.json
```

Bots: **compound** (merge mode's archetype: commits to Snowballs and Nest Eggs in a deck kept thin with Bonfires, replays them with Encores, skips spoils it doesn't want, keeps a reserve in the Vault and buys threats off rather than feed them good cards; plays as engine in the other modes), **engine** (Sparks, Scouts and the other Actions, kept within its ⚡ budget; villages and draw in classic), **money** (mostly Coins, merged; Big Money in classic) and **random** (a floor any strategy should beat). Both heuristic bots merge every pair an Anvil lets them. Runs are seeded: the same `--seed` plays the same game. A run ends when the town falls, after `--waves` waves (30), after `--turns` turns (2000, "stalled"), when a bot's picker loops ("stalled") or when the deck passes `--deckcap` cards (400, "runaway deck"). Use `--waves 40` to measure merge mode, so god runs aren't cut off.

The report shows, per bot: waves cleared, the share of runs that cleared 20+ waves and the peak single-turn coin (median / p90 / max); how runs end and which threat ended them; per wave, the coin, spare Actions, cards seen and how often a turn drew the whole deck, next to what the wave's coin threats and the market ask (as turns of income); each threat's clear and detonation rate; and for every card, charm and splice, how often it was taken and how those runs did.

## Files

- `index.html` — page structure, title screen, how-to-play
- `css/style.css` — styles; all sizes in `rem`, so the UI scale is the root font-size
- `js/data.js` — tuning, cards, charms and threats
- `js/game.js` — rules: waves, turns, threats, attacks, the Inn
- `js/ui.js` — rendering, modals, inspector, effects, layout and scaling, settings
- `js/save.js` — automatic saving and loading
- `js/versions.js` — the title screen's version switcher on the published site
- `manifest.webmanifest`, `icon.svg` — install-to-home-screen metadata
- `classic/` — the 22 October 2026 version, frozen, behind the Classic mode button
- `sim/sim.js` — the simulator: options, sandbox, report
- `sim/bots.js` — runs inside the sandbox: stand-ins for `ui.js`, the bots, the recording
