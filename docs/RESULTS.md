# Results

Reproduce with:

```
node sim/check.js
node sim/results.js pacing 24
node sim/results.js skill 12
node sim/results.js tap 12
node sim/results.js decks
node sim/results.js share 8
TUNEX='{"crossX":1}' node sim/results.js rules 12
```

Full output is in `docs/results_raw.txt`. All of it is from bots on the shipped rules. Nobody has played this version. Fights run on the game's own clock at 4 taps a second unless marked. Time outside fights is assumed: 25 s per home visit, 5 s per march, 10 s per caravan, 1 s between fights. The careful bot also rebuilds its deck instantly and never hesitates, so a person will be slower than every figure here.

Section 1 and the bot table in section 2 were rerun after Keen was limited to cards it affects. Bots that used to waste a socket on Keen now choose differently, which moved the 24-seed median to 1e12 from 26 to 31 minutes, with the same worst seed. The other tables are from just before that change, and the 12-seed baseline they compare against stayed at 26 (18-68).

**Power** is the damage a deck does in 12 seconds at 4 taps a second, from an empty board, against a dummy. A burst is a home visit that at least doubles Power, or a boss reward. With 12 seeds, differences of a few minutes are noise.

## 1. Pacing

Careful bot, 24 seeds.

| Measure | Result |
|---|---|
| Minutes to 1e6 | 9 (7-12) |
| Minutes to 1e9 | 21 (11-30) |
| Minutes to 1e12 | 31 (18-113) |
| Minutes to 1e15 | 32 (21-95), 3 seeds not inside 240 minutes |
| Minutes between bursts | median 1.7, p10 0.6, p90 4.4 (n=408) |
| Gaps inside 1 to 5 minutes | 64% |
| Trips, defeats (median) | 16, 5 |
| Median trip, median fight | 1.0 min, 6 s |
| Non-finite numbers | 0 |

## 2. Is the deck the real decision?

Same fight rules and tap rate, 12 seeds, against a baseline of 26 minutes to 1e12. "Never" means not inside 240 minutes, so medians on those rows understate the gap.

| Bot | Minutes to 1e12 | Ratio per seed (median) | Never |
|---|---|---|---|
| Careful | 26 (18-68) | | 0 |
| Naive: cheapest purchase first, random sockets, packs everything | 136 (30-224) | x5.19 | 4 of 12 |
| Levels well, but never changes its pack or bastions | 109 (42-240) | x3.81 | 2 of 12 |
| No sockets | 117 (64-148) | x3.38 | 4 of 12 |
| Never buys the Wheel | 31 (23-66) | x1.23 | 0 |
| Never hires the Page | 30 (20-50) | x1.13 | 1 of 12 |
| No Charge perk | 26 (18-68) | x1.00 | 0 |

The bot almost never picks Charge, so that row says little about the perk.

**Eight deck ideas, same coin.** Each deck is fixed, and the bot spends the budget on it. The number is the deepest fight it wins from a fresh start more than half the time. Enemy health grows x1.34 a fight, so 10 fights is about x19.

| Deck | 100K coin | 1B coin | 10T coin |
|---|---|---|---|
| Snowball (Barrels, Anvil, Whetstone) | 31 | 71 | 104 |
| Blight (Vials, Plague Bell, Apothecary) | 31 | 71 | 100 |
| Crossfire mix (Forks, Kegs, Forge, Arsenal, Cannon) | 25 | 64 | 95 |
| Guns and Powder (Scoops, Bellows, Mortar, Cannon) | 31 | 64 | 83 |
| Block and bash | 31 | 59 | 83 |
| Fork swarm | 31 | 59 | 82 |
| Wide field (Rams, four bastions) | 25 | 57 | 81 |
| Combo horn (Horns, Drums, Tower) | 31 | 57 | 79 |

Early on the decks are close. Late on they are not: Snowball and Blight lead, and the gap to the bottom at 10T is about x1500 in enemy health.

## 3. Are any cards useless?

This was the complaint that started this version. Each finished deck from the careful bot (8 seeds) was test-fired with one part taken out. The number is how far its damage falls.

| Deck at Power | Attack cards out | Bastions out | Other cards out (Powder, block, draw, Whetstones) |
|---|---|---|---|
| 1M | x2.1 | x246 | x2.7 |
| 1B | x5311 | x56 | x9.1 |
| 1T | x1.0T | x56 | x25 |

Every part carries weight at every stage after the start.

