# Feed the board, climb in forays

Blend the two genres by splitting Coinkeep's numbers into two kinds: small numbers the player decides with (energy, hand size, ammo, board slots) and huge numbers the board pays out (damage, shields, health, coin). The deck becomes the generator: cards make ammo, the board spends it left to right, and bases fire their big effects. That addresses your hollow infinite turns, because a long turn now feeds something that scales, and each base fires only once a turn, so the turn has a top instead of a loop. I recommend Plan B, "Forays": trips of about 3 to 5 minutes out from a home base, where you smash the fights that beat you last time, hit a new wall, go home, spend and go again. It is the closest match to Chef Knight's loop, it lands each burst only after you have fallen behind (the rule the toy pacing model rated most important), and a loss costs little. The catch is real: I found no game that combines a live hand with a resource-fed, auto-firing board, nobody has written up how such a game plays, and nothing in this report has been playtested. So the first job is not the rework. It is a small test of whether feed order creates real decisions, on a new `wild/*` branch.

**How to read the evidence.** A linked claim is sourced, and weak sources are named as such. **Inference** marks reasoning from those sources. **Toy model** marks results from [pacing_model_results.md](../research_notes/Deckbuilder%20incremental%20hybrid%20design/pacing_model_results.md), a throwaway script with no card rules, no enemy damage and no real player. It sizes the stair steps and does not show the game is fun. **Proposal** marks design suggestions written for this report. Every name below is a working name.

