# Coinkeep

A pocket roguelike deckbuilder. You're the steward of a little hilltop town, and trouble arrives in endless waves: tax collectors, ogres, pirates, blizzards, ghosts. Build one deck for the whole run and use it to pay off, outlast or blow up every threat. Between waves you pick charms that bend the rules and visit the Inn to upgrade, copy or trash cards.

## Playing

Open `index.html` in a browser, or serve the folder (e.g. GitHub Pages, or `python -m http.server`). No build step. It can be added to a phone's home screen (web app manifest included).

Works on desktop, tablets and phones in either orientation. Use **⚙ Settings** to change the UI size (or `+` / `−` on a keyboard). On touch screens, tap a card to read it before playing or buying it, and press and hold a card in a picker to read it.

## Files

- `index.html` — page structure, title screen, how-to-play
- `css/style.css` — styles; all sizes in `rem`, so the UI scale is the root font-size
- `js/data.js` — tuning, cards, charms and threats
- `js/game.js` — rules: waves, turns, threats, attacks, the Inn
- `js/ui.js` — rendering, modals, inspector, effects, layout and scaling, settings
- `manifest.webmanifest`, `icon.svg` — install-to-home-screen metadata
