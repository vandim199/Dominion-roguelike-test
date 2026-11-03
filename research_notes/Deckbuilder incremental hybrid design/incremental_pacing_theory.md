# Incremental game design theory and the mathematics of pacing

Evidence labels used throughout:
- **[P]** primary source: peer-reviewed paper, or a developer or publisher describing their own numbers.
- **[W]** game wiki.
- **[A]** one developer's anecdote, not validated.
- **[C]** community rule of thumb or opinion.
- **[S]** search snippet only; the page could not be opened, so verify before relying on it.
- **[X]** computed for these notes from the cited formula. It is not a claim made by the source.

Overall evidence caveat: the genre's maths is well documented, but its psychology is mostly not. The academic work is qualitative. Spiel et al. interviewed 6 designers and say their results are not generalisable, and Deterding says he has no evidence linking motives to Cookie Clicker's design beyond his own 8,432 hours of play. Treat psychological claims as plausible frameworks, not measured effects.

## What are the canonical cost and production formulas, and what ranges do real games use?

### Takeaway
Cost compounds with each purchase (`base × r^owned`, with r usually 1.07 to 1.15), while production only grows linearly with the count, so cost always overtakes income. Multipliers exist to pull income back up for a while, and the ratio between r and those multipliers is the main pacing control.

### Cited Findings

