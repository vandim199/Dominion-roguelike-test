# Forays-merged: what was tried, and what stayed

This branch is `wild/forays-yours` with the ideas from `wild/forays-claude` tested one at a time. Each idea had to earn its place against the bots. Most did not, and the changes that did were not all the ones `reports/Forays comparison.md` on main expected.

Nobody has played this. Every number comes from bots, and minutes assume 15 seconds a played turn.

## What changed

Four changes to the rules, plus one display fix:

| Change | Before | Now | What it does for the game |
|---|---|---|---|
| Higher fill costs | Cannon 3, Palisade 2 | Cannon 4, Palisade 3 | The most important one. Powder can no longer fill everything, so layout and burning become real choices. |
| Flatter enemy damage | Starts 17, grows ×1.19 a fight | Starts 24, grows ×1.175 | More danger early, less sudden death late. Even odds now mean about the same thing at every stage. |
| Third starting bastion | Cannon, Palisade | Cannon, Palisade, Apothecary. Deeds start at the fourth slot | Your Powder cannot feed three, so the first fights have a question in them. |
| Free swap | None in the game | Tap two bastions. One swap a turn is free, more cost 1 energy | Changes who is fed first and who gets hit. The smallest gain of the four. |
| Dead enemy's health | Could show "-2 / 18" | Stops at 0 | |

## Each idea on its own

Each row adds one idea to the rules of `wild/forays-yours`, except the last, which has all four kept changes. 24 seeds each, on one clock: 15 s a turn, 3 s a fight, 25 s a home visit, 5 s a march, 10 s a caravan. Treat differences of a few minutes as noise.

- **Fighting** is how much slower a bot that does not think in fights reaches a trillion. **Careless** is the same for a bot that buys the cheapest thing and picks random sockets, and never retreats.
- **Avoiding** is how long a bot that leaves before close fights takes, compared with the normal bot. Below ×1 means dodging close fights is the faster way to climb.
- **Best layout** is how often the most successful layout won, mid-game / late-game. The target is about 60%.

| Idea | Minutes to a trillion (10th-90th percentile) | Bursts 1-5 min apart | Fighting | Careless | Avoiding | Best layout | Verdict |
|---|---|---|---|---|---|---|---|
| Forays-yours as it was | 63.8 (51-100) | 58% | ×1.87 | ×4.13 | ×0.79 | 76% / 52% | |
| No "must attack first" rule | 63.8 (51-100) | 58% | ×1.87 | ×4.13 | ×0.79 | 76% / 56% | **Rejected.** No effect |
| Free swap | 59.6 (45-89) | 61% | ×2.00 | ×4.47 | ×0.85 | 67% / 41% | **Kept** |
| Hunker and Dodge intents | 63.7 (50-85) | 57% | ×2.05 | ×4.50 | ×0.85 | 69% / 59% | **Rejected.** No gain in the fight tests |
| Dodge only | 67.0 (46-83) | 58% | ×1.90 | ×4.02 | ×0.75 | 76% / 54% | **Rejected** |
| Third starting bastion | 56.5 (47-71) | 63% | ×1.83 | ×4.19 | ×0.95 | 89% / 69% | **Kept**, for the first fights |
| Higher fill costs | 63.3 (51-74) | 52% | ×2.22 | ×4.56 | ×0.92 | 41% / 31% | **Kept** |
| Flatter enemy damage | 55.1 (46-73) | 58% | ×1.97 | ×4.75 | ×0.85 | 69% / 30% | **Kept** |
| Odds gate on upgrades, at ×5 | 85.2 (52-102) | 50% | ×1.59 | ×3.09 | ×0.72 | 76% / 52% | **Rejected.** Slower, and the spread barely moved |
| Odds gate on upgrades, at ×8 | 67.5 (44-97) | 57% | ×1.75 | ×3.90 | ×0.87 | 76% / 52% | **Rejected** |
| Double pay for close wins | 60.2 (53-81) | 58% | ×2.14 | ×3.52 | ×0.89 | 76% / 52% | **Rejected.** Nothing gained on the final rules (below) |
| **All four kept changes (shipped)** | **51.0 (40-61)** | **63%** | **×1.91** | **×4.94** | **×0.94** | **59% / 56%** | |

