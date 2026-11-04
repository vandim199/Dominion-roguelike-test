STATUS: DONE

## Deliverables (copied from the brief)
1. docs/TAKE.md: pitch, a minute and a session, decision log, kept/changed/cut. Done.
2. DOM-free rules core plus headless test of the riskiest idea. Done: js/game.js, sim/decision.js. The first rules failed, and the changes are recorded in TAKE.md.
3. index.html is this game on phone and desktop: title, home, trip, fights, defeat or retreat, home, spend, go again. Autosave; losing never deletes progress. Done.
4. Whole-loop bot tuned the pacing. Done: sim/loop.js, sim/results.js.
5. Real browser check, README updated. Done; limits are listed in RESULTS.md.
6. docs/RESULTS.md: decision test, whole-loop pacing, optimisation depth, honest verdict, with reproducing commands. Done.

## If someone continues
- Biggest open problem: avoiding close fights is still the fastest route to 1e12 (RESULTS.md, section 4).
- preview_start cannot find the forays-claude entry from this worktree: it starts the main checkout. Run python -m http.server 8771 --bind 127.0.0.1 in the background from the worktree, then preview_start with url http://localhost:8771/index.html.
- Do not rewrite data.js with PowerShell Get-Content/WriteAllText: it mangles emoji. Patch with node scripts.
- Experiments: the TUNE='{"cLv":2.1}' environment variable overrides numbers in sims.
