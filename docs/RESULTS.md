# Results

Reproduce with:

```
FN=12 LN=5 SAMPLES=16 node sim/results.js all
node sim/results.js ko
node sim/feedtest.js 10 deeds
node sim/feedtest.js 10 junk
```

Full output is in `docs/results_raw.txt`. Everything here was measured on the shipped rules unless marked. Nobody has played this game yet. All minutes assume 15 seconds per played turn, 3 s per fight's modals, 5 s per march, 10 s per caravan and 25 s per home visit, none of which is measured from a person.

**R** is estimated three-turn damage divided by enemy health. It is offence only. The game's on-screen odds and the bands in section 2 use a stricter heuristic, `oddsAt`, which also counts toughness, front-bastion fragility and bosses.

## 1. Decision test

12 seeds across 9 enemies per cell (108 fights). `think` samples 60 whole turns per turn on a copy of the fight, with the unseen draw reshuffled. `fixed` plays attacks first and burns the rest, and also powers the Auto button.

| Build | R | Win: random / fixed / think | HP lost: random / fixed / think | Turns to kill in wins: random / fixed / think |
|---|---|---|---|---|
| Early (L6) | 0.7 | 17 / 89 / 95% | 85 / 19 / 17% | 7.9 / 4.7 / 4.5 |
| | 1 | 56 / 100 / 100% | 51 / 5 / 5% | 6.1 / 3.2 / 3.1 |
| | 1.5 | 90 / 100 / 100% | 18 / 0 / 0% | 4.8 / 2.1 / 2.2 |
| | 3 | 100 / 100 / 100% | 1 / 0 / 0% | 3.1 / 1.1 / 1.1 |
| Mid (L22) | 0.7 | 60 / 80 / 85% | 40 / 21 / 18% | 5.9 / 5.4 / 3.8 |
| | 1 | 80 / 88 / 98% | 22 / 15 / 8% | 4.7 / 4.1 / 3.0 |
| | 1.5 | 88 / 100 / 100% | 15 / 5 / 0% | 3.6 / 3.1 / 2.0 |
| | 3 | 100 / 100 / 100% | 1 / 0 / 0% | 2.3 / 2.0 / 1.3 |
| Late (L38) | 0.7 | 0 / 0 / 16% | 100 / 100 / 88% | none / none / 4.1 |
| | 1 | 0 / 2 / 32% | 100 / 99 / 69% | none / 5.5 / 3.9 |
| | 1.5 | 6 / 15 / 72% | 96 / 87 / 29% | 6.0 / 6.9 / 3.5 |
| | 3 | 51 / 89 / 100% | 50 / 13 / 0% | 4.4 / 5.4 / 1.7 |

**Pass mark: think at least 20% better than fixed in close fights.**
- Late: pass, by a wide margin.
- Mid: pass on damage (47% less at R=1) and speed (26% faster at R=1), but win rate is only 10 points better.
- Early: **fail.** Fixed is about as good as think. Play-everything is close to correct for roughly the first few trips.

Cards played and burned per turn: in the mid and late builds, think burns 2.4 to 3.5 a turn while fixed burns 1.2 or fewer, so the extra skill is coming from the feed.

**Knock-outs at R=1 on the mid build** (fixed win / think win, HP lost by fixed / by think):

| Variant | Win | HP lost |
|---|---|---|
| As shipped | 88 / 98% | 15 / 8% |
| Bot may not swap | 88 / 97% | 15 / 9% |
| Burn is flat 1, not cost + 1 | 100 / 100% | 4 / 4% |
| Only Powder cards feed | 100 / 100% | 2 / 2% |
| Wheel only feeds, hand never burns | 94 / 100% | 10 / 6% |
| No Magazine | 88 / 98% | 15 / 8% |

Enemy health is set from each variant's own R estimate, so read the gap inside each row and not win rates across rows.

**Pass mark: no layout best more than about 60% across enemy sets** (think bot, R=1, same absolute enemy for every layout, six layouts).
- Mid: **fail.** Palisade-first is best in 76% of pairings and for 8 of 9 enemies.
- Late: pass, narrowly. Hex chain 52%, Gatehouse chain 28%, Bellows chain 13%. The best layout varies across enemies (Hex, Gatehouse, big guns first).

A separate test of builds, as opposed to layouts, was not run. The closest evidence is the whole-loop spread in hand share below.

**Junk.** Same absolute enemy, mid build (90 fights a row; differences of a few points are noise):
- Slots with Deeds that burn for nothing, wheel 8: 0 Deeds 90% win and 14% HP lost, 1 Deed 100% and 4%, 2 Deeds 100% and 1%, 3 Deeds 100% and 1%, 4 Deeds 98% and 3%.
- At wheel 1 and 3 the trend is weaker and not monotonic.
- Two useless dead cards with slots free: 100% and 1% with none, 97% and 9% with two.
- Think-fixed gap at R=1 (R-normalised): Deeds 12 points, no Deeds 16, Wards 17, Hold Deeds 4.

## 2. Whole-loop pacing

Careful upgrades, think fight bot (16 samples), 5 seeds, fresh start to 1e15.

