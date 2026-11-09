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

**Run shape.** 8 circles, each a Foe, an Elite (×1.5 health) and a Boss (×2.2 health, plus a curse on the rules). Health grows ×1.65 a fight. Beat the 8th Boss to win, then play on into endless circles if you like. 3 hearts: a foe still standing after its last turn costs one. Elites and Bosses offer a relic (5 slots). After a Boss, the Sanctum offers one rite: purge 2 cards, raise one a tier, copy one, or recover a heart. Each circle's Boss is announced at its first fight.

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
| Zap | Spell | starter | Deal 3 |
| Channel | Mana | common | +2 ✦ |
| Ponder | Mana | common | +1 ✦; +1 Card |
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
| Twincast | Mana | uncommon | Your next card resolves twice |
| Surge | Spell | uncommon | +3 ✦; Deal 6 |
| Wild Magic | Spell | uncommon | Deal 12; +3 ✦ |
| Fireball | Spell | uncommon | Deal 22; −2 ✦ |
| Chain Lightning | Spell | uncommon | Deal 5 per spell already cast this turn |
| Spellstorm | Spell | uncommon | Deal 3 per other card in your hand |
| Conflagrate | Spell | uncommon | Deal damage equal to the foe's Burn |
| Hex | Spell | uncommon | Foe takes +50% damage this turn; +1 ✦ |
| Empower | Spell | uncommon | +1 ✦; your next spell hits ×2 |
| Focus Rune | Rune | uncommon | Every hit deals +2 this fight |
| Amplify | Mana | rare | Double your ✦ |
| Cataclysm | Spell | rare | Deal 2 per ✦, then ✦ drops to 1 |
| Meteor | Spell | rare | Deal 45; once per fight |
| Mana Rune | Rune | rare | +1 ✦ at the start of each turn this fight |
| Curse | Curse | — | Can't be played (Bog Witch) |

Spellstorm, Conflagrate, Frostbolt, Siphon and Ponder are new in version 2.

## Bosses

| Boss | Curse | Counters |
|---|---|---|
| Bog Witch | 2 Curses shuffled into your draw pile each turn | thin decks |
| Ogre King | draw 1 fewer card | everything, gently |
| Snow Queen | your finest card is frozen for the fight | one key card |
| Bookworm | cards your spells draw are eaten (4 a turn) | draw engines |
| Null Rift | ✦ can't rise above 10 | Mana engines |
| Time Djinn | 3 turns, not 5 | slow ramps |
| Wraith | the first hit each turn does nothing | one big hit a turn |
| Ancient Dragon | heals 20% each turn | slow decks |
| Goblin Thief | steals a random card from your hand each turn, for the fight | small hands |
| Toll Golem | discard 2 cards each turn | big hands |
| Iron Bureaucrat | every card costs 2 ✦ | wide decks |
| Mirror Knight | hits under a fifth of its health do nothing | many small hits (Burn still works) |

## Relics

Wide Sleeves (+1 hand), Mana Crystal (+1 ✦ a turn), Silver Clasp (rewards offer 4 cards), Focusing Lens (+2 a hit), Quicksilver (+2 ✦ on each fight's first turn), Scholar's Quill (reward cards one tier higher), Ember Heart (Burn ×2), Leyden Jar (all unspent ✦ carries over, not half), Overflow Sigil (unspent ✦ strikes at end of turn), Twin Wand (first card each turn twice), Owl's Eye (first spell each turn ×2), Ascetic's Bead (×2 damage with 12 cards or fewer), Hourglass (6 turns), Crescendo (+1 a hit per card played), Philosopher's Stone (Sanctum rites twice), Glass Wand (damage ×3, one turn less), Archmage Staff (Mana cards +1 ✦), Old Grimoire (damage grows with each Boss beaten).

## Balance tests

`node sim/sim.js`, 60 seeded runs per bot. Only bots and one person have played it, so this is a calibration, not a verdict. The one human log so far (version 1) beat the best bot on every Boss, so the target is set a little above the bot.

| Bot | Fights won (of 24) | Beat circle 8 |
|---|---|---|
| mage: looks ahead over every order of its hand | 13.1 (median 14) | 30% |
| burner: Burn and big spells | 10.3 | 10% |
| naive: picks cards like mage, casts in a random order | 5.9 | 2% |
| random | 2.4 | 0% |

**Sequencing is still the skill.** Mage and naive pick the same cards and differ only in casting order: 13 fights won against 6.

**New cards matter.** The mage bot takes about 10 new cards and 3 raises a run and ends with an 18-card deck.

**The clock bites.** For the mage bot the first foe falls on turn 4.7, the first Elite on 3.6, the first Boss on 3.9 (67% won). In circles 3–4 fights take 2.5–3 turns. Late fights are still short for runs that get there: those are the decks whose engine broke, and the decks that didn't break are already dead. Balatro's late game works the same way.

**Bosses** (mage win rate): Null Rift 29% (its cap has since gone from 8 to 10), Time Djinn 46%, Iron Bureaucrat 50%, Snow Queen 54%, Bog Witch 62%, Bookworm 65%, Toll Golem 67%, Ogre King 71%, Wraith 71%, Mirror Knight 77%, Goblin Thief 80%, Ancient Dragon 86%.

**Tuning history.** Version 1: health 24 × 1.48 a fight → 45 × 1.43, Bosses sharpened; the human player still killed most foes on turns 1–2 from circle 2. Version 2: tried 3-, 4- and 5-turn fights at growth 1.45 to 1.6 without carry-over (no change in when fights end), then full, half and no carry-over at growth 1.45 to 1.85. Snow Queen (2 cards frozen) and a Goblin Thief that stole your best card were brutal in thin decks and were softened; Time Djinn went from 4 turns to 3.

## Open questions

- **Is half carry-over fun?** It's the main new decision and no person has tried it. The alternative is to keep Mana resetting and accept that fights are decided by the combo turn.
- **Late circles stay short** for decks that break. More Bosses that counter a broken engine (like Null Rift) would push back without punishing everyone else.
- **A Balatro-style shop** could come back as a small stop after each Boss, selling relics. It would need a currency, and Arcana was removed to keep cards scarce.
- **The card pool** is 28 cards. Rarity hides the rares, but a few runs will show every common.

## Look

A wizard's tower at night: a starfield behind everything, parchment cards with a band coloured by type (red spells, blue Mana, violet runes) and their rarity on the type line (rares glow), the Mana cost as a blue wax seal, the foe in a slowly turning summoning circle, and a Mana orb whose glow grows with the multiplier and which shows how much Mana will carry over. Fonts are Cinzel (titles) and Alegreya Sans (text). The discard pile is "Spent", and the icon is a wizard's hat.
