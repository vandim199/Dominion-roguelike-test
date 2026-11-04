STATUS: IN PROGRESS

## Deliverables (copied from the brief)
1. docs/TAKE.md: pitch, a minute and a session, decision log, kept/changed/cut.
2. DOM-free rules core plus headless test of the riskiest idea.
3. index.html becomes this game on phone and desktop: title, home, trip, fights, defeat or retreat, home, spend, go again. 30-45 min of progress. Autosave; losing never deletes progress.
4. Whole-loop bot tunes the pacing.
5. Real browser check, README updated.
6. docs/RESULTS.md: decision test, whole-loop pacing, optimisation depth, honest verdict, with reproducing command.
Rules: branch wild/forays-claude only, no force-push, leave pages.yml, keep classic/, js/versions.js, #tVersions, slotKey saves. Every commit ends with the Co-Authored-By line for Claude Opus 5.5. No subagents, no web research. Do not look at other wild/forays-* branches. Browser: launch.json entry forays-claude on 8771 (launch.json is git-ignored, recreate it), own tabId, return viewport to desktop.

## Done
- docs/TAKE.md pitch (decision log still to write).
- js/data.js (content, TUNE), js/game.js (rules, no DOM), sim/bots.js, sim/decision.js, sim/loop.js.
- index.html, js/ui.js, js/save.js, css/style.css: full loop plays in a browser at phone width.

## Next
- Tune with sim/loop.js. Write docs/TAKE.md decision log, docs/RESULTS.md, README.md.

## Notes for a fresh session
- preview_start cannot find the forays-claude entry from this worktree: it starts the main checkout. Run python -m http.server 8771 --bind 127.0.0.1 in the background from the worktree, then preview_start with url http://localhost:8771/index.html.
- Do not rewrite data.js with PowerShell Get-Content/WriteAllText: it mangles emoji. Patch with node scripts in the scratchpad.
- Experiments: TUNE='{"cLv":2.1}' environment variable overrides numbers in sims.
