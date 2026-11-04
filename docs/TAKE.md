# Coinkeep: Forays (this branch's take)

## Pitch

You hold a Keep with a water wheel that grinds Powder. You march out with a small pack of cards and a row of bastions, and every card in your hand is both a move and fuel, so each turn you decide what to play and what to burn. Powder runs left to right, and a full bastion fires at once. Your machine sweeps the old ground by itself, the fights near your limit are played by hand, and when you are beaten or wise enough to leave, you go home and spend. Nothing you bought is ever lost. Shops come rarely. Every card is a small build of its own, with levels, triple-pay milestones and sockets, and the top of the game is a chain of Charged bastions that has to complete inside one turn.

## A minute

Press March and watch the enemy that beat you last trip die in one volley among a dozen others. Then a fight you outclass: two turns, one small choice. Then one at even odds, where you count Powder to finish the chain this turn, and burn your best card to do it because the Tower Archer is about to shoot the far end of the line and break it.

## A session

Measured by bot, at an assumed 15 seconds per turn: about 25 trips to 1e15, median trip about 2 minutes, a power burst about every 2 minutes (p90 5.5). Home is thirty seconds of buying up to a milestone, moving a bastion, swapping a card in the pack and reading the Ahead row. A boss every 12 fights gives a permanent rule change. A caravan every 7 fights offers one card, once. A person is likely to take longer per turn than the bot's assumption. Nobody has played it yet.

## The hard questions that changed the design

Numbers below come from `docs/RESULTS.md` or, where marked, from earlier runs during tuning.

