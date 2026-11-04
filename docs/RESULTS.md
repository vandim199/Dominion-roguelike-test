# Measured results

Reproduce with:

```
node sim/decision.js --seeds 24
node sim/results.js --seeds 8
```

Bots play through the real rules in `js/game.js`. R is your power divided by enemy health. Power is measured from a cold start: the fixed bot's average damage over its first 3 turns against a dummy. Because it ignores charged Bastions and good play, it understates what a thinking player can do, so "even" in practice sits below R 1.

The bots:
- **random:** random legal plays.
- **fixed:** Powder first, then damage, then the rest. It never moves a Bastion. This is also the in-game Auto turn.
- **thinker:** plays out each option to the end of the fight with the fixed routine from a reshuffled draw pile (8 rollouts per option here, 4 in the whole loop) and keeps the best. It cannot see the real draw order.

## 1. Decision test

Each row is 192 fights: 24 seeds against each of 8 enemies. The board is Bolt Tower, Great Bombard, Buttress and Gatehouse. "Health pools lost" adds your health and each Bastion's health, each counted as a share of its maximum, so 1.0 means one full pool lost.

**Level 8 (power 16.2K)**

| R | Bot | Win % | Health pools lost | Turns to kill (wins) |
|---|---|---|---|---|
| 0.7 | random | 5 | 6.53 | 20.6 |
| 0.7 | fixed | 59 | 6.31 | 13.6 |
| 0.7 | thinker | 65 | 2.15 | 8.3 |
| 1 | random | 16 | 5.95 | 15.2 |
| 1 | fixed | 68 | 3.98 | 8.1 |
| 1 | thinker | 80 | 1.32 | 4.9 |
| 1.5 | random | 48 | 4.28 | 7.7 |
| 1.5 | fixed | 95 | 2.05 | 4.5 |
| 1.5 | thinker | 100 | 0.70 | 3.3 |
| 3 | random | 93 | 1.42 | 4.0 |
| 3 | fixed | 100 | 0.12 | 1.5 |
| 3 | thinker | 100 | 0.05 | 1.3 |

**Level 30 (power 29.5B)**

| R | Bot | Win % | Health pools lost | Turns to kill (wins) |
|---|---|---|---|---|
| 0.7 | random | 8 | 6.43 | 20.6 |
| 0.7 | fixed | 61 | 5.76 | 11.9 |
| 0.7 | thinker | 73 | 1.83 | 7.6 |
| 1 | random | 18 | 6.30 | 17.2 |
| 1 | fixed | 69 | 4.34 | 8.4 |
| 1 | thinker | 87 | 1.36 | 5.2 |
| 1.5 | random | 56 | 4.13 | 8.5 |
| 1.5 | fixed | 97 | 1.42 | 3.2 |
| 1.5 | thinker | 100 | 0.74 | 2.9 |
| 3 | random | 90 | 1.50 | 4.2 |
| 3 | fixed | 100 | 0.10 | 1.5 |
| 3 | thinker | 100 | 0.04 | 1.3 |

**Pass mark, thinker at least 20% better than fixed in close fights: passed on health lost and kill speed, mixed on wins.**

| Close fight | Level 8: health lost / kill speed / win points | Level 30: health lost / kill speed / win points |
|---|---|---|
| R 0.7 | 66% less / 39% faster / +6 | 68% less / 36% faster / +12 |
| R 1 | 67% less / 40% faster / +13 | 69% less / 38% faster / +18 |
| R 1.5 | 66% less / 26% faster / +5 | 48% less / 9% faster / +3 |

The edge is about the same at both scales, so the decision survives big numbers. The first version of the rules failed this test. See `docs/TAKE.md`, questions 1 to 3.

**Layouts: all 24 orders of those four Bastions, fixed bot, R 0.7, level 8.** 4 different orders were best across the 8 enemies, and the most common was best against 5 of 8 (63%, just over the 60% mark). The gap between the best and worst order on average was only 4 points (63% to 58%), while individual enemies differ more: three of them (Mire Toad, Ledger Moth, Writ Crow) beat the fixed bot almost every time at R 0.7 whatever the order. So for a bot that never reorders, the starting order matters little on average. Mid-fight order is what counts: a thinker that never swaps loses far more health than one that does.

