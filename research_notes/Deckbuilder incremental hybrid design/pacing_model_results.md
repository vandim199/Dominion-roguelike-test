# Pacing model results

Computed by the coordinator on 2026-11-03 with a throwaway Node script (200 seeded runs per row). It is a toy: there are no card rules, no enemy damage and no real player, and the parameters are my own starting points. Nothing here has been playtested. It sizes the stair steps; it does not prove the game is fun.

## The model

- Enemy health: `H(f) = 20 * g^f`, with a boss at 2x health every 18-24 fights.
- Player power grows ×1.04-1.05 per fight (small card and base levels) and ×M at each burst.
- `R = power / enemy health`. R = 1 is an even fight: 3 turns to kill. Turns to kill = `ceil(3 / R)`, with hand-to-hand luck of up to about ×1.28 either way in the gated rows.
- 15 seconds per played turn. A one-turn kill at R ≥ 3 auto-resolves in 3 seconds.
- More than 6 turns to kill counts as a lost fight: knocked back 4 fights, keeping a ×1.5 salvage bonus.

## Free-running versus gated bursts

"Free" lands a burst every 3-9 fights (4-12 for g 1.20) regardless of power. "Gated" lands one only after at least 3 fights and once power has fallen below 0.85 times the next enemy's health.

| Schedule | Enemy growth per fight | Burst | Minutes to 1e12, median (p10-p90) | Bursts | Minutes between bursts, median (p10-p90) | Time enjoying (R≥2) / even (R 1-2) / struggling (R<1) / lost |
|---|---|---|---|---|---|---|
| Free | ×1.40 | ×5.6 | 24 (9-36) | 13 | 1.2 (0.2-4.8) | 32 / 46 / 17 / 5 % |
| Free | ×1.30 | ×3.6 | 34 (11-56) | 16 | 1.6 (0.2-5.1) | 26 / 48 / 23 / 3 % |
| Free | ×1.20 | ×3.15 | 44 (17-80) | 17 | 2.1 (0.3-6.3) | 38 / 41 / 19 / 2 % |
| Gated | ×1.40 | ×5 | 43 (39-45) | 13 | 3.0 (2.3-3.8) | 24 / 47 / 26 / 3 % |
| Gated | ×1.30 | ×5 | 56 (53-58) | 12 | 4.0 (3.4-8.4) | 24 / 50 / 23 / 4 % |
| Gated | ×1.30 | ×3 | 67 (65-68) | 17 | 3.5 (3.0-4.3) | 14 / 58 / 26 / 2 % |
| Gated | ×1.20 | ×5 | 75 (71-78) | 12 | 6.1 (5.0-6.8) | 25 / 49 / 25 / 1 % |
| Gated | ×1.30 | ×4, every 4th burst ×12 | 53 (49-55) | 12 | 4.0 (3.3-5.0) | 23 / 49 / 25 / 2 % |

## Findings

1. **Gating is the most important tuning rule the model found.** It narrows the time to 1e12 from 11-56 minutes to 53-58 on the ×1.30 curve (the free row uses ×3.6 bursts, the gated row ×5). Without it, a lucky streak snowballs and bursts pile up, as little as 0.2 minutes apart.
2. **Free-running curves are very sensitive to burst size.** On the ×1.30 free schedule, with the enemy curve held fixed, the time to 1e12 was: ×1.5 → 147 min (14 losses), ×2 → 108 min (8), ×2.7 → 69 min (3), ×3.5 → 36 min (1), ×5 → 9 min (0), ×8 → 7 min (0). A single overtuned multiplier can collapse the game, which is the argument for gating and for the simulator.
3. **The size of the burst decides how long the "enjoy" phase lasts.** On the ×1.30 gated curve, ×5 bursts give 24% of the time at R ≥ 2, and ×3 bursts only 14%. A bigger, rarer burst feels more like the user's brief.
4. **Enemy growth sets the burst interval.** With ×5 bursts: ×1.40 per fight → about 3 minutes, ×1.30 → about 4, ×1.20 → about 6. This sits inside or just past the user's 1-5 minute target.
5. **A first trillion at about 45-75 minutes is consistent with 3-6 minute bursts.** Chef Knight reaches quadrillions in about 3 hours according to the precedent notes, so continuing past the trillion is plausible and leaves room for prestige.

## Burst size needed for a given length of game

Climbing from 20 health to about 2e12 (×1e11, 11 orders of magnitude), ignoring small growth:

| Game length | Burst every | Bursts | × per burst |
|---|---|---|---|
| 30 min | 2 min | 15 | ×5.41 |
| 60 min | 2 min | 30 | ×2.33 |
| 60 min | 3 min | 20 | ×3.55 |
| 60 min | 5 min | 12 | ×8.25 |
| 120 min | 3 min | 40 | ×1.88 |
| 120 min | 5 min | 24 | ×2.87 |
| 180 min | 3 min | 60 | ×1.53 |
| 180 min | 5 min | 36 | ×2.02 |

## What the model does not cover

Whether the feed order creates real decisions, whether enemy damage against bases works, how much a real turn takes on a phone, how long the "enjoy" phase needs to be, and anything about fun. Those need the real simulator and playtests.