**Formulas**
- Next cost: `cost_next = cost_base × r^owned`. Total production: `production = (production_base × owned) × multipliers` — [P] [Pecorella, Math of Idle Games Part I](https://www.gamedeveloper.com/design/the-math-of-idle-games-part-i)
- Bulk-buy cost of n items with k owned: `b × r^k × (r^n − 1) / (r − 1)`. Maximum affordable with currency c: `floor( log_r( c(r−1) / (b × r^k) + 1 ) )`. These only hold for simple exponential costs — [P] [Part I](https://www.gamedeveloper.com/design/the-math-of-idle-games-part-i)
- Generator chains (generators that make generators) follow the series `1, x, x²/2, x³/6, … xⁿ/n!`. More tiers approach true exponential growth, but a finite chain always lags it, so exponential costs still win in the end — [P] [Part II](https://www.gamedeveloper.com/disciplines/the-math-of-idle-games-part-ii)
- Comparing two upgrades: A before B is better when `cost_a/nps + cost_b/(nps+rate_a) < cost_b/nps + cost_a/(nps+rate_b)`. Worked example at 5 income/s: A (cost 20, +1) then B (cost 100, +10) takes 20.67 s, while B then A takes 21.33 s — [Tuts+, Design and Math of Incremental Games](https://code.tutsplus.com/numbers-getting-bigger-the-design-and-math-of-incremental-games--cms-24023a)

**Growth rates in real games**

| Game | Cost multiplier r | Other values | Source |
|---|---|---|---|
| AdVenture Capitalist, Lemonade Stand | 1.07 | Base cost about 4, 1.67/s; ×2 at 25 and 50 owned | [P] [Part I](https://www.gamedeveloper.com/design/the-math-of-idle-games-part-i) |
| AdVenture Capitalist, all 10 businesses | 1.07 to 1.15 | Differs by business | [Tuts+](https://code.tutsplus.com/numbers-getting-bigger-the-design-and-math-of-incremental-games--cms-24023a) |
| Clicker Heroes | 1.07, all 35 heroes (2015 data) | Treebeard: base 50, +5 per level; ×4 per 25 levels | [Tuts+](https://code.tutsplus.com/numbers-getting-bigger-the-design-and-math-of-incremental-games--cms-24023a); [P] [Pecorella GDC Europe 2016 slides](https://www.slideshare.net/slideshow/quest-for-progress-gdc-europe-2016/65405507) |
| Cookie Clicker | 1.15, all buildings | Base cost rises about ×5 per tier (older version data) | [Tuts+](https://code.tutsplus.com/numbers-getting-bigger-the-design-and-math-of-incremental-games--cms-24023a) |
| Derivative Clicker | 1.1 (High School) | `5 × 1.1^n`; +0.05% tier boost per building | [P] [Part II](https://www.gamedeveloper.com/disciplines/the-math-of-idle-games-part-ii) |
| Idle Idol | 1.11 to 1.19 | Cost passes reward near level 35; 40+ upgrades on one sheet | [P] [Idle Idol balancing post](https://gamedeveloper.com/design/balancing-tips-how-we-managed-math-on-idle-idol) |
| Monster (Steam summer sale) | up to 2.5 | Called very steep and punishing | [Tuts+](https://code.tutsplus.com/numbers-getting-bigger-the-design-and-math-of-incremental-games--cms-24023a) |
| One developer's 7 small games | 1.15 default | Linear costs produced a stalled stretch | [A] [aguier, dev.to](https://dev.to/aguier/i-built-7-idle-games-in-30-days-what-i-learned-about-incremental-design-5d3f) |

- Multipliers are described as offsetting cost growth and supplying bumps and small victories. Pecorella's example graphs use ×2 per 100 owned and ×5 per prestige — [P] [GDC Europe slides](https://www.slideshare.net/slideshow/quest-for-progress-gdc-europe-2016/65405507)
- Very small changes matter: a 0.01 difference in the growth factor produces a large gap by the 20th upgrade — [P] [Idle Idol](https://gamedeveloper.com/design/balancing-tips-how-we-managed-math-on-idle-idol)
- Why the curve happens: costs compound per purchase while production is linear in count, so income leads early and cost inevitably overtakes it. The wait for the next purchase then grows until it is impractical, and multipliers and prestige push production back up temporarily — [P] [Part I](https://www.gamedeveloper.com/design/the-math-of-idle-games-part-i)
- **Source conflict:** one post says exponential costs keep the gap between purchases roughly constant — [A] [Novak, dev.to](https://dev.to/sam_novak_574b07811e18495/idle-game-economy-design-what-your-currency-sinks-actually-eat-1non). This contradicts Pecorella's model above and holds only if multipliers match cost growth (see inferences).

### Inferences
All figures below are [X].
- **Wait per purchase:** `T(n) = b × r^n / (p × n × M)`. Between milestones T grows by `r × n/(n+1)` per purchase, which tends to r. The wait is lowest at `n = 1/ln r` (14.8 owned at r=1.07, 7.2 at r=1.15). This explains the fast opening: waits shrink until that point, then lengthen forever.
- **Wait doubling time:** every `ln 2 / ln r` purchases, which is 10.2 at 1.07, 5.0 at 1.15, 3.1 at 1.25, 1.7 at 1.5 and 1.0 at 2.0.
- **The key balance ratio:** a milestone every s purchases holds waits constant only if `M = r^s`. The net change in wait per milestone step is `r^s / M` at high counts, and somewhat smaller at low counts because each purchase also adds income:

| Setup | r^s | Net wait change per step |
|---|---|---|
| r=1.15, ×4 per 10 | 4.05 | ×1.01 (almost flat) |
| Clicker Heroes, r=1.07, ×4 per 25 | 5.43 | ×1.36 |
| AdVenture Capitalist early, r=1.07, ×2 per 25 | 5.43 | ×2.71 |
| r=1.15, ×2 per 25 | 32.9 | ×16.5 |
| Talk's graph, r=1.07, ×2 per 100 | 868 | ×434 |

- **Purchases needed to reach a price of 1e12** (base price 10): 374 at r=1.07, 181 at 1.15, 114 at 1.25, 63 at 1.5, 37 at 2.0, 28 at 2.5, 23 at 3.0. If most growth runs through one price track, a turn-based game with few purchases per minute cannot use clicker-style rates without far more purchases than a session allows, so it needs steeper r or larger multipliers.
- **Generator chains:** time to reach 1e12 with k tiers at unit rates, from `t = (k! × 1e12)^(1/k)`: k=3 gives 18,171 ticks, k=4 gives 2,213, k=5 gives 654, k=6 gives 299, k=8 gives 119.
- **Tier payback:** base cost ÷ base income in the Tuts+ Cookie Clicker table climbs from about 150 s (Cursor) to 7,500 s (Prism), which is how later tiers become less efficient while still increasing total income.

### Gaps
- Pecorella's multiplier tables and spreadsheet values are images or external files (the slides reference kon.gg/idle-math-spreadsheets), so they were not extracted.
- The Tuts+ data is from about 2015. Current values may differ after patches.

## How is a sawtooth or stair-step curve deliberately built?

### Takeaway
A burst is a threshold multiplier landing on a rising cost curve: it cuts the wait instantly and triggers a run of rapid purchases. The plateau lasts until compounding cost erases that gain, and the wall follows. The designer controls the shape through multiplier size M, milestone spacing s and growth rate r. I found no game that publishes a target interval between upgrades, so duration figures below are anecdotal or derived.

### Cited Findings
- Pecorella's prestige model shows bumps of rapid purchases at 300, 400 and 500 generators where multipliers trigger, and a long stall beginning at 120 minutes that breaks at 500 generators when a 16× multiplier fires. He says this is for rough feel and not an accurate simulation — [P] [Part III](https://www.gamedeveloper.com/design/the-math-of-idle-games-part-iii)
- Reset timing should vary, with slow and fast phases, in the same way the rest of the progression does — [P] [Part III](https://www.gamedeveloper.com/design/the-math-of-idle-games-part-iii)
- Variable time between prestiges can come from multipliers based on owned counts. Early progress after a prestige should feel quick, and players should reach a valuable prestige point regularly — [P] [GDC Europe slides](https://www.slideshare.net/slideshow/quest-for-progress-gdc-europe-2016/65405507)
- A Tap Titans artist describes the same cycle from the player's side: easy passage through early stages after a prestige, then a wall that prompts planning for the next run. Designers alternate busy phases and enforced idleness to create ebb and flow in tension — [P] [Spiel et al. 2019](https://par.nsf.gov/servlets/purl/10174274)
- Cost scaling is used to create suspense, and system changes create moments of surprise and climax — [P] [Spiel et al. 2019](https://par.nsf.gov/servlets/purl/10174274)
- Base costs rising about ×5 per tier give players time to enjoy each unlock — [Tuts+](https://code.tutsplus.com/numbers-getting-bigger-the-design-and-math-of-incremental-games--cms-24023a)
- The final cost formula in Idle Idol was built on the growth of the exponent, not the raw number, which the author says kept pacing steady — [P] [Idle Idol](https://gamedeveloper.com/design/balancing-tips-how-we-managed-math-on-idle-idol)
- A Clicker Heroes guide gives player-facing wall signals: a boss you cannot beat within the time limit even after upgrades, or a single zone taking minutes. Its active skills can then push 10 to 20 more zones before a reset. The guide appears on the official blog, but its quality is uneven — [Clicker Heroes blog](https://blog.clickerheroes.com/clicker-heroes-hero-souls-complete-guide-to-power-up/)
- Monster health scaling reported by the community: ×1.145 per zone for zones 140 to 500, ×1.15 for 500 to 1000, ×1.155 for 1000 to 1500. This is a 2016 forum figure and may be outdated — [C] [r/ClickerHeroes thread](https://axebps-redlib.hf.space/r/ClickerHeroes/comments/4naohc/math_and_transcendance)

**Duration evidence**

| Interval | Value | Quality |
|---|---|---|
| First upgrade purchasable | within 60 s | [A] [aguier](https://dev.to/aguier/i-built-7-idle-games-in-30-days-what-i-learned-about-incremental-design-5d3f) |
| First automation | within 3 min | [A] [aguier](https://dev.to/aguier/i-built-7-idle-games-in-30-days-what-i-learned-about-incremental-design-5d3f) |
| Each phase transition | 3 to 5 min of active play | [A] [aguier](https://dev.to/aguier/i-built-7-idle-games-in-30-days-what-i-learned-about-incremental-design-5d3f) |
| First prestige | 10 to 15 min (aguier); 25 to 35 min actual, 15 to 20 wanted (Doomscroll 2077) | [A] [aguier](https://dev.to/aguier/i-built-7-idle-games-in-30-days-what-i-learned-about-incremental-design-5d3f); [A] [Doomscroll 2077 post, dev.to](https://dev.to/tanishpaul1106/aura-data-and-prestige-designing-the-economy-of-doomscroll-2077-293f) |
| Active skill cooldowns | 5 min to a few hours | [P] [GDC Europe slides](https://www.slideshare.net/slideshow/quest-for-progress-gdc-europe-2016/65405507) |
| AdVenture Capitalist early income | $390/s in under 10 min | [P] [Alharthi et al. 2018](https://par.nsf.gov/servlets/purl/10061230) |
| Fast growth phase, AdVenture Capitalist and Cookie Clicker | first 8 to 10 hours, then marginal gains | [Tuts+](https://code.tutsplus.com/numbers-getting-bigger-the-design-and-math-of-incremental-games--cms-24023a) |
| Cookie Clicker Bingo Center unlock | about 200 hours into a first playthrough | [P] [Deterding 2019](https://eprints.whiterose.ac.uk/146788/1/25_Deterding_draft_final_180515_SDE.pdf) |

### Inferences
All figures below are [X] unless noted.
- **Plateau length in purchases:** after a ×M burst, the wait returns to its pre-burst value after `ln M / ln r` purchases.

| M | r=1.07 | r=1.15 |
|---|---|---|
| ×2 | 10.2 | 5.0 |
| ×4 | 20.5 | 9.9 |
| ×10 | 34.0 | 16.5 |
| ×16 | 41.0 | 19.8 |
| ×100 | 68.1 | 33.0 |

The same formula says how far a permanent multiplier carries: ×K production buys `ln K / ln r` extra levels.

- **Simulation** (single generator, r=1.07, base 4, 1.67/s, buying one at a time):

| Purchase | ×2 per 25: wait / elapsed | ×4 per 25: wait / elapsed |
|---|---|---|
| 25 | 0.51 s / 18 s | 0.51 s / 18 s |
| 26 (after burst) | 0.26 s / 18 s | 0.13 s / 18 s |
| 100 | 2.45 s / 79 s | 0.31 s / 32 s |
| 150 | 12.0 s / 310 s | 0.38 s / 41 s |
| 200 | 66.2 s / 1,540 s | 0.52 s / 54 s |
| 300 | not run | 1.17 s / 99 s |

Going from ×2 to ×4 at the same spacing changes the curve from a rapidly lengthening wait to a slowly rising one. In this model each ×2 burst only halves the wait, and the next 25 purchases raise it by roughly ×4 to ×5.

- **Reaching 1e12:** this is 12 orders of magnitude, or 39.9 doublings. Multiplier needed per burst is `10^(12/N)`:

| Bursts N | 6 | 8 | 10 | 12 | 15 | 20 | 24 | 30 | 40 |
|---|---|---|---|---|---|---|---|---|---|
| × per burst | 100 | 31.6 | 15.8 | 10 | 6.3 | 4.0 | 3.2 | 2.5 | 2.0 |

At the brief's 1 to 5 minutes per burst, 10 bursts means 10 to 50 minutes and 40 bursts means 40 to 200 minutes. Across several runs, permanent multipliers supply part of that total.

- **Challenge-side version of the same maths.** This headroom model is mine, not from a source. Let headroom `h = player power ÷ challenge`. It falls by 1/g each step when challenge grows ×g per step. A burst of ×M every n steps is stable when `g^n = M`. If headroom right after a burst is h₀, the comfortable plateau lasts `log_g(h₀)` steps, and the rest of the interval is the wall. So plateau-to-wall ratio is set by h₀, independently of how large the numbers are.
- **Growth per step for a given burst size** (`g = M^(1/n)`):

| M | n=5 | n=10 | n=15 | n=20 |
|---|---|---|---|---|
| ×4 | 1.320 | 1.149 | 1.097 | 1.072 |
| ×10 | 1.585 | 1.259 | 1.166 | 1.122 |
| ×16 | 1.741 | 1.320 | 1.203 | 1.149 |
| ×100 | 2.512 | 1.585 | 1.359 | 1.259 |

- **Growth per step to cover 1e12 in total:** 50 steps needs ×1.738, 100 needs ×1.318, 200 needs ×1.148, 300 needs ×1.096. The ×1.148 case matches the Clicker Heroes community range: 1.148^200 ≈ 0.97e12.
- **How intervals stretch:** aguier's targets (1, 3, then 10 to 15 minutes) grow by about ×3 to ×4 per milestone, and Cookie Clicker's run to hundreds of hours. Together with Pecorella's model this suggests intervals are expected to stretch geometrically within a run and then compress after a reset. That is a pattern read across sources, not a stated rule.

### Gaps
- I found no published target, from any well-regarded game, for minutes between meaningful upgrades. The 3 to 5 minute figure comes from one developer's small games.
- I found no data on plateau-to-wall time ratios. The Clicker Heroes boss-health and timer figures conflict across sources (boss multiplier cited as both about 10× and 100× of regular monsters) and could not be confirmed, since the wiki blocked access.

## How do prestige and reset layers work?

### Takeaway
Prestige trades current progress for a slower-growing currency that permanently boosts production, usually via a root or log of earnings. The exponent decides how much more you must earn to double it: ×4 for square root, ×8 for cube root, about ×130 to ×140 for Egg, Inc. Published rule of thumb is to reset when you would gain +50% to +200% prestige currency, and there is no canonical number of layers.

### Cited Findings

**Formula table** (c_L = lifetime earnings, c_M = max earnings, c_R = this run)

| Game | Formula | Earnings needed to double | Same-point reset pays? | Source |
|---|---|---|---|---|
| Realm Grinder | `p = (√(1 + 8·c_M/1e12) − 1) / 2` | ×4 | No | [P] [Part III](https://www.gamedeveloper.com/design/the-math-of-idle-games-part-iii) |
| AdVenture Capitalist | `p = 150·√(c_L/1e15)` | about ×3 to ×4 | Yes, with diminishing returns | [P] [Part III](https://www.gamedeveloper.com/design/the-math-of-idle-games-part-iii) |
| Cookie Clicker | `p = ∛(c_L/1e12)` | about ×8 | Must gain at least +1 level | [P] [Part III](https://www.gamedeveloper.com/design/the-math-of-idle-games-part-iii); [W] [Cookie Clicker wiki](https://cookieclicker.wiki.gg/wiki/Prestige) |
| Egg, Inc. | `Δp = (c_R/1e6)^0.14` | about ×128 per Pecorella | Yes, equal value per run | [P] [Part III](https://www.gamedeveloper.com/design/the-math-of-idle-games-part-iii) |
| Clicker Heroes | 1 soul per 2,000 hero levels, plus boss souls | Linear in levels | Yes, same amount | [P] [GDC Europe slides](https://www.slideshare.net/slideshow/quest-for-progress-gdc-europe-2016/65405507); [P] [Part III](https://www.gamedeveloper.com/design/the-math-of-idle-games-part-iii) |
| Antimatter Dimensions, Infinity | `IP = floor(mult × 10^(log10(AM)/308 − 0.75))` after Break Infinity; 1 per crunch before it | ×1e308 AM gives ×10 IP | Yes, based on highest AM this run | [W] [AD wiki, Infinity](https://antimatterdimensions.wiki.gg/wiki/Infinity) |
| Antimatter Dimensions, Eternity | `EP = floor(mult × 5^(log10(IP)/308 − 0.7))` at 1.80e308 IP | ×1e308 IP gives ×5 EP | Yes, based on highest IP this run | [W] [AD wiki, Eternity](https://antimatterdimensions.wiki.gg/wiki/Eternity) |

The AD formulas were garbled on the page and are my reading of them. They reproduce the wiki's stated values of about 1.78 IP and 1.62 EP at the threshold.

**Offering and timing**
- Rule of thumb: reset when you would gain +50% to +200% prestige currency. Prestige currency is usually scaled by log or a fractional exponent, so it grows at a slower order of magnitude than the main currency — [P] [GDC Europe slides](https://www.slideshare.net/slideshow/quest-for-progress-gdc-europe-2016/65405507)
- Predicting when players will reset is difficult, and most can be captured by varying within reasonable ranges. A player who just hit a big milestone is likely to keep going for a while — [P] [Part III](https://www.gamedeveloper.com/design/the-math-of-idle-games-part-iii)
- Lifetime-based formulas keep rewarding advancement, while per-run formulas favour repeated resets at a plateau — [P] [Part III](https://www.gamedeveloper.com/design/the-math-of-idle-games-part-iii)
- Cycle speed is a choice: faster cycles push players toward higher prestige points, slower cycles tire players and call for a meta prestige, and varied cycles surprise but are harder to design — [P] [GDC Europe slides](https://www.slideshare.net/slideshow/quest-for-progress-gdc-europe-2016/65405507)
- First reset timing: "Make the first one faster than feels right." The same author says players who reach the first reset usually stay, and that resets must cost something to matter — [A] [Doomscroll 2077 post, dev.to](https://dev.to/tanishpaul1106/aura-data-and-prestige-designing-the-economy-of-doomscroll-2077-293f)
- A test for prestige strength: the next run should feel noticeably faster within 30 seconds. Sample curve: `bonus = floor(√(points/1000))`, `multiplier = 1 + 0.1·bonus`, giving 1.1×, 1.2×, 1.3× at 1,000, 4,000 and 9,000 points — [A] [aguier](https://dev.to/aguier/i-built-7-idle-games-in-30-days-what-i-learned-about-incremental-design-5d3f)

**What resets and what persists**
- Antimatter Dimensions Big Crunch loses antimatter, dimensions, tickspeed, galaxies, boosts and replicanti, and keeps achievements and statistics. The first crunch opens new tabs (upgrades, Break Infinity, Replicanti, challenges) — [W] [AD wiki, Infinity](https://antimatterdimensions.wiki.gg/wiki/Infinity)
- Eternity additionally resets Infinity Points, upgrades and challenge completions, keeping achievements and general statistics — [W] [AD wiki, Eternity](https://antimatterdimensions.wiki.gg/wiki/Eternity)
- Cookie Clicker gives +1% production per level, additive (`1 + 0.01·P`). Heavenly Chips are earned 1:1 with levels, spent on upgrades and kept through later ascensions — [W] [Cookie Clicker wiki](https://cookieclicker.wiki.gg/wiki/Prestige)
- Some games let players spend prestige currency on boosts at the cost of part of its production bonus — [P] [GDC Europe slides](https://www.slideshare.net/slideshow/quest-for-progress-gdc-europe-2016/65405507)
- Kittens Game uses New Game+: the more resets, the faster and richer later games become — [P] [Alharthi et al. 2018](https://par.nsf.gov/servlets/purl/10061230)

**Layers and run lengths**
- Antimatter Dimensions has three main stages: Infinity, Eternity and Reality — [W][S] [AD wiki, Celestials](https://antimatterdimensions.wiki.gg/wiki/Celestials)
- Clicker Heroes has Ascension, then Transcendence (earliest after zone 300), which resets Hero Souls, Ancients and Gilds for Ancient Souls. Guides suggest a first ascension around zone 130 — [Clicker Heroes blog](https://blog.clickerheroes.com/clicker-heroes-hero-souls-complete-guide-to-power-up/); the zone 300 figure is [S] from the [Clicker Heroes blog](https://blog.clickerheroes.com/), exact post not identified
- Revolution Idle: Prestige at 1M score, Promote at 1000× P.Mult, Infinity at 1.79e308, Infinity Break after 9 challenges, then Stars. Suggested prestige steps are ×6, ×10, ×1000, ×100,000. Runs after Infinity Break are under a minute or 5 to 30 minutes. The source is an uncredited guide with no version number — [C] [GamerBlurb guide](https://gamerblurb.com/articles/revolution-idle-beginners-guide)
- NGU Idle players report 30-minute rebirths early and 24-hour rebirths later, with 15, 12, 10 and 7-minute runs when farming XP. Some bonuses scale with a rebirth time factor — [C][S] [NGU Idle Steam discussions](https://steamcommunity.com/app/1147690/discussions/); 24-hour schedule in [C] [Sayo's guide](https://sayolove.github.io/ngu-guide/en/chapters/chapter-5)
- Melvor Idle's documented long-term structure is a Mastery Pool: cap of 500,000 × item count, checkpoints at 10%, 25%, 50% and 95%, a +5% Mastery XP bonus at 10%, and pool share rising from 25% to 50% after skill level 99 — [W][S] [Melvor wiki, Mastery pool](https://wiki.melvoridle.com/w/Mastery_pool)
- Egg, Inc.'s sub-prestige loop multiplies earnings by about ×5 per step — [P] [Part III](https://www.gamedeveloper.com/design/the-math-of-idle-games-part-iii)
- After three prestiges, acceleration is noticeable, and after ten it is a very different game, according to one developer — [A] [Doomscroll 2077 post, dev.to](https://dev.to/tanishpaul1106/aura-data-and-prestige-designing-the-economy-of-doomscroll-2077-293f)

### Inferences
All figures below are [X].
- Doubling multiple is `2^(1/α)` for `p ∝ c^α`: ×4 at α=½, ×8 at α=⅓, ×141 at α=0.14 (Pecorella rounds to 128, or 2⁷), and about 10^92.7 at AD's α=1/308.
- Earnings multiple needed to hit the rule-of-thumb reset window:

| Exponent | +50% currency | +100% | +200% |
|---|---|---|---|
| Square root | ×2.25 | ×4 | ×9 |
| Cube root | ×3.38 | ×8 | ×27 |
| 0.14 | ×18 | ×141 | ×2,559 |

- Prestige gain from ×10 earnings: ×3.16 with square root, ×2.15 with cube root, ×1.38 at 0.14. From ×1,000: ×31.6, ×10, ×2.63.
- Realm Grinder's formula is the inverse of triangular numbers: `p(p+1)/2 = c_M/1e12`, so prestige 1, 2, 3, 4, 10 needs 1, 3, 6, 10, 55 trillion. This gives a clean way to tie a prestige level to a trillions-scale target.
- Cookie Clicker's first level arrives at exactly 1 trillion lifetime cookies, and AdVenture Capitalist gives 150 angels at 1e15. Both start their prestige formula at a large earnings threshold, so "trillions" is an established scale for a first prestige.
- AD's layers repeat one idea: compress an enormous number into a small one, then let that small number grow to the same enormous threshold. Its 1.80e308 threshold equals the JavaScript double limit (see the number section).

### Gaps
- No primary source prescribes how many layers a game should have. Among the games checked, counts range from 1 (Cookie Clicker) to 3 or more (Antimatter Dimensions), but I found no outcome data linking counts to retention.
- I found no reliable playtime figures for reaching Infinity, Eternity or Reality in Antimatter Dimensions.
- NGU Idle and Melvor Idle wikis blocked access. I could not confirm NGU's rebirth rules, or whether Melvor has any reset layer. One third-party tool's docs claim [Melvor has several prestige-like layers](https://livingfailure93.github.io/Simple-IDLE-Forge-Docs/prestige-forge.html), but that is unverified and conflicts with what the wiki excerpts cover.
- Realm Grinder details beyond Pecorella's formula were not retrieved.

## What is known about the psychology?

### Takeaway
The best-supported frame is that players respond to visible progress, goals, curiosity and system-level surprise. Incremental players skew toward achievement and power over mastery. Designers rate new mechanics ("paradigm shifts") as the core story beats, and big numbers appear to work through comparison with where the player started, not through size itself.

### Cited Findings
- **Progress:** Amabile's work on diaries covering more than 12,000 hours of work life found meaningful progress to be the top motivator. Deterding applies this to the constant upward counters in Cookie Clicker. He warns that this link is his interpretation from auto-ethnography — [P] [Deterding 2019](https://eprints.whiterose.ac.uk/146788/1/25_Deterding_draft_final_180515_SDE.pdf)
- **Achievement over mastery:** Yee and Ducheneaut separate achievement (completion, growing power) from mastery (overcoming challenges), and incremental players predominantly seek the former — [P] [Deterding 2019](https://eprints.whiterose.ac.uk/146788/1/25_Deterding_draft_final_180515_SDE.pdf). Pecorella's talk reports the same top motivators (Completion and Power) and an audience of 70% "core" and 20% "hardcore" — [P] [GDC Europe slides](https://www.slideshare.net/slideshow/quest-for-progress-gdc-europe-2016/65405507)
- **Goals:** clear, taxing but attainable goals raise effort, and Cookie Clicker's counters always suggest several near-term goals, such as seven more of a building to unlock its upgrade — [P] [Deterding 2019](https://eprints.whiterose.ac.uk/146788/1/25_Deterding_draft_final_180515_SDE.pdf)
- **Curiosity and surprise:** for a new player it is a mystery which upgrades and achievements exist. Hidden content such as the Grandmapocalypse and comic flavour text supply novelty — [P] [Deterding 2019](https://eprints.whiterose.ac.uk/146788/1/25_Deterding_draft_final_180515_SDE.pdf)
- **New mechanics versus bigger numbers:** Spiel's interviewees treat "paradigm shifts" as narrative beats. Kittens Game's developer names this as a favourite concept, and Frank Lantz describes a method of setting a rhythm, adding a twist, then playing variations on it. Each shift starts a new cycle of exploring, experimenting and optimising — [P] [Spiel et al. 2019](https://par.nsf.gov/servlets/purl/10174274)
- **Upgrades that change behaviour:** one developer's lesson is that upgrades should change how you play, not only raise a stat — [A] [aguier](https://dev.to/aguier/i-built-7-idle-games-in-30-days-what-i-learned-about-incremental-design-5d3f). The Gnorp Apologue simulates units individually so upgrades can do more than add a percentage — [P] [Game Developer interview](https://gamedeveloper.com/design/interview-the-gnorp-apologue)
- **Anticipation and planning:** the central experience is said to shift from playing to planning as the growth curve goes on, and experts interact less but think more strategically — [P] [Alharthi et al. 2018](https://par.nsf.gov/servlets/purl/10061230)
- **Waiting can be satisfying:** Keogh and Richardson report players taking satisfaction in the waiting and frowning on paying to skip it — [P] (cited in [Spiel et al. 2019](https://par.nsf.gov/servlets/purl/10174274))
- **Automation as reward:** idle games tend to give more reward for doing less as they progress, and most include mechanics that automate play. Queues let players hand off remembering plans while increasing control over outcomes — [P] [Alharthi et al. 2018](https://par.nsf.gov/servlets/purl/10061230)
- **Delegation:** Fizek describes the pleasure as progress without direct play, or outsourcing play to the game — [P] (cited in [Spiel et al. 2019](https://par.nsf.gov/servlets/purl/10174274))
- **Direct control can interfere:** The Gnorp Apologue's designer felt direct character control got in the way of enjoying growth, and draws units in large numbers so growth is visible — [P] [Game Developer interview](https://gamedeveloper.com/design/interview-the-gnorp-apologue)
- **Autonomy paradox:** compelling engagement can deplete the joy of autonomous play, and players may respond with protest play — [P] [Deterding 2019](https://eprints.whiterose.ac.uk/146788/1/25_Deterding_draft_final_180515_SDE.pdf)
- **Number perception, logarithmic account:** Dehaene's review argues the mental number line seems logarithmic and links this to Weber's and Fechner's work — [P] [Dehaene 2003](https://homepage.uni-tuebingen.de/andreas.nieder/Dehaene%282003%29TICS.pdf). This is contested: a 2022 study explains compression through response effects, not an intrinsic logarithmic code — [P] [Psychological Science 2022](https://journals.sagepub.com/doi/reader/10.1177/09567976211034501)
- **Number perception in games:** 1e1000 to 1e1001 feels far weaker than 1e10 to 1e100, a button that only adds a zero would not satisfy, and the appeal is big numbers in context — [C] [The Paper Pilot, Guide to Incrementals](https://code.incremental.social/thepaperpilot/pages/raw/commit/8c509e7595bdd99e827065ef8f49c8e1abece509/guide-to-incrementals/ludology/appeal-gamers/index.html). Tuts+ similarly argues poor intuition for large numbers lets rising numbers feel rewarding without external meaning — [Tuts+, why they are fun](https://code.tutsplus.com/numbers-getting-bigger-what-are-incremental-games-and-why-are-they-fun--cms-23925a)
- **Limit of distinguishability:** one 2015 community comment says numbers stop being distinguishable past about the quadrillions, and that rising proportions may feel better than raw size — [C][S] [r/incremental_games thread](https://libreddit.neb.cx/r/incremental_games/comments/33ezz6/web_work_wednesday_20150422)

### Inferences
- Under both the Paper Pilot view and the logarithmic account, a ×10 step should look much the same at any scale, so felt pacing tracks orders of magnitude gained per minute, not absolute values. This is a hypothesis; I found no controlled test of it in games.
- At 12 orders of magnitude, a trillions target is modest for the genre (Antimatter Dimensions' first threshold is 1.8e308), so it can be reached without exotic notation. Trillions also stays inside the comparison range the community comment considers still distinguishable.
- A deckbuilder audience may want mastery more than the achievement-oriented incremental audience, which suggests the two motivations should each have their own source of reward. This is reasoning from the motivation split above, not a finding about hybrid games.

### Gaps
- Quantic Foundry's primary data on idle players could not be opened (HTTP 403), so the motivation findings come from Deterding and Pecorella's citations.
- I found no experiment that isolates anticipation or a burst's timing in incremental games, and none that compares a new mechanic against an equal-size multiplier.

## How do these games stop numbers becoming meaningless?

### Takeaway
They add layers that change what the number means (prestige conversion), new resources and mechanics that restart the player's learning, and context that makes numbers comparable or visible. Hard caps and compression systems are also used when numbers run away.

### Cited Findings
- Some games added systems that substantially rein in numbers, such as Realm Grinder's Reincarnations and AdVenture Capitalist's Mega Bucks — [P] [Part III](https://www.gamedeveloper.com/design/the-math-of-idle-games-part-iii)
- Antimatter Dimensions caps antimatter at 1.80e308 until the player breaks Infinity, and each crunch compresses that number into a single point — [W] [AD wiki, Infinity](https://antimatterdimensions.wiki.gg/wiki/Infinity)
- Multipliers can depend on the target generator, other generators, meta statistics or external data, and ownership-tied milestones can build collecting into the mechanics (AbyssRium) — [P] [GDC Europe slides](https://www.slideshare.net/slideshow/quest-for-progress-gdc-europe-2016/65405507)
- Derivative chains give lower tiers visible scale as higher ones arrive, which Pecorella likens to several idle games running at once. Derivative Clicker keeps manual buys meaningful by basing cost on purchased counts and adding tier boosts — [P] [Part II](https://www.gamedeveloper.com/disciplines/the-math-of-idle-games-part-ii)
- Aggressive multipliers can keep small generators relevant — [P] [GDC Europe slides](https://www.slideshare.net/slideshow/quest-for-progress-gdc-europe-2016/65405507)
- Pecorella's advice is to decide where the fun lies (unlocking features, collecting achievements or optimising resets) and focus balancing there — [P] [Part III](https://www.gamedeveloper.com/design/the-math-of-idle-games-part-iii)
- Universal Paperclips uses a three-act structure in which each act changes interface and scale. Spiel et al. advise understanding functions as storytelling, letting narrative beats guide the maths, and keeping variables semantically coherent within the game's world — [P] [Spiel et al. 2019](https://par.nsf.gov/servlets/purl/10174274)
- Progressive disclosure: Trimps and Kittens unfold features gradually and show what comes next and how to get it. One developer shows only the next 2 to 3 upgrades — [P] [Alharthi et al. 2018](https://par.nsf.gov/servlets/purl/10061230); [A] [aguier](https://dev.to/aguier/i-built-7-idle-games-in-30-days-what-i-learned-about-incremental-design-5d3f)
- Making numbers legible: Kittens tooltips show real-world time to reach a goal, helping players compare build orders — [P] [Alharthi et al. 2018](https://par.nsf.gov/servlets/purl/10061230)
- Comparison gives meaning: the sense of progress comes from contrasting where you are against where you began — [C] [The Paper Pilot](https://code.incremental.social/thepaperpilot/pages/raw/commit/8c509e7595bdd99e827065ef8f49c8e1abece509/guide-to-incrementals/ludology/appeal-gamers/index.html)
- Comedy and flavour carry meaning in Cookie Clicker through whimsical items and text — [P] [Deterding 2019](https://eprints.whiterose.ac.uk/146788/1/25_Deterding_draft_final_180515_SDE.pdf)
- JavaScript specifics: integers are exact up to 9,007,199,254,740,991 (about 9 quadrillion), and the largest double is about 1.797e308 — [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER)

### Inferences
- Antimatter Dimensions' 1.80e308 threshold equals the JavaScript double limit, so a technical limit became a story beat.
- A trillions-scale vanilla-JS game fits in ordinary doubles with exact integers, up to about 9 quadrillion. Display rounding or a big-number library is only needed if later layers go past that.
- Permanent qualitative upgrades such as extra board slots belong to the same category as Cookie Clicker's Heavenly Upgrades and Antimatter Dimensions' first-crunch unlocks: rewards that keep value after numbers reset. They also change the set of decisions available, which fits the paradigm-shift finding.

### Gaps
- No numeric detail was retrieved for how Mega Bucks or Reincarnations rein in numbers.
- I found no primary source defining softcaps in a general way, nor measuring player response to them.

## Which beginner explanations and glossary terms should be conveyed?

### Takeaway
A newcomer needs one sentence (earn a number, spend it to make the number grow faster, then eventually start over stronger), a dozen terms, and one picture of the stair-step curve.

### Cited Findings

**Core loop in plain words**
- An incremental game has a number that grows with little effort. You spend it on things that make it grow faster: accumulate, reinvest, accelerate. That loop is what separates it from a game that just has a rising score — [Tuts+, why they are fun](https://code.tutsplus.com/numbers-getting-bigger-what-are-incremental-games-and-why-are-they-fun--cms-23925a)

**Glossary**
- **Idle game:** progresses without player input for a time; waiting is play, with flexible return and no game over — [P] [Alharthi et al. 2018](https://par.nsf.gov/servlets/purl/10061230)
- **Incremental game:** an idle game where you pick resources to generate, wait, then spend to automate generation. Terms are used loosely: idle, incremental, clicker, ambient and background overlap in practice — [P] [Alharthi et al. 2018](https://par.nsf.gov/servlets/purl/10061230)
- **Clicker:** clicking or tapping is a core action, usually fading as automation arrives — [P] [Alharthi et al. 2018](https://par.nsf.gov/servlets/purl/10061230)
- **Generator:** something you buy that produces currency over time. **Derivative** games have generators that produce other generators — [P] [Part II](https://www.gamedeveloper.com/disciplines/the-math-of-idle-games-part-ii)
- **Growth rate (cost multiplier):** the r in `base × r^owned`; at r=1.07 each purchase costs 7% more — [P] [Part I](https://www.gamedeveloper.com/design/the-math-of-idle-games-part-i)
- **Milestone multiplier:** a bonus at an ownership threshold, such as ×2 at 25 owned — [P] [Part I](https://www.gamedeveloper.com/design/the-math-of-idle-games-part-i)
- **Bulk buy:** buying many at once, sometimes in multiples of 100 — [P] [Part I](https://www.gamedeveloper.com/design/the-math-of-idle-games-part-i)
- **Prestige:** give up production for a permanent bonus, similar to New Game+. Also known by game-specific names: Ascension, Rebirth, Big Crunch — [P] [GDC Europe slides](https://www.slideshare.net/slideshow/quest-for-progress-gdc-europe-2016/65405507); [W] [AD wiki](https://antimatterdimensions.wiki.gg/wiki/Infinity); [W] [Cookie Clicker wiki](https://cookieclicker.wiki.gg/wiki/Prestige)
- **Prestige currency:** what the reset pays out. Examples are Heavenly Chips, Hero Souls and Infinity Points — [W] [Cookie Clicker wiki](https://cookieclicker.wiki.gg/wiki/Prestige); [Clicker Heroes blog](https://blog.clickerheroes.com/clicker-heroes-hero-souls-complete-guide-to-power-up/); [W] [AD wiki](https://antimatterdimensions.wiki.gg/wiki/Infinity)
- **Meta prestige (layer):** a prestige on top of a prestige that resets the lower one — [P] [GDC Europe slides](https://www.slideshare.net/slideshow/quest-for-progress-gdc-europe-2016/65405507)
- **Wall:** the point where progress effectively stops, such as a boss you cannot beat after upgrading — [Clicker Heroes blog](https://blog.clickerheroes.com/clicker-heroes-hero-souls-complete-guide-to-power-up/)
- **Plateau or bottleneck:** a phase of reduced action built into the curve — [P] [Alharthi et al. 2018](https://par.nsf.gov/servlets/purl/10061230)
- **Offline progress:** gains while the game is closed, sometimes capped (Egg, Inc.: 2 hours) — [P] [Part III](https://www.gamedeveloper.com/design/the-math-of-idle-games-part-iii)
- **Paradigm shift:** the game changes what you are doing, not only the numbers — [P] [Spiel et al. 2019](https://par.nsf.gov/servlets/purl/10174274)
- **Soft cap:** community term for the point where growth keeps going but can no longer keep pace — [C][S] [r/ClickerHeroes thread](https://pol1.lr.ggtyler.dev/r/ClickerHeroes/comments/7wwf16/the_hopelessness_of_progression_above_soft_cap)
- **Sink:** something that consumes currency. A sink that runs out leaves currency piling up with nothing to spend it on — [A] [Novak, dev.to](https://dev.to/sam_novak_574b07811e18495/idle-game-economy-design-what-your-currency-sinks-actually-eat-1non)

### Inferences
- A helpful plain explanation of the stair-step curve: prices climb on a slope, while your power climbs in jumps. Right after a jump you are ahead of the slope and everything feels easy. Then the slope catches you, and that is the wall. The next jump puts you ahead again.
- "Sawtooth" and "stair-step" are shape descriptions I did not find formally defined. Sawtooth fits a meter that drops at each reset (Pecorella's chart of generators owned falling to 0), while stair-step fits power that jumps and holds.
- `1e12` means a 1 followed by 12 zeros, or one trillion, and is worth explaining early, since it appears throughout the genre's discussion.

### Gaps
- r/incremental_games' own wiki and glossary could not be opened, so no community-maintained glossary was checked.

## What are the common failure modes?

### Takeaway
The recurring failures are stalls with no visible way forward, runaway or too-steep curves, and empty stretches when content runs out. Many perceived balance problems turn out to be interface problems. The evidence is mostly developer judgement, not measured player data.

### Cited Findings

**Walls too long and passive waiting**
- As costs outrun income, the wait grows until impractical unless balanced — [P] [Part I](https://www.gamedeveloper.com/design/the-math-of-idle-games-part-i)
- Slow prestige cycles can tire players and need a meta prestige to relieve them — [P] [GDC Europe slides](https://www.slideshare.net/slideshow/quest-for-progress-gdc-europe-2016/65405507)
- Without resets or extra upgrades, progress stalls once buildings run out — [Tuts+](https://code.tutsplus.com/numbers-getting-bigger-the-design-and-math-of-incremental-games--cms-24023a)
- Egg, Inc.'s 2-hour offline cap is called a likely mistake by Pecorella — [P] [GDC Europe slides](https://www.slideshare.net/slideshow/quest-for-progress-gdc-europe-2016/65405507)
- Excessive repetitive interaction risks frustration, boredom and click fatigue — [P] [Alharthi et al. 2018](https://par.nsf.gov/servlets/purl/10061230)
- Requiring frequent active play is flagged as a violation of humane design — [Tuts+](https://code.tutsplus.com/numbers-getting-bigger-the-design-and-math-of-incremental-games--cms-24023a)

**Early-game boredom**
- Players judge quickly: about 30 seconds to decide whether the game is interesting, then about 4 minutes before they want to know what comes next. This is one developer's observation — [A] [aguier](https://dev.to/aguier/i-built-7-idle-games-in-30-days-what-i-learned-about-incremental-design-5d3f)
- Players who quit before the first reset never see the rest of the game, so a slow first reset is expensive. One game's 25 to 35 minutes was judged too slow — [A] [Doomscroll 2077 post, dev.to](https://dev.to/tanishpaul1106/aura-data-and-prestige-designing-the-economy-of-doomscroll-2077-293f)
- Linear costs create a stalled early stretch and predictable outcomes — [A] [aguier](https://dev.to/aguier/i-built-7-idle-games-in-30-days-what-i-learned-about-incremental-design-5d3f); [Tuts+](https://code.tutsplus.com/numbers-getting-bigger-the-design-and-math-of-incremental-games--cms-24023a)

**Runaway multipliers and stacking**
- Ownership multipliers can compound on cheaper generators — [P] [GDC Europe slides](https://www.slideshare.net/slideshow/quest-for-progress-gdc-europe-2016/65405507)
- Exponential costs get out of control quickly, and small changes have large downstream effects. Keep every value spreadsheet-driven, and build a calculator showing each level at a chosen prestige amount — [P] [Idle Idol](https://gamedeveloper.com/design/balancing-tips-how-we-managed-math-on-idle-idol)
- Some games later had to add systems to rein in numbers, as with Reincarnations and Mega Bucks — [P] [Part III](https://www.gamedeveloper.com/design/the-math-of-idle-games-part-iii)
- Cost without growth creates a dominant option: without exponential cost, one upgrade can be exploited exclusively — [Tuts+](https://code.tutsplus.com/numbers-getting-bigger-the-design-and-math-of-incremental-games--cms-24023a)
- Very steep cost multipliers (up to 2.5 in Monster) feel punishing — [Tuts+](https://code.tutsplus.com/numbers-getting-bigger-the-design-and-math-of-incremental-games--cms-24023a)
- Mathematically balanced charts can still feel bland, so some imbalance between options can be acceptable — [P] [Idle Idol](https://gamedeveloper.com/design/balancing-tips-how-we-managed-math-on-idle-idol)
- Some designers deliberately avoid slowing growth, as The Gnorp Apologue does, tying its multiplier to units owned because that is simpler and more predictable — [P] [Game Developer interview](https://gamedeveloper.com/design/interview-the-gnorp-apologue)

**Interface and perception**
- Before rebalancing, check whether the complaint is really a UI or tutorial issue. Idle Idol's players missed the passive skills screen and felt progress was slow as a result — [P] [Idle Idol](https://gamedeveloper.com/design/balancing-tips-how-we-managed-math-on-idle-idol)
- Many surveyed idle games were unplayable because of incomprehensible, poorly documented interfaces or clutter. Interfaces should signal when interaction is available, welcome, or better left for later — [P] [Alharthi et al. 2018](https://par.nsf.gov/servlets/purl/10061230)

**Ethical and retention risks**
- Idle games can easily abuse players' cognitive, financial and time resources. Guidelines: space story beats over longer intervals, design plateaus that let players step away, limit transactions, and offer fixed-cost or free play. Some games provide an ending so players can stop — [P] [Spiel et al. 2019](https://par.nsf.gov/servlets/purl/10174274)
- Selling speed-ups exploits the wish for constant progress and undermines the genre's comfortable feel — [P] [Buergi 2024](https://www.czasopisma.uni.lodz.pl/Replay/article/view/23588)
- Good incremental design keeps a player safe to experiment: no state from which progress is impossible, and recovery through time if resources are misallocated — [P] [Spiel et al. 2019](https://par.nsf.gov/servlets/purl/10174274)

### Inferences
All figures below are [X].
- **Stacking arithmetic:** ten independent +100% bonuses reach ×11 if added but ×1,024 if multiplied. Forty independent ×2 sources alone reach about 1.1e12, the whole trillions budget. So the structure of the multiplier stack matters as much as any single value. Cookie Clicker's additive +1% per level is one example of a contained source.
- **Combinatorics in a deckbuilder:** the risk is sharper when players choose which multipliers to combine, since balancing must cover combinations and not one path. Pecorella's node-connection formula `n(n−1)/2` on the [GDC Europe slides](https://www.slideshare.net/slideshow/quest-for-progress-gdc-europe-2016/65405507) indicates how quickly pairs accumulate: 10 sources give 45 pairs, 20 give 190.
- **Simulation warning:** the ×2 versus ×4 table earlier shows a small change in milestone size can move time to purchase 200 from 54 seconds to 1,540 seconds in the simple model, so a wall can appear purely from a parameter change.

### Gaps
- No primary source gives measured churn at walls of a given length, or a tolerable wall duration. Reddit discussion threads on what kills idle games could not be opened.
- No quantitative treatment of multiplier-stacking failure was found. Sources describe it qualitatively.

## How do active incrementals differ from idle ones, and is offline progress expected?

### Takeaway
By the academic definition, a turn-based game with a fail state is not an idle game at all, because it lacks background progress and has a game over. It can still use incremental maths. The main changes are that time is replaced by player actions, walls cannot be waited out, and offline progress is optional. I found no source specifically on turn-based incrementals.

### Cited Findings
- Alharthi et al. require all of the following for "idle": most play happens in the background, waiting counts as play, players can return flexibly with little penalty, one instance is often played for a year or more, and there is no game over — [P] [Alharthi et al. 2018](https://par.nsf.gov/servlets/purl/10061230)
- Spiel et al. reject technical endlessness as a required trait, since some idle games end, and they treat paradigm shifts and resets as temporary endings forming multiple closed narratives — [P] [Spiel et al. 2019](https://par.nsf.gov/servlets/purl/10174274)
- Interactivity is a spectrum, and games often shift along it: on a 0 to 10 scale, Progress Quest is 0, Crusaders of the Lost Idols 5, A Dark Room 9. Many games move up and down in different phases — [P] [Alharthi et al. 2018](https://par.nsf.gov/servlets/purl/10061230)
- Boss fights make manual play a chance to show prowess instead of undercutting the upgrades. Random events such as golden cookies reward attention with no penalty for missing them — [P] [Alharthi et al. 2018](https://par.nsf.gov/servlets/purl/10061230)
- Idle play naturally ends sessions: costs rise as you act, leaving fewer options, and being away restores options — [P] [Alharthi et al. 2018](https://par.nsf.gov/servlets/purl/10061230)
- Designers plan for play alongside everyday activities and interrupted engagement, and advise letting players disengage at any point without substantial consequences — [P] [Spiel et al. 2019](https://par.nsf.gov/servlets/purl/10174274)
- Sessions can fill short moments of boredom, such as commuting — [P] [Alharthi et al. 2018](https://par.nsf.gov/servlets/purl/10061230)
- Offline at half rate: `offlineEarnings = baseRate × hours × 0.5`, so being present still feels better — [A] [aguier](https://dev.to/aguier/i-built-7-idle-games-in-30-days-what-i-learned-about-incremental-design-5d3f)
- Other developer positions: active play should always out-reward idle play ([S] [Subpixel, Patreon](https://www.patreon.com/Subpixel/posts/10-rules-for-160530914)); offline time upgradeable to 52 hours, and offline efficiency halved in another game ([S] [itch.io post](https://itch.io/post/16284377), [itch.io post](https://itch.io/post/16292914)); a stated goal of supporting both low-attention and constantly active play ([S] [Four Divine Abidings devlog](https://fourda.itch.io/four-divine-abidings-full/devlog/981439/active-or-idle))
- A community thread raises the concern that if offline and online feel the same, there is little reason to play actively. Other commenters say disabling offline progress is reasonable in active-oriented games, and that preferred interaction frequency is personal. Neither thread could be opened, so which comment sits in which thread is unconfirmed — [C][S] [r/incremental_games design thread](https://red.chatoyer.de/r/incremental_games/comments/vfmhs5/design_choices_questions_and_discussion); [C][S] [r/incremental_games, what makes an idle game fun](https://libreddit.neb.cx/r/incremental_games/comments/1epowcl/what_makes_an_idle_game_fun)
- Storage caps create pressure to return, as in Clash of Clans — [Tuts+, why they are fun](https://code.tutsplus.com/numbers-getting-bigger-what-are-incremental-games-and-why-are-they-fun--cms-23925a). Social games penalise long absences, whereas idle games typically do not put existing progress at risk — [P] [Alharthi et al. 2018](https://par.nsf.gov/servlets/purl/10061230)
- Clicker Heroes has no offline cap, and Egg, Inc. caps at 2 hours, so even idle games differ — [P] [Part III](https://www.gamedeveloper.com/design/the-math-of-idle-games-part-iii)

### Inferences
- **Time becomes turns:** in `wait = cost / income`, income per second becomes income per fight or per turn. The brief's 1 to 5 minute burst must then be converted into actions per minute. Burst tables above are stated per step so they can be used directly, once a real turn duration is measured.
- **Walls can't be waited out:** in an idle game, the wall resolves itself with time. In a turn-based game with no background income, a wall holds until the player gains more through replay, better decisions, or a reset. A wall therefore needs a guaranteed way forward, or it becomes a dead stop. This is the main structural difference I can identify.
- **Failure replaces waiting:** the idle plateau's job of slowing the player has to be done by something else, such as losing a run. This conflicts with Spiel's advice about safe exploration and no bad states. Coinkeep currently deletes the save when the town falls (commit b1e04ef), so a permanent layer surviving that loss would be what reconciles the roguelike fail state with the genre's expectation that progress is not lost. That reading is mine.
- **Reset and run loss can coincide:** a roguelike's run end is a natural moment for prestige payout, which removes the need to persuade players to give up progress voluntarily. Pecorella's concerns about predicting reset timing would then apply less. I found no source testing this.
- **Skill can act as a multiplier:** when the player is active, Pecorella's lifetime-versus-per-run choice also determines whether skilful play pays again later. Other researchers are covering specific hybrids, so I have not looked for examples here.
- **Offline progress looks optional here:** the sources justify it through idle play, and those discussing active-oriented games accept switching it off. Nothing retrieved indicates that players of active session-based games expect it. Evidence is thin and mostly forum-level. Automation can still act as a reward inside a session, without any background progress, by removing tedious actions.
- **Session endings need a deliberate cause:** without the idle mechanism of shrinking options, an active game has no built-in stopping point. Plateaus and run ends may serve as natural stops.

### Gaps
- I found no design source on turn-based or card-based incrementals specifically. The closest match is general active-versus-idle commentary, and hybrid games were assigned to other researchers.
- I retrieved no benchmark on session length or sessions per day. The GameAnalytics link found in search led to a marketing homepage with no idle data.
- The Subpixel "10 rules" post could not be opened (HTTP 403). Only its snippet was seen, and the attribution of that snippet to this page rests on the search result.
- Pecorella's earlier talk, "Idle Chatter", which holds retention data (cited by Deterding), was not retrieved. Deterding reports from it that incremental games retained and monetised better than any other genre on Kongregate, which hosts over 120,000 games, but the underlying figures were not seen.
