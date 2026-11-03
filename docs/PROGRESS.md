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
- Branch created, design doc drafted.

## Next
- js/core.js rules core and sim/feedtest.js.