| Term | Plain meaning |
|---|---|
| Incremental game | You earn a number and spend it to make the number grow faster ([Tuts+](https://code.tutsplus.com/numbers-getting-bigger-what-are-incremental-games-and-why-are-they-fun--cms-23925a)) |
| Burst | A sudden jump in power. A bonus at an ownership threshold, such as ×2 at 25 owned, is the classic form ([Pecorella](https://www.gamedeveloper.com/design/the-math-of-idle-games-part-i)) |
| Wall | The point where progress effectively stops, such as a boss you cannot beat after upgrading ([Clicker Heroes blog](https://blog.clickerheroes.com/clicker-heroes-hero-souls-complete-guide-to-power-up/)) |
| Prestige | Giving up current progress for a permanent bonus ([Pecorella's GDC slides](https://www.slideshare.net/slideshow/quest-for-progress-gdc-europe-2016/65405507)) |
| Paradigm shift | The game changes what you are doing, not only the numbers ([Spiel et al.](https://par.nsf.gov/servlets/purl/10174274)) |
| Payload | Dominion's term for what a turn produces once the cards are drawn ([Dominion 101](https://dominionstrategy.com/2017/11/06/dominion-101-what-is-an-engine/)) |
| Gating | Holding a burst back until the player has fallen behind the challenge (toy model's term) |
| R | Your power divided by enemy health. R = 1 is an even fight, about 3 turns to kill |
| 1e12 | A 1 followed by 12 zeros: one trillion |
| Powder, Bastion, Gatehouse, Deed, Keep | Ammo, base, outpost, Victory-style junk card, and home base |

## Six findings shape the design, and the full combination has no precedent

### Nobody has shipped this exact game, so most of the evidence is analogy

True deck-and-incremental hybrids are few and small: [Feed The Void](https://barribob.itch.io/feed-the-void) (a free prototype at 4.8/5 from 597 ratings), [Card Storm Idle](https://store.steampowered.com/app/1734280/Card_Storm_Idle/) (Mixed, 51% of 111 reviews) and the jam game [Mine Cards](https://rose11.itch.io/mine-cards). [Orc Incremental](https://www.gamingonlinux.com/2026/09/orc-incremental-review-an-incremental-auto-battler-inspired-by-classic-warcraft/) drafts cards but has no real deck. I found no game where a live hand feeds an auto-firing board, and no card battler whose enemy health reaches trillions in normal play. That is a null result from limited searches, not proof.

Games with self-running fights push nearly every decision into the shop and placement between fights. Their players' strongest complaint is becoming a spectator: late [Nodebuster](https://vaporlens.app/app/3107330/nodebuster.md) turns into an AFK grind (weight 0.58 in an AI summary of Steam reviews), and one critic [stopped watching enemies altogether](https://blog.lauramichet.com/played-nodebuster/). Keeping a live hand is therefore the open space, though an untested one.

The space may be empty for a reason. [KeenGamer's Orc Incremental review](https://www.keengamer.com/articles/reviews/orc-incremental-review-a-great-horde-ruined-by-one-great-orc/) describes upgrades funnelling into one unit, every test pointing to one answer, and late chieftains becoming a rounding error. The same could happen to your hand cards if board numbers dwarf them (inference).

### Chef Knight teaches rhythm, not decisions

[Chef Knight](https://store.steampowered.com/app/4304930/Chef_Knight/) is about three hours long and has no cards. It runs timed dungeon trips, returns you to a kitchen and a large skill tree, and takes income [from hundreds to quadrillions](https://vulgarknight.com/chef-knight-review/). You become overpowered in one dungeon, then the next restarts the challenge. It held 95% positive from 1,571 English reviews when the notes were taken, and its top complaint is [being too short](https://vaporlens.app/app/4304930/chef_knight.md).

Two warnings carry over. Its largest numbers are where it breaks, with [about 2 FPS reported at the end](https://vulgarknight.com/chef-knight-review/) and [clutter hiding the character](https://steamcommunity.com/app/4304930/reviews/?browsefilter=toprated&p=1). And its dissenters say [the tree offers little real choice](https://steamcommunity.com/app/4304930/negativereviews/?browsefilter=toprated&p=1), since no paths are locked. A deckbuilder lives on exclusive choices, so copy the rhythm and not the tree (inference). No source measures its trip length or time between upgrades.

### A stair-step is a multiplier landing on a rising slope

Costs compound with every purchase while production grows only with the count, [so cost always overtakes income](https://www.gamedeveloper.com/design/the-math-of-idle-games-part-i). In plain terms, prices climb on a slope and your power climbs in jumps. After a jump you are ahead of the slope and everything is easy. Then the slope catches you, and that is the wall.

Two things differ in a turn-based game (inference). Few purchases fit in a session, so clicker-style rates are too slow: from a price of 10, reaching 1e12 takes 374 purchases at the common ×1.07 per purchase, but 37 at ×2 (arithmetic in the notes). And a wall cannot be waited out, so it needs a guaranteed way forward. [Spiel et al.](https://par.nsf.gov/servlets/purl/10174274) describe good design as having no state from which progress is impossible, and [Feed The Void](https://store.steampowered.com/app/4476320) keeps progress on a failed trial.

The toy model's clearest result concerns gating. "Free" rows land a burst on a schedule, regardless of power. "Gated" rows land one only after at least 3 fights and once power has dropped below 0.85 of the next enemy's health. All rows assume 15 seconds per turn.

| Schedule | Enemy growth per fight | Burst | Minutes to 1e12, median (p10-p90) | Minutes between bursts, median | Time at R≥2 / R 1-2 / R<1 / lost |
|---|---|---|---|---|---|
| Free | ×1.30 | ×3.6 | 34 (11-56) | 1.6 | 26 / 48 / 23 / 3% |
| Gated | ×1.40 | ×5 | 43 (39-45) | 3.0 | 24 / 47 / 26 / 3% |
| Gated | ×1.30 | ×5 | 56 (53-58) | 4.0 | 24 / 50 / 23 / 4% |
| Gated | ×1.30 | ×3 | 67 (65-68) | 3.5 | 14 / 58 / 26 / 2% |
| Gated | ×1.30 | ×4, every 4th ×12 | 53 (49-55) | 4.0 | 23 / 49 / 25 / 2% |
| Gated | ×1.20 | ×5 | 75 (71-78) | 6.1 | 25 / 49 / 25 / 1% |

Without gating, a lucky streak snowballs, and bursts can land as little as 0.2 minutes apart. The free and gated ×1.30 rows use different burst sizes, so compare their spread more than their medians. On the free ×1.30 curve, burst size alone moved time to 1e12 from 147 minutes (×1.5) to 36 (×3.5) to 9 (×5). A single overtuned multiplier can collapse the game (toy model). Developer writing agrees that [a 0.01 change in a growth factor](https://gamedeveloper.com/design/balancing-tips-how-we-managed-math-on-idle-idol) makes a large gap by the 20th upgrade.

Bigger numbers alone are probably not enough. Designers interviewed by [Spiel et al.](https://par.nsf.gov/servlets/purl/10174274) treat paradigm shifts as the story beats of these games, and meaning comes from [comparing where you are with where you began](https://code.incremental.social/thepaperpilot/pages/raw/commit/8c509e7595bdd99e827065ef8f49c8e1abece509/guide-to-incrementals/ludology/appeal-gamers/index.html), according to one community guide. No experiment compares a new mechanic with an equal-sized multiplier, and that study covered only six designers.

### Big numbers stay meaningful only as ratios

What matters is the spread of numbers inside one fight, not their size. A rule that depends only on the ratio of attacker to defender works the same at 1e3 and 1e30 (inference, with arithmetic in the notes). Literal small bonuses die at scale, as players report: [a 10% bonus gets watered down](https://steamcommunity.com/app/3147430/discussions/0/595139710753493768). Small integers survive only on resources that never inflate, such as energy, hand size and turn counts.

Flat block, the Slay the Spire model, works if both sides scale, but it has a cliff. An attack 1.5 times your block lets 33% through, and an attack 2 times your block lets 50% through. Poison breaks harder. With stacks far above fight length, [Slay the Spire's minus-one decay](https://slaythespire.wiki.gg/wiki/Poison) never matters, so the fix is decay by a proportion. At 50% per turn, total damage is bounded at twice the stacks (arithmetic in the notes).

Curve shape decides how a game ends. The `1.7^w × 1.02^(w²)` curve in the notes is a ceiling. A ×10 burst buys 2.36 waves at wave 10 and only 0.91 at wave 50, so a stair-step cannot be sustained on it unless bursts keep growing. That curve lives on your `wild/monolith` branch (`js/data.js`, line 43). I checked, and `main`'s merge mode uses `0.6 × 1.3^(w-1)`.

Health and damage can also grow at different rates. [Diablo 3's Greater Rifts](https://maxroll.gg/d3/resources/greater-rift-explained) grow health ×1.17 per level but damage only ×1.02 at high tiers. The wall becomes "cannot kill in time" rather than "dies instantly". Multiplier stacking needs a budget too: forty independent ×2 sources already make about 1.1e12, and 10 sources make 45 pairs to balance (arithmetic in the notes). [Soulstone Survivors' developers](https://steamdb.info/patchnotes/9555513) moved upgrades from multiplicative to additive for this reason (patch note read through a search snippet).

### Boards need warnings and rules, not only bigger health bars

[Star Realms bases](https://rulespal.com/star-realms/rulebook) stay in play, return to the discard pile when destroyed, and outposts must fall first. One [2014 reviewer](https://meadowparty.com/blog/2014/12/06/star-realms/?amp=1) says attack values of 8 to 10 by mid-game mean outposts rarely survive. That is a single opinion, but it is the failure to design against. In a player-versus-player game, hitting a base costs the attacker damage it could have dealt to you. An enemy has no such cost, so targeting needs its own rule (inference).

The strongest evidence favours fixed rules plus advance warning. Into the Breach's developer wanted [clear rules so that each death would feel self-inflicted](https://gamedeveloper.com/game-platforms/road-to-the-igf-subset-games-i-into-the-breach-i-), which led to telegraphed attacks. Slay the Spire's developers reportedly credit [showing enemy intent](https://readray.ai/notes/1046045) for making their game come together, though that comes from an AI-generated transcript summary. No study covers enemies targeting a player's persistent board, so this is transfer from adjacent systems.

The first-in-line feed has one known danger and one known remedy. [Factorio players](https://forums.factorio.com/viewtopic.php?p=396127) report the first turret on a belt taking nearly all the ammo (forum-level evidence). [Slay the Spire's orbs](https://slaythespire.wiki.gg/wiki/Orbs) turn overflow into a payout instead of a loss, which suggests that rules for refill and overflow matter more than any other feed choice (inference).

### Junk needs a new reason to exist

Dominion's junk works through three things together: [Victory cards do little in play](https://en.wikipedia.org/wiki/Dominion_(card_game)), hand size is scarce, and a finite supply forces a race. A game with no scoring and no race loses the reason those cards are needed. Their cost also vanishes once a deck draws itself, which is exactly when infinite turns arrive (inference).

The useful precedents give junk a job. [Tunnel](https://dominionstrategy.com/2012/11/14/hinterlands-tunnel/) pays when discarded outside clean-up, so it needs a deliberate discard outlet. Your Ward already behaves this way: `stays:true` keeps it in hand, it takes up a draw (`js/game.js`, line 893) and it works only from the discard pile (`wardTick`, line 577). [Zet Zillions](https://turnbasedlovers.com/review/one-of-the-craziest-roguelite-deckbuilders-zet-zillions-impressions/) uses Trash as ammunition and Junk as armour, the closest direct match. [Crossroads](https://dominionstrategy.com/2011/10/26/hinterlands-crossroads/) is the caution: its Victory cards hurt more than one Crossroads helps, unless they are hybrids. Clogged hands also carry a known risk, since [Retromine players](https://cicidigital.itch.io/retromine) already report full hands blocking what they need and bad opening draws deciding a run.

## Every plan shares one core: small decisions drive huge payloads

Everything in this section is a proposal built from the findings above, and none of it has been tested. The four plans in the next section differ only in structure around this core.

**Turn shape.** Draw 5 cards with 3 energy. Enemies show their intents, with target and amount. Energy pays for normal cards and Bastion cards alike. Powder cards feed the board, response cards answer the intent, and Bastion cards deploy into a slot you choose.

**The ammo feed.** Powder flows the moment a card makes it, to the leftmost Bastion that is not full and has not fired this turn. A full Bastion fires at once and empties. Each Bastion fires at most once per turn. Partial fills carry between turns. Overflow goes into a small capped Magazine that feeds first next turn, and anything past the cap is lost, with the screen showing it as wasted.

The once-per-turn limit is what turns starvation into scheduling. Take 6 Powder per turn, a left Bastion costing 3 and a right Bastion costing 10. With repeat firing, the left one fires twice each turn and the right one never fires. With the limit, the left fires every turn and the right fires on turn 4 (arithmetic in the notes).

Carry-over has a price: with nothing urgent, best ratio first becomes the solved order. So order has to stay meaningful through four things that break that answer: intent deadlines, the firing limit, buffer Bastions that must fire before payload Bastions, and exposure to attack. Powder cards also need a second mode, such as "make 3 Powder or deal damage", because a card with no alternative use is autoplay, and a hand that always plays everything means the deck is playing itself (inference).

**Enemy targeting.** The default fits one sentence: attacks hit the leftmost Bastion, and with an empty board they hit you. A Gatehouse standing anywhere takes attacks first. Some intents name you directly, so your own health still matters. A shared shield pool absorbs damage first, and damage past a Bastion's health carries to the next target, which stops worthless Bastions acting as perfect shields.

Because the leftmost slot gets Powder first and hits first, placement becomes a real trade-off. If enemies hit from the far end, the two systems stop interacting and placement solves itself (inference). Every intent needs a possible answer: shielding, swapping two adjacent Bastions for 1 energy, recalling a Bastion to the discard pile for 1 energy, killing first, or firing early.

Unavoidable loss comes from a stack of three things: a random target, damage above the target's health, and no response available. Never allow all three on a large hit (inference).

**Bastion durability.** Health persists between fights on a trip. A destroyed Bastion goes to the discard pile and comes back at full health when replayed, losing its partial fill and costing energy again. To soften death spirals, a destroyed Bastion costs 1 less energy the next time it is played. Bastion health scales with its level, and a tough class counts hits rather than damage, as [Wildfrost's Clunkers](https://wildfrostwiki.com/Getting_Started) do, so large numbers cannot one-shot it.

**Junk.** Deeds are dead in hand. They are necessary because owning a set number opens each new board slot, and each Deed raises a Standing multiplier on all payloads. So buying a Deed is itself a small burst, paid for with a permanently worse hand, which recreates Dominion's question of when to start. Anvils can merge two Deeds into one higher-level Deed, using your existing merge rule, and that is the main way to thin them.

The Ward keeps its rule: it stays in hand, takes up a draw, and needs a deliberate discard outlet. It works until the next reshuffle brings it back. Its effect should be a share of enemy health per turn, as `wardTick` does with threats today, and bosses resist it, because a share-of-health effect ignores scale and would dominate late (inference). [The Tower's elites](https://the-tower.notion.site/1bf91383b93f80b39962d0d6d4cd07a7) being immune to several of its effects is a precedent for that kind of carve-out. Enemy junk such as your Rubble lasts only for the fight or trip, following [Slay the Spire's status cards](https://slaythespire.wiki.gg/wiki/Status), so pressure never permanently damages a long-term deck.

**Enemy scaling.** Health follows `20 × g^f` with a constant g of ×1.30 per fight, with no quadratic term. A boss with 2× health arrives every 18 to 24 fights and cannot be skipped. Enemy damage grows more slowly, starting at about ×1.2, because health sets how long a fight lasts and damage sets how lethal it is. Reuse your `enrageAfter` idea: the toy model counts more than 6 turns to kill as a lost fight, so the wall is "too slow to win" more often than "one-shot".

**Keeping combat numbers meaningful.** Author every big value as a multiple of a unit tied to the current enemy, so "1 block" effectively means one unit even when shown as trillions. Aim to keep a fight's largest and smallest relevant numbers within 2 to 3 orders of magnitude, which is an assumption to test.

Block stays flat subtraction for familiarity, with hit-relative armour `A/(A+kD)` as the fallback if the cliff is too sharp. Poison decays by 50% per turn. Curses are count-based, such as "the next 2 attacks are halved". Above the tense band, numeric intents cannot threaten anything, so enemies also need rules that ignore size: drain Powder, disable a Bastion, discard, add Rubble, or a small hit per card played. Keep global multiplier buckets few and put most growth on individual cards and Bastions, so that decks do not collapse into one answer. Pay overkill in pace rather than power, such as [carry-over to the next enemy](https://raw.githubusercontent.com/Trimps/Trimps.github.io/master/config.js) or a Powder refund, because paying in power would steepen the curve.

Plain doubles are enough. Integers are [exact to about 9 quadrillion](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER) and overflow near 1.8e308. The real danger is NaN, because a comparison with NaN is always false, `hp<=0` never fires and a fight never ends. [JSON also turns Infinity and NaN into null](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify), so validate saves on load.

**Pacing target.** Aim for a burst about every 3 to 4 minutes, inside your 1 to 5 minute range, with ×5 bursts on ×1.30 enemy growth as the starting row. Gate every burst. Make every 4th one larger and rule-changing: a new slot, a new Bastion class or a new feed rule. The notes' working bands are R above 10 trivial, 3 to 10 enjoyment, 1 to 3 tense, below 1 wall, and these are guesses to replace with playtest data.

Run trivial fights through the real rules with no animation, and decide eligibility from R rather than fight number, so skipping switches off as the wall approaches. Fights in the enjoyment band should stay on screen as one-tap kills with growing overkill feedback, because a 3-second auto-resolve leaves little time to enjoy anything. [Balatro's creator](https://www.gamesradar.com/games/roguelike/after-winning-big-at-the-game-awards-and-taking-hours-of-our-time-in-2024-balatro-creator-reveals-their-most-productive-night-resulted-in-one-of-the-games-most-satisfying-features) calls its overkill flames a proudest feature.

Resolve chains first and then play back an event list, with each step lasting `min(dt, budget/n)`, so long chains stay fast and the sim and game share rules. No plan needs offline progress: [by the academic definition](https://par.nsf.gov/servlets/purl/10061230) a game with a fail state is not idle anyway, and what evidence exists on this is thin.

**Fixing the hollow infinite turn.** Your complaint matches Dominion's named pitfall: [a deck that draws itself without payload](https://dominionstrategy.com/2017/11/06/dominion-101-what-is-an-engine/) falls behind simple money decks. The code shows the rest of your diagnosis: spoils are always level one however strong you are (`js/game.js`, line 425). No source says infinite engines feel pointless, so "hollow" rests on your own experience plus inference. The fix has three parts.

First, give the long turn somewhere to land. Powder feeds Bastions whose payloads keep growing, and market cards arrive at levels tied to your depth, so the shop scales with you.

Second, close the loop rather than banning the cards. Draw stops at the bottom of the draw pile with no mid-turn reshuffle, so a turn sees the deck at most once. Each Bastion fires once, and energy refunds are capped per turn. [Slay the Spire 2's 0.100.0 beta patch](https://www.pcgamesn.com/slay-the-spire-2/patch-notes-infinites-nerfed) took a similar route, mostly removing draw and energy refunds from individual cards, which made infinites harder to set up without removing them.

Third, make the maximum turn a celebrated target. A full-board chain is a real, finite peak that you reach in the enjoyment stretch, and a cap on draw also keeps Deeds costing something at high power. On bosses only, add rules that read card counts, like [Time Eater's turn-ending after 12 cards](https://slaythespire.gg/bosses).

## Four plans put different structures around that core

### Plan A: The Long Road (one continuous climb)

**Shape.** One save and one numbered road of fights with a shop between them, ending at a final boss after two or three hours.

**A minute.** One or two fights and a quick purchase. Fights after a burst end in a turn, and fights before one take four or five.

**A session.** 20 to 30 minutes, about 5 to 7 bursts, stopping wherever you like.

**The cycle.** Bursts arrive as road milestones, held back by the gate. This is the shape the toy model actually simulated: ×1.30 growth and ×5 bursts gave 4.0 minutes between bursts and 56 minutes to 1e12.

**Losing.** You are knocked back four fights and keep a small salvage bonus (×1.5 in the toy model). Going back n fights restores R by `g^n`, so a small knock-back recovers a lot, but replay must pay or the same loss repeats.

**What persists.** Everything.

**Main risk.** The gate is a hidden rubber band, and players may notice it. You never meet old enemies again, so numbers lose their comparison. The deck is never rebuilt, so it may be solved within the first hour. "Permanent" also means little when nothing is ever taken away.

**Build effort.** Smallest on top of the core.

### Plan B: Forays (short trips, and everything you buy stays)

**Shape.** Home is the Keep. You go out, fight until you are beaten or choose to retreat, go home, spend, and go again. Deck, levels, slots and layout stay forever. Each trip starts at a "drop-in" fight where your new power gives about R = 5. Earlier fights are skipped and paid as a lump sum. You can drop in earlier if you want a longer victory lap. Boss clears set checkpoints and open slots. Damage, Powder and spoils reset each trip.

**A minute.** Two fights die in seconds with huge numbers, against enemies that recently beat you. Then comes a two-turn fight where the hand starts to matter.

**A session.** 20 to 30 minutes is about 5 to 7 trips and a rule change or two. At the toy model's pace, 1e12 arrives in about an hour. A final boss near 1e15 could close the game at two or three hours, if content holds.

**The cycle.** Spending at the Keep is the burst. The opening fights are the enjoyment. The closing fights at R below 1 are the wall. My arithmetic, on the toy model's assumptions and not a simulation: starting at R = 5 on ×1.30, you get two one-turn kills, then five fights of two or three turns, and reach your first R below 1 fight after about 3.1 minutes. The fight you lose starts at about 5.3 minutes and ends at about 6.9. So on ×1.30, a trip played all the way to defeat overshoots your 5-minute limit, while retreating once fights turn against you stays inside it. The same three marks are 1.9, 4.1 and 5.6 minutes at ×1.40, and 3.7, 8.4 and 9.9 minutes at ×1.20. The gate is built in, because a trip ends only once you have fallen behind or chosen to leave.

**Losing.** The trip ends. You keep all coin on retreat and about 70% on defeat, which is a starting guess. [Loop Hero's 30/60/100 ordering](https://www.gfinityesports.com/article/loop-hero-death-what-happens-when-you-die) is the guard: dying must never out-earn leaving. No cards are lost and no save is deleted. The screen reports the ratio, such as "needed ×3.2 more", and what the next purchase would give.

**What persists.** Everything bought at the Keep. One spoil from each trip can be kept.

**Main risk.** Repetition, and the income loop. Coin grows with depth and depth grows with power, so a mismatch between cost growth per level and power growth per level makes bursts either shrink or run away (inference). The toy model shows how sharp that is. The safety catch is a level cap tied to your deepest fight, so that spare coin cannot buy past it. The deck can also go stale, so slots and a deck limit need to force exclusive choices, and spoils should vary each trip.

**Build effort.** Medium: Keep screen, permanent profile, drop-in rule, depth-based level cap.

### Plan C: Ages (chapters ended by a chosen reset)

**Shape.** Four or five Ages of 20 to 40 minutes, the first one shorter. Each ends in a boss and adds a new rule. Beating the boss lets you Ascend: deck, levels and coin reset and numbers restart small, but you keep slots, a few heirloom cards and Renown, a slow-growing currency that multiplies everything. [Realm Grinder's prestige formula](https://www.gamedeveloper.com/design/the-math-of-idle-games-part-iii) gives a clean ladder: levels 1, 2, 3, 4 and 10 need 1, 3, 6, 10 and 55 trillion.

**A minute.** Like Plan A, but the early minutes of a later Age are noticeably faster than the same stretch in the last one.

**A session.** About one Age, which gives clean stopping points.

**The cycle.** Gated bursts inside each Age, then the largest burst at the reset. One developer's test is that [the next run should feel faster within 30 seconds](https://dev.to/aguier/i-built-7-idle-games-in-30-days-what-i-learned-about-incremental-design-5d3f), and another's advice is to [make the first reset faster than feels right](https://dev.to/tanishpaul1106/aura-data-and-prestige-designing-the-economy-of-doomscroll-2077-293f). Both are anecdotes.

**Losing.** Knock-back inside the Age, or an early Ascend for less Renown.

**What persists.** Slots, heirlooms, Renown and unlocked rules.

**Main risk.** Content cost and reset stalls. [Orc Incremental's progress stalls after rebirth](https://vaporlens.app/app/4047270/orc_incremental.md) (weight 0.40), and some [Feed The Void players](https://barribob.itch.io/feed-the-void/comments) resent forced deck resets. There are two layers to balance, and each new rule invalidates earlier tuning. It has the strongest paradigm-shift story and the freshest decks.

**Build effort.** Largest.

### Plan D: The Handover (the game takes over the playing)

**Shape.** Play starts fully manual. Each burst hands one chore to the Keep: auto-play Powder cards, auto-redeploy Bastions, draw on a timer in the style of [Mine Cards' upgradable pickaxes](https://rose11.itch.io/mine-cards), and finally real-time fights. You keep feed order, layout, the deck, a few orders per fight and manual play on bosses.

**A minute.** Early on, like Plan A. Late on, you watch the board fire and make an occasional call.

**A session.** Active at first, then shorter and heavier on planning. [Alharthi et al.](https://par.nsf.gov/servlets/purl/10061230) describe the central experience of these games shifting from playing to planning as growth goes on.

**The cycle.** A chore vanishing and the pace jumping is the burst. Watching is the enjoyment. Bosses the automation cannot handle are the wall, and they [make manual play a chance to show skill](https://par.nsf.gov/servlets/purl/10061230).

**Losing.** Knock-back, as in Plan A.

**What persists.** Everything.

**Main risk.** Spectating, the strongest complaint in this space ([Nodebuster](https://vaporlens.app/app/3107330/nodebuster.md), [Ballionaire](https://vaporlens.app/app/2667120/ballionaire.md), [BALL x PIT](https://vaporlens.app/app/2062430/ball_x_pit.md)). It also gives up the one open space, the live hand. Delegation is [a real pleasure](https://par.nsf.gov/servlets/purl/10174274), but you asked for a hand and a board that both matter.

**Build effort.** Large: a new real-time loop and more phone performance risk.

### How they compare

| | A: Long Road | B: Forays | C: Ages | D: Handover |
|---|---|---|---|---|
| Structure | One climb | Short trips from a home base | Chapters with a chosen reset | One climb that automates |
| Source of each burst | Gated milestones | Spending after each trip | Gated milestones, large one at reset | Chores removed, gated milestones |
| Is the gate built in? | No, a hidden rule | Yes, though burst size needs a cap | No | No |
| Cost of a loss | Four fights back | A short trip and some coin | Four fights back or an early reset | Four fights back |
| Deck stays interesting | Weak | Medium, with varied spoils | Strong | Weak, as the hand fades |
| Old enemies give comparison | No | Every trip | Each Age | No |
| Permanent upgrades feel permanent | Weakly | Clearly | Strongly | Weakly |
| Closest precedent | The toy model's shape | Chef Knight, [The Tower](https://apps.apple.com/app/1575590830) | Cookie Clicker, Feed The Void | Nodebuster, Orc Incremental |
| Complaint it invites | Rubber-banding, stale deck | Repetition | Stalls after resets | Spectating |
| Added effort over the core | Small | Medium | Large | Large |

### Choose Plan B, and borrow one idea each from Plans C and D

**Forays deliver your cycle by structure.** The model's most important rule, landing a burst only after falling behind, is what a trip's ending does anyway. Plan A has to impose it through a rule players may resent.

**They give big numbers a comparison.** The enemy that beat you four minutes ago dies in one turn. That is the "enjoy the power" you asked for, and it answers the finding that meaning comes from contrast. No other plan does this every few minutes.

**They make a wall a normal event.** A failed trip still pays, so a wall can never become a dead stop. You also stop deleting saves when the town falls (`js/save.js`), and permanent upgrades such as extra slots get an obvious home. This matches your only genre reference in rhythm, while the deck and hand supply the choices Chef Knight's tree lacks. One difference: its trips end on a timer, and these end on defeat or retreat.

**Borrow from the others.** From Plan C, take the rule-changing burst, every 4th burst or at each boss, without the reset. From Plan D, take only auto-resolve of trivial fights. If content later outlasts the climb, an Ages-style prestige can be added on top, because the Keep's profile already separates what persists.

**What would change this advice.** Choose Plan A if you dislike replaying fights. The two share most code, so setting the drop-in point to your deepest fight moves Forays close to the Long Road (inference). Choose Plan C if decks feeling fresh matters more to you than build size. If the feed test below fails, no plan survives as written, and the feed itself has to change.

The honest weakness: the toy model simulated a continuous road with fixed burst sizes, not trips with bursts bought by coin. My arithmetic shows matching cycle times, but it does not test the income loop, and that loop is Plan B's main risk.

## Test the feed cheaply, then build in six stages

I checked the repository as well as your description of it. `pages.yml` needs no changes: a branch named `wild/bastion` publishes to `v/wild-bastion/`, appears as "Bastion" in the Versions row, and gets its own save slot through `slotKey` (`js/game.js`, line 65). A push publishes it publicly, so hold the first push until something is playable.

Your compact formatting is confirmed in code, not only in commit messages: `fmt` exists in `js/data.js` on `wild/compound` (line 16) and `wild/monolith` (lines 15-16), and on `wild/mult` too. Take Monolith's version. Its `num` helper turns NaN into 0, which is safe for players but hides bugs, so the sim must check for non-finite values before that happens.

| Stage | What gets built | Where | Move on when |
|---|---|---|---|
| 0. Branch | `git switch -c wild/bastion main`, kept local for now | Git | Branch exists |
| 1. Feed test | One fight with about 10 cards, 5 Bastions and 4 intents, no UI, plus a small script for the R table in log values | New DOM-free `js/battle.js` and `sim/feedtest.js` | See below |
| 2. One playable fight | Hand, board, Powder gauge, intents, event-list playback, first push | `index.html`, `js/ui.js`, `css/style.css`, `js/versions.js` unchanged | You hesitate on real choices at phone size. Seconds per turn is measured and replaces the toy model's 15 |
| 3. Big numbers | Monolith's `num` and `fmt`, values authored as multiples of a tier unit, one damage path, tabular digits | `js/data.js`, `js/battle.js`, `css/style.css` | Sim runs to 1e15 with no non-finite value |
| 4. Forays and the Keep | Scaling market, levels, depth-based cap, drop-in rule, permanent profile under `slotKey('coinkeep.profile')`, separate from the trip save, with `Number.isFinite` checks and a rewritten `loadGame` | `js/game.js`, `js/save.js`, `js/ui.js`, `js/data.js` | A profile survives a loss and a reload |
| 5. Bots and metrics | New bots in `simRun`, updated `BOTS` and `--mode` lists, ratio-based reports | `sim/bots.js`, `sim/sim.js` | Burst spacing and R-band shares sit near target |
| 6. Content and people | Deeds, Wards, Gatehouses, 8 to 10 Bastions, rule-changing bursts, first outside playtests | `js/data.js`, `js/game.js` | Outside players start another trip unprompted |

Worth reusing: `mdef` cards with `eff(X)` levels, Anvil merging, the Ward's `stays` flag, Rubble, seeded randomness, and `sim/bots.js`'s ui.js stand-ins, which already let game logic run with no DOM.

**The cheap test comes first because the feed is the riskiest idea.** The notes call the absence of any design discussion of a deck feeding a board their main evidence gap. If order is solved or the hand is autoplay, the rest of the rework is wasted.

Stage 1 compares three bots across fights set at R of 0.7, 1, 1.5 and 3. A `fixed` bot sets best ratio leftmost, never reorders and plays Powder first. A `reader` bot reads intents, looks one turn ahead, and reorders and recalls. A `random` bot sets the floor. This is the [ladder of bots at different skill levels](https://arxiv.org/abs/1908.01423v1) and [restricted-play comparison](https://cdn.aaai.org/ojs/12513/12513-52-16035-1-2-20201228.pdf) from published work, which frames such testing as an early warning system and not a replacement for people.

Starting pass marks, all of them guesses: in the tense band, `reader` takes at least 20% less damage or kills at least 20% faster than `fixed`, no single layout wins more than about 60% of the time across enemy sets, and the best layout changes when the enemy changes. Use fixed seeds across variants. Run the feed both ways, with Powder flowing immediately and in a batch at end of turn.

If the test fails, escalate in this order: add neighbour effects, then enemies that target positions, then let the player aim Powder by hand. That last step drops the automatic left-to-right rule, so it would be your call.

**Metrics for stage 5.** Report these per fight and per burst: R distribution (p10, p50, p90) for each bot, turns to kill against turns to die, time to next upgrade, share of time in each R band, share of final damage from the largest source, power lost when each source is removed, the largest and smallest relevant numbers in each fight, and the top 10 outlier runs rather than only averages.

Add a bot that bans the top-damage card, one that makes a bad pick (how many fights does one mistake cost?), and a retreat-policy sweep. Compare coin per hour between dying early and retreating, so that losing on purpose never pays. Compare card strength by point of acquisition, since [late-acquired cards can look stronger than they are](https://briefread.pages.dev/en-GB/summary/slay-the-spire-metrics-driven-design). Bots have no sense of time, so convert to minutes with the measured seconds per turn and report the result as an estimate.

## Your decisions, and what remains unproven

**Decisions for you, with my default in brackets:**

1. Which plan? (B, Forays.)
2. Does the game end? (Yes, a final boss near 1e15 at two to three hours. "Too short" did Chef Knight little harm, whereas grind complaints are worse.)
3. How much does a defeat cost? (Keep about 70% of the trip's coin, 100% on retreat.)
4. Do cards found on a trip stay? (Keep one per trip, the rest are temporary.)
5. Does Powder flow at once or at end of turn? (At once, because base-fired draw and energy then create choices mid-turn. Test both.)
6. How much enjoyment do you want? (×5 bursts, about 24% of time at R≥2 in the toy model, with ×12 every 4th. Bigger bursts mean longer enjoyment.)
7. What does "curse" mean on a Bastion? (A count-based weakening of enemy attacks, not junk added to an enemy deck.)

**What remains unproven.** Nothing here has been played by anyone, and no simulator has run these rules. The notes state plainly that the toy model does not cover whether feed order creates decisions, whether enemy damage against bases works, how long a real turn takes on a phone, how long the enjoyment stretch must be, or anything about fun. Whether a hand stays meaningful beside a growing board is the core open question. Every starting number in this report is a guess: ×1.30, ×5, the R bands, the 2-to-3 order spread, 70%, 20%.

| Area | Specific limit in the evidence |
|---|---|
| Blocked sources | Reddit was largely unreachable, so r/incremental_games, r/roguelites and r/slaythespire appear only through mirror snippets or not at all. Fandom wikis, poewiki and Bulbapedia blocked reading. The NGU Idle and Melvor wikis blocked access. The DominionStrategy wiki is bot-gated, so its Curse, Ruins, Greening and Golden Deck pages were excerpts only. GDC Vault is members-only, so the Slay the Spire talk comes from secondary summaries. Quantic Foundry and a Subpixel post returned HTTP 403. SteamDB was read by snippet. Steam tag searches could not be read |
| Closest precedent unconfirmed | A search result described an idle game using Dominion-style deckbuilding, but marywdev.itch.io returned 404, so its title and contents are unknown. Most of itch.io's 109 and 178 relevant tag results were not inspected |
| Thin pacing evidence | No well-regarded game publishes a target for minutes between upgrades. The 3-to-5 minute figure comes from one developer's small games. There is no data on enjoyment-to-wall ratios or tolerable wall length, and no measured Chef Knight trip length or upgrade interval. Your 1-to-5 minute target is reasonable but is not validated by any source |
| Weak source types | Vaporlens figures are AI-generated summaries of Steam reviews, and their weights show relative mentions, not percentages. The Slay the Spire intent claim comes from an AI-generated transcript summary. The Star Realms outpost criticism is one 2014 opinion. Factorio evidence is forum-level. The psychology is largely qualitative: Spiel interviewed 6 designers, and Deterding says his motive reading rests on his own play |
| Missing topics | No source covers turn-based incremental design, enemy targeting of a persistent board, or a deck feeding a board. No source says Dominion's infinite engines feel hollow. No comparison of fail states on retention was found |
| Chef Knight conflicts | Sources disagree on stages per dungeon (three or four), on whether enemies pose danger, and on post-game play. A rebirth system appears only at low weight and is unconfirmed |
| Aging data | Slay the Spire 2 sources date from about March to April 2026 and it is in early access. The Bazaar's values change by patch. Pending Steam versions of Feed The Void and Retromine could close the gap described here |
| Technical | The big-number libraries were not benchmarked: the figures come from a stand-in on a desktop, and low-end phones are unmeasured. Mobile `localStorage` limits were not researched. Plain doubles avoid the question for this plan, but Chef Knight's peak-moment slowdown shows phone testing cannot wait until the end |

## Conclusion

Your two wishes turn out to be one problem. Infinite turns felt empty because nothing could absorb them, and trillions feel empty when nothing compares them, so both are solved by giving output a place to land and giving it an old enemy to be measured against. The research also reverses the usual view of losing: in a turn-based incremental, where a wall cannot be waited out, a cheap and regular defeat is the pacing mechanism and not the failure of it. Whether all of that survives contact with a real hand of cards is what the feed test exists to find out, and it can answer before the rework costs you much.
