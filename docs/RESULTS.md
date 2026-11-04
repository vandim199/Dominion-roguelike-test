# Results

Measured on the rules shipped on this branch. `docs/MERGE.md` explains how they were chosen. Nobody has played this game yet.

Reproduce with:

```
FN=12 LN=5 SAMPLES=16 node sim/results.js all
node sim/variants.js base 24
```

Full output is in `docs/results_raw.txt` and `docs/variants_table.txt`. All minutes assume 15 seconds per played turn, 3 s per fight's modals, 5 s per march, 10 s per caravan and 25 s per home visit, none of which is measured from a person.

**R** is estimated three-turn damage divided by enemy health. It is offence only, and the on-screen odds use a stricter estimate. R is not comparable between rule sets: the higher fill costs lower the power estimate, so a given R is an easier fight than it was on `wild/forays-yours`. Compare the gap inside a row, not win rates across rule sets.

## 1. Decision test

12 seeds across 9 enemies per cell (108 fights). `think` samples 60 whole turns per turn on a copy of the fight, with the unseen draw reshuffled. `fixed` plays attacks first and burns the rest, and also powers the Auto button. It never swaps.

| Build | R | Win: random / fixed / think | HP lost: random / fixed / think | Turns to kill in wins: random / fixed / think |
|---|---|---|---|---|
| Fresh (L1) | 0.7 | 26 / 81 / 100% | 77 / 20 / 2% | 4.1 / 3.0 / 2.1 |
| | 1 | 54 / 96 / 100% | 49 / 6 / 0% | 3.9 / 2.4 / 2.0 |
| | 1.5 | 79 / 100 / 100% | 23 / 0 / 0% | 3.4 / 1.8 / 1.2 |
| Early (L6) | 0.7 | 70 / 96 / 100% | 33 / 10 / 0% | 5.5 / 2.9 / 2.0 |
| | 1 | 86 / 100 / 100% | 17 / 2 / 0% | 4.7 / 2.3 / 2.0 |
| | 1.5 | 95 / 100 / 100% | 7 / 0 / 0% | 3.7 / 1.8 / 1.2 |
| Mid (L22) | 0.7 | 71 / 88 / 94% | 30 / 17 / 11% | 7.1 / 5.5 / 3.4 |
| | 1 | 82 / 97 / 100% | 20 / 7 / 2% | 5.7 / 4.1 / 2.6 |
| | 1.5 | 94 / 100 / 100% | 12 / 1 / 0% | 4.4 / 3.1 / 2.0 |
| Late (L38) | 0.7 | 5 / 18 / 85% | 97 / 85 / 16% | 7.8 / 8.5 / 4.7 |
| | 1 | 15 / 62 / 99% | 86 / 40 / 1% | 7.6 / 7.6 / 3.8 |
| | 1.5 | 59 / 91 / 100% | 43 / 11 / 0% | 7.0 / 5.8 / 2.8 |

At R=0.5 on the fresh build, from the 24-seed run: fixed wins 66%, think 82%, HP lost 45% against 26%, turns to kill 3.8 against 3.1.

**Pass mark: think at least 20% better than fixed in close fights.**
- Fresh and early: **pass** on damage and speed. On `wild/forays-yours` this failed: at R=0.7 on the fresh build, fixed won 58% and think 53%.
- Mid: pass on damage (71% less at R=1) and speed (37% faster at R=1). Win rate is only 3 points better, because R=1 is now an easy fight.
- Late: pass, by a wide margin.

**Knock-outs at R=1 on the mid build** (fixed win / think win, HP lost by fixed / by think). Enemy health is set from each variant's own R estimate, so read the gap inside each row.

| Variant | Win | HP lost |
|---|---|---|
| As shipped | 97 / 100% | 7 / 2% |
| Think bot may not swap | 97 / 100% | 7 / 2% |
| Burn is flat 1, not cost + 1 | 100 / 100% | 0 / 0% |
| Only Powder cards feed | 100 / 100% | 0 / 0% |
| Wheel only feeds, hand never burns | 100 / 100% | 2 / 1% |
| No Magazine | 97 / 100% | 7 / 4% |

Burning is still what makes the hand matter: without it the gap disappears. The swap does not show up in this test at all. Its small gain only appears over the whole loop (see `docs/MERGE.md`).

