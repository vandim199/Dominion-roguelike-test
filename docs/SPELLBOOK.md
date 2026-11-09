# Spellkeep: design

Spellkeep is classic Coinkeep turned into a wizard game built around one idea: **leftover Mana is your multiplier**. In classic Coinkeep, villages (+Actions) were dangerous because a deck that never runs out of Actions breaks the game. Here we lean into that. Cards may hand out lots of Mana, because Mana you don't spend multiplies your damage, and you will need that multiplier.

## The rules

| | Classic Coinkeep | Spellkeep |
|---|---|---|
| Money | Coin, spent the same turn | **Arcana ◆**, a purse that keeps between turns and fights |
| Actions / Energy | +Actions to play Actions; Treasures free | **Mana ✦**: every card costs 1, start each turn with 3 |
| Leftover Actions | wasted | **the damage multiplier** |
| Enemies | several threats demanding coin, Actions, Buys | **one foe** with health, beaten within 5 turns |
| Buying | Buys, during the turn | any time in your turn, no Buys needed |
| Starting deck | 7 Copper, 3 Shack | 4 Mote (+1 ◆), 4 Zap (Deal 3), 2 Channel (+2 ✦) |

**Resolution.** A card's lines resolve top to bottom, then you pay its 1 ✦. Every hit deals its number × the ✦ you hold at that moment (never less than ×1). So with 3 ✦ a Zap deals 9, the next 6, the next 3.

**Sequencing.** That rule makes order the main decision, at three levels:

1. *Inside a card.* Surge is "+3 ✦, then Deal 6": it hits with the new Mana. Wild Magic is "Deal 12, then +3 ✦": a bigger number, but it hits before the Mana arrives, so you want Mana from somewhere else first. Fireball is "Deal 22, then −2 ✦": cast it last, or it costs the spells after it.
2. *Inside a turn.* Mana cards first, then big spells while ✦ is high, then cheap spells, and Arcana with whatever ✦ is left, since Arcana isn't multiplied. Draw costs a Mana now to find cards later. Empower, Hex and Twincast change the next card. Cataclysm deals 2 per ✦ *and* is multiplied by ✦, then drops you to 1: it ends a turn.
3. *Across a fight.* Burn is multiplied once, when applied, then ticks at the end of every turn for the rest of the fight, so early Burn is worth up to 5×. Runes (Focus, Mana Rune) last the fight, so they want turn 1 too. Meteor is once per fight.

**The clock.** You can't sit on a weak foe buying cards. Its health is set so a deck has to be built *and* fight within 5 turns. A foe that falls early pays a bounty of Arcana for every turn to spare, so speed pays. A foe still standing after its last turn costs a heart (3 per run) and leaves without paying.

**Run shape.** 8 circles, each a Foe, an Elite (×1.6 health) and a Boss (×2.4 health, plus a curse on the rules). Health grows ×1.43 a fight. Beat the 8th Boss to win; you may play on into endless circles. After every win you may take one card from three spoils. Elites and Bosses offer a relic (5 slots). After a Boss, the Sanctum offers one rite: purge 2 cards, raise one a tier, copy one, or recover a heart. Each circle's Boss is announced at its first fight, so you can prepare.

**Tiers.** Market cards arrive at higher tiers as the circles climb (Firebolt, Firebolt+…). Damage and Arcana grow along Coinkeep's tier curve (1, 2, 3, 4, 5, 8, 11, 17…); Mana gains grow by one or two a tier. So Mana and damage both scale, and decks that build a real engine get exponential output, which is what makes breaking the game possible and fun.

## Cards

Every card costs 1 ✦. Prices are tier-0.

| Card | Type | Price | Text (top to bottom) |
|---|---|---|---|
| Mote | Arcana | starter | +1 ◆ |
| Crystal | Arcana | 3 | +2 ◆ |
| Star Shard | Arcana | 6 | +3 ◆ |
| Alembic | Arcana | 5 | +1 ◆ per ✦ you hold |
| Hoarded Tome | Arcana | 4 | +1 ◆; worth 1 more for good |
| Channel | Mana | starter, 2 | +2 ✦ |
| Ley Line | Mana | 3 | +1 Card; +2 ✦ |
| Wellspring | Mana | 5 | +4 ✦ |
| Study | Mana | 4 | +3 Cards |
| Familiar | Mana | 5 | +2 Cards; +1 ✦ |
| Clear Mind | Mana | 2 | +1 ✦; discard any, draw that many |
| Twincast | Mana | 5 | Your next card resolves twice |
| Banish | Mana | 2 | Banish up to 3 cards from your hand |
| Amplify | Mana (rare) | 8 | Double your ✦ |
| Zap | Spell | starter, 1 | Deal 3 |
| Firebolt | Spell | 3 | Deal 7 |
| Magic Missiles | Spell | 4 | Deal 3, three times |
| Surge | Spell | 5 | +3 ✦; Deal 6 |
| Wild Magic | Spell | 4 | Deal 12; +3 ✦ |
| Fireball | Spell | 6 | Deal 22; −2 ✦ |
| Chain Lightning | Spell | 5 | Deal 5 per spell already cast this turn |
| Ignite | Spell | 4 | Burn 1 (×✦ when applied, ticks every turn) |
| Hex | Spell | 4 | Foe takes +50% damage this turn; +1 ✦ |
| Empower | Spell | 4 | +1 ✦; your next spell hits ×2 |
| Meteor | Spell | 7 | Deal 45; once per fight |
| Cataclysm | Spell (rare) | 8 | Deal 2 per ✦, then ✦ drops to 1 |
| Focus Rune | Rune | 5 | Every hit deals +2 this fight |
| Mana Rune | Rune | 6 | +1 ✦ at the start of each turn this fight |
| Curse | Curse | — | Can't be played (Bog Witch) |

