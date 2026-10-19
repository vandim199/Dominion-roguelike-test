# Dominion: Crisis

An endless, Balatro-flavoured deckbuilder built on Dominion's engine cards. Your deck persists across waves of threats; between waves you draft jokers and tune your deck.

## Playing

Open `index.html` in a browser, or serve the folder (e.g. GitHub Pages, or `python -m http.server`). No build step.

Works on desktop, tablets and phones in either orientation. Use **⚙ Settings** to change the UI size (or `+` / `−` on a keyboard). On touch screens, tap a card to read it before playing or buying it, and press and hold a card in a picker to read it.

## Files

- `index.html` — page structure
- `css/style.css` — styles; all sizes in `rem`, so the UI scale is the root font-size
- `js/data.js` — tuning, cards, jokers and threats
- `js/game.js` — rules: waves, turns, threats, attacks, camp
- `js/ui.js` — rendering, modals, inspector, layout and scaling, settings
