# Spellkeep: design

Spellkeep is classic Coinkeep turned into a wizard game around one idea: **leftover Mana is your multiplier**. In classic Coinkeep, villages (+Actions) were dangerous because a deck that never runs out of Actions breaks the game. Here we lean into that. Cards may hand out lots of Mana, because the Mana you don't spend multiplies your damage, and you will need that multiplier.

## Version 2: no market

The first version kept Dominion's market: Arcana from cards, six cards for sale, buy at any point in your turn. In play that made new cards unexciting. You could buy something almost every turn, the market refilled, and one run showed you the whole card pool. Version 2 removes the market and Arcana:

- **One new card per win.** After each win, pick 1 of 3 cards, as in Slay the Spire, or take none.
- **Rarity.** Cards are common, uncommon or rare. Foes roll 62/31/7%, Elites 35/50/15%, and a Boss always offers a rare (the other two are 60% uncommon). Later circles offer higher tiers (Firebolt+, Firebolt++…).
- **Raise instead.** After an Elite or a Boss you may instead raise a card you own one tier. Offered after every win, the bots took raises twice as often as new cards, so it's limited to the bigger fights.
- **Half your unspent Mana carries over** to the next turn (rounded down). See "Why carry-over" below.
- **A fight ends the moment the foe falls.** No Arcana to collect, so no cleanup turn.
- **Twincast doesn't compound.** A second Twincast keeps only the larger echo, and Amplify is always ×2 (upgrades add Mana first).

## Version 2.1: clearer boosts, fairer Bosses, choices you can take back

From the first human play of version 2: the game is better without the market, but Bosses felt uneven, Twincast seemed not to work, and a stray click could throw away a reward.

- **Twincast is +1 ✦, then "your next card resolves twice".** It worked before, but paying its 1 ✦ lowered the multiplier, so "twice" looked like ×1.3 (a Zap at 3 ✦ went from 9 to 12). Now it pays for itself and twice really is twice (9 → 18). Its runs now win the most fights of any card for the mage bot.
- **Boosted cards say so.** While Twincast, Empower, Twin Wand or Owl's Eye will act on the next card, every card in hand it would change glows and carries a gold seal (**2× cast**, **×2 dmg**, or both), and each line it changes shows its factor (*Deal 3 ×2*). The ⚔ preview already included it. The log says when a card was cast twice.
- **Null Rift's cap grows: 10 ✦ per circle** (10, 20, 30…). A flat 10 was fair in circle 1 (71% beaten) and almost unbeatable late (10% in circles 6–8). Now 80 / 67 / 41%.
- **Bosses have a health factor** (`hp` in `BOSSES`): Time Djinn ×0.8, Bookworm ×1.15. Over 300 mage-bot runs, Boss win rates went from 23–74% to 56–73%.
- **Every reward choice can be taken back.** Raising a card shows the card before → after once you pick it, and has **Back to the spoils**. Relics are picked, then confirmed (**Take Glass Wand**); letting a relic go when your slots are full has **Back**. Each Sanctum rite has **Back to the Sanctum**, and Purge and Transcribe need a card (no silent skip). Skipping a card reward or a relic takes two taps.
- Twincast on a Mana Rune now gives both runes' Mana (it used to keep only one).
- Overlays (your deck, rewards) scroll from the top, so a long deck is no longer cut off above the fold, and their buttons stay on screen while you scroll.

## Version 2.4: more ways to win than "all Mana, then all Zaps"

A human run on the older version played almost every turn as Channel, Channel, Channel, then Zap, Zap: gain all your Mana first, then spend it on damage. The rules make that the default because Mana multiplies every later hit. These cards reward something else: the state of your hand, the size of your deck, or a long fight.