## Bosses

Each one counters a strategy, so a one-trick deck meets its match somewhere.

| Boss | Curse | Counters |
|---|---|---|
| Bog Witch | 2 Curses shuffled into your draw pile each turn | thin decks |
| Ogre King | draw 1 fewer card | everything, gently |
| Snow Queen | your 2 finest cards frozen for the fight | one key card |
| Bookworm | cards your spells draw are eaten (4 a turn) | draw engines |
| Null Rift | ✦ can't rise above 8 | Mana engines |
| Pirate Lich | plunders half your ◆, market closed | hoarding |
| Wraith | the first hit each turn does nothing | one big hit a turn |
| Ancient Dragon | heals 20% each turn | slow decks |
| Goblin Thief | steals a quarter of your ◆ each turn | hoarding |
| Toll Golem | discard 2 cards each turn | big hands |
| Iron Bureaucrat | every card costs 2 ✦ | wide decks |
| Mirror Knight | hits under a fifth of its health do nothing | many small hits (Burn still works) |

## Relics

Wide Sleeves (+1 hand), Mana Crystal (+1 ✦ a turn), Alchemist's Coin (Arcana cards +1), Focusing Lens (+2 a hit), Trophy Skull (double bounty), Scholar's Quill (◆ for deck size), Ember Heart (Burn ×2), Leyden Jar (half unspent ✦ carries over), Overflow Sigil (unspent ✦ strikes at end of turn), Twin Wand (first card each turn twice), Owl's Eye (first spell each turn ×2), Ascetic's Bead (×2 damage with 12 cards or fewer), Hourglass (6 turns), Crescendo (+1 a hit per card played), Philosopher's Stone (Arcana ×2), Glass Wand (damage ×3, one turn less), Archmage Staff (Mana cards +1 ✦), Old Grimoire (damage grows with each Boss beaten).

## Balance tests

All numbers come from `node sim/sim.js`, 100 seeded runs per bot (seeds 1–100). No person has played it yet, so treat them as a first calibration, not a verdict.

| Bot | Fights won (of 24) | Beat circle 8 |
|---|---|---|
| mage: looks ahead over every order of its hand, balanced deck | 17.3 (median 20) | **52%** |
| burner: Burn and big spells | 16.5 | 33% |
| money: Arcana first | 11.9 | 8% |
| naive: buys exactly like mage, plays its hand in a random order | 5.4 (median 3) | **0%** |
| random | 0.5 | 0% |

**Sequencing is the skill.** Mage and naive buy the same decks; the only difference is the order they cast in. Mage wins three times as many fights and half its runs; naive never finishes one. Naive loses most at the first Boss (29% win), mage at the late Bosses.

**Passive buying loses.** The Arcana-first bot does worst of the real strategies (8%). Buying is still necessary, though: decks grow from 10 to about 100 cards over a run.

**The clock bites early and late.** With the starter deck the first foe takes the mage bot 3 turns and the first Boss falls 75% of the time. In circles 3 to 5 a working engine outgrows the foes (most fall in about 2 turns). From circle 6 the Bosses take over again: 65%, 49%, then 38% for the 8th.

**Breaking the game works.** Once Amplify, Twincast and Mana cards line up, single hits pass a million and some fights end with 10²⁰ times the foe's health dealt. Endless mode exists for that, yet health growth still catches up: playing on after the 8th Boss, the mage bot's longest runs end around fight 36 (`--endless 1`, 40 runs). A broken deck is still an inconsistent one.

**Bosses** (mage win rate, all circles): Null Rift 54%, Toll Golem 63%, Iron Bureaucrat 64%, Ogre King 65%, Bog Witch 65%, Wraith 67%, Bookworm 69%, Snow Queen 74%, Ancient Dragon 76%, Mirror Knight 82%, Pirate Lich 82%, Goblin Thief 85%. The naive bot finds Iron Bureaucrat (14%) and Snow Queen (22%) hardest.

**Tuning history.** First pass (health 24 × 1.48 a fight): the first foe fell on turn 1.8 and the mage bot won 71%, so the clock didn't bite. Raised starting health to 45 and lowered growth to ×1.43. Bog Witch (1 Curse to the discard), Iron Bureaucrat (first card costs 2), Pirate Lich (market closed) and later Mirror Knight (10%) and Ancient Dragon (12%) were too soft and were sharpened to what's listed above. Null Rift's cap went from 6 to 8 because it was the one Boss that decided runs.

## Open questions

- **Stalling.** A foe that falls early pays a bounty for each spare turn, but nothing measures whether a player gains by dragging a weak foe out to buy more. A "stall" bot would answer it.
- **Deck size.** The bots buy whenever they can afford something good and end with about 100 cards. People will likely keep thinner decks; Banish and the Sanctum's purge are there for it, but the bots never use Banish.
- **The middle circles are easy** for a strong engine. Steeper health growth there would also make the late game harder, so that wants a person's feel first.
- **Order inside a card** (Surge against Wild Magic) is the idea the game started from. The bots use both about equally, which suggests neither dominates, but it hasn't been looked at closely.

## Look

The retheme is a wizard's tower at night: a starfield behind everything, parchment cards with a band coloured by school (red spells, blue Mana, gold Arcana, violet runes), the Mana cost as a blue wax seal, prices as gold coins, the foe in a slowly turning summoning circle, and a Mana orb whose glow grows with the multiplier. Fonts are Cinzel (titles) and Alegreya Sans (text). The market is the Arcane Library, the discard pile is "Spent", and the icon is a wizard's hat.