But **bots specialise**. Share of damage done by cards, over a whole game, 24 seeds: 0 1 1 1 1 2 2 2 4 6 7 8 14 17 97 100 100 100 100 100 100 100 100 100. That is 14 gun-heavy decks and 10 card-heavy decks and nothing between. An Arsenal counts as a bastion here, although it repeats a card's hit. So neither road is solved, but the two do not blend the way I intended.

## 4. Thumb speed

| Taps a second | Minutes to 1e12 (12 seeds) |
|---|---|
| 1.5 | 42 (25-175) |
| 2.5 | 36 (18-103) |
| 4 | 26 (18-68) |
| 6 | 31 (16-44) |
| 8 | 31 (15-101) |

Inside a fight, speed clearly pays. The starting deck first loses more than half its fights at fight 7 on 1.5 taps a second, fight 12 on 4 and fight 15 on 8. Its 12-second damage at 8 taps is x1.6 that of 4 taps. Over a whole climb, going past 4 taps shows no gain in this test, so mashing is a reward and not a requirement. With the Page and Wheel bought, two of four decks at 1e9 still did about half their damage with no tapping at all. The other two did 8% or less.

## 5. Each combo rule switched off

12 seeds. Baseline 26 (18-68).

| Rule off | Minutes to 1e12 | Reading |
|---|---|---|
| Combo | 58 (30-110), 1 never | Real power, about x2 |
| Crits | 34 (17-90) | Small |
| Crossfire | 32 (18-181) | Small, and it does not make bots mix. It stays as spectacle |
| Same card in a row | 29 (22-195) | Nothing measurable: pure spectacle |
| Title Deeds (slots free) | 31 (18-56) | Nothing measurable |
| Shuffle pause 0 s | 18 (12-23) | The strongest pacing knob |
| Shuffle pause 1.5 s (shipped 0.5) | 45 (21-217) | |
| Swing every 3 s (shipped 4) | 36 (22-133) | |
| Swing every 6 s | 28 (18-49) | |

## 6. Honest verdict

**What bots cannot tell us.** Whether tapping feels good, which was the whole point of this version. Whether the effects are exciting or noisy on a phone. Whether a person can tell why a deck is good. How long a thumb lasts: a trip is about a minute, and holding the deck draws three cards a second to spare it.

**What is weak.**
- **It may be too fast.** 31 minutes to a trillion is well under the 51 Forays-merged took, and the median burst gap of 1.7 minutes is near the low end of your 1 to 5. A person will be slower than the bot. I would judge this after playing.
- **Long walls still happen.** One seed in 24 took 113 minutes to 1e12. On a Shield Bash deck, it went 12 trips in a row with under x1.15 power. Costs double each level while value grows x1.56, so a deck that has run out of multipliers stalls. Switching decks is cheap (a fresh card catches up for about the price of one top level), but the bot does not see that, and a person may not either.
- **Late decks are not balanced.** Snowball and Blight lead by a wide margin at 10T.
- **Bots do not mix.** Crossfire was built to reward mixing, and they still go all guns or all cards.
- **The Wheel and Page matter little** (x1.23 and x1.13), and the Title Deed's cost does not show.
- **The Power number flatters Snowball**, which shows 103M at a budget where other decks show 100K to 500K, for the same fight. The March and the odds no longer rely on it, but the headline does. It is also a plain average of two runs, so on a deck that compounds it can jump either way when a socket changes. Echo's reading in the socket menu does not have this problem: on one Anvil deck, an average of 32 firings put Echo on the Field Anvil anywhere from x13 to x85, and the typical run from x6 to x9.
- **Odds are step-like.** Fights are low in variance, so the next-fight odds tend to read 100% then 0%. "Press on" is rarely a close call.
- **No choices inside a fight**, by design. Layout and pack are set at home, and the only live decisions are how fast to tap and when to go home.

**Browser check.** Run at 375x812 on a local server. On the final build, a scripted thumb that never retreats ran three trips: two defeats, two marches, three caravans and one boss reward. On earlier builds of this session, real clicks and a scripted thumb also covered running mid-fight, buying, sockets, layout, packing and billion-scale numbers. No script errors and no NaN or undefined on screen in any of it. Hold-to-draw, the space bar and resuming after a reload all work. The layout was also measured at 1100x800 and is centred. The browser pane was hidden throughout, so CSS animations did not run: I checked the layout by forcing them to their end state and never saw them play. Sounds ran without errors, and nobody has heard them. The live page was fetched, not played.