| Measure | Result |
|---|---|
| Minutes to 1e6 | 24 (19-29) |
| Minutes to 1e9 | 38 (33-42) |
| Minutes to 1e12 | 56 (51-79) |
| Minutes to 1e15 | 65 (63-102) |
| Minutes between power bursts | median 2.2, p10 0.4, p90 5.5 (n=132) |
| Time at odds 2 or more / 1 to 2 / below 1 | 33% / 43% / 21% |
| Trips, defeats, retreats (median) | 25 (20-42), 8, 17 |
| Median trip length | 1.9 min |
| Power jump per trip (median) | x2.3 |
| Hand share of damage (median trip) | 28%, varying widely by seed and build |
| Non-finite checks failed through 1e15 | 0 |

A burst is a home visit where spending multiplies power by at least 1.5, or a boss reward. The bands are medians across seeds, so they do not sum to 100%. Finite-number checks ran after every fight. A separate stress case at level 300 (power 3.8e62) stayed finite and survived a JSON round trip.

**Retreat policy** (minutes to 1e12): leave at odds below 1.2, 50 min. Below 1, 59. Below 0.75 (the default), 56. Below 0.5, 79. Never leave, 89. Dying does not out-earn leaving. Pure march-and-go-home farming did not reach 1e9 within its 200 minute cap.

## 3. Optimisation depth

Same fight bot. Naive = cheapest purchase first, random sockets, first caravan card, never retreats.

| Bot | Minutes to 1e12 |
|---|---|
| Careful | 56 (51-79) |
| Naive | 198 (141 to never within the 400 minute cap) |

**Careful play is x3.52 faster at the median.** Per seed: 2.75, never, never, 2.60, 2.49, where "never" means naive missed 1e12 inside the cap, so the true ratio on those seeds is unknown.

Fight skill, with careful upgrades: fixed fight bot x2.37 slower than think (133 minutes against 56).

**Knock-outs.** Under the shipped rules some bots fell into a loop of about 600 zero-fight trips, which is a bot artefact, so the table below requires every trip to fight once. The baseline under this rule is slower too (77 minutes to 1e12, 91 to 1e15).

| Removed | Minutes to 1e12 | Ratio | Minutes to 1e15 |
|---|---|---|---|
| Sockets | 351 | x4.55 | never in cap |
| Charge perk | 82 | x1.06 | 245 |
| Buying the Wheel | 79 | x1.03 | 119 |

Under the free-retreat rule, never buying the Wheel was x1.41 to 1e12. Charge and the Wheel matter mostly late: at 1e15, x2.7 and x1.3.

## 4. Honest verdict

**What bots cannot tell us.** Whether any of this is fun. Whether a person can read a Charge chain on a phone. Whether 15 seconds a turn is right: chain turns are arithmetic and may take much longer, which would stretch every figure above. Whether the March's spectacle lands. Whether repeating enemies gets boring. Whether the Deed annoys people.

**What is weak.**
- **The early game has no decision test pass.** For the first few trips, playing everything is about as good as thinking. The feed only matters once there is more than one bastion to feed. That is also the stretch where a person decides whether to keep playing.
- **Pacing is uneven.** 1e6 takes 24 minutes and 1e12 to 1e15 takes only 9 at the median, so the late game accelerates. The seed spread is large (1e12 in 51 to 79 minutes), and the trip log shows both a x60 single-trip jump and a run of four trips at x1 to x2.3 against the same wall.
- **R is not uniform.** R=1 is safe at L6 and lethal at L38. On-screen odds are a heuristic with hand-chosen terms, and the bot still sometimes dies at odds it was told were fine, mostly at bosses.
- **Mid-game layout is close to solved.** Palisade first dominates (76%).
- **Sockets may converge.** The careful bot nearly always ends on Keen and Charge. The socket list has fewer real choices than it appears, and the knock-out says Charge barely matters before 1e12.
- **The Wheel is optional.** It is one viable road rather than the backbone you imagined, as a hand build reaches 1e12 at about the same time.
- **Deeds rest on thin evidence.** The effect on win rate is near noise, and only the HP cost is clear.
- **The careful bot is not an optimal player,** so x3.52 is a lower estimate of what skill could reach, and the naive bot's never-retreat rule accounts for part of its slowness.
- **Tuning overfits the bots,** and the fight bot's sample count changes results. Whole-loop runs used 16 samples and the decision test 60.
- **Content is small:** 19 usable cards, 10 bastions, 8 enemies, 3 bosses, with emoji for art.

**Browser check.** Run in the built-in browser against a local server for this worktree (the named launch entry resolved to the main repo, so I served port 8772 by hand). Checked: title to home, march animation, fight through real buttons, Burn preview and Charge display, caravan, defeat report, home purchases and all quick-buy modes, reload mid-fight resuming the exact state, New game erasing the save, no horizontal overflow at 375x812 and centred at 1100x800, no script errors (only `versions.json` 404s, which are expected locally). I took screenshots at phone width. The real `v/wild-forays-yours/` URL and the version switcher row with data were not exercised. I drove these by script and judged appearance from a few screenshots, so this does not stand in for someone playing on a phone.
