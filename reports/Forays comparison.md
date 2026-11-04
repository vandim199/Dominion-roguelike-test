# Forays: my take against yours

**Bottom line.** Continue from Forays-yours and bring over Forays-claude's enemy targeting. Your direction beat what I would have built on the things you asked for: its bursts land closer to your 1-5 minute target, it reaches a trillion sooner, and both careful upgrades and good fighting clearly pay off. Forays-claude has one clear advantage: it asks real questions from the very first fight, while Forays-yours plays itself for the first few trips.

All of this comes from bots. Nobody has played either version properly, so neither result says which one is more fun.

Play them on the live site: [Forays-claude](https://vandim199.github.io/Dominion-roguelike-test/v/wild-forays-claude/) and [Forays-yours](https://vandim199.github.io/Dominion-roguelike-test/v/wild-forays-yours/). Each has its own save. Each agent's reasoning is in `docs/TAKE.md` on its branch ([claude](https://github.com/vandim199/Dominion-roguelike-test/blob/wild/forays-claude/docs/TAKE.md), [yours](https://github.com/vandim199/Dominion-roguelike-test/blob/wild/forays-yours/docs/TAKE.md)).

## How the two differ

The Forays-claude agent never saw your last message. It worked from your original brief and the research report, and was free to drop anything that failed its tests.

| | Forays-claude | Forays-yours |
|---|---|---|
| Feeding ammo | Some cards have a Powder side and a damage side; you tap one | Any card can be played, or burned for its cost + 1 Powder |
| Upgrades | Three shared tracks that every card reads. No per-card levels | Each card has its own levels, triple pay every 10 levels, and up to 4 sockets |
| Deck | Grows as you buy, with a bench to trim it | A pack of 8-12 cards chosen from a collection that keeps everything |
| Shop | New stock at home every trip | A caravan every 7 fights: one card, once |
| Cards found on a trip | Keep one | None. Spoils are gone |
| Optimising time | Nothing dedicated beyond an Auto turn button | The Wheel: a permanent Powder generator that also decides how far you sweep automatically. Coin per minute is shown as a score |
| Junk card | A Deed sticks in hand until you pay 1⚡. It multiplies payouts ×1.6 and opens slots. Wards and Rubble use the same rule | A Title Deed is dead and burns for nothing. You need one for each slot past two. The Ward was cut |
| Outposts | "Must attack this first" cut. Attacks hit the left end, and you get one free swap a turn | "Must attack this first" kept. Swapping in a fight cut |

## The numbers, on one clock

Each agent's headline numbers used a different clock: Forays-claude counted only turns, while Forays-yours also counted fights and home visits. They also defined a burst differently. So I remeasured both on the same terms, 12 seeds each: 15 seconds a turn, 3 seconds a fight, 25 seconds a home visit, 10 seconds a shop or cache stop, 5 seconds a march. A burst here means a home visit that at least doubles your power. The 15 seconds is an assumption, not a measurement.

This is why Forays-claude's 68 minutes to a trillion in its own report becomes 92 here.

| Measure | Forays-claude | Forays-yours |
|---|---|---|
| Minutes to a trillion, median (10th-90th percentile) | **92** (83-98) | **60** (51-90) |
| Minutes to a million / a billion | 37 / 61 | 23 / 38 |
| Minutes between bursts, median (10th-90th percentile) | 6.8 (4.5-11.3) | 4.4 (1.5-9.0) |
| Gaps between bursts that fall inside your 1-5 minutes | 16% | 56% |
| Median trip | 5.7 min | 2.7 min |
| Turns per fight | 1.6 | 3.0 |
| Trips ending in defeat | 78% | 44% |
| How much slower to a trillion with no thinking in fights | ×1.01 | ×2.1 |
| How much slower to a trillion with careless spending | ×1.24 | ×5.2 to ×5.8 |

Two of those rows matter most. In Forays-claude, fighting well barely speeds up the climb, because the upgrade gate and the rule for leaving set the pace. In Forays-yours, both good fighting and careful upgrades change how fast you climb.

Treat the careless-spending row with care. Forays-yours' careless bot also picks random sockets. It never retreats as shipped (×5.8). When I made it retreat like the careful bot, it collapsed into very short trips with almost no fights (×5.2). So the gap is real but probably overstated. Its own report said ×3.52 on 5 seeds.

These figures come from each agent's own decision test. The bots and enemies differ, so compare the pattern, not the exact numbers:

| Close fights, thinking bot against no-thinking bot, power equal to the enemy | Forays-claude | Forays-yours |
|---|---|---|
| Early game | 80% against 68% wins, 67% less health lost | 100% against 100% wins, same damage: **fails** |
| Mid game | Not tested separately | 98% against 88% wins, 47% less damage |
| Late game | 87% against 69% wins, 69% less health lost | 32% against 2% wins |
| One layout is best this often (target about 60%) | 63% | Mid 76%: **fails**. Late 52% |
| Speed gained by avoiding close fights | 24% | 11% |

## What your ideas turned out to be worth

**Rare shops: built, not proven.** Forays-yours has them and they remove the keep-one problem. No bot can tell whether a rarer choice feels more meaningful, so that one is for you to judge by playing.

**Real progress: yes, in both.** Neither version takes cards away, and a defeat only costs 30% of the trip's coin. Forays-yours also shows old enemies dying in the March, which makes the progress visible.

**Optimising a card: your strongest idea, with one condition.** Plain levels weren't enough. In Forays-yours, buying the cheapest upgrade was only 15-36% slower in an early run, because spreading coin around was nearly free. In Forays-claude, per-card levels poured everything into one tower and left new cards useless, so that agent cut them. What worked was milestones and sockets that multiply: removing sockets made the climb ×4.55 slower. The remaining worry is that the careful bot nearly always chooses the same two perks, and every socket is full by level 40.

**Optimising time: works, but isn't the backbone you pictured.** The Wheel exists, but never buying it is only ×1.41 slower, because a hand-based build gets there too. The agent rejected real-time ammo without testing it, reasoning that it would reward sitting still. If you want the generator to be central, that's a design change, not a tuning change.

**The victory-card equivalent: still unproven, as you suspected.** Forays-claude's Deed is essentially mandatory: without it the climb is about ×8 slower, so it's less a decision than a tax. Forays-yours' Deed has a clear cost in health, but its effect on wins is close to noise. I would keep the simple slot-cost version for now and decide after you've played it.

**Cards feeding ammo: keep it, but not in its plain form.** Plain Powder cards failed in both versions. Forays-claude only passed after adding the free swap, new enemy intents and removing "must attack this first". Forays-yours gets its depth from burning: with Powder cards only, its mid-game gap between thinking and not thinking disappeared (100% against 100%). Burning at cost + 1 is the simplest fix either agent found.

## What I would have done without your message

Forays-claude is the answer. I would have stayed close to the report, kept the keep-one rule and a shop every trip, replaced per-card levels with shared tracks, and put my effort into making each fight a good puzzle. That part worked: its fights ask real questions from fight 1.

But it gives you much less to optimise, and it has less of the stair-step you asked for. Your message pushed toward depth outside the fight, which is what an incremental game is made of. I would have missed that.

## Weak spots

**Forays-claude**
- Avoiding hard fights is the fastest way to climb, by 24%.
- Most gaps between bursts are longer than you asked for.
- 78% of its trips end in defeat, and fights are short at 1.6 turns.
- Careful spending settles on one board.

**Forays-yours**
- The first few trips play themselves, and that's when a new player decides whether to keep going.
- A Palisade-first layout is usually best in the mid-game.
- The time to a trillion varies widely between runs (51-90 minutes).
- The odds shown on screen are a hand-tuned estimate, and even power is safe early but deadly late.
- Late chain turns are arithmetic, so 15 seconds a turn is probably most optimistic here.
- A dead enemy can show negative health, such as "-2 / 18".

## What I recommend next

Continue on Forays-yours and test these four changes, one at a time, with its bots:

1. **Use Forays-claude's targeting.** Remove "must attack this first" and add one free swap a turn. Removing it was Forays-claude's biggest single gain, taking the thinking bot's edge from about 6% to about 60% less health lost. It should also loosen the Palisade-first layout. Forays-yours found swapping did nothing, but it tested that with "must attack this first" still in place, so I think the two results fit (my inference, untested).
2. **Bring over the Hunker and Dodge intents.** They punish autopilot at any scale of numbers.
3. **Fix the opening trips.** Start with a third bastion or tighter Powder, so there's something to feed and a choice from fight 1 (a proposal, untested).
4. **Try Forays-claude's odds gate on upgrades.** It may narrow the 51-90 minute spread, at the risk of slowing the climb.

And fix the negative health display.

## What I did and didn't check

- **Reruns:** I reran both agents' measurements with their own seeds. The key figures I compared matched, apart from one Forays-claude cell (39.3 against a reported 40.0).
- **Live site:** both versions load, list each other in the Versions row and keep separate saves.
- **My own play:** I played only the opening fights of each at phone size, and ran no full loop myself. Screenshots failed because the app's browser pane was hidden, so I worked from page text and layout measurements. I have not judged how either looks or feels. Each agent's scripted browser check went further into its own version.
- **Not compared:** time to 1e15, because my script only records power when a trip starts and misses the final jump.
- **Unknown:** whether either is fun, how long a real turn takes, and whether reading a Charge chain on a phone is pleasant or tiring.

The scripts and raw output for the common clock are in `research_notes/Forays comparison/`.
