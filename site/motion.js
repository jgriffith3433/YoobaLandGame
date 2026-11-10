// Motion: hero parallax and staged reveals. Does nothing at all when the visitor prefers reduced motion
// (the page is then left exactly as written). State is exposed on window.yoobaMotion for the playtest and for checks.
(function () {
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)");
  var root = document.documentElement;
  var state = (window.yoobaMotion = { enabled: false, heroY: 0, revealed: 0, total: 0 });
  if (!reduce || reduce.matches) { root.classList.remove("motion"); return; }
  root.classList.add("motion");
  state.enabled = true;

  // Reveal targets: section headings, ledes, card rows, gallery, devlog, posts. Rows stagger by position.
  var groups = [
    ".section > h2, .section > .lede, .section > .kicker, .cast-note, .live",
    ".cast-grid > li", ".explore-stage", ".cards > .card", ".gallery > figure", ".devlog > li", ".posts > .post-link"
  ];
  var targets = [];
  groups.forEach(function (sel) {
    var items = document.querySelectorAll(sel);
    for (var i = 0; i < items.length; i++) {
      var el = items[i];
      if (el.closest(".hero") || el.hasAttribute("data-reveal")) continue;
      el.setAttribute("data-reveal", "");
      if (sel.indexOf(">") > -1 && sel.indexOf(",") < 0) el.style.setProperty("--i", String(i % 4));
      targets.push(el);
    }
  });
  state.total = targets.length;

  function show(el) {
    el.classList.add("is-in");
    state.revealed++;
    root.setAttribute("data-revealed", String(state.revealed));
  }
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target); // once: never hides again
        show(e.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    targets.forEach(function (el) { io.observe(el); });
  } else {
    targets.forEach(show);
  }

  // Hero parallax: one custom property, written at most once per frame, only while the hero is on screen.
  var hero = document.querySelector(".hero");
  if (!hero) return;
  var ticking = false, last = -1;
  function update() {
    ticking = false;
    var y = Math.max(0, Math.min(window.scrollY || window.pageYOffset || 0, hero.offsetHeight));
    if (y === last) return;
    last = y;
    state.heroY = y;
    hero.style.setProperty("--hero-y", String(y));
  }
  window.addEventListener("scroll", function () {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  update();

  // If the preference changes while the page is open, drop everything back to the plain page.
  if (reduce.addEventListener) reduce.addEventListener("change", function () { if (reduce.matches) location.reload(); });
})();
