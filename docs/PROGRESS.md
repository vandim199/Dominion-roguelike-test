STATUS: DONE

Branch: `wild/forays-yours` (publishes to `v/wild-forays-yours/`). Never commit to main or force-push.

## Deliverables (priority order)
1. `docs/TAKE.md`: pitch, a minute and a session, decision log, accepted/changed/rejected.
2. DOM-free core plus headless test of the riskiest idea (`js/data.js`, `js/game.js`, `sim/feedtest.js`).
3. Playable loop in `index.html`: title, home, trip, fights, defeat or retreat, home, spend, again. Phone and desktop. Autosave. Loss keeps progress.
4. Whole-loop bot, tune pacing (`sim/loop.js`).
5. Real browser check; update `README.md`. launch.json entry `forays-yours` exists but preview_start resolves against the main repo, so serve the worktree with `python -m http.server 8772` and open `http://localhost:8772/index.html` with preview_start url.
6. `docs/RESULTS.md`: decision test, whole-loop pacing, optimisation depth, honest verdict, with reproducing command (`node sim/results.js all > docs/results_raw.txt`).

Keep working: `classic/`, `js/versions.js`, `#tVersions`, `slotKey`. Every commit ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Done
- All deliverables: rules core, feed test, full UI loop with save, whole-loop bots, tuning, browser check, README, TAKE, RESULTS.

## Next
- Nothing required. If continuing: a real person's playtest first, then the weak spots listed in RESULTS section 4.
