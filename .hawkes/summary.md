# Phone and speed pass on the site pages

**Found:** Header + Play button already on blog, What's new, privacy, contact (and blog posts), and the `pages` scenario already exists in `site/playtest.js` (visits 7 pages at 1280 and 390, flags sideways scroll, tap targets <44 px, text <14 px). So those two items were already in place; I didn't redo them.

**Changed:**
- `site/site.css`: every link/button in the header, menu, footer, credits, post cards, map tools and zoom/close buttons now has a 44 px minimum height (and width for icon buttons); inputs and the Send button too. Text that was 12.8–13.6 px is now 14 px. Link green darkened (#1f8a45 → #187a3a) for AA contrast; a visible focus ring on buttons/summary/Play.
- `index.html`, `blog.html`, `contact.html`, `privacypolicy.html`, `whatsnew.html`, `blog/*.html`: Google Fonts stylesheet loads without blocking first paint (media=print swap, with noscript fallback).
- `index.html`: hero video `preload="metadata"` (the poster paints first; autoplay is unchanged).

**Not done / limits:**
- Nothing was run: no browser and no Lighthouse here (not allowed to start a build/playtest). The Lighthouse 85/95 and "0 flags" results need beta's run to confirm. The `pages` scenario still reports findings as warnings.
- `images/` is skip-worktree in this checkout, so I could not resize images or make WebP/AVIF versions. That is the likeliest remaining cost for the 85 performance score (hero-loop.jpg, shot-*.jpg, hero-yooba.jpg are 1280+ px jpgs); the home hero video is also large. Next step: responsive `srcset` + WebP for those.
- `site/hawkes-credits.css` and `whatsnew.html` are written by the Unity deploy; I overrode credits sizing in `site.css` rather than editing them, but the whatsnew font change should also be made in YoobaLand/Tools/Web or the deploy will overwrite it.
- No GPU used; nothing to estimate.