| Thinker, level 8 | Win % | Health pools lost | Turns to kill |
|---|---|---|---|
| R 0.7 with swaps | 65 | 2.15 | 8.3 |
| R 0.7 never swaps | 57 | 5.85 | 13.6 |
| R 1 with swaps | 80 | 1.32 | 4.9 |
| R 1 never swaps | 78 | 3.25 | 7.2 |

**Builds: thinker, R 1 by the mixed build's power, level 8, 12 seeds per enemy.** Win %, with the best build on each row marked.

| Enemy | Chain | Wall | Plague | Mixed | Draw |
|---|---|---|---|---|---|
| Tollgate Rat | 100 | 100* | 100 | 100 | 83 |
| Rust Hound | 100* | 92 | 100 | 100 | 92 |
| Tax Imp | 100* | 100 | 100 | 100 | 100 |
| Mire Toad | 67 | 0 | 83* | 25 | 25 |
| Siege Goat | 92 | 100* | 42 | 100 | 50 |
| Ledger Moth | 67 | 0 | 92* | 33 | 33 |
| Dun Mason | 92 | 100* | 92 | 100 | 67 |
| Writ Crow | 92 | 8 | 100* | 58 | 83 |
| Mean | 89 | 62 | 89 | 77 | 67 |

No build is best against more than 3 of 8 enemies (38%), which passes. Chain and Plague lead overall at 89% each, and each has a weak enemy.

**Feed timing at level 8, R 1.** Powder flowing at once: thinker 80% wins, 1.32 pools lost. A batch at end of turn: 79%, 1.19. No meaningful difference, so I kept the immediate feed because it lets drawn cards be played the same turn.

## 2. Whole-loop pacing

8 seeds each, medians, 15 seconds per played turn. That figure is the brief's default, not measured from a person. Time at the Keep is not counted, so real sessions will be longer. A burst is a Keep visit that at least doubles power. The bot leaves when the next fight's R falls below 1, and stops at 1e15.

| Run | Min to 1e6 | 1e9 | 1e12 | 1e15 | Burst gap min: median / p10 / p90 | % turns at R>=2 / 1-2 / <1 | Trips | Defeats | Non-finite |
|---|---|---|---|---|---|---|---|---|---|
| Thinking fights, careful spending | 28.8 | 46.0 | 67.8 | 90.5 | 4.75 / 3 / 7.25 | 68 / 28 / 4 | 22 | 19 | 0 |
| Fixed fights, careful spending | 29.3 | 47.5 | 68.0 | 91.3 | 4.5 / 3 / 9 | 71 / 25 / 4 | 25 | 22 | 0 |
| Thinking fights, naive spending | 31.3 | 55.3 | 85.8 | 391.3 | 5.25 / 3.5 / 16 | 75 / 17 / 8 | 116 | 93 | 0 |
| Fixed fights, naive spending | 40.0 | 69.5 | 121.0 | 188.0 | 5.5 / 3.5 / 14.75 | 73 / 18 / 9 | 201 | 176 | 0 |

Main run detail: deepest fight 119, 362 turns, all 8 seeds reached 1e15 and beat the final boss, with no non-finite number (the rules count every time the guard has to step in, and it never did). 3.17 Bastion firings per turn, 0.06 Powder wasted per turn, and the board did 96% of direct damage in the last trip. That figure leaves out Blight.

**Leaving policy, to 1e12, thinking fights, careful spending**

| Leave when next R is below | Min to 1e12 | Burst gap median | % turns at R>=2 / 1-2 / <1 | Trips | Defeats |
|---|---|---|---|---|---|
| 0.3 (nearly always fights to defeat) | 76.5 | 5 | 57 / 28 / 15 | 14 | 14 |
| 0.55 | 70.0 | 5 | 56 / 29 / 15 | 13 | 13 |
| 1 | 67.8 | 4.75 | 66 / 29 / 4 | 15 | 12 |
| 1.5 | 65.3 | 4.5 | 73 / 26 / 1 | 16 | 6 |
| 2.5 | 51.8 | 3.25 | 97 / 3 / 0 | 22 | 2 |