| Card | Rarity | Text | Rewards |
|---|---|---|---|
| 🌊 Ebb Tide | uncommon | +1 ✦ for each card fewer than 5 in your hand | Mana that's better **late** in a turn: as your last card, +5 |
| 🗡 Last Word | uncommon | Deal 6 for each card fewer than 5 in your hand | a finisher: as your last card, Deal 30 |
| 🔔 Resonance | rare | Your next spell hits × the cards left in your hand; once per fight | playing it **early**, with a full hand |
| 📚 Bibliomancy | uncommon | Deal 1 for each card in your deck | a **big** deck, instead of a thin one |
| 🔷 Focus Rune (reworked) | uncommon | Every hit deals +3 this fight; +3 more at the start of each turn | casting it early in a long fight, and **multi-hit** spells (Magic Missiles, Chain Lightning) |

"Cards in your hand" counts the hand after the card has left it. Spellstorm (Deal 3 per other card in your hand) already did the "more cards in hand" job for damage, so Resonance multiplies instead: Spellstorm, Resonance and Ebb Tide or Last Word pull the same turn in opposite directions.

Focus Rune was +2 a hit, which barely moved a Zap at 5 ✦ (15 → 25) and did nothing for a Wild Magic turn. Now it grows: cast on turn 1, every hit deals +12 by turn 4.

Resonance was tried without "once per fight": a ×4 Empower for one card was the bots' favourite pick and raised the mage bot's circle-8 rate from 28% to 35%. Once per fight it's 32% and 36% on two seeds (28% and 35% without the new cards), within noise.

## Version 2.3: Chain Lightning, a fairer Thief, starting cards worth raising

- **Chain Lightning deals 5 once for each card already played this turn**, Mana cards included, as separate hits. Play Channel, Ponder, then Chain Lightning: two hits. As a multi-hit spell it loses only one hit to the Wraith, and the Mirror Knight counts the hits together.
- **The Goblin Thief steals from your draw pile**, not your hand, at the start of each turn, before you draw. You see what it took, and your hand is always full.
- **Raising a starting card is now a real choice.** Each tier of these grows far more than other cards:

  | | Base | + | ++ | +++ |
  |---|---|---|---|---|
  | Zap | Deal 3 | +2 ✦; Deal 10 | +2 ✦; Deal 15 | +2 ✦; Deal 20 |
  | Channel | +2 ✦ | +5 ✦ | +8 ✦ | +11 ✦ |
  | Ponder | +1 ✦; +1 Card | +2 ✦; +2 Cards | +3 ✦; +3 Cards | +4 ✦; +4 Cards |

  Zap+ pays for itself (+2 ✦ before its 1 ✦ cost), so it strikes with a higher multiplier than Zap ever could. Channel and Ponder offered as rewards use the same table, so those commons are worth taking now too.
- **Health grows ×1.7 a fight, not ×1.65**, to pay for all of that. Chain Lightning and the Thief moved the mage bot from 30% to 39% of runs beating circle 8, and the starting cards to 43%. At ×1.7 it's 28% (13.3 fights won), where it was before.

## Version 2.2: Bosses that don't end runs unfairly, and Wither

- **Mirror Knight judges a multi-hit spell by its total.** Magic Missiles' three hits used to be checked one by one against "a fifth of its health", so they always glanced off. Now 3 × 9 counts as 27. Single small hits still glance. Its health is ×1.15 to make up for it.
- **Wraith** is unchanged: only the first hit of each turn passes through, so a multi-hit spell loses its first hit and the rest land. Its text now says so.
- **Bog Witch's Curses no longer stay in your deck.** They used to be shuffled into the deck for good: one Witch fight could leave you up to ten dead cards for the rest of the run. Now Curses can be played for 1 ✦ to dispel them and draw a card, and every Curse vanishes when the fight ends. Still 2 a turn. Mage-bot win rate against her: about 60%, in line with the other Bosses.
- **New card: Wither** (uncommon, 🥀). Deal 0.5% of the foe's *current* health per ✦: at 4 ✦ that's 2%. Your ✦ sets the percentage rather than multiplying the damage again; Empower, Hex, Twincast and damage relics still apply, Focus and +damage don't. Each tier adds 0.25% (Wither+ 0.75%, Wither++ 1%), not the usual ×1.5, because rewards climb a tier a circle and a 2–4% Wither killed late Bosses at 25–50 ✦.

  Wither is a late-game Boss killer: it ignores how fast health grows. With it in the pool the mage bot beats circle 8 in about 30% of runs, against about 23% without it (three seeds × 300 runs); fights won barely change (13.5 → 14). If that's too much, "once per fight" brings it down a few points.

