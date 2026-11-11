# Yooba Land website — agent notes

**Lanes, local dev and deploys:** `LANES.md` (branches dev -> beta -> main; `dev.bat`, `deploy-beta.bat`, `deploy-prod.bat`, `status.bat`, `links.bat`, `sync.bat`; beta and live links).

The site for **Yooba Land** (yoobalandgame.com), static on GitHub Pages. In the Hawkes Biomedical line it is
sold as *hyporexia support*. `Game/` is the WebGL build from the Unity project `C:\Projects\YoobaLand\YoobaLand`
(its `YoobaWebBuild` editor script writes it); don't hand-edit build output. Local dev: `auto-start.bat`
(http://localhost:8088). Publishing is pushing to `main`: ask J first.

## Generative AI: Hawkes Gen

Images, textures, video, 3D, music, voice, sound and Claude all go through **Hawkes Gen**
(`C:\Projects\hawkesgen`, dashboard http://127.0.0.1:8790; start it with `hawkesgen\auto-start.bat`). It holds
the API and AWS keys and runs the shared GPU fleet. This project never holds those keys.

- **Agents:** the `hawkesgen` MCP server is in this folder's `.mcp.json`. Use `hawkesgen_presets` (project
  `yoobaland`) for the art direction, then `hawkesgen_run`.
- **Command line:** `C:\Projects\hawkesgen\hawkesgen.cmd run - --project yoobaland --preset <name> --param prompt="..." --out <folder>`
- **Art direction:** `hawkesgen/presets/yoobaland.json` (style line and named presets). Edit it there.
- **Code:** copy `hawkesgen/clients/js/hawkesgen.mjs` into `tools/` and use `new HawkesGen({ project: 'yoobaland' })`.
- GPU tools cost money while a server runs. Ask J before starting servers or running big batches.

## Playtest

The home page implements the playtest contract (`site/playtest.js`, with the `hawkes-playtest.js` and `hawkes-perf.js`
helpers copied from hawkesstudio `clients/web`). It loads only when a bot drives the page (`navigator.webdriver` or
`?playtest=`), so players download nothing. Scenarios open `Game/` in a full-window frame:
- `play-flow` (start point `at: "load-failed"`): hero holds still, Play, loading (progress bar, lore lines), canvas
  without moving, failed load (`?loadfail=1`) with Try again
- `play-fail`: `Game/?playtest=fail-load` (loader simulates a failed Unity load) and the failure screen
- `play-rotate` (phone): portrait rotate prompt, then landscape, then Tap to play gets the first pointerdown
- `play-chrome`: fullscreen button toggles; the Home link returns to the site home
- `map`: Explore Yooba Land on the home page — pan, zoom, open three place cards; screenshots at desktop and 390 px
- `whatsnew`: What's new + home Devlog + blog picture cards; newest expanded; no empty live-moment date; 1280 and 390 px
The game page itself has no contract of its own: the Unity game's bridge registers `smoke`, `explore` and `full` there.
