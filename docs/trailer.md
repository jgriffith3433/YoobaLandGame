# Yooba Land: gameplay trailer (site hero)

A 45–60 s cut of **real play** from the vertical slice only (Glass Garden → street → Yooba Town square), shown from the home-page hero before a visitor commits to the WebGL load. Tone matches A Short Hike’s trailer: lead with the core verb in the first seconds. Here that verb is **eat, then grow**.

## Hold the cut until

Do not compose the final files until both Unity tasks are on **beta**:

- `k_6c339fe0702c` — Growing is the reward (juice on Yooba + world reacts to size)
- `k_3001ea3be60f` — Ground every building, fountain and props in the slice

Until then the hero player, buttons and playtest scenario ship without the final mp4s (paths below).

## Files (when cut)

| Path | Shape | Target |
|---|---|---|
| `images/trailer.mp4` | 16:9, ~1280×720 | Desktop / landscape phone overlay |
| `images/trailer-portrait.mp4` | 9:16, ~720×1280 | Portrait phone, full-bleed |
| `images/trailer-poster.jpg` | 16:9 still | Poster / share frame |

Both cuts ≤ ~4 MB each (phone stream). H.264 + AAC. Game music and in-game voices stay in the mix (no stock bed).

## Music and voices (existing Gen)

- Bed: Yooba Town busy theme `a_4e4874199e4ddbc6` (marimba / ukulele / accordion hub), ducked under chomp, grow chime and Yooba barks.
- Optional dusk bed under the square beat: `a_cec12717f689075b`.
- Voices: whatever the playtest recording already carries from `YoobaYooba` / scene stems — do not re-voice over the cut.

## Beat sheet (~52 s)

Reference: A Short Hike opens on climb/glide. We open on **chomp → grow**.

| t | Place | What the visitor sees / hears | Source |
|---|---|---|---|
| 0.0–5.0 | Glass Garden | Yooba bites an apple; pop, sparkles, camera eases out, size meter ticks; grow chime + a short bark | Playtest of first eat after juice lands |
| 5–12 | Glass Garden | Second snack or the cracked pane; Yooba squeezes out onto the path | Same take or contiguous |
| 12–22 | Street | Walk the cobbles toward town with life in frame the whole way (neighbour crossing **and** a lamp or cart/bird — not empty travel) | Street footage |
| 22–38 | Yooba Town square | Clock tower, fountain, other Yoobas; one visible size-react (glint / critter scatter / townsfolk line) | Square after grounding + grow juice |
| 38–48 | Square / street | One non-chomp verb before the hold: talk to a neighbour **or** a push (not eat-once-then-tourism) | Contiguous |
| 48–52 | Hold on Yooba, title card optional | Soft fade on town music; no text longer than one line if any | Compose |

Portrait cut: same timeline, framed tighter on Yooba (crop/zoom in `video.compose`, `fit: crop`, 720×1280). First 5 s must still read as eating and growing on a 390×844 phone.

## Compose (free, CPU)

When footage is ready, two `video.compose` jobs (no GPU):

1. Horizontal: width 1280, height 720, fps 30, grade `warm`, music `a_4e4874199e4ddbc6` ducked.
2. Vertical: width 720, height 1280, `fit: crop`, same timeline, punch-in on Yooba for the open.

Import with `studio_gen_import` into `images/`. Estimate: **$0** GPU for both cuts; optional new music bed only if stems are missing (~$0.18 GPU + idle tail if a server boots — prefer the existing town theme).

## Site wiring

- Hero button **Watch the trailer** opens `site/trailer.js` overlay (nothing loads until the click).
- Portrait uses `trailer-portrait.mp4` full-screen; landscape/desktop uses `trailer.mp4` in a 16:9 box.
- Close (×, Escape, backdrop) restores scroll; hero layout does not jump.
- Playtest scenario: `trailer` (see `site/playtest.js`).
