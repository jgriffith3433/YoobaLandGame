# Explore map: pan was dead (attempt 2)

**What was wrong:** beta's run reported "Pan moved 0 px". Cause in `site/map-explore.js` `clampTransform`: whenever the map
fit the frame on an axis (`mw <= vw`) it pinned x/y to the centre, and the start view *is* the fit view, so on first load
the map could not be dragged at all (desktop or phone) until you zoomed in. Pinch worked, which is why scale moved 0.5 → 0.8.

**Changed**
- `site/map-explore.js`: new clamp. Pan is always free, bounded so at least 60% of the smaller of map/frame stays on screen
  on each axis (can't be lost). Start view on frames under 640 px wide now fills the frame height (map wider than the
  frame), so one-finger drag has visible room; desktop still opens on the whole map.
- `site/playtest.js` (`map` scenario): drags are now 8 small pointermoves (like a finger), the phone-size step measures map
  movement from the one-finger drag (`mapPhonePanPx`, flags < 8 px), and logs `pageOverflowX` (flags if the page is wider than
  the screen) beside the existing scrollX check. Scenario name is in `.hawkes/scenario.txt`: `map`.

**Checked:** `node --check` on both files; `npm run build` (nothing to build, passes). Math of the new clamp worked through for
390 px (map 577 px wide at start, x range −343…156, a 72 px drag lands inside). I did not run a browser (not allowed);
beta's `map` playtest is the real check.

**Not changed:** `touch-action: none` on the map stays so one-finger drags never scroll the page sideways; the cost is that a
finger that starts on the map doesn't scroll the page vertically (the map is ≤ 62vh, so there is page on all sides).
GPU: none used; nothing to estimate.
