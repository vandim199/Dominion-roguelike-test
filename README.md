# Coinkeep

A pocket roguelike deckbuilder. You're the steward of a little hilltop town, and trouble arrives in endless waves: tax collectors, ogres, pirates, blizzards, ghosts. Build one deck for the whole run and use it to pay off, outlast or blow up every threat. Between waves you pick charms that bend the rules and visit the Inn to upgrade, copy or trash cards.

## Playing

Open `index.html` in a browser, or serve the folder (e.g. GitHub Pages, or `python -m http.server`). No build step. It can be added to a phone's home screen (web app manifest included).

Works on desktop, tablets and phones in either orientation. Use **⚙ Settings** to change the UI size (or `+` / `−` on a keyboard). On touch screens, tap a card to read it before playing or buying it, and press and hold a card in a picker to read it.

**Saving is automatic.** The run is saved in the browser (localStorage) whenever the game is waiting for you, and between waves before the charm draft and the Inn. **Continue** on the title screen picks it up, log included. Randomness is seeded and saved with the run, so reloading can't reroll a draw, a shuffle or an offer. The save is deleted when the town falls. Starting a new run while one is saved asks first. The Classic version keeps its own save.

**📜 Log → ⬇ Save** (also in Settings and on the game-over screen) downloads the whole run's log as a text file, not just the last 200 lines on screen.

## Modes

**Play** is merge mode. Cards are played with ⚡ Energy (1 a turn; each card's play cost is in its blue pip). Your Anvil merges a pair of identical cards from anywhere in your deck (discard pile and cards already played this turn first, then draw pile, then hand) into one a level higher, which goes to your discard pile. A card's play cost never changes as it levels; its effect goes up by one: Copper → Silver → Gold (+1, +2, +3 Coin), Spark +1/+2/+3 ⚡ for 0, Scout +1/+2/+3 Cards for 1 ⚡. The market sells the Anvil, but rarely (`TUNE.rareWeight`); the Twin Hammers charm lets it merge 2 pairs. Each of a Patron's upgrades picks any market card, so one card can go up several levels at once. The market stocks each card one level below the best you've merged it to (`TUNE.marketLag`), and cards that cost more ⚡ to play arrive in later waves (`TUNE.energyFrom`). The Ward stays in your hand and only works once it's in your discard pile. At the Inn between waves, **Merge** combines 2 or 3 different cards into one that does it all (a fusion is a card of its own, so two copies of one can be merged by the Anvil, raising every part a level). Every Inn service has a Back button. In your hand a card shows only its ⚡ cost; the market and the close-up view show its price too. Threats have fuses: one that runs out detonates, attacks and costs a heart. Clearing one offers a free level-one card. The cards are `mdef`s in `js/data.js`; merge mode's threat curves are `TUNE.merge`.

Merge mode is built to break: the longer a run goes, the bigger the numbers, Balatro-style (they show as 12.3K, 4.5M, 6.7B, then 1.2e15).
- **The Monolith.** The Inn's Merge fuses 2 or 3 cards (`TUNE.fuseMax`) into one; a cleared threat's spoils can be absorbed straight into a card of yours instead of joining your deck. Every part beyond the first multiplies all of a fusion's numbers by `TUNE.synergy` (×1.02, compounding); it costs the average ⚡ of its parts, rounded down. Multipliers and Encores in a fusion take the best part (a fused Encore makes the whole card resolve again); strikes stack with diminishing returns and, like every strike in merge mode, take at most 40% (`TUNE.strikeCap`). A fusion of four or more parts is a *Monolith*: threats can't trash it, but it is no reaction either. A deck of 6 cards or fewer gets a second Inn service. Fusion keys (`fz:<key>.<level>[*count]+…:<⚡>`) rebuild on load, old ones too.
- **Tiny-deck charms.** Hermit (rare: deck ≤ 6, draw it all and every card resolves twice), Monk (+1 ⚡ per card below 10), Lone Wolf (your first card each turn resolves once more per 10 cards trashed this run, then you can play no other), Keystone (rare: ×1.1 a part instead of ×1.02), and Minimalist retuned (+10% to all Coin per card below 16). A card that resolves k times does its numbers k times over and its choices once, k times as big; a multiplier applies once. Warm Mittens is uncommon, and an Ice Coffin holds for only one turn against it.
- **Overkill and chains.** The 💥 Overkill button pours all your Coin through the board (most urgent first), then the queue: the overflow spills on, and a threat paid off in the queue never arrives (no Rubble, no Ice Coffin). Non-coin threats take Coin at `t.rate` a unit, so a whole one costs what a `TUNE.exchange` (15) × wave-scale coin threat would; one-shot fees are all or nothing. Each threat cleared in your turn makes the Coin you make for the rest of it worth ×1.25 (`TUNE.chain`). Clearing 3+ in the turn that ends the wave is a Wipe: an extra charm or Inn service.
- **Ante Up.** After the Inn, an optional contract for the next wave: Double Stakes (demands ×2, pays a choice of 2 rare charms), Crowded Gates (+2 threats, pays an extra Inn service) or Short Fuses (fuses 1 shorter, pays a free card fused into one of yours). It pays only if the wave ends without a heart lost.
- **Threats.** Coin demands are `coin × rise^(w−1) × ramp^((w−1)²)` (`TUNE.merge`: 1, 1.7, 1.02), so every wave's rise is steeper than the last. Elites seal your finest card from wave 3 (`TUNE.merge.coffinFrom`). Wards together wear threats down by at most 20% a turn.

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
node sim/sim.js --bot monolith --runs 300 --waves 40 --tune synergy=1.03   # try a TUNE number without editing data.js
```

Bots: **monolith** (merge mode's archetype: trashes its junk and Anvil, fuses everything into one card, absorbs every spoil into it, takes the tiny-deck charms, clears coin threats cheapest first, then Overkills, and signs an Ante Up contract when its last wave's best turn beats the next wave's threats by a margin; elsewhere it plays as engine), **engine** (Sparks, Scouts and the other Actions, kept within its ⚡ budget; villages and draw in classic), **money** (mostly Coins, merged; Big Money in classic) and **random** (a floor any strategy should beat). The heuristic bots merge every pair an Anvil lets them and Overkill their leftover Coin. Runs are seeded: the same `--seed` plays the same game. A run ends when the town falls, after `--waves` waves (30), after `--turns` turns (2000, "stalled") or when the deck passes `--deckcap` cards (400, "runaway deck").

The report shows, per bot: waves cleared; how runs end and which threat ended them; per wave, the coin, spare Actions, cards seen and how often a turn drew the whole deck, next to what the wave's coin threats and the market ask (as turns of income); each threat's clear and detonation rate; and for every card, charm, splice and Ante Up contract, how often it was taken and how those runs did. It also gives the share of runs that cleared 20+ waves, the peak single-turn Coin (median, p90, max), in merge mode the biggest fusion's parts and each wave's median best turn, how often each threat was paid off in the queue, and the best run's monolith.

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