## The rules

| | Classic Coinkeep | Spellkeep |
|---|---|---|
| Money | Coin, spent the same turn | none |
| Actions / Energy | +Actions to play Actions; Treasures free | **Mana ✦**: every card costs 1; 3 each turn plus half of what you didn't spend |
| Leftover Actions | wasted | **the damage multiplier**, and half of it carries over |
| Enemies | several threats demanding coin, Actions, Buys | **one foe** with health, beaten within 5 turns |
| New cards | buy from the market | pick 1 of 3 after each win |
| Starting deck | 7 Copper, 3 Shack | 6 Zap (Deal 3), 3 Channel (+2 ✦), 1 Ponder (+1 ✦, +1 Card) |

**Resolution.** A card's lines resolve top to bottom, then you pay its 1 ✦. Every hit deals its number × the ✦ you hold at that moment (never less than ×1). So with 3 ✦ a Zap deals 9, the next 6, the next 3.

**Sequencing.** That rule makes order the main decision, at three levels:

1. *Inside a card.* Surge is "+3 ✦, then Deal 6": it hits with the new Mana. Wild Magic is "Deal 12, then +3 ✦": a bigger number, but it hits before the Mana arrives. Fireball is "Deal 22, then −2 ✦": cast it last.
2. *Inside a turn.* Mana cards first, then big spells while ✦ is high, then cheap ones. Draw costs a Mana now to find cards. Empower, Hex and Twincast change the next card. Cataclysm deals 2 per ✦ *and* is multiplied by ✦, then drops you to 1.
3. *Across a fight.* Unspent Mana half carries over, so every card is also a question of now or later. Burn is multiplied once, when applied, then ticks every turn for the rest of the fight. Runes last the fight. Meteor is once per fight.

**Run shape.** 8 circles, each a Foe, an Elite (×1.5 health) and a Boss (×2.2 health, plus a curse on the rules). Health grows ×1.7 a fight. Beat the 8th Boss to win, then play on into endless circles if you like. 3 hearts: a foe still standing after its last turn costs one. Elites and Bosses offer a relic (5 slots). After a Boss, the Sanctum offers one rite: purge 2 cards, raise one a tier, copy one, or recover a heart. Each circle's Boss is announced at its first fight.

## Why carry-over

Removing the market fixed the cards, not the clock. With a thin deck you see every card you own by turn 3, and damage arrives in one big combo turn, so a fight was decided by whether that turn came. Raising health didn't make fights longer. It only turned wins into losses: at every health growth and every fight length tried (3, 4 or 5 turns), about two-thirds of won fights still ended on turn 1 or 2.

Carrying Mana over is what the original pitch described ("all leftover mana is converted into a multiplier"). It gives the turns something to build: spend now, or save toward a bigger turn before time runs out. Full carry-over made it too strong a ramp (the first foe always fell on turn 5 after four turns of saving); half is the middle.

How fights end, mage bot:

| | Turn 1 | 2 | 3 | 4 | 5 | Lost |
|---|---|---|---|---|---|---|
| Version 1 (market) | 35% | 33% | 13% | 6% | 4% | 9% |
| Version 2 | 19% | 20% | 14% | 13% | 16% | 18% |

## Cards

Every card costs 1 ✦.

