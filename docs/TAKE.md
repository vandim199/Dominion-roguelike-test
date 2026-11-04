# Coinkeep: Forays (Claude's take)

## Pitch

You run a Keep that owes everyone money. You go out on short forays. Your hand makes Powder, the board burns it from left to right, and each Bastion that fills fires once a turn for a huge number. Energy, hand size, Powder and fill costs stay small forever, so a turn at 1e9 asks the same small question as a turn at 100: which three of these five cards, with that attack coming at that slot? When the road beats you, you go home, spend what you carried, march back through the thing that beat you in one shot, and walk into the next wall a few fights further on.

## A minute and a session

**A minute.** Early in a trip you tap one card, three Bastions go off in a row, and the enemy that beat you ten minutes ago is gone with "Overkill ×40" on screen. A minute later the odds chip has fallen under ×1.5. The enemy says it will hit your leftmost Bastion for more than its health, then dodge your first hit next turn. You have 3 energy, a Deed stuck in your hand and one free swap. You think.

**A session.** About 20 minutes is 3 to 5 trips of 3 to 6 minutes each. At home you spend coin and watch the rematch odds climb with each purchase, then go again. Every 15 fights a boss stops you until you can beat it, and it pays a Crest that buys a rule change such as +1 energy. The whole climb to 1e12 takes about 68 bot-minutes.

## Decision log

These are the questions that changed the design, with what the bots said. Numbers before the final tuning come from smaller runs, so treat them as direction, not results. `docs/RESULTS.md` holds the final numbers.

**1. Does the feed create decisions at all?** The report's rules failed the first test. A fixed "Powder first" routine matched the search bot at R 1 (100% against 100%, 17% less health lost at best, and negative at other ratios). Options: raise enemy damage, add neighbour effects, or give the player a reason to reorder every turn. Raising damage alone changed nothing. I then swapped the search bot for one that plays each option out to the end of the fight, to rule out a bad bot, and it gained at R 1 only (92% against 71% wins, in a small run with harder enemies) and nothing at R 0.7 or 1.5. So the rules had to change.

**2. How do I make board order a live choice, not a setup choice?** Options: a valve to skip a Bastion (aiming by hand, the report's last resort), neighbour effects, or cheaper swaps. I chose one free swap a turn. Swapping changes who is fed first and who is hit first at once, and it keeps the automatic left-to-right rule from your brief. I also added two scale-free intents that punish autopilot: Hunker (takes a quarter damage next turn) and Dodge (the first hit next turn misses, so fire something small first). Without swaps the thinking bot now loses about 2.5 to 3 times as much health.

**3. Which mechanic can be cut with nothing lost?** The Gatehouse "must fall first" rule from Star Realms and the report. While it existed, a Gatehouse anywhere made the left end safe, so the most valuable Bastion always went first: one order was best against 7 of 8 enemies. I cut it. Attacks now simply hit the left end, and the Gatehouse is a Bastion that counts hits instead of damage. The thinking bot's edge jumped from about 6% to about 60% less health lost, and the same-order share fell to 4 of 8 in that run. This was the biggest single improvement.

**4. Per-card levels or shared tracks?** The report and brief imply each card levels up. The careful bot funnelled everything into one Bolt Tower. New Bastions arrived a few levels behind, and with ×1.87 a level that made them worthless, so six-slot boards sat with two Bastions. I replaced item levels with three shared tracks: Gunnery, Masonry and Walls. Every card and Bastion reads from them, so all numbers climb together, a new piece is useful on arrival, and the ratio of hand cards to Bastions never drifts. It also cut the shop from about 20 rows to 3. Standing and Temper apply to cards as well, so a Sledge is still a real number at 1e12.

**5. Why would I ever buy a third Bastion?** With 7 Powder a turn, two Bastions drank it all. I raised starting Powder (Cartridge +4, Flint +2) and lowered fill costs, so a new deck overflows and the board visibly wants more. Firings per turn rose from 1.5 to about 3 on the main run.

**6. What stops the income loop running away?** Bursts of ×50 appeared whenever price growth matched power growth. Steeper prices alone made the game grind to a halt late (a stall near 1e7 at ×2.35 a level). What works is an odds gate: Gunnery stops once your odds at the next new fight reach ×2.5. Going deeper lifts the gate. This is the report's depth cap, but written on measured power, so it needs no retuning as boards grow.

**7. Can a wall become permanent?** Yes: in one test, a tighter level cap with stronger bosses left the bots unable to reach 1e12 at all. So each defeat without new ground raises the gate by ×1.5 (Grit). Retreats do not count, so it cannot be farmed safely.

**8. What would make someone avoid the interesting fights?** The bots found that leaving early was much faster, because close fights take many more turns than easy ones while paying only ×1.3 more. I tried three fixes together: a forced march (always start at least 4 fights behind your deepest, which is also the "enjoy your power" stretch and a tax on tiny trips), a tighter gate, and double pay for winning at odds under ×1.5. Dying is now the slowest policy, as the report asked. **Not fully solved:** a bot that only fights at R 2.5 or better still reaches 1e12 about 24% sooner (see Results).

**9. Do Deeds earn their place?** A Deed sticks in hand, like your Ward, until you pay 1 energy to file it. It pays rent, adds ×1.6 Standing and opens slots. A bot that never buys one takes 530 minutes to reach 1e12, against 68. So they are necessary junk, as you asked. Charters merge two to thin the deck. The careful bot rarely bothers, which may mean they are underpriced junk or just a limit of how it measures power.

**10. What is the "wow"?** Playing one Keg and watching Bellows, Anvil and Bombard fire in a row, for a number bigger than the enemy, with the overkill banner growing. In the browser check, one Powder Keg triggered three firings for 132B against a 4B enemy.

**11. Where is the player still deciding at 1e9?** In the same place as at 1e3. The thinking bot's edge is about equal at level 8 and level 30 (67% and 69% less health lost at R 1).

## Kept, changed, cut

| Item | Verdict | Why |
|---|---|---|
| Forays: home, trip, wall, spend | Kept | The whole loop works; defeat costs 30% of the trip's coin only |
| Energy, Powder, left-to-right auto-feed, once-a-turn firing | Kept | Immediate and end-of-turn feed tested about equal; kept immediate because mid-turn draw needs it |
| Part-fills, Magazine, visible waste | Kept | |
| Bastions fall to the discard pile, 1 cheaper to replay | Kept | |
| Sticky junk (Ward rule) | Kept, widened | One rule now covers Deeds, Wards and Rubble |
| Poison halving, count-based curses | Kept | |
| Crests and rule-changing Works | Changed | Report's "every 4th burst" became "each boss" |
| Enemy health ×1.30 per fight, final boss near fight 105 | Kept | The final boss has about 3.5e13 health, and all 8 main-run seeds beat it |
| Enemy damage growing slower than health | Changed | Equal growth, otherwise late fights stopped being dangerous |
| Per-card levels | Cut | See 4; shared tracks instead |
| Gatehouse taunt | Cut | See 3 |
| Lump sum for skipped fights | Cut | Enter, retreat, collect was an exploit, and low fights are worth almost nothing anyway |
| Hit-relative armour fallback | Not needed | Flat shields held up in the tests |
| Drop-in at R 5 | Changed | R 9, and at least 4 fights behind your deepest |
| Offline progress, deck limit | Left out | Draw dilution already limits the deck; bench lets you trim |
| Boss rule reading card counts | Left out | Bosses use seizing, reversed targeting and a Powder toll instead |
| New: Haul, close-fight pay, Grit, Auto turn at odds ×2 or better | Added | Pressing on pays; no wall is permanent; easy turns are quick |