Dying never beats leaving, as the report asked. Also measured: a careful bot that takes Bastion offers first reaches 1e12 in 69.0 minutes, and one that never buys a Deed takes 530.3.

## 3. Optimisation depth

Careful spending tries each purchase on a copy and measures power per coin, and tidies the board by trial. Naive spending buys the cheapest thing it can, and never reorders.

| Fights played by | Careful to 1e12 | Naive to 1e12 | Careful is faster by |
|---|---|---|---|
| Thinking bot | 67.8 min | 85.8 min | 21% less time |
| Fixed bot | 68.0 min | 121.0 min | 44% less time |

To 1e15 the gap is wider: 90.5 against 391.3 minutes with the thinking bot, and 91.3 against 188.0 with the fixed bot. The naive runs took 116 and 201 trips in total, stalling repeatedly at bosses. The thinking naive run's 1e15 median is slower than the fixed naive run's, which I read as seed noise at the slow end, since only 8 seeds ran.

With careful spending, thinking in fights hardly changes time to 1e12 (67.8 against 68.0), because the odds gate and the leaving rule set the pace. It shows when the player is underpowered: naive spending goes from 121.0 to 85.8 minutes.

## 4. Honest verdict

**Weak:**
- **Avoiding the hard fights is still the fastest route.** A bot that only fights at R 2.5 or better reaches 1e12 about 24% sooner, with 97% of its turns in comfortable fights. It needs 22 trips against 15, so Keep time narrows that gap, but probably does not close it. Only bosses force close fights on it. Double pay for close wins was not enough. Many players will push for curiosity, but the numbers do not reward it, and this is the biggest flaw.
- **Comfortable turns dominate the time share.** 68% of turns are at R>=2, against the report's guide of about a quarter. Part of that is the cold-start power measure, and easy turns should take far less than 15 seconds, but the enjoyment stretch may be too long.
- **Bursts sit at the top of the brief's range.** The median gap is 4.75 minutes and p90 is 7.25, against the 1 to 5 minutes asked for. Some trips run far longer: one traced trip was 38 turns, or 9.5 minutes. Caches give mini-bursts mid-trip, and these are not counted.
- **The climb is uneven in scale.** 1e6 takes 29 minutes, and each later factor of 1000 takes about 20.
- **Careful spending converges on one board** (Bellows, Anvil, Bombard, Plague Pit and a Tower or Buttress), even though the build table shows other builds win some fights. The careful bot measures power with the fixed routine, so it may undervalue defensive and draw pieces, but a solved best board is a real risk.
- **Some content barely registers.** Charters were not in the final decks I inspected. Mint and Signal Post appear only in some runs. Fixed-bot win rates against Mire Toad, Ledger Moth and Writ Crow at R 0.7 are near zero, which may be too swingy.

**What bots cannot tell us:** whether this is fun; whether reading intents and swapping feels clever or fiddly on a phone; how long a real turn takes, since every minute above assumes 15 seconds; whether the 30% defeat cost or a stuck Deed feels fair; whether someone starts another trip unprompted. The thinking bot is a strong rollout player, so a human's edge over the fixed routine may be smaller. Nobody has played this.

**Browser check.** Run in the built-in browser pane, served from the worktree on port 8771, using a scripted player clicking the real buttons. It played three full trips on a fresh save at 375x812: title, Keep, fights, caches, defeat, spending, and setting out again. A save resumed mid-fight after a reload. A level-30, six-slot profile showed no overflow on any slot, card or button at 375 wide, and one Keg triggered a three-Bastion chain for 132B. The only console errors were 404s for `versions.json`, which does not exist locally. The switcher hides itself in that case, so I did not see it working on the published site. The desktop width was checked only through a cropped screenshot, because the pane was hidden. Animations were not watched by eye. No touch device was used.