| Card | Type | Rarity | Text (top to bottom) |
|---|---|---|---|
| Zap | Spell | starter | Deal 3 (raised: +2 ✦; Deal 10, 15, 20…) |
| Channel | Mana | common | +2 ✦ (+3 ✦ a tier) |
| Ponder | Mana | common | +1 ✦; +1 Card (+1 of each a tier) |
| Ley Line | Mana | common | +1 Card; +2 ✦ |
| Study | Mana | common | +3 Cards |
| Clear Mind | Mana | common | +1 ✦; discard any, draw that many |
| Banish | Mana | common | Banish up to 2 cards from your hand |
| Firebolt | Spell | common | Deal 7 |
| Magic Missiles | Spell | common | Deal 3, three times |
| Frostbolt | Spell | common | Deal 5; +1 Card |
| Siphon | Spell | common | Deal 4; +1 ✦ |
| Ignite | Spell | common | Burn 1 (×✦ when applied, ticks every turn) |
| Wellspring | Mana | uncommon | +4 ✦ |
| Familiar | Mana | uncommon | +2 Cards; +1 ✦ |
| Twincast | Mana | uncommon | +1 ✦; your next card resolves twice |
| Surge | Spell | uncommon | +3 ✦; Deal 6 |
| Wild Magic | Spell | uncommon | Deal 12; +3 ✦ |
| Fireball | Spell | uncommon | Deal 22; −2 ✦ |
| Chain Lightning | Spell | uncommon | Deal 5 once for each card already played this turn |
| Spellstorm | Spell | uncommon | Deal 3 per other card in your hand |
| Conflagrate | Spell | uncommon | Deal damage equal to the foe's Burn |
| Hex | Spell | uncommon | Foe takes +50% damage this turn; +1 ✦ |
| Empower | Spell | uncommon | +1 ✦; your next spell hits ×2 |
| Focus Rune | Rune | uncommon | Every hit deals +3 this fight; +3 more at the start of each turn |
| Ebb Tide | Mana | uncommon | +1 ✦ for each card fewer than 5 in your hand |
| Bibliomancy | Spell | uncommon | Deal 1 for each card in your deck |
| Last Word | Spell | uncommon | Deal 6 for each card fewer than 5 in your hand |
| Resonance | Spell | rare | Your next spell hits × the cards left in your hand; once per fight |
| Amplify | Mana | rare | Double your ✦ |
| Cataclysm | Spell | rare | Deal 2 per ✦, then ✦ drops to 1 |
| Wither | Spell | uncommon | Deal 0.5% of the foe's current health per ✦ |
| Meteor | Spell | rare | Deal 45; once per fight |
| Mana Rune | Rune | rare | +1 ✦ at the start of each turn this fight |
| Curse | Curse | — | Dispel this Curse; +1 Card (Bog Witch; all vanish when the fight ends) |

Spellstorm, Conflagrate, Frostbolt, Siphon and Ponder are new in version 2.

## Bosses

| Boss | Curse | Counters |
|---|---|---|
| Bog Witch | 2 Curses shuffled into your draw pile each turn (1 ✦ to dispel; gone after the fight) | thin decks |
| Ogre King | draw 1 fewer card | everything, gently |
| Snow Queen | your finest card is frozen for the fight | one key card |
| Bookworm | cards your spells draw are eaten (4 a turn; health ×1.15) | draw engines |
| Null Rift | ✦ can't rise above 10 per circle | Mana engines |
| Time Djinn | 3 turns, not 5 (health ×0.8) | slow ramps |
| Wraith | the first hit each turn does nothing (just the first of a multi-hit spell) | one big hit a turn |
| Ancient Dragon | heals 20% each turn | slow decks |
| Goblin Thief | steals a random card from your draw pile each turn, for the fight | small decks |
| Toll Golem | discard 2 cards each turn | big hands |
| Iron Bureaucrat | every card costs 2 ✦ | wide decks |
| Mirror Knight | spells dealing under a fifth of its health do nothing; a multi-hit spell counts its total (health ×1.15) | many small hits (Burn still works) |

## Relics