**Pass mark: no layout best more than about 60% across enemy sets** (think bot, R=1, same absolute enemy for every layout, six layouts).
- Mid: **pass, just.** Guns-first 59%, Palisade-first 31%. Guns-first is best against 7 of 9 enemies. It was Palisade-first at 76% on `wild/forays-yours`.
- Late: **pass, just.** Chain 56%, Bellows chain 31%. Chain is best against 7 of 9 enemies. This is no better than the 52% on `wild/forays-yours`.

## 2. Whole-loop pacing

Careful upgrades, think fight bot, fresh start to 1e15, 24 seeds. The burst here is a home visit that at least doubles power, the definition used to compare versions.

| Measure | This branch | `wild/forays-yours` |
|---|---|---|
| Minutes to 1e12, median (10th-90th percentile) | 51.0 (40-61) | 63.8 (51-100) |
| Minutes to 1e15, median | 64 | 82 |
| Minutes between bursts, median (10th-90th percentile) | 3.8 (1.7-7.3) | 4.3 (1.3-8.4) |
| Gaps between bursts inside 1-5 minutes | 63% | 58% |
| Median trip | 2.8 min | 2.6 min |
| Turns per fight | 2.4 | 3.2 |
| Trips ending in defeat, up to 1e12 | 35% | 44% |
| Slower with no thinking in fights | ×1.91 | ×1.87 |
| Slower avoiding close fights | ×0.94 | ×0.79 |
| Slower never retreating | ×1.41 | ×1.44 |

From the 5-seed `results.js` run: time at odds 2 or more / 1 to 2 / below 1 is 46% / 42% / 11% (33% / 43% / 21% on `wild/forays-yours`), and hand share of damage is 30%. Non-finite checks failed: 0. A stress case at level 300 (power 2.5e62) stayed finite and survived a JSON round trip. 8 of 8 seeds beat the final boss at fight 119 when run past 1e15.

Dying does not out-earn leaving. By when the bot leaves, 5 seeds, minutes to 1e12: below 1.2, 49. Below 1, 57. Below 0.75 (the default), 48. Below 0.5, 63. Never, 77. Pure march-and-go-home farming did not reach 1e9 within its 200 minute cap.

## 3. Optimisation depth

Same fight bot. Naive = cheapest purchase first, random sockets, first caravan card, never retreats.

| Measure | Result |
|---|---|
| Careful against naive, 24 seeds | ×4.94 (×4.13 on `wild/forays-yours`) |
| Careful against naive, 5 seeds | ×2.76 (seeds disagree widely, and one never reached 1e12 in the cap) |
| Without sockets | Never reaches 1e12 within the 400 minute cap |
| Without the Charge perk, every trip must fight, 5 seeds | ×2.01 (×1.06 on `wild/forays-yours`) |
| Never buying the Wheel, 24 seeds | ×1.39 (×1.20 on `wild/forays-yours`) |

Part of the naive bot's slowness comes from never retreating. A bot that levels and sockets carefully is still far faster at every seed count, and your optimisation depth did not get worse.

## 4. Honest verdict

**What bots cannot tell us.** Whether any of this is fun. Whether a person can read a Charge chain on a phone. Whether 15 seconds a turn is right, since chain turns are arithmetic and may take much longer. Whether tapping to swap feels useful or fiddly. Whether the Deed annoys people.

**What is weak.** See `docs/MERGE.md`. In short: the first ten minutes still give thinking and non-thinking bots the same power, one layout still leads against 7 of 9 enemies, careful play may now find fights too easy, the on-screen odds were not retuned, the Wheel is optional, and the Title Deed still rests on thin evidence. In the Deed tests, fights at this difficulty are now easy enough that the cost of two dead cards no longer shows up, so that test says nothing either way on these rules.

**Browser check.** Run in the built-in browser against a local server at 375x812. Checked: title, home, march, fight, tapping two bastions to swap, the free swap followed by a 1 energy swap, cancelling by tapping the same bastion, the attack target updating after a swap, reload mid-fight resuming the same order and swap state, and four scripted trips through defeat and home using the real buttons, with no script errors, no horizontal overflow and no negative health shown. Only `versions.json` returned a 404, which is expected locally. Desktop width was not rechecked. This does not stand in for someone playing on a phone.