The odds gate at ×3 stalled completely in the 12-seed round (122 minutes to a trillion, with bots making trips of a few seconds), so it was not run again.

## Does each kept change still earn its place?

Each row takes one change back out of the shipped rules. The fresh-build column is the not-thinking / thinking win rate at odds of 0.5, in fights with a level 1 deck.

| Shipped rules, without | Minutes to a trillion | Bursts 1-5 min apart | Avoiding | Best layout | Fresh build at 0.5 | What it shows |
|---|---|---|---|---|---|---|
| Nothing (shipped) | 51.0 (40-61) | 63% | ×0.94 | 59% / 56% | 66% / 82% | |
| Free swap | 53.9 (44-61) | 61% | ×0.91 | 52% / 41% | 66% / 81% | Small. About 5% faster, and the layout test is better without it |
| Third bastion | 53.7 (49-61) | 63% | ×0.89 | 44% / 41% | 22% / 23% | Without it, the first fights go back to playing themselves |
| Higher fill costs | 51.5 (41-63) | 52% | ×0.78 | 91% / 43% | 11% / 10% | Without it, one mid-game layout wins nearly always, and dodging close fights pays again |
| Flatter damage | 65.6 (53-74) | 61% | ×0.80 | 56% / 35% | 78% / 87% | Without it, the climb is slower and late fights turn lethal at even odds |

The free swap is the weakest of the four. It stays because every whole-loop number moves slightly the right way, it costs one rule, and a person may use it better than a bot does. If it feels fiddly, it is the first thing to cut.

## What this corrects in the comparison report

The comparison on main predicted that removing the "must attack first" rule would be the main gain, and that it would loosen the Palisade-first layout. **Both were wrong for this game.** It had no effect here. Fill costs were the real cause. The bots only ever place a Gatehouse at the left end, where the rule changes nothing, so this result does not say the rule is good: only that removing it did nothing in these tests. It stays because your original brief asked for outposts.

It also predicted that Hunker and Dodge would punish autopilot, and that the odds gate might narrow the spread. Neither held. The spread narrowed anyway, from 51-100 minutes to 40-61, thanks to the other changes.

## What is still weak

- **The first ten minutes.** Thinking bots now lose less health and kill faster in the first fights, but thinking and non-thinking bots still reach the same power at the ten-minute mark.
- **Layouts are better, not free.** The most successful layout now wins 59% of the mid-game tests and 56% of the late ones, just inside the target, and the same layout is best against 7 of 9 enemies at both stages.
- **The fights got easier for careful play.** A thinking bot wins nearly every fight at even odds, and the share of time at odds below 1 fell from 21% to 11%. The stair-step may need a sharper wall.
- **The odds scale moved.** Higher fill costs lower the power estimate, so "even odds" is safer than the number suggests. The on-screen odds were not retuned.
- **The Wheel is still optional** (×1.39 slower without it), and **the Title Deed is still on thin evidence**.
- **Bots only.** The think bot samples turns at random and may undervalue or misuse a swap. Whether any of this is fun is still unknown.

## Reproduce

```
node sim/variants.js yours 24                # the old rules
node sim/variants.js yours+swap 24           # one idea added to them
node sim/variants.js base 24                 # the shipped rules
node sim/variants.js base+noswap 24          # the shipped rules without one change
node sim/variants.js list                    # every switch
```

`docs/variants_table.txt` holds the output for every row above, including the fight-by-fight decision tests. The rejected ideas stay in the code as switches that are off by default, so these commands keep working. Hunker and Dodge have no on-screen text, because they never appear in the shipped game.
