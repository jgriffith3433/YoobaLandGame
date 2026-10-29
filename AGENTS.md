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