**Does the hand decide anything, or does it play itself?** The first version burned every card for 1 Powder. A fixed bot won 78% at R=1 and a thinking bot 79%. With three energy and five cards you play three and burn two, so burning cost nothing. I weighed Powder cards only (the report's plan), wheel only (the hand never feeds, your alternative) and burning at cost + 1. Cost + 1 moved the gap at R=1 to 58% against 77% in the same early run, because an expensive card now competes with itself. **Chosen: every card burns for cost + 1.** In the final tuning, Powder-cards-only and wheel-only both flatten the mid-game gap (100% against 100%, and 94% against 100%, against 88% against 98% as shipped).

**What does "optimise time" mean in a turn-based game?** Real-time Powder during a fight was rejected without a test, on logic: a thinking pause would earn ammo, so sitting still becomes optimal. Offline income was not built either. What I built instead:
- The Wheel gives Powder before you act each turn. The first version of this had no measurable effect on pace, at x0.92 to x1.06 when the bot never bought it, because burning cards replaced it.
- So the March changed: it sweeps what your machine clears on Wheel Powder alone, or anything you outclass eight times over. The Wheel now literally shortens the walk to your limit.
- The trip report shows coin per minute and your best, so leaving at the right moment is a visible score.
Result: never buying the Wheel is x1.41 slower to 1e12 under the shipped rules, and x1.03 to 1e12 and about x1.3 to 1e15 when every trip must fight. The bot adapts by switching to a hand build (96% hand damage). So it is a real path but not a necessary one.

**How can a deck keep growing without every choice mattering less?** Your objection was right. **Chosen: the collection grows and the pack does not.** The pack holds 8 to 12 cards. Everything else waits in the vault, free to swap at home. A new card has to beat an old one to get in. Spoils were cut altogether, so "keep one" no longer exists.

**What can a player optimise about one card, and when does it run out?** First I tested plain levelling, and a cheapest-first bot reached 1e12 only 15 to 36% slower than the careful bot in an earlier run. With exponential prices, spreading out is almost free. So optimisation needed to multiply rather than add. I added **Charge** (the next bastion or attack card pays triple, and chains multiply), which only pays if the whole chain fires inside one turn, and **Flurry**. That raised the gap to x3.52. A card has three sockets from a list of five or six, free to change, plus a fourth at level 60 from one boss reward. It does run out: by level 40 every socket is full and the rest is numbers. The remaining depth is in the order of the line and the Powder budget.

**Where is the player still deciding at 1e9?** This was the question I expected to fail, and it is the strongest result. In the late build the fixed bot wins 2% at R=1 and the thinking bot 32%. At R=1.5 it is 15% against 72%. Because chains need exact Powder, the thinking bot burns about three cards a turn and finishes with an attack card. Over the whole loop, a careful upgrader with a fixed fight bot takes x2.37 as long to reach 1e12.

**What is the moment the player says "wow"?** The March killing your nemesis, called out by name, with a number far above its health. The second is a completed chain where a Battering Ram lands at x81. Neither has been seen by a person yet.

**What would make someone start another trip?** The defeat report (how much health it had left, what the odds were), the Ahead row with odds per fight, the next boss and caravan, the buy buttons lighting up, and coin per minute to beat.

**Which mechanic could I cut with nothing lost?**
- *Swapping bastions in a fight for 1 energy:* the bot's win rate and damage did not move (98% against 97%). **Cut from the game.** Layout is a home decision; the Handcart card rotates the line in a fight.
- *The Magazine:* removing it also changed nothing measurable (98% in both). It stays only because it softens waste for people. It is the next thing to cut.
- *The Wheel, Charge, sockets:* tested above and below, kept. Removing sockets is x4.55.

**Should there be a junk card at all?** You were unsure, so I tried four options on the same footing:
- *Plain Deed (dead, burns for 1, opens a slot):* in an early run, two of them cost only 2 points of win rate. It was simply free power, so no decision.
- *Hold Deed (boosts the board x1.5 while held, burn for Powder):* the think-fixed gap at R=1 fell to 4 points, against 12 for the Deed. It was mostly just power.
- *Ward (stays in hand, burn to start a share-of-health tick):* burn it the first chance you get, and it scales with nothing, so it is a turn-one reflex. Rejected, and left in the data only for the test.
- *Deed that burns for nothing (shipped):* two dead cards in a mid-game pack take HP lost from 1% to 9%, a real cost. A slot pays well at first and the third or fourth is close to nothing. The win-rate differences among Deed counts are near noise (90 fights a row). **Kept, changed, on thin evidence.**

**Can you farm by marching and going home?** Yes, at first. With full bounties on marched fights the bot made trips with no fights at all and still jumped x6. Marched fights now pay a tenth. Pure march-and-go-home farming did not reach 1e9 within 200 minutes.

## What I did with your ideas and the report

| Idea | Verdict | Why |
|---|---|---|
| Enemy battler with health, intents, damage to you | Accepted | Core of the game |
| Bastions on a board with health, back to the discard when destroyed | Accepted | As asked. They also start the trip deployed (your layout), so a march can exist |
| Energy pays for cards and bastions | Accepted | |
| Powder consumed left to right, fires when full | Accepted | Layout test shows the order matters, and which order changes by enemy in the late game |
| Effects: shields, damage, poison, curses, money, card draw | Accepted | Poison halves per turn, curses are counts, money is a share of the bounty, so all three hold at any scale |
| Anvils | Changed | A card that triples another card for one fight. I did not build merging |
| Cards feed ammo | Changed | Not Powder cards. Every card can burn, at cost + 1 |
| A permanent base that generates ammo, faster over time | Accepted, changed | The Wheel, with no real time. It also powers the March |
| Victory-style junk you discard | Changed | Title Deed: dead, burns for nothing, and needed for each slot past two |
| Ward | Rejected | Measured as a reflex rather than a choice |
| Rarer, meaningful shops instead of buying any time | Accepted | Caravan every 7 fights, one card, once, at a level that scales with you |
| Real felt progress | Accepted | Nothing lost on defeat except 30% of trip coin, a power chart at home, and your old nemesis dying in the march |
| "Keep one spoil" (report) | Rejected | Spoils are gone. Bought cards stay |
| Trips from a home base, Plan B | Accepted | Bots show the stair holds |
| Trillions | Accepted | Reached by bot in about an hour |
| More slots as a permanent upgrade | Accepted | Boss rewards, each with a Deed |
| Bursts every 1 to 5 minutes | Accepted | Median 2.2, p90 5.5 |
| Swap and recall in fights (report) | Rejected | Swap measured nothing. Recall was never built |
| Level cap tied to depth (report) | Not needed | Costlier late levels and a tenth pay on the march kept the loop stable without it |
| Drop-in fight at R=5 (report) | Changed | The March, by rule, and it stops at unseen caravans and unbeaten bosses |
| Final boss near 1e15 (report) | Accepted | Fight 119 ends the story. The road goes on |
