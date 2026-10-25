# Yooba Land landing page (LCH-02)

**What changed (home page only):**
- New headline and pitch: "Become one of the people of Yooba Land", with three cards: become the people, play together, a story in episodes. The page description (search/share text) matches.
- A "A look around" section with three screenshots (market, orchard, the glass fence and the orb), resized to web size in `images/`.
- A "The next live moment" box. The live-moment time is still J's call (roadmap LIVE-02), so it says the date and time will be posted before it starts. It names no time.
- Styles for the gallery and the box are in `site/site.css`. The old "How a walk goes" and blog sections are unchanged.

**Checked:** the HTML is well formed and every link and image path exists. `npm run check` reports one problem that was already there: `whatsnew.html` has no analytics tag. The deploy writes that page, so I left it alone.

**For J to look at:**
- The screenshots are the existing store shots. Some of the store shots are from VR days; I used ones without VR controllers. Fresh `photos` shots from the current game need a playtest on the T4. Ask Talk for one and I'll swap them in.
- The `credits` and `whatsnew` scenarios run in the game, and I didn't change the game or those pages. The whatsnew and credits pages are untouched.
- I added no scenario: the website has no playtest contract.
- GPU: none used or needed, so there's no estimate.
