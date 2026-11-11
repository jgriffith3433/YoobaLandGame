## What was wrong
The home Meet the people strip was four static cards (two screenshots, two inline SVG stand-ins). It did not load `site/cast/cast.json`, play voice lines, show captions, react, or swipe on phone.

## What changed
- **Data:** `site/cast/cast.json` now drives six characters (Yooba, Pip, Old Reed, Bramley, Kelp, Wren) with `react` (bounce / blink / lean) and voice captions. SVG portraits under `site/cast/portrait/`; 18 ElevenLabs voice lines under `site/cast/voice/`.
- **UI:** `site/cast.js` fills `#characters`; tap plays next line (never same twice in a row) with caption bubble + reaction; second tap while speaking stops; one speaker at a time; first-tap sound hint; keyboard/SR buttons.
- **Layout:** desktop 3-column grid; ≤600px scroll-snap swipe row (`overscroll-behavior-x: contain`) so the page does not scroll sideways. Idle bob when `html.motion`.
- **Playtest:** `cast` scenario in `site/playtest.js` (named in `.hawkes/scenario.txt`) taps three characters, checks caption/react/stop/cycle, screenshots desktop + 390-style phone.
- **Canon:** story + world bible — Kelp is the Marmalade captain (older notes said Captain Salt); Wren is the Skyport pilot; home cast listed.

Overlapped lightly with the trailer agent on `index.html`, `site/site.css`, `site/playtest.js`, `site/motion.css`, `AGENTS.md`, `docs/story.md`, `docs/world-bible.md` — edits kept to the cast strip / scenario / canon lines only.

## Checks
- `npm run check` (Hawkes Analytics): OK
- `node --check` on `site/cast.js` and `site/playtest.js`
- `cast.json` parses; 18 mp3 + 6 svg on disk
- **Fun reviewer:** thin — voice/captions good; gaps: real portraits, place stills/ambient under lines, second verb into the map. Idle bob added; portraits priced below (no GPU budget this task).
- **Reviewer:** merge — ACs covered; commit must include voice/portrait assets.

## GPU estimate (portraits — not run)
Six `image.generate` cast portraits (1024²): ~7 min wall, **~$0.20 GPU** (or **~$2.06 with idle tail** if the server is left on). Approve to replace SVG stand-ins.
