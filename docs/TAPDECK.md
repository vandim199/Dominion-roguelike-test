# Forays: tap the deck

An experiment on `wild/forays-yours`. The card-playing version is at commit `c38cf26`, and its closest living relative is `wild/forays-merged`.

## What was asked

Card playing was boring next to the incremental side. After a few upgrades to the Cannon you just burned cards to feed it, and the hand stopped mattering. So:

| Asked for | What it became |
|---|---|
| No energy, just a deck | Energy, the hand, burning and the Magazine are gone |
| Tap: draw, and play it for free | `tapDeck()` plays the top card and everything it sets off |
| Tableau cards go on the field | A drawn bastion lands in the slot you gave it at home |
| Deckbuilding is the real decision | Fights have no choices. Pack, layout, levels and sockets are all at home, and a readout re-measures the deck after every change |
| Cards combo off each other | Combo, Same card in a row, Crossfire, crits, and cards that build on them |
| Dopamine | The drawn card shown big on the deck, callouts, number sizes scaled to the enemy, screen shake, coin showers, and tap notes that climb a scale with Combo |
| When all are full, start on the first again | Powder has a cursor. It moves on after each firing and loops, with no limit per swing |
| Do not start with cards on the board | The field starts empty each trip |

## Decisions you did not make, which you may want to overrule

**Real time.** Your message left open what ends a turn. Options were a fixed number of taps per turn, one lap of the deck per turn, or a clock. A fixed count makes tapping speed meaningless, so the Cookie Clicker reward disappears. One lap per turn plays every card once each turn, so a bigger deck is always better and draw effects mean nothing. So the enemy swings on a timer, every 4 seconds: that is your "turn". The old objection to real time, that a thinking pause would earn free ammo, no longer applies once there is nothing to think about mid-fight. If it is wrong, the rules are one function: `tick()`.

**The field lasts the whole trip.** "Do not start with cards on the board" could mean each fight or each trip. I chose each trip, since you first described bases as persisting, so the machine keeps running from kill to kill. Deck order also carries from fight to fight.

**The clock stops between fights.** After a kill the next enemy waits with honest odds, until you tap to press on or go home. There is no modal, so mashing flows straight through. Tapping is ignored for 0.45 s after a kill, so you get a beat to stop.

**Old save.** This version saves under a new key, so a save from the old rules is left alone but not used.

## New in this version

- **Combo:** +1 per card or firing, up to 100, for up to ×3 on damage, block and blight. It fades after 1.5 s without a play.
- **Same card in a row:** ×2, ×3, up to ×5.
- **Crossfire:** a gun right after an attack card, or an attack card right after a gun: ×2.
- **Crits:** 5%, ×5.
- **Shuffle pause:** 0.5 s when the deck runs out. A thin deck draws its best cards more often but pauses more, which is what makes deck size a choice. It is also the strongest pacing knob in the tests.
- **Cards that replace "costs more":** with no energy, a plain big attack would be strictly better than a small one, so payoffs are conditional. Sally Forth (attacks in a row), Battering Ram (per bastion), War Horn (per Combo), Rolling Barrel (grows each play), Shield Bash (your block), Plague Bell (their blight), Whetstone, Field Anvil, Bell Rope, Powder Trail, War Drum.
- **New bastions:** Forge (cards pay more each firing), Arsenal (repeats your last card's hit), Drum Tower (Combo), and Bellows (now doubles the next gun).
- **The Page:** a Keep upgrade that draws for you, and presses on by itself when the next fight looks safe. This is the clicker's arc from tapping to automation.
- **The Wheel** now makes Powder per second, for the whole fight.
- **Honest odds:** the old hand-tuned formula is gone. Odds now come from simulating the real fight.
- **Caravan purchases** join your deck at once if there is room.

## What testing changed

Numbers are from the bots. See `docs/RESULTS.md`.

- **Powder scaled with level at first, and guns drowned everything.** A levelled Scoop fired them ten times a second. Powder now stays scarce: +1 per 10 levels.
- **Then bots went almost all cards**, which is your complaint turned upside down, so guns now pay triple. The final split is 14 gun-heavy decks to 10 card-heavy.
- **Crossfire was meant to make bots mix guns and cards, and it did not.** They still go all one way, and taking it away costs about 20%. It stays because it should feel good, which bots cannot judge.
- **The March used Power**, which let a Snowball deck march into fights it could not win. It now asks whether the enemy would die well before its first swing. Median defeats fell from 6 to 4.
- **Shield Bash was a trap**, since block grows more slowly than attacks. One bot sat at a wall for hours. It now compounds, which cut the worst seed from 204 to 113 minutes.
- **"Same card in a row" had no cap**, so a deck of one card would have snowballed forever. It is capped at ×5.
- **Sweeping all hits bypassed block**, which made bosses lethal regardless of defence. Fixed.
- **Costs and enemies were rescaled**, because fights went from about 36 s to about 6 s and coin came in too fast: level costs now double, against x1.72 before, and enemy health is x1.34 a fight, against x1.30.

## What to look at first when you play

1. Does tapping feel good, or is it a chore?
2. Are the first few minutes readable, or just noise?
3. Is it too fast? The bot's trillion takes 26 minutes.
4. Does a deck change at home feel like it matters when you tap next?
