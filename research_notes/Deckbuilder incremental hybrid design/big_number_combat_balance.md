# Big-number combat, balance and implementation for an incremental deckbuilding battler

Checked 2026-11-03. "[computed]" means I calculated it in Node during this session; it is my arithmetic, not a published figure. Community figures are labelled. Fandom wikis, poewiki and several Reddit mirrors blocked automated reading, so some game formulas rest on search snippets (flagged in each Gaps section).

## How do games with exponential numbers scale enemy health and damage, what growth rates make a good wall, and how are bosses used as checkpoints?

### Takeaway
Documented per-step HP growth falls into two bands: about 1.55 to 1.8x per zone in fast clickers, and about 1.15 to 1.17x per step in long-tail phases. Bosses usually sit about one segment of growth ahead of normal enemies. Curves either bend down (long grind) or bend up (eventual hard ceiling); `1.7^w x 1.02^(w^2)` is the bending-up kind.

### Cited Findings
- **Trimps (actual source code).** Health = `130 * sqrt(z) * 3.265^(z/2) - 110`, then a cell-position factor, and from zone 60 `* 1.1^(z-59)`. Attack = `50 * sqrt(z) * 3.27^(z/2) - 10`, and from zone 60 `* 1.15^(z-59)` — [Trimps config.js](https://raw.githubusercontent.com/Trimps/Trimps.github.io/master/config.js)
- **Tap Titans (original game, community wiki).** `MaxHP = 18.5 * 1.57^min(stage,150) * 1.17^max(stage-150,0)`. The exponent layout was reconstructed from a search snippet, and the formula has no boss term — [r/TapTitans wiki formulas](https://axebps-redlib.hf.space/r/TapTitans/wiki/formulas)
- **Tap Titans 2.** A boss with "exponentially more" health appears after a set number of titans; killing it advances the stage. No number given — [Giant Bomb wiki](https://giantbomb.com/wiki/Games/Tap_Titans_2)
- **Clicker Heroes structure.** A boss every 5 zones with a time limit; advancing needs 10 common monsters, plus 0.1 per 500 zones passed; Primal bosses appear every 5 levels from level 100 at 25%; Centurion bosses every 100 levels to 1000; first Centurion kills grant Hero Souls — [Clicker Heroes blog](https://blog.clickerheroes.com/clicker-heroes-monsters-ultimate-guide-to-enemies-strategies/)
- **Clicker Heroes boss HP (community, hedged).** A boss has X times normal health, with X starting "at 10 I think" and rising; Bubos can lower it to no less than 5x — [Steam thread](https://steamcommunity.com/app/363970/discussions/0/1694920442946918737)
- **Clicker Heroes growth (community).** Zones 1-140: each boss takes nearly 10x the DPS of the previous one. After patch 1.0e10, zones past 200k grow about 8.8x per 5 zones. After 1.0e11, each 500 zones adds 0.4 monsters' worth of boss health — [Fandom talk comment](https://clickerheroes.fandom.com/wiki/Talk:Zones/@comment-45738661-20200509171759). Zone-to-zone HP ratio 1.145 for 140-500, 1.15 for 500-1000, 1.155 for 1000-1500 (2016, may be outdated) — [r/ClickerHeroes](https://axebps-redlib.hf.space/r/ClickerHeroes/comments/4naohc/math_and_transcendance)
- **Balatro base chips by ante, white stake:** 300, 800, 2,000, 5,000, 11,000, 20,000, 35,000, 50,000 (ante 8), then 110k, 560k, 7.2M, 300M, 4.7e10, 2.9e13, 7.7e16, 8.6e20 (ante 16), up to 4.5e288 (ante 38) and 4.8e309 (ante 39). Green and purple stakes run higher (ante 8 = 100k and 200k) — [Balatro Wiki](https://balatrowiki.org/w/Blinds_and_Antes)
- **Balatro blinds.** Small 1x, Big 1.5x, Boss 2x, except The Wall 4x, Violet Vessel 6x, The Needle 1x; results are rounded to two significant digits. Ante 39 exceeds double precision and overflows; "scoring even naneinf is not sufficient" because nan is incomparable — [Balatro Wiki](https://balatrowiki.org/w/Blinds_and_Antes)
- **Diablo 3 Greater Rifts.** Monster health x1.17 per level. Damage x1.13185 (GR1-25), x1.07177 (GR26-70), x1.02337 (GR71-150). Health doubles about every 4.5 tiers, damage about every 30 — [Maxroll](https://maxroll.gg/d3/resources/greater-rift-explained)
- **The Tower (fan wiki).** Normal, Elite and Boss enemy types; a boss wave every 10 waves; bosses x20 the health of basic enemies; elites are immune to Orbs, Death Ray, Shockwave and Black Hole and drop Cells — [Notion wiki 1](https://the-tower.notion.site/1bf91383b93f80b39962d0d6d4cd07a7), [Notion wiki 2](https://the-tower.notion.site/1bf91383b93f80d39d62e01fba217b89). No published per-wave formula found.
- **Cost-side reference.** `cost = base * rate^owned` with AdCap Lemonade rate 1.07, and production linear or polynomial times milestone multipliers (x2 at 25 and 50 owned) — [Kongregate Part I](https://www.gamedeveloper.com/design/the-math-of-idle-games-part-i). Derivative Clicker uses `5 * 1.1^n` — [Part II](https://www.gamedeveloper.com/disciplines/the-math-of-idle-games-part-ii)
- **Realm Grinder has no enemy curve to cite;** its documented scaling is prestige: `p = (sqrt(1 + 8*c_M/1e12) - 1)/2` — [Part III](https://www.gamedeveloper.com/design/the-math-of-idle-games-part-iii)
- **Disgaea (community).** Damage = `(Atk * SkillMod% * AtkPower - 0.5 * Def * DefPower) * (boosts * resist * crit...)`. Disgaea 6 item-derived stats reach 1 trillion; one player reports stats near 1 trillion against Baals at about 5.5 trillion — [r/Disgaea thread](https://redlib.cypherpunktools.com/r/Disgaea/comments/1f5zz2i/rdisgaea_monthly_noob_questions), [r/Disgaea thread 2](https://redlib.cypherpunktools.com/r/Disgaea/comments/187xb5n/rdisgaea_monthly_noob_questions)

### Inferences
- **The Balatro wiki's endless formula rendered garbled.** The form that reproduces its table is `50000 * (1.6 + (0.75c)^(1+0.2c))^c` with `c = ante-8`. It gives 5.66e5 at ante 10 and 8.65e20 at ante 16, against the wiki's 5.6e5 and 8.6e20. A fraction reading fails badly (3.57e5 and 2.7e9). [computed]
- **Balatro's ante-to-ante ratio falls, then explodes:** 2.67, 2.5, 2.5, 2.2, 1.82, 1.75, 1.43 (antes 1-8, only 167x in total), then 2.3, 4.9, 12.9, 41.7, 155, 626, 2,617, 11,210 (antes 9-16). The fair game is gentle and the endless game is a ceiling. [computed]
- **Per-step rates in common units** [computed]:

| Game and phase | HP per step | Note |
|---|---|---|
| Clicker Heroes zones 1-140 | 1.585 (10x per 5) | community |
| Clicker Heroes past 200k | 1.545 (8.8x per 5) | community |
| Clicker Heroes 140-1500 | 1.145 to 1.155 | 2016 figure |
| Tap Titans to stage 150 / after | 1.57 / 1.17 | 1e12 at stage 55; 4.5e30 at stage 150 |
| Trimps before / after zone 60 | 1.807 / 1.988 | attack 1.808 / 2.08 |
| Diablo 3 Greater Rifts | 1.17 | damage only 1.023 late |
| `1.7^w x 1.02^(w^2)` | 2.58 (w10), 3.83 (w20), 5.05 (w27), 12.6 (w50) | ratio itself rises 4.04% per wave |

- **Curve shape decides the ending.** Tap Titans and Clicker Heroes bend down after an early steep phase, so the game can run indefinitely. Balatro endless, Trimps past 60 and any `c^(w^2)` term bend up, so they end in a practical ceiling.
- **Boss sizing pattern (my observation, not a documented rule):** the boss multiplier is roughly `g^(segment length)`, so a boss previews the next segment's normal difficulty. Clicker Heroes: 1.585^5 = 10x. Balatro: boss 2x against 1.43 to 2.67x per ante.
- **HP and damage need not grow at the same rate.** Diablo 3's roughly 7:1 gap in doubling speed (at high tiers) makes its wall "cannot kill in time" rather than "dies instantly". Trimps goes the other way past zone 60 (attack grows faster than health), which makes death more likely than a slow fight.
- **Reaching 1e12 at constant growth** [computed]: g=1.07 takes 409 steps; 1.15 takes 198; 1.17 takes 176; 1.3 takes 106; 1.5 takes 69; 1.6 takes 59; 2.0 takes 40. The current formula reaches 1e12 at wave 27.

### Gaps
- No source defines a "good wall" numerically. The bands above are observed values, not validated targets, and they come mostly from games with very short steps, not turn-based fights.
- The Clicker Heroes zone 1-140 formula could not be verified (Fandom and Reddit wiki pages blocked). A commonly remembered base of 1.55 did not appear in anything I could read.
- Idle Champions: no formula found. The only evidence is an anecdotal Steam post that enemy health roughly doubles per area. Champion health stopped scaling with levels in one update — [Update 52 notes](https://idle-champions.fandom.com/wiki/Patch_Note_Log/Update_52)
- Melvor Idle: no exponential enemy formula found. Its combat documentation centres on capped damage reduction (see next section), so it is a contrast case rather than a precedent.

## When both sides grow exponentially, how do flat block, flat damage, damage over time and health bars stay meaningful?

### Takeaway
What matters is the dynamic range inside a fight, not the absolute number. Any rule that depends only on the ratio of attacker to defender keeps working at 1e3 or 1e30. Flat subtraction is ratio-based at parity but has a sharp cliff. `x/(x+k)` with constant k saturates in display, though it behaves as division underneath. `A/(A+kD)` is scale-free. Linear-decay poison stops functioning as a decaying effect at scale and needs a proportional rule.

### Cited Findings
- **League of Legends, constant k.** `damage = raw / (1 + armor/100)`; "Every 1 point of armor adds 1% to the effective health pool"; armor "does not give diminishing returns of effective health" — [League Wiki](https://wiki.leagueoflegends.com/en-us/Armor)
- **Path of Exile, hit-relative.** `DR = AR / (AR + 10 * DMG)` for PoE 2 per one guide — [Mobalytics](https://mobalytics.gg/poe-2/guides/armour). A calculator uses a coefficient of 5 — [West Games](https://west-games.com/?p=30363). These conflict; the form is what matters here. Armour "scales with the size of the enemy hit", which explains "why a small amount of armour barely reduces a big hit" — [poe.ninja](https://poe.ninja/posts/defensive-stat-breakdowns)
- **Melvor Idle, percentage with cap.** Damage reduction runs 0% to 95%; damage taken is base times (1 - DR%), floored, with the Combat Triangle modifying DR — [Melvor Wiki](https://wiki.melvoridle.com/w/Damage_Reduction)
- **Genshin Impact, level ratio.** A level 90 character hitting a level 90 enemy loses exactly half its damage before resistance — [Wermos blog](https://wermos.github.io/blog/genshin-impact/theory-crafting/babys-first-step-in-genshin-theorycrafting). The level effect is deliberately small: under 10% relative difference for 20 levels — [Genshin Wiki](https://genshin-impact.fandom.com/wiki/Enemy/Level_Scaling). Third-party calculators give `(L+100)/((L+100)+(EL+100))`; the full wiki formula was not confirmed.
- **Destiny 2, power-delta (community-derived, may be outdated).** No benefit for being over-levelled; steep loss when under, with a 0.5x floor at -200 delta. Weapon delta costs about 1% per level for the first 5, then 0.8%, then 0.6% — [MossyMax breakdown](https://red.bismuth.it/r/DestinyTheGame/comments/1cdq1e9/after_9_years_we_finally_know_how_power_level). A -5 delta cap in raids meant about two-thirds of prior damage, and Bungie later walked the system back — [Dot Esports](https://vip-develop.dotesports.com/?p=1266092)
- **Damage cap.** Slay the Spire's Corrupt Heart has Invincible: "Can only lose X more HP this turn", 300 base and 200 at Ascension 19. Beat of Death deals 1 or 2 damage per card played — [Slay the Spire Wiki](https://slaythespire.wiki.gg/wiki/Corrupt_Heart)
- **Poison.** An enemy loses HP equal to stacks at the start of its turn, then stacks drop by 1. It ignores Block. Catalyst doubles or triples existing Poison. Artifact negates all Poison "applied by a single source". Intangible reduces all HP loss to 1 — [Slay the Spire Wiki](https://slaythespire.wiki.gg/wiki/Poison)
- **Percent-effect carve-outs.** The Tower's elites are immune to its Orbs, Death Ray, Shockwave and Black Hole — [Notion wiki](https://the-tower.notion.site/1bf91383b93f80b39962d0d6d4cd07a7)
- **The stat squish as the alternative.** WoW scales down stats, health and ability damage (490,873 health became 30,375 at item level 530). Health was stored as signed 32-bit, later a 64-bit double in Legion. The 32-bit motive for the squish is community claim — [Warcraft Wiki](https://warcraft.wiki.gg/wiki/Stat_squish). Blizzard's team later blamed the "Big Squish" implementation for problems — [Kotaku](https://kotaku.com/blizzard-is-sorry-world-of-warcraft-patch-8-0-messed-up-1827735593). Another squish was reported for Midnight — [Mein-MMO](https://mein-mmo.de/en/in-wow-midnight-you-are-a-thousand-times-weaker-all-values-drop-drastically,1523590)

### Inferences
**Approaches compared** (numbers [computed]):

| Approach | Rule | Behaviour at scale | Keeps a "1 block" decision? |
|---|---|---|---|
| Flat subtract | `max(0, E-B)` | Ratio-based if both scale. Fraction through by E/B: 0.5→0, 1→0, 1.1→9%, 1.5→33%, 2→50%, 3→67%, 10→90% | Yes near parity; meaningless once E/B is above 10 or below 1 |
| Percent of max HP | `p * maxHP` | Fully scale-free, but ignores player power | Only if bosses resist it; otherwise it dominates late |
| Constant-k armour | `x/(x+k)` | Display saturates: at x/k of 1, 10, 100, 1e3, 1e6, 1e12 it reads 50%, 90.9%, 99%, 99.9%, 99.9999%, 100%. Underneath it is division by `1+x/k` | No as a percentage; yes if shown as "÷N" |
| Hit-relative armour | `A/(A+kD)` | Unchanged when A and D scale together: A=D gives 16.7% at any scale with k=5 | Yes |
| Level/tier ratio | `(L+c)/((L+c)+(EL+c))` | Compresses gently; needs a linear level stat | Indirectly |
| Power delta | `f(tier difference)` with caps | Log comparison in practice; caps limit both tails | Indirectly |
| Hard damage cap | at most X per turn | Sets a minimum fight length | Protects enemy intents, kills overkill |
| Squish or display scale | divide everything | Hides numbers, risks backlash | Yes, but works against the fantasy of huge numbers |

- **`A/(A+kD)` is a smooth flat block.** The damage blocked is `A*D/(A+kD)`: nearly all of a small hit, and at most `A/k` of a huge hit. With A=1000 and k=5: D=1 blocks 1, D=100 blocks 66.7, D=1000 blocks 166.7, D=1e6 blocks 200. The fraction passing through at A/D of 0.1, 1, 5, 10, 50, 100 is 98%, 83%, 50%, 33%, 9%, 4.8%. [computed] This is the closest match to block's feel without a cliff.
- **Numeric trap with constant k:** `1 - x/(x+k)` returns exactly 0 at x=1e20, k=100, while `k/(x+k)` correctly returns 1e-18. Always compute the fraction that passes through, not one minus the reduction. [computed]
- **How 1 HP or 1 block stays relevant:** author all values against a per-tier unit `U(w)`, for example `U(w) = threat(w)/c`. Enemy intents are then multiples of U, and block and damage cards are tuned to land within about 0.1U to 30U of each other. Then "1 block" means "1U" and every Slay-the-Spire-style decision carries over unchanged. Shown numbers can still be trillions. The check to run is fight dynamic range: `biggest relevant number / smallest relevant number` inside one fight. My starting guess is that it should stay within 2 to 3 orders of magnitude; that is an assumption to test.
- **Consequence:** real additive effects on the raw number die at scale, so a card effect with a literal "+1" is noise past early game. Literal small integers only survive on non-scaling resources such as energy, card draw, cards in hand, ammo counts if those stay small, status durations, and turn counts.
- **Linear-decay poison at scale.** Total damage if fully played out is `n(n+1)/2` (n=1e6 gives 5e11), so the theoretical value is quadratic. But with stacks far larger than fight length T, damage is simply about `n*T` and the decay never matters. At 1e16 and above, `n-1` does not even change the value. The "poison runs out" decision disappears; poison just becomes a ×T multiplier that ignores block. [computed]
- **Proportional decay fixes this.** Stacks times `(1-d)` per turn gives total `n(1-(1-d)^T)/d`, bounded by `n/d` (d=0.5 gives 2n; d=0.25 gives 4n). It stays linear in n, has a real end, and makes re-application timing matter. Block-bypass remains a scale-free advantage, so it needs its own price.
- **Status effects that survive unchanged are count-based or source-based:** Artifact's "negate one application" means the same at any scale. Intangible's "reduce HP loss to 1" becomes total immunity at scale unless "1" means "1U".
- **Hard caps fit bosses only.** "Cannot lose more than 25% max HP per turn" guarantees four turns of intents whatever the numbers. Used on normal fights it would remove the fast-kill payoff that the sawtooth is meant to deliver.

### Gaps
- I found no shipped game that documents a literal logarithmic damage comparison; Destiny's delta and Genshin's level ratio are the closest. Log-ratio damage is my extrapolation.
- PoE's exact coefficient and its reported 90% cap could not be confirmed against the wiki (bot protection). Bulbapedia was blocked too, so percent-based poison precedents such as Pokémon's badly-poisoned status are unverified here.
- I found no developer writeup specifically on status effects at exponential scale.

## How can enemy intents stay interesting when one side outscales the other, what makes "time to enjoy the power" fun, and how can trivial fights be fast-forwarded?

### Takeaway
Scaling numbers alone cannot make intents interesting when the power ratio is far from 1, so interest has to come from rules that ignore magnitude. The precedents for the enjoyment phase are visible overkill feedback, carry-over of excess damage, instant wins against much weaker enemies, and speed plus repeat controls.

### Cited Findings
- **Overkill feedback.** Balatro's creator calls the flames that appear when a hand beats the requirement a proudest feature; they grow from small at the score boxes to erupting across them — [GamesRadar](https://www.gamesradar.com/games/roguelike/after-winning-big-at-the-game-awards-and-taking-hours-of-our-time-in-2024-balatro-creator-reveals-their-most-productive-night-resulted-in-one-of-the-games-most-satisfying-features)
- **Overkill carry-over.** Trimps' perk: "Each level of this perk will allow 0.5% of your overkill damage to harm the next enemy. If this damage kills the next enemy, you will lose no time moving through that cell. Maximum of 30 levels" — [Trimps config.js](https://raw.githubusercontent.com/Trimps/Trimps.github.io/master/config.js)
- **Instant win.** EarthBound: much weaker enemies try to flee, and if weak enough you get an instant victory on contact — [FandomSpot guide](https://www.fandomspot.com/earthbound-combat-guide/)
- **Rolling HP.** In EarthBound damage counts down gradually, giving time to heal or win before it reaches zero — [HandWiki](https://handwiki.org/wiki/Software:EarthBound)
- **Speed and repeat.** Disgaea 6 offers battle speeds of 2x to 32x, including with auto-battle — [Final Weapon](https://finalweapon.net/2020/12/28/famitsu-shows-off-the-game-speed-feature-for-disgaea-6-defiance-of-destiny-allows-up-to-32x-game-speed-in-battles/), per-character auto-battle behaviour — [Siliconera](https://www.siliconera.com/disgaea-6-auto-battle-function/), and map auto-repeat. Pre-release, developers weighed restricting Auto plus Repeat because it could break story balance — [Siliconera](https://www.siliconera.com/disgaea-6-will-feature-a-32x-speed-mode/)
- **Rule-based bosses.** Balatro's boss multipliers vary (4x Wall, 6x Violet Vessel, 1x Needle), so some bosses are not pure number checks — [Balatro Wiki](https://balatrowiki.org/w/Blinds_and_Antes)
- **Per-card ping regardless of total power.** Beat of Death punishes each card played — [Slay the Spire Wiki](https://slaythespire.wiki.gg/wiki/Corrupt_Heart)
- **Players want asymmetric speed:** slower for hard fights, faster or skip-to-result for easy ones (a forum comment) — [itch.io](https://itch.io/post/9440385). A results screen with a fast-forward toggle plus a skip button is one shipped form — [Nintendo playguide](https://playguide.shadows.nintendo.com/hc/en-us/articles/55745935931289-View-Battle-Replays)
- **Enjoyment is in the fast section.** Players who hit a milestone often keep going through a fast section, so resets can run longer than a model predicts — [Kongregate Part III](https://www.gamedeveloper.com/design/the-math-of-idle-games-part-iii)

### Inferences
- **Define the sawtooth with one ratio:** `R(w) = player damage per turn * target turns / enemy HP(w)`. A burst multiplies R by B, and each wave divides it by g. Provisional bands, to be tuned: R>10 trivial, R 3-10 enjoyment, R 1-3 tense, R<1 wall.
- **Intents only need depth in the tense band.** Far above it, numeric intents cannot threaten anything. Options that ignore magnitude: percent-of-current or percent-of-max effects, discard, disable a base, drain ammo, add curses, block a card type, per-card pings measured in U.
- **The non-scaling resources are the decision layer:** energy, hand size, ammo and base slots do not inflate, so choices about them stay readable all the way up, provided they are not also multiplied.
- **Overkill rewards should pay in pace or in non-combat value,** such as carry-over, ammo refund, a bonus draw, or a skip. Paying overkill in raw power would compound with the multiplier stack and steepen the curve.
- **Auto-resolve should run the real rules at no animation,** not a separate estimator. `sim/sim.js` already loads `js/data.js` and `js/game.js` into a sandbox with only `console` and a stubbed `setTimeout`, so the game logic appears able to run without the DOM. A fight whose worst-case bot or estimator result shows a clear win (for example R above a threshold and predicted damage well below player HP) can be resolved instantly and shown as a one-line result.
- **The skip eligibility test should depend on R, not on wave number,** so it naturally turns off as the wall approaches. Disgaea's concern applies: if skip stays available on checkpoint bosses, it removes the check.

### Gaps
- I found little developer writing on why the enjoyment phase is fun; most evidence here is feature precedent and player comment. Slower-paced hybrid precedents are covered by other researchers.
- No specific data found on how players respond to instant-win against weak enemies in modern deckbuilders.

## What failure modes arise: a single mistake being fatal, abrupt run ends versus slow grind, one multiplicative stack dominating, and additive upgrades becoming worthless?

### Takeaway
Each failure has a measurable signature. Steepness sets how many waves of slack a mistake costs. A rising per-wave ratio turns the wall into a terminal ceiling. Multiplier stacking narrows builds. Additive bonuses fade unless placed inside a multiplier bucket.

### Cited Findings
- **Multiplicative dominance.** Soulstone Survivors' developers moved upgrades from multiplicative to additive, saying multiplicative scaling causes problems for Affixes and Endless mode and goes against making many builds viable because it rewards focusing one attribute (patch note, read via search snippet) — [SteamDB patch notes](https://steamdb.info/patchnotes/9555513)
- **Additive fade (player reports).** A 10% bonus gets "watered down" to 5% or lower as the game progresses — [Journey to Incrementalia thread](https://steamcommunity.com/app/3147430/discussions/0/595139710753493768). Upgrades with multiplicative costs and linear additive rewards always feel worse as the game goes on, and additive upgrades are hard to judge because they depend on everything bought before (search snippets; which comment sits in which thread was not confirmed) — [r/incremental_games thread 1](https://reddit.birdcat.cafe/r/incremental_games/comments/16snoif/game_feature_youd_defend_to_your_grave), [thread 2](https://redlib.hbubli.cc/r/incremental_games/comments/1e8gl1c/key_considerations_for_creating_an_incremental)
- **Keeping low tiers relevant.** In Derivative Clicker, each tier-1 building boosts all tier-1 production by 0.05%, so early tiers keep value — [Kongregate Part II](https://www.gamedeveloper.com/disciplines/the-math-of-idle-games-part-ii)
- **Labelling.** Path of Exile separates "Increased" (additive) from "More" (multiplicative) — [PoE forum](https://pathofexile.com/forum/view-thread/261646)
- **Milestones distort.** AdCap's purchase spikes around 25 and 50 owned reflect temporarily overvalued thresholds — [Kongregate Part I](https://www.gamedeveloper.com/design/the-math-of-idle-games-part-i)
- **Terminal overflow as a failure.** NaN at ante 39 cannot be beaten — [Balatro Wiki](https://balatrowiki.org/w/Blinds_and_Antes)
- **Over-tuned deltas draw backlash.** Destiny's negative power cap and later walk-back — [Dot Esports](https://vip-develop.dotesports.com/?p=1266092)

### Inferences
- **Steepness and slack.** Waves of headroom from a burst or margin: `n = ln(B)/ln(g)`. [computed]

| B \ g | 1.1 | 1.17 | 1.3 | 1.5 | 1.7 | 2 | 3 |
|---|---|---|---|---|---|---|---|
| 2 | 7.3 | 4.4 | 2.6 | 1.7 | 1.3 | 1.0 | 0.6 |
| 3 | 11.5 | 7.0 | 4.2 | 2.7 | 2.1 | 1.6 | 1.0 |
| 5 | 16.9 | 10.3 | 6.1 | 4.0 | 3.0 | 2.3 | 1.5 |
| 10 | 24.2 | 14.7 | 8.8 | 5.7 | 4.3 | 3.3 | 2.1 |
| 100 | 48.3 | 29.3 | 17.6 | 11.4 | 8.7 | 6.6 | 4.2 |

  A wrong upgrade worth a factor of 3 costs 7 waves at g=1.17 and 1 wave at g=3. That is the "one mistake is fatal" dial.
- **The current formula is a ceiling.** With `1.7^w x 1.02^(w^2)`, a x10 burst buys 2.36 waves at w10, 1.41 at w27, 0.91 at w50, 0.51 at w100. A x1e6 burst buys 11.9, 7.9, 5.3 and 3.0 waves. Buying 5 waves needs x169 at w10, x1,223 at w20, x4,890 at w27, x64,168 at w40. [computed] If the power side grows only exponentially, a stair-step eventually cannot be sustained, and bursts must grow in size over the run or the term must be capped or removed past some wave.
- **Abrupt ending vs slow grind are the two sides of g.** Too steep gives one attempt and a sudden stop; too flat (for example 1.145 per step with long steps) gives long sections with no new decisions. Clicker Heroes-style growth is tolerable with quick steps because each step takes little time; a turn-based fight is far more expensive per step, so step count to target matters more than in clickers.
- **Enemy damage is the lethality dial; enemy HP is the duration dial.** Diablo 3's split shows they can be set separately. Letting HP lead makes walls slow rather than lethal, and keeps a run from ending on one hit. A flat-block cliff makes this worse: going from E/B of 1.0 to 1.5 moves from no damage to a third of the attack through.
- **Additive placement.** Additive upgrades stay useful when they add into a base value that is then multiplied, when several add into one "bucket" with separate buckets multiplying, or when costs are also additive. Signatures to track: share of final damage from the largest multiplier source, and the power lost when each source is removed.
- **Bucket structure limits stacking.** Number of separate multiplier buckets sets how explosive the build is; adding a new bucket late is equal to adding a new exponential term.
- **Interactions compound hidden growth:** a persistent board plus scaling cards plus status multipliers can multiply unintentionally. Sim runs should report the top-10 run outliers in damage per turn, not only averages.

### Gaps
- No quantitative study found on how much steepness players accept in turn-based settings. A thread titled "The hopelessness of progression above soft cap" exists on r/ClickerHeroes, but I could not open it.
- Soulstone's note was read through a search snippet because SteamDB blocked the fetch; the patch version was not confirmed.

## What is the right fail state when the player loses in a game built around walls?

### Takeaway
Comparable games mostly convert loss into carried value rather than pure reset, and they usually make dying worse than choosing to leave. No fail state is proven best. Math favours keeping loss small relative to the amount of time needed to re-earn it, and watching for players who gain by dying on purpose.

### Cited Findings
- **Partial keep by exit type.** Loop Hero: about 30% of resources kept on death, 60% on retreat away from camp, 100% at camp (one guide says within one tile of it) — [Gfinity](https://www.gfinityesports.com/article/loop-hero-death-what-happens-when-you-die), [Slyther Games](https://www.slythergames.com/?p=5172)
- **Run ends, currency carries.** The Tower: defend until destruction, then start over; coins go to permanent workshop upgrades and research — [App Store](https://apps.apple.com/app/1575590830). A fan guide warns towers that cannot afford high-level upgrades by wave 50 hit a wall — [Shapes guide](https://shapes.inc/guides/the-tower-guide)
- **Prestige through walls.** Clicker Heroes has a steep curve, and players can keep earning prestige at about the same point to get past a wall. Prestige currency effectively reduces the growth curve's scale — [Kongregate Part III](https://www.gamedeveloper.com/design/the-math-of-idle-games-part-iii)
- **Prestige formulas.** AdCap `p = 150*sqrt(c_L/1e15)`; Cookie Clicker `p = cbrt(c_L/1e12)`; Egg, Inc. `Δp = (c_R/1e6)^0.14`. Doubling prestige needs 3-4x earnings in AdCap, about 8x in Cookie Clicker, about 128x in Egg, Inc. — [Kongregate Part III](https://www.gamedeveloper.com/design/the-math-of-idle-games-part-iii)
- **Reset length.** In the model an early run lasts about 120 minutes and breaks at a 16x milestone; resets should vary in length — [Kongregate Part III](https://www.gamedeveloper.com/design/the-math-of-idle-games-part-iii)
- **Timed checkpoint.** Clicker Heroes bosses have a time limit — [Clicker Heroes blog](https://blog.clickerheroes.com/clicker-heroes-monsters-ultimate-guide-to-enemies-strategies/)
- **Harsh mode as opt-in.** Melvor's Hardcore treats death as permanent per its FAQ, and a test-wiki page says all equipped items are lost. These come from search snippets, are inconsistent and may be outdated — [Melvor test wiki](https://testwiki.melvoridle.com/w/Mode)
- **Balatro's loss.** Mr. Bones cannot save a run at the overflow point; beating Endless is defined as scoring naneinf on ante 39 — [Balatro Wiki](https://balatrowiki.org/w/Blinds_and_Antes)

### Inferences
| Fail state | Loss in wall math | Risk | Precedent |
|---|---|---|---|
| Full run reset, no carry | All of it | One bad wall feels like hours lost; fits short runs only | Balatro-style (general knowledge; not re-verified this session) |
| Reset plus prestige currency | Run power, minus `f(progress)` | Tuning the exponent; suicide farming if it beats surviving | Clicker Heroes, The Tower |
| Boss checkpoint restart | Back to last boss | Boss must be beatable from checkpoint state; can soft-lock if resources were spent | Clicker Heroes boss zones (structure only; its failure behaviour is unverified) |
| Knock back n waves | Gives g^n headroom | Needs a resource source during replay, or it repeats the same loss | Clicker-style farming |
| Partial keep by exit type | 30/60/100 style | Adds an "exit decision", more UI | Loop Hero |

- **Knock-back has an exact value.** Going back n waves restores `R` by `g^n`: at g=1.7, 3 waves is x4.9; at g=3, 3 waves is x27. On a steep curve a small knock-back recovers a lot, so it can be lenient in waves. [computed]
- **Soft-lock check:** knock-back and checkpoints need the player to actually gain power in the replay. If power comes only from one-time events, replaying gives nothing. This suits a persistent board only if farmed currency or ammo keeps flowing.
- **Death should not out-earn a good exit.** Loop Hero's ordering (death < retreat < camp) is the standard guard. For prestige on death, compute payoff using best-progress values and check bots do not earn more per hour by losing early.
- **Choosing the exponent:** low exponents make repeats nearly worthless and encourage pushing further (Egg, Inc.); higher exponents let players grind past walls at the same point (Clicker Heroes). A wall-based game wants enough gain from repeat attempts that failed attempts still move R upward, measured as attempts to clear each wall.
- **A loss screen should report the ratio,** such as "needed ×3.2 more", and what the next upgrade would give. Under exponential scale this is more informative than absolute shortfall.

### Gaps
- Details of what Tap Titans 2, Trimps and Idle Champions do after failure could not be verified (pages blocked or anecdotal).
- No comparative retention data across fail-state types was found.

## How do autoplay and animation speed work in games with long trigger chains, and what are good UX patterns for huge chains and big numbers on a phone?

### Takeaway
A speed multiplier alone stops scaling once chains get long. Games and mods then add chain acceleration, hold-to-fast-forward, or result-first skipping. For numbers, 3 significant digits with suffixes then a switch to scientific, plus a player toggle, is the usual community-backed pattern; there is no measured evidence favouring one notation.

### Cited Findings
- **Balatro speed.** There is a setting with a max of 4; one player calls 2 comfortable and another says 4 is too slow for them. Players say scoring speeds up with more triggers, and warn that maxing it can make you miss interactions (player reports) — [Steam thread](https://steamcommunity.com/app/2379780/discussions/0/4346606879508270539). One player reports going about 50 hours without noticing the setting (search snippet from the same Steam discussions, exact thread not pinned down), so a default-off control can stay undiscovered for a long time
- **Balatro mods fill the gap.** Saturn: up to 16x, and "Eliminate in-game animations to speed up game loop in later antes" — [Saturn](https://github.com/oceanramen/saturn). Talisman: raises the cap from about 1e308 to about 1e1000, has an option to disable long scoring animations, and reports lag with many retriggers; high scores do not save to the profile, save files are not backward-compatible, and other mods' numeric comparisons may break. It is archived and deprecated in favour of Amulet — [Talisman](https://github.com/MathIsFun0/Talisman)
- **Luck be a Landlord.** A mobile review reports you can increase the speed or turn off animations for instant spin results. The review page blocked re-reading, so the specific attribution is unconfirmed — [TouchArcade](https://toucharcade.com/2023/07/25/luck-be-a-landlord-mobile-review-iphone-ipad-android/)
- **Hearthstone Battlegrounds players ask for animation-off and battle skip** — [Blizzard forum](https://us.forums.blizzard.com/en/hearthstone/t/feature-request-animation-turning-off-and-battle-skip/145908)
- **Mobile strategy presets.** x1 to x4, with players requesting both faster and a 0.5x option — [The Last Flame thread](https://steamcommunity.com/app/1830970/discussions/0/592886010360160600)
- **Notation preferences (anecdotal, split).** Suffixes favoured at a glance; scientific favoured for comparing and for not memorising letters, and by non-native English speakers; a toggle is commonly requested — [r/idleslayer](https://reddit.birdcat.cafe/r/idleslayer/comments/1g5evdf/scientific_notation_or_nah), [Unnamed Space Idle thread](https://steamcommunity.com/app/2471100/discussions/0/600765572565761276/?ctp=2). One Idle Champions commenter says the game forces scientific at e60 — [Steam thread](https://steamcommunity.com/app/627690/discussions/0/1482109512313549984/?ctp=2)
- **Balatro in practice.** A forum post shows a score shown as 6.604e11 — [Penny Arcade forum](https://forums.penny-arcade.com/discussion/249793/balatro-so-ill-tell-you-all-the-story-about-the-poker-and-the-rougelike/p4)
- **Notation library.** Antimatter Dimensions' package covers Scientific, Engineering, Letters, Standard, Mixed Scientific, Mixed Engineering, Logarithm and novelty formats — [ADNotations](https://github.com/antimatter-dimensions/notations)
- **Native formats.** `Intl.NumberFormat` supports `notation` of standard, scientific, engineering, compact, plus `compactDisplay`, and compact defaults to 2 max significant digits — [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/NumberFormat)
- **Stable digit widths.** `font-variant-numeric: tabular-nums` makes figures equal width — [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-numeric)

### Inferences
- **Resolve first, then play back.** Compute the whole chain synchronously and store an event list. Animation is then a playback of the list, and skip jumps to the known final state with no gameplay difference. This also keeps the sim and live game on the same rules, and a saved game never depends on animation state.
- **Budget chain time instead of multiplying it:** `per-step time = min(dt, budget/n)`. With dt=0.25s and a 3s budget: 4 and 12 triggers stay at 0.25s, 50 at 0.06s, 200 at 0.015s, 1,000 at 0.003s. [computed] Past about 60 per second, batch events into groups per source and show aggregated totals. Tap or hold skips to the end.
- **Show chains as ratio progress.** On phone width, a progress bar for "this hand vs enemy HP" is readable when digits are not. Flames-style escalation can trigger at multiples of requirement (1x, 10x, 100x), which also works as overkill feedback.
- **Keep digit strings short.** Three significant digits plus suffix is at most about 6 characters ("999Qa"), which works on small cards. Show exact details only in a long-press panel. Use tabular numbers so counters do not jitter.
- **Show the suffix-to-exponent mapping or a hint,** since suffix memorisation gets hard past T. Reasonable default: plain to 999, K M B T Qa Qi Sx Sp Oc No Dc to 1e33, then scientific, with a settings toggle. Letters beyond Dc are the commonly criticised part.
- **`Intl` compact stops at T in English:** 1e15 prints "1000T", and 1e30 prints a long string of digits followed by T. A cached formatter took about 950 ns per call, an uncached one about 37,800 ns, and a small custom formatter about 275 ns on this desktop in Node. [computed] So do not use Intl compact for this range, and never construct a formatter per call.
- **Rounding edge:** 999,500 has to print as "1M", not "1000K". This formatter handled it in testing, along with 9.999e14 → "1Qa" and Infinity → "INF" [computed]:

```js
const S=['','K','M','B','T','Qa','Qi','Sx','Sp','Oc','No','Dc'];
function fmt(x){
  if(!Number.isFinite(x)) return x>0?'INF':(x<0?'-INF':'NaN');
  const a=Math.abs(x);
  if(a<1000) return (Math.round(x*10)/10).toString();
  let t=Math.floor(Math.log10(a)/3);
  if(t<S.length){
    let s=(x/Math.pow(1000,t)).toPrecision(3);
    if(Math.abs(+s)>=1000&&t+1<S.length){t++;s=(x/Math.pow(1000,t)).toPrecision(3);}
    return (+s)+S[t];
  }
  return x.toExponential(2).replace('e+','e');
}
```

- **Phone readability of a delta:** show change as a relative hint when digits repeat, such as "1.23T → 1.25T (+2%)". After a burst, showing the multiplier ("×12") is usually more legible than the new total.
- **Accessibility:** a reduced-motion option maps naturally to the result-first path. Autoplay needs to pause on non-trivial events, with the skip rule based on R.

### Gaps
- **The Bazaar:** two targeted searches returned nothing about its speed or combat UX. No reliable statement available.
- No controlled usability study on number notation was found; everything above is player opinion and my reasoning. Balatro's exact scientific-notation threshold is unconfirmed.
- Luck be a Landlord's exact option names were not confirmed.

## Technical: JS precision limits, when break_infinity.js or break_eternity.js are needed, performance, no-build availability, saves and notation

### Takeaway
Plain doubles are enough for "trillions and beyond" up to about 1e300 and are the simplest path; precision only matters if numbers that differ hugely are added, which good tuning avoids. Use break_infinity or break_eternity only if the design truly needs to pass 1e308. Both load from a script tag and neither is archived, but only break_eternity had a code release in the past two years. The major risks are NaN and Infinity in saves, not speed.

### Cited Findings
- **Limits.** `Number.MAX_SAFE_INTEGER` = 9007199254740991 (2^53 - 1) — [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER). `Number.MAX_VALUE` is about 1.797e308; larger values become Infinity — [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_VALUE)
- **JSON.** `JSON.stringify([NaN, null, Infinity])` gives `[null,null,null]`; BigInt throws TypeError; objects with `toJSON()` control their own output — [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify)
- **BigInt.** Cannot be used with `Math` methods or mixed with Number in arithmetic; precision can be lost converting back; MDN says only use it when values greater than 2^53 are reasonably expected — [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt)
- **Determinism.** "Many `Math` functions have a precision that's implementation-dependent", and even the same engine on a different OS or architecture can differ — [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math)

**Library status (checked 2026-11-03):**

| Library | Latest on npm | Last code change | Repo signals | Range |
|---|---|---|---|---|
| break_infinity.js | [2.2.0](https://registry.npmjs.org/break_infinity.js/latest) (about 2023-02-26, inferred from a publish timestamp in metadata) | [Latest commits](https://api.github.com/repos/Patashu/break_infinity.js/commits?per_page=6) are README only (2025-08-26, 2025-08-08, 2023-10) | [Not archived, 254 stars, 17 open issues plus PRs](https://api.github.com/repos/Patashu/break_infinity.js) | about 1e(9e15) |
| break_eternity.js | [2.1.3](https://registry.npmjs.org/break_eternity.js/latest), [jsDelivr latest](https://data.jsdelivr.com/v1/packages/npm/break_eternity.js) | [2025-12-07, "[2.1.3] fromString NaN/Infinity/-Infinity"](https://api.github.com/repos/Patashu/break_eternity.js/commits?per_page=6) | [Not archived, 208 stars, 43 open issues plus PRs](https://api.github.com/repos/Patashu/break_eternity.js) | up to 10^^1e308 |
| OmegaNum.js | not checked | [pushed 2026-10-09](https://api.github.com/repos/Naruyoko/OmegaNum.js) | Not archived, 57 stars, 8 open | up to 10{1000}9e15 |

- **break_infinity.** Self-described replacement for decimal.js for games prioritising speed over accuracy, and recommends decimal.js when accuracy matters. Author-run benchmarks against decimal.js: add 2.5x, multiply 2.9x, log10 121x, pow 442x faster; Antimatter Dimensions' script time improved 4.5x after switching. CDN: `https://cdn.jsdelivr.net/npm/break_infinity.js@2` — [README](https://github.com/Patashu/break_infinity.js)
- **break_eternity.** Stores sign, layer, mag. Execution time is "within 2x/0.5x" of break_infinity. It is a drop-in replacement, except `log`, `log2`, `log10` and `ln` return Decimal rather than Number. Operators like `+` do not work; methods return new Decimals. Download and use with a script tag, or use `dist/break_eternity.min.js` or the ESM build — [README](https://github.com/Patashu/break_eternity.js)
- **Serialisation in the libraries.** Both have `toJSON()` returning `toString()` — [break_eternity source](https://raw.githubusercontent.com/Patashu/break_eternity.js/master/src/index.ts), [break_infinity build](https://cdn.jsdelivr.net/npm/break_infinity.js@2.2.0/dist/break_infinity.js). `valueOf()` also returns a string, fields are public and mutable, and `fromString` handles "NaN" and "Infinity" — [break_eternity source](https://raw.githubusercontent.com/Patashu/break_eternity.js/master/src/index.ts). `MAX_SIGNIFICANT_DIGITS` is 17 and `EXP_LIMIT` is 9e15 in both.
- **Precedent for doubles.** Balatro's score limit is the double-precision limit; going past it took mods — [Balatro Wiki](https://balatrowiki.org/w/Blinds_and_Antes), [Talisman](https://github.com/MathIsFun0/Talisman)

### Inferences
- **Where each threat curve hits the limits** [computed]: `1.7^w x 1.02^(w^2)` reaches 1e12 at w=27, 2^53 at w=32, 1e100 at w=96, and overflows at w=177. Constant growth to 2^53 and to overflow: 1.17 takes 234 and 4,521 steps; 1.5 takes 91 and 1,751; 2.0 takes 53 and 1,024. So overflow is a design decision, not a near risk.
- **What precision costs in practice** [computed]:

| Value | Gap between doubles | `x+1===x`? |
|---|---|---|
| 1e12 | 0.00012 | no |
| 1e15 | 0.125 | no |
| 2^53 | 2 | yes |
| 1e18 | 128 | yes |
| 1e21 | 131,072 | yes |
| 1e100 | 1.9e84 | yes |

- **Meaningful rule:** additions smaller than about 1e-16 of the current value vanish, so an enemy at 1e100 HP takes zero damage from a 1e80 hit. Because tuning already keeps a fight within a few orders of magnitude, this rarely shows up. Exact integer equality past 2^53 cannot be relied on; use `<=` and `>=` thresholds only, and do not count things like "number of triggers" in a value that also carries huge magnitudes.
- **`Math.floor` stops doing anything past 2^53.** Keep fractional handling only below it. `Math.floor(1e15+0.5)` still works; at 1e300 it returns the same value. [computed]
- **NaN is the true danger.** `Infinity-Infinity`, `Infinity*0` and `Infinity/Infinity` are NaN, `Math.max(NaN,1)` is NaN, and NaN comparisons are false, so `hp<=0` is never true and a fight never ends. [computed] Balatro's nan outcome is the same issue reaching players. Practical steps: clamp at `Number.MAX_VALUE` in one damage path, and make the sim throw on any non-finite value.
- **Saves.** Infinity and NaN become `null` in JSON and revive as `null` (which then coerces to 0 in arithmetic); `JSON.parse('{"x":1e400}')` gives Infinity. [computed] Validate on load with `Number.isFinite`, keep a save version number, and migrate. Decimal values serialize as strings and need reviving by key. The 2.1.3 break_eternity fix for parsing "NaN" and "Infinity" means saving those values before it could fail, so pin at least that version.
- **Silent library bug class.** Because `valueOf()` returns a string (read in break_eternity's source; check break_infinity before relying on either behaviour), `a<b` on two Decimals compares strings lexicographically and `a+b` concatenates, with no error. Every comparison needs `.lt()` and every sum needs `.add()`, which is a major rewrite and a source of hidden bugs in a game that already has many number paths. Talisman's warning that other mods' comparisons break is the same problem.
- **Performance** [computed, Node on desktop, 2e7 add+mul loops]: plain double about 15-24 ms; a minimal `{m,e}` object stand-in about 785 ms; log-space doubles about 760-820 ms. That is about 40 ns per add+mul against about 1 ns. This is a stand-in, not the real library, which does more. A 1,000-operation turn at 40 ns is 40 µs, so speed is not the limit for a turn-based game. `sim/sim.js` runs about 300 runs in about 45s by its own header, so arithmetic is unlikely to dominate either. Allocation churn on low-end phones during large chains is the case to measure; Talisman's reported retrigger lag points that way.
- **Size and loading.** jsDelivr served both pinned builds with HTTP 200; min builds are 16.6 KB (break_infinity 2.2.0) and 56.9 KB (break_eternity 2.1.3) before compression. [computed] For a no-build, offline-capable game, vendor the pinned min file in `js/` rather than relying on the CDN at runtime. `sim/sim.js` loads scripts with `vm.Script` from an array, so a vendored UMD file slots in as one more entry.
- **Decision rule:**
  1. Default: plain doubles, with all arithmetic that can overflow routed through a few helpers.
  2. Use break_infinity only if numbers must exceed 1e308 and stay below about 1e(9e15). It costs little code, but its npm release is from 2023.
  3. Use break_eternity only for tetration-scale fantasy. Its newer maintenance is a plus, but the size is 3.4x.
  4. Not BigInt: no fractions, no `Math`, and full-precision integers are not useful for game values.
  5. Store log10 values only for threat curves, as a planning tool. It costs as much as objects per add and is awkward for block.
- **Precompute curves as log values when exploring:** `log10 T(w) = w*log10(1.7) + w*w*log10(1.02)` does not overflow and is easy to compare. Tuning tools should use it.
- **Replay determinism.** Because `Math.pow` and `Math.log10` can differ across engines and devices, seeded runs may differ in the last bits. Rounding authored thresholds to 2-3 significant digits (Balatro's approach to its requirements) and avoiding equality checks limits the effect. Use integer-only RNG, and use authored tables rather than recomputed `pow` if a replay must match exactly. Save state, not just seed plus inputs.
- **`toString` switches format at 1e21** ("1e+21"; 1e20 prints all digits), so never build display text from raw `String(x)`. [computed]

### Gaps
- I did not install or benchmark the real libraries on phones; I also avoided downloading packages for this research. The numbers above are a stand-in. A test on a low-end Android device is needed if libraries are adopted.
- npm web pages returned 403; publish dates are inferred from registry metadata timestamps and commit dates, not stated directly. Weekly downloads are unavailable.
- Whether break_infinity's `pad-end` dependency is bundled in the min build was not separately checked, although the README recommends the CDN file directly.
- `localStorage` quota behaviour on mobile browsers was not researched here.

## Tuning method: how to use simulation or spreadsheets to tune a stair-step curve, which metrics to measure, and how bots can stand in for players

### Takeaway
Use a closed-form model first to choose g, B and step count, then use bots to find where real card play breaks the model. The published literature backs simulation as an early warning tool, not a replacement for human data. Metrics should be ratio-based and measured per step.

### Cited Findings
- **Model limits.** Spreadsheet models are rough guides, not accurate simulations; vary parameters across reasonable ranges to capture most behaviour; players may keep going through a fast section and run longer than predicted; balancing is hard and requires iteration — [Kongregate Part III](https://www.gamedeveloper.com/design/the-math-of-idle-games-part-iii)
- **Closed forms for bulk costs.** Bulk cost `b * r^k * (r^n - 1)/(r - 1)` and max affordable `floor(log_r(c(r-1)/(b*r^k) + 1))`, valid only for simple exponential costs. Balance checks compare production against next cost, with the wall defined as when the wait for the next purchase "gets prohibitively long" — [Kongregate Part I](https://www.gamedeveloper.com/design/the-math-of-idle-games-part-i)
- **Polynomial vs exponential.** A `x^k` curve is not exponential and is always eventually outpaced by `k^x` — [GDC Europe 2016 slides](https://www.slideshare.net/slideshow/quest-for-progress-gdc-europe-2016/65405507). With a finite number of generator tiers, growth still lags true exponential — [Part II](https://www.gamedeveloper.com/disciplines/the-math-of-idle-games-part-ii)
- **Metrics in a deckbuilder.** Slay the Spire's team built an analytics tool recording details of every tester game because they could not balance that many cards by hand; every card should have a purpose; metrics are one tool and can mislead — [GDC listing](https://gdconf.com/news/learn-slay-spires-successful-metrics-driven-approach-game-balancing-gdc-2019), [talk summary](https://summ-www.pages.dev/en-GB/summary/slay-the-spire-metrics-driven-design). The summary is secondary; the talk itself is members-only on GDC Vault.
- **Bots at different skill levels.** Planning agents that imitate different skill levels generate playthroughs to derive metrics, demonstrated on Scrabble and a custom card game — [Zook et al. 2019](https://arxiv.org/abs/1908.01423v1)
- **Separate simulator.** The Sims Mobile work recreated core mechanics in a simulator; thousands of simulations surfaced imbalanced actions and weak rewards, leading to shipped changes — [Exploring Gameplay With AI Agents](https://paperswithcode.com/paper/exploring-gameplay-with-ai-agents)
- **Dominion-style set balance.** Mahlmann et al. used three agents and looked for cards appearing in winning sets across all three — [cited in arXiv 1811.06962](https://arxiv.org/pdf/1811.06962.pdf)
- **Restricted play.** Pit deliberately restricted agents against standard ones to measure a rule or card's importance; near-optimal agents avoid weak-AI confounds; framed as an "early warning system" — [AAAI paper](https://cdn.aaai.org/ojs/12513/12513-52-16035-1-2-20201228.pdf)
- **Limits of evolved agents.** A student study on deck-building found imbalances, plus issues with generalisability, training time and practical use — [Swansea conference](https://cs-student-conference.swan.ac.uk/?p=8791)

### Inferences
**Closed-form step (spreadsheet or a small Node script):**
- Steps needed: multiplier per step `B = target^(1/steps)`. [computed]

| Steps | ×/step to 1e12 | ×/step to 1e15 | At 3 min per step |
|---|---|---|---|
| 12 | 10.0 | 17.8 | 36 min |
| 20 | 3.98 | 5.62 | 1 h |
| 30 | 2.51 | 3.16 | 1.5 h |
| 60 | 1.585 | 1.78 | 3 h |
| 120 | 1.259 | 1.33 | 6 h |
| 240 | 1.122 | 1.155 | 12 h |

- Long-run consistency: `B = g^(waves per step)`, so `g = B^(1/waves)`. Example: a 3-hour run with 60 steps and 5 waves per step gives g = 1.585^(1/5) = 1.096. A 1-hour run with 20 steps and 5 waves per step gives g = 3.98^(1/5) = 1.32. Check the time budget too: 5 waves in a 3-minute step leaves 36 seconds per fight, which is tight for turn-based play unless trivial fights are skipped or steps hold fewer waves.
- Comparing to the current curve: `1.7^w x 1.02^(w^2)` has g of 2.58 by w10 and 5.05 by w27, and reaches 1e12 by wave 27. That fits a fast session of perhaps 27 fights, not hours of steps. If it is the target, the burst per 5 waves must be x169 to x4,890 over that span.
- Use a small sawtooth table per wave to check R against planned bursts before touching cards: `R[w+1] = R[w] / g(w) * (burst at w, else 1)`.

**Metrics to report per wave and per step** (from `--json` output):
- Power ratio R(w) distribution: p10, p50, p90 per bot.
- Turns to kill (TTK) and turns to die (TTD), and TTK/TTD. The band where both are finite and comparable is the "tense" band.
- Time to next upgrade, in actions and in estimated seconds; p50 and p90. Part I's wall definition maps to this.
- Waves between bursts and headroom at burst `ln(R)/ln(g)`.
- Share of waves in each R band (trivial, enjoyment, tense, wall). The stair-step target can be stated as a share of each.
- Wall duration: attempts and time before clearing each wall.
- Damage share by source (top-1 share and a concentration index) to catch multiplier dominance; share of value from additive sources.
- Fight dynamic range: max and min relevant numbers per fight.
- Decision leverage: outcome difference between the best bot and a restricted or random policy, per R band. If nothing changes in the tense band, the decisions are not real.
- Overflow watch: max value reached, any non-finite values, closest approach to 2^53 for things that must stay exact.

**Bots as players** (existing: `engine`, `money`, `random`; `--runs`, `--waves`, `--turns`, `--deckcap`, `--json`):
- Use a ladder, as in Zook: `random` as floor, `money` as simple human, `engine` as strong human. Track the gap between them; too small means decisions do not matter, and too large means the game is unwinnable without optimal play.
- Bots have no feel for time. Convert to minutes with a stated model: seconds per decision plus seconds per animation step, under budgeted chain time. Report these as estimates.
- Add a restricted bot that bans the top-damage card or base and reruns; the win-or-wave loss measures dominance (the restricted-play method).
- Add explicit fail-state policy, such as when to retreat or prestige, because Part III warns that player reset behaviour changes the curve. Sweep it as a parameter.
- Add a "skips suboptimal upgrade" bot to measure mistake cost: how many waves does one wrong pick cost? Compare with `ln(B)/ln(g)` from the model.
- Sim loads real game code, which removes the drift risk of a separate simulator such as the Sims Mobile example.
- Sample sizes: about 300 runs takes about 45s by the file header, so overnight parameter sweeps are feasible; use fixed seeds across variants so differences are not noise.
- Parameter sweep order: fix target and steps first, then g, then B distribution, then cards. Treat results as bug-finding and ranges; validate feel with humans, since Slay the Spire's team relied on real-player data and warned metrics mislead.

### Gaps
- No published stair-step tuning playbook specific to incremental deckbuilders was found. The R-band thresholds, TTK ideas and dynamic-range target are my starting assumptions, to be replaced by playtest results.
- Specific win-rate and pick-rate thresholds from the Slay the Spire talk could not be verified, since GDC Vault is members-only.
- Other researchers cover general pacing theory, so I did not research session-length or retention targets.