Wide Sleeves (+1 hand), Mana Crystal (+1 ✦ a turn), Silver Clasp (rewards offer 4 cards), Focusing Lens (+2 a hit), Quicksilver (+2 ✦ on each fight's first turn), Scholar's Quill (reward cards one tier higher), Ember Heart (Burn ×2), Leyden Jar (all unspent ✦ carries over, not half), Overflow Sigil (unspent ✦ strikes at end of turn), Twin Wand (first card each turn twice), Owl's Eye (first spell each turn ×2), Ascetic's Bead (×2 damage with 12 cards or fewer), Hourglass (6 turns), Crescendo (+1 a hit per card played), Philosopher's Stone (Sanctum rites twice), Glass Wand (damage ×3, one turn less), Archmage Staff (Mana cards +1 ✦), Old Grimoire (damage grows with each Boss beaten).

## Balance tests

`node sim/sim.js`, 100 seeded runs per bot (version 2.1). Only bots and one person have played it, so this is a calibration, not a verdict. The one human log so far (version 1) beat the best bot on every Boss, so the target is set a little above the bot.

| Bot | Fights won (of 24) | Beat circle 8 |
|---|---|---|
| mage: looks ahead over every order of its hand | 13.7 (median 14) | 24% |
| burner: Burn and big spells | 11.2 | 9% |
| naive: picks cards like mage, casts in a random order | 6.5 | 3% |
| random | 2.4 | 0% |

**Sequencing is still the skill.** Mage and naive pick the same cards and differ only in casting order: 13 fights won against 6.

**New cards matter.** The mage bot takes about 10 new cards and 3 raises a run and ends with an 18-card deck.

**The clock bites.** For the mage bot the first foe falls on turn 4.7, the first Elite on 3.6, the first Boss on 3.9 (67% won). In circles 3–4 fights take 2.5–3 turns. Late fights are still short for runs that get there: those are the decks whose engine broke, and the decks that didn't break are already dead. Balatro's late game works the same way.

**Bosses** (mage win rate, version 2.1, 100 runs): Time Djinn 51%, Snow Queen 51%, Bog Witch 59%, Iron Bureaucrat 62%, Bookworm 64%, Toll Golem 68%, Ogre King 69%, Null Rift 71%, Wraith 77%, Ancient Dragon 79%, Mirror Knight 81%, Goblin Thief 86%. At 300 runs the spread is narrower (56–73%): the easy end moves around from sample to sample. In version 2 Null Rift was 30%, and 10% in circles 6–8.

**Still lopsided.** Amplify, Cataclysm and Meteor are the most-taken cards and runs that find them win more; once a deck doubles its Mana every turn, late fights end with 10–100× overkill. Commons (Channel, Ponder, Clear Mind, Ley Line) are almost never taken over an uncommon. Mana Crystal and Silver Clasp are the weakest relics. These are left alone until a human log says whether the runaway late game is fun or a problem.

**Tuning history.** Version 1: health 24 × 1.48 a fight → 45 × 1.43, Bosses sharpened; the human player still killed most foes on turns 1–2 from circle 2. Version 2: tried 3-, 4- and 5-turn fights at growth 1.45 to 1.6 without carry-over (no change in when fights end), then full, half and no carry-over at growth 1.45 to 1.85. Snow Queen (2 cards frozen) and a Goblin Thief that stole your best card were brutal in thin decks and were softened; Time Djinn went from 4 turns to 3.

## Open questions

- **Is half carry-over fun?** It's the main new decision and no person has tried it. The alternative is to keep Mana resetting and accept that fights are decided by the combo turn.
- **Late circles stay short** for decks that break. More Bosses that counter a broken engine (like Null Rift) would push back without punishing everyone else.
- **A Balatro-style shop** could come back as a small stop after each Boss, selling relics. It would need a currency, and Arcana was removed to keep cards scarce.
- **The card pool** is 33 cards. Rarity hides the rares, but a few runs will show every common.

## Look

A wizard's tower at night: a starfield behind everything, parchment cards with a band coloured by type (red spells, blue Mana, violet runes) and their rarity on the type line (rares glow), the Mana cost as a blue wax seal, the foe in a slowly turning summoning circle, and a Mana orb whose glow grows with the multiplier and which shows how much Mana will carry over. Fonts are Cinzel (titles) and Alegreya Sans (text). The discard pile is "Spent", and the icon is a wizard's hat.
