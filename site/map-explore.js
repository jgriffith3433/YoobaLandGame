// Explore Yooba Land: pan/zoom map on the home page, pins from places.json, place cards.
// Loads map.svg + places.json only when #explore scrolls into view. No GPU.
(function () {
  var root = document.querySelector("[data-explore-map]");
  if (!root) return;

  var viewport = root.querySelector(".explore-viewport");
  var canvas = root.querySelector(".explore-canvas");
  var card = root.querySelector(".explore-card");
  var cardImg = root.querySelector(".explore-card-img");
  var cardName = root.querySelector(".explore-card-name");
  var cardHook = root.querySelector(".explore-card-hook");
  var cardClose = root.querySelector(".explore-card-close");
  var zoomIn = root.querySelector('[data-explore-zoom="in"]');
  var zoomOut = root.querySelector('[data-explore-zoom="out"]');
  if (!viewport || !canvas || !card) return;

  var MAP_BASE = "./site/map/";
  var VIEW_W = 1100;
  var VIEW_H = 800;
  var MIN_SCALE = 0.55;
  var MAX_SCALE = 3.2;

  var placesById = Object.create(null);
  var placeList = [];
  var loaded = false;
  var loading = false;
  var svgEl = null;
  var scale = 1;
  var tx = 0;
  var ty = 0;
  var openId = null;
  var anim = null;
  var ambient = null;

  // Exposed for the map playtest scenario (real UI; no teleporting past the load).
  window.yoobaExplore = {
    ready: function () { return loaded; },
    openPlace: function (id) { return openPlace(id, true); },
    closeCard: closeCard,
    panBy: function (dx, dy) { setTransform(tx + dx, ty + dy, scale); },
    zoomBy: function (factor, cx, cy) { zoomAt(factor, cx, cy); },
    getTransform: function () { return { x: tx, y: ty, scale: scale }; },
    // How far clampTransform will let x/y move from the current pose (for the map scenario).
    panSlack: function () {
      var left = clampTransform(tx - 1e5, ty, scale);
      var right = clampTransform(tx + 1e5, ty, scale);
      var up = clampTransform(tx, ty - 1e5, scale);
      var down = clampTransform(tx, ty + 1e5, scale);
      return { x: Math.abs(right.x - left.x), y: Math.abs(down.y - up.y) };
    },
    // Room to drag in each direction from the current pose (px): a card centres its pin, which can leave the
    // map pinned against one edge, so a scripted drag has to pick the side that has room.
    panRoom: function () {
      return {
        left: tx - clampTransform(tx - 1e5, ty, scale).x,
        right: clampTransform(tx + 1e5, ty, scale).x - tx,
        up: ty - clampTransform(tx, ty - 1e5, scale).y,
        down: clampTransform(tx, ty + 1e5, scale).y - ty,
        moving: !!anim,
      };
    },
    getOpenId: function () { return openId; },
    soundOn: function () { return soundOn; },
    audioState: function () {
      return { on: soundOn, voices: voices.map(function (v) { return { src: v.src, to: v.to, vol: v.el.volume, paused: v.el.paused }; }) };
    },
    journey: function () { return { state: lastJourney, visited: journeyVisited, running: !!journey }; },
    lifeRunning: function () {
      var y = svgEl && svgEl.querySelector(".life-yooba");
      return !!y && !svgEl.classList.contains("is-offscreen") && getComputedStyle(y).animationName !== "none" &&
        getComputedStyle(y).animationPlayState === "running";
    },
  };

  function prefersReduce() {
    return window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function fitScale() {
    var r = viewport.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return 1;
    return Math.min(r.width / VIEW_W, r.height / VIEW_H);
  }

  function clampTransform(x, y, s) {
    var r = viewport.getBoundingClientRect();
    var vw = r.width;
    var vh = r.height;
    var mw = VIEW_W * s;
    var mh = VIEW_H * s;
    // Always pannable, never lost: at least 60% of the smaller of (map, frame) stays inside the frame on each axis.
    // (The old clamp pinned the map in place whenever it fit the frame, so at the start view nothing could be dragged.)
    var keepX = Math.min(mw, vw) * 0.6;
    var keepY = Math.min(mh, vh) * 0.6;
    return {
      x: Math.min(vw - keepX, Math.max(keepX - mw, x)),
      y: Math.min(vh - keepY, Math.max(keepY - mh, y)),
      scale: Math.min(MAX_SCALE, Math.max(MIN_SCALE * fitScale(), s)),
    };
  }

  function applyTransform() {
    canvas.style.transform = "translate(" + tx + "px," + ty + "px) scale(" + scale + ")";
  }

  function setTransform(x, y, s, animate) {
    if (anim) {
      cancelAnimationFrame(anim);
      anim = null;
    }
    var c = clampTransform(x, y, s);
    if (!animate || prefersReduce()) {
      tx = c.x;
      ty = c.y;
      scale = c.scale;
      applyTransform();
      return;
    }
    var fromX = tx;
    var fromY = ty;
    var fromS = scale;
    var t0 = performance.now();
    var dur = 420;
    function step(now) {
      var u = Math.min(1, (now - t0) / dur);
      var e = 1 - Math.pow(1 - u, 3);
      tx = fromX + (c.x - fromX) * e;
      ty = fromY + (c.y - fromY) * e;
      scale = fromS + (c.scale - fromS) * e;
      applyTransform();
      if (u < 1) anim = requestAnimationFrame(step);
      else anim = null;
    }
    anim = requestAnimationFrame(step);
  }

  function centerOnMapPoint(mx, my, wantScale, animate) {
    var r = viewport.getBoundingClientRect();
    var s = wantScale != null ? wantScale : Math.max(scale, fitScale() * 1.35);
    s = Math.min(MAX_SCALE, Math.max(MIN_SCALE * fitScale(), s));
    var x = r.width / 2 - mx * s;
    var y = r.height / 2 - my * s;
    setTransform(x, y, s, animate);
  }

  function zoomAt(factor, clientX, clientY) {
    var r = viewport.getBoundingClientRect();
    var cx = clientX != null ? clientX - r.left : r.width / 2;
    var cy = clientY != null ? clientY - r.top : r.height / 2;
    var mx = (cx - tx) / scale;
    var my = (cy - ty) / scale;
    var next = Math.min(MAX_SCALE, Math.max(MIN_SCALE * fitScale(), scale * factor));
    setTransform(cx - mx * next, cy - my * next, next, false);
  }

  function resetView() {
    var r = viewport.getBoundingClientRect();
    // Desktop: the whole map. Phones / narrow frames: fill the frame's height so there is always room to drag.
    var s = r.width < 640 ? Math.max(r.width / VIEW_W, r.height / VIEW_H) : fitScale();
    setTransform((r.width - VIEW_W * s) / 2, (r.height - VIEW_H * s) / 2, s, false);
  }

  function resolveImage(path) {
    if (!path) return "";
    if (/^https?:\/\//i.test(path) || path.charAt(0) === "/") return path;
    return MAP_BASE + path.replace(/^\.\//, "");
  }

  // Sound: off by default, remembered per visitor. Two audio elements crossfade by rAF (no timers polling).
  var SOUND_KEY = "yooba-map-sound";
  var soundOn = false;
  try { soundOn = localStorage.getItem(SOUND_KEY) === "1"; } catch (e) { /* storage blocked */ }
  var soundBtn = root.querySelector("[data-explore-sound]");
  var voices = [];
  var wantAmbient = null;
  var fadeRaf = 0;
  var AMBIENT_VOL = 0.45;

  function renderSound() {
    if (!soundBtn) return;
    soundBtn.setAttribute("aria-pressed", soundOn ? "true" : "false");
    soundBtn.textContent = soundOn ? "Sound on" : "Sound off";
  }

  function fadeStep() {
    var now = performance.now();
    var busy = false;
    voices = voices.filter(function (v) {
      var u = Math.min(1, (now - v.t0) / v.dur);
      var vol = v.from + (v.to - v.from) * u;
      try { v.el.volume = Math.max(0, Math.min(1, vol)); } catch (e) { /* ignore */ }
      if (u < 1) { busy = true; return true; }
      if (v.to === 0) { try { v.el.pause(); } catch (e) { /* ignore */ } return false; }
      return true;
    });
    fadeRaf = busy ? requestAnimationFrame(fadeStep) : 0;
  }

  function fadeVoice(v, to, dur) {
    v.from = v.el.volume;
    v.to = to;
    v.t0 = performance.now();
    v.dur = prefersReduce() ? 1 : dur;
    if (voices.indexOf(v) < 0) voices.push(v);
    if (!fadeRaf) fadeRaf = requestAnimationFrame(fadeStep);
  }

  function stopAmbient() {
    wantAmbient = null;
    voices.slice().forEach(function (v) { fadeVoice(v, 0, 500); });
  }

  function playAmbient(path) {
    wantAmbient = path || null;
    if (!soundOn || !path) { if (!path) stopAmbient(); return; }
    var src = MAP_BASE + String(path).replace(/^\.\//, "");
    var cur = voices.filter(function (v) { return v.src === src; })[0];
    voices.forEach(function (v) { if (v !== cur && v.to !== 0) fadeVoice(v, 0, 900); });
    if (cur) {
      if (cur.to !== AMBIENT_VOL) {
        try { if (cur.el.paused) cur.el.play().catch(function () {}); } catch (e) { /* ignore */ }
        fadeVoice(cur, AMBIENT_VOL, 900);
      }
      return;
    }
    try {
      var el = new Audio(src);
      el.loop = true;
      el.volume = 0;
      var v = { el: el, src: src, from: 0, to: AMBIENT_VOL, t0: 0, dur: 900 };
      el.play().catch(function () { /* blocked until a gesture */ });
      fadeVoice(v, AMBIENT_VOL, 900);
    } catch (e) { /* no audio */ }
  }

  function setSound(on) {
    soundOn = !!on;
    try { localStorage.setItem(SOUND_KEY, soundOn ? "1" : "0"); } catch (e) { /* storage blocked */ }
    renderSound();
    if (soundOn) playAmbient(wantAmbient); else voices.slice().forEach(function (v) { fadeVoice(v, 0, 300); });
  }
  if (soundBtn) soundBtn.addEventListener("click", function () { setSound(!soundOn); });
  renderSound();

  // Follow the Road Home: a glowing trail from chapter 1 to 8, pausing on each pin.
  var journeyBtn = root.querySelector("[data-explore-journey]");
  var journeyCap = root.querySelector(".explore-journey-cap");
  var journey = null;
  var journeyVisited = 0;
  var lastJourney = "idle";

  function endJourney(how) {
    if (!journey) return;
    var j = journey;
    journey = null;
    cancelAnimationFrame(j.raf);
    clearTimeout(j.timer);
    lastJourney = how;
    if (j.trail) j.trail.style.strokeDashoffset = how === "done" ? "0" : j.trail.style.strokeDashoffset;
    root.classList.remove("is-journey");
    if (journeyBtn) journeyBtn.textContent = "Follow the Road Home";
    if (journeyCap) journeyCap.hidden = true;
    if (j.trail && j.trail.parentNode) j.trail.parentNode.removeChild(j.trail);
    if (how === "done") { closeCard(); resetView(); }
  }

  function startJourney() {
    if (!loaded || journey) return;
    var road = svgEl.querySelector("#road-home");
    if (!road) return;
    var len = road.getTotalLength();
    var stops = placeList.filter(function (p) { return p.chapter; })
      .sort(function (a, b) { return a.chapter - b.chapter; })
      .map(function (p) {
        var best = 0, bd = Infinity;
        for (var l = 0; l <= len; l += 4) {
          var q = road.getPointAtLength(l);
          var d = Math.hypot(q.x - p.map[0], q.y - p.map[1]);
          if (d < bd) { bd = d; best = l; }
        }
        return { place: p, at: best };
      });
    var trail = road.cloneNode(false);
    trail.removeAttribute("id");
    trail.setAttribute("class", "road-trail");
    trail.style.cssText = "stroke:#ffd54a;stroke-width:8;stroke-dasharray:" + len + ";stroke-dashoffset:" + len +
      ";filter:drop-shadow(0 0 6px #ffb300);pointer-events:none";
    road.parentNode.insertBefore(trail, road.nextSibling);
    var reduce = prefersReduce();
    journey = { trail: trail, raf: 0, timer: 0, i: 0 };
    journeyVisited = 0;
    lastJourney = "running";
    root.classList.add("is-journey");
    if (journeyBtn) journeyBtn.textContent = "Skip the journey";
    if (journeyCap) journeyCap.hidden = false;
    var j = journey;
    var drawn = 0;

    function pause() {
      var st = stops[j.i];
      journeyVisited++;
      openPlace(st.place.id, !reduce);
      if (journeyCap) journeyCap.textContent = "Chapter " + st.place.chapter + " of " + stops.length + " · " + st.place.name;
      j.timer = setTimeout(function () {
        j.i++;
        if (j.i >= stops.length) { endJourney("done"); return; }
        walk();
      }, reduce ? 1600 : 2200);
    }

    function walk() {
      var from = drawn;
      var to = stops[j.i].at;
      if (j.i === 0 || reduce || to <= from) { drawn = to; trail.style.strokeDashoffset = reduce ? "0" : String(len - to); pause(); return; }
      var t0 = performance.now();
      var dur = Math.max(700, (to - from) * 6);
      function frame(now) {
        if (journey !== j) return;
        var u = Math.min(1, (now - t0) / dur);
        var l = from + (to - from) * u;
        trail.style.strokeDashoffset = String(len - l);
        if (u < 1) j.raf = requestAnimationFrame(frame);
        else { drawn = to; pause(); }
      }
      j.raf = requestAnimationFrame(frame);
    }
    if (reduce) trail.style.strokeDashoffset = "0"; // static: the whole trail shown at once
    walk();
  }

  if (journeyBtn) journeyBtn.addEventListener("click", function () {
    if (journey) endJourney("skipped"); else startJourney();
  });

  // Idle life on the SVG: drifting clouds, shimmering water, a tiny Yooba on the path. CSS only; paused off-screen.
  function addLife() {
    var NS = "http://www.w3.org/2000/svg";
    var road = svgEl.querySelector("#road-home");
    var g = document.createElementNS(NS, "g");
    g.setAttribute("class", "life");
    g.setAttribute("pointer-events", "none");
    var html = "";
    [[0, 90, 1], [-380, 330, 0.8], [-760, 560, 1.15]].forEach(function (c, i) {
      html += '<g class="life-cloud" style="--dx:' + c[0] + 'px;animation-duration:' + (60 + i * 18) + 's;animation-delay:-' + (i * 21) +
        's" transform="translate(0,' + c[1] + ') scale(' + c[2] + ')"><path d="M0,24 C-4,8 18,2 28,12 C34,-2 62,-2 66,16 C84,12 90,32 70,34 L8,34 C-4,34 -6,28 0,24Z" fill="#fff" opacity=".7"/></g>';
    });
    [["glimmer-lake", 40], ["willow-water", 26], [null, 22, 632, 128]].forEach(function (w) {
      var p = w[0] ? placesById[w[0]] : null;
      if (w[0] && !p) return;
      var x = p ? p.map[0] : w[2], y = p ? p.map[1] : w[3], r = w[1];
      html += '<path class="life-shimmer" d="M' + (x - r * 0.5) + ',' + (y - 4) + ' q' + (r * 0.25) + ',-5 ' + (r * 0.5) + ',0 t' + (r * 0.5) + ',0" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>' +
        '<path class="life-shimmer life-shimmer-b" d="M' + (x - r * 0.3) + ',' + (y + 7) + ' q' + (r * 0.2) + ',-4 ' + (r * 0.4) + ',0 t' + (r * 0.4) + ',0" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>';
    });
    g.innerHTML = html;
    if (road) {
      var w = document.createElementNS(NS, "g");
      w.setAttribute("class", "life-yooba");
      w.style.offsetPath = 'path("' + road.getAttribute("d") + '")';
      w.innerHTML = '<ellipse cy="9" rx="7" ry="2.5" fill="#000" opacity=".2"/><g class="life-bob"><path d="M-3,-6 L-3.5,-10 M3,-6 L3.5,-10" stroke="#10281c" stroke-width="1.8" stroke-linecap="round"/><circle r="7" cy="0" fill="#23c34a" stroke="#10281c" stroke-width="2"/><circle cx="-3.5" cy="-10.5" r="2" fill="#fff" stroke="#10281c" stroke-width="1.3"/><circle cx="3.5" cy="-10.5" r="2" fill="#fff" stroke="#10281c" stroke-width="1.3"/><circle cx="-3.5" cy="-10.5" r="0.8" fill="#10281c"/><circle cx="3.5" cy="-10.5" r="0.8" fill="#10281c"/></g>';
      g.appendChild(w);
    }
    svgEl.appendChild(g);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { svgEl.classList.toggle("is-offscreen", !en.isIntersecting); });
      }, { threshold: 0 }).observe(viewport);
    }
  }

  function openPlace(id, animate) {
    var p = placesById[id];
    if (!p) return false;
    openId = id;
    card.hidden = false;
    root.classList.add("is-card-open");
    card.setAttribute("data-place", id);
    cardName.textContent = p.name + (p.chapter ? " · Chapter " + p.chapter : "");
    cardHook.textContent = p.hook || "";
    var src = resolveImage(p.image);
    if (cardImg.getAttribute("src") !== src) {
      cardImg.removeAttribute("src");
      cardImg.alt = p.name;
      cardImg.loading = "lazy";
      cardImg.src = src;
    }
    playAmbient(p.ambient);
    var pin = svgEl && svgEl.querySelector('[data-place="' + id + '"]');
    if (pin) {
      svgEl.querySelectorAll(".place.is-active").forEach(function (el) { el.classList.remove("is-active"); });
      pin.classList.add("is-active");
    }
    centerOnMapPoint(p.map[0], p.map[1], Math.max(scale, fitScale() * 1.45), animate !== false);
    return true;
  }

  function closeCard() {
    openId = null;
    card.hidden = true;
    root.classList.remove("is-card-open");
    card.removeAttribute("data-place");
    stopAmbient();
    if (svgEl) svgEl.querySelectorAll(".place.is-active").forEach(function (el) { el.classList.remove("is-active"); });
  }

  function wirePins() {
    if (!svgEl) return;
    placeList.forEach(function (p) {
      var g = svgEl.querySelector('[data-place="' + p.id + '"]');
      if (!g) return;
      g.setAttribute("tabindex", "0");
      g.setAttribute("role", "button");
      g.setAttribute("aria-label", p.name);
      var go = function (e) {
        if (e) e.preventDefault();
        openPlace(p.id, true);
      };
      g.addEventListener("click", function (e) {
        if (dragMoved) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        go(e);
      });
      g.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          go(e);
        }
      });
    });
  }

  async function loadMap() {
    if (loaded || loading) return;
    loading = true;
    root.classList.add("is-loading");
    var hint = root.querySelector(".explore-hint");
    if (hint) hint.textContent = "Loading the map…";
    try {
      var placesRes = await fetch(MAP_BASE + "places.json");
      var svgRes = await fetch(MAP_BASE + "map.svg");
      if (!placesRes.ok || !svgRes.ok) throw new Error("map assets missing");
      var data = await placesRes.json();
      var svgText = await svgRes.text();
      placeList = (data.places || []).slice();
      placeList.forEach(function (p) { placesById[p.id] = p; });
      if (data.viewBox) {
        VIEW_W = data.viewBox[0] || VIEW_W;
        VIEW_H = data.viewBox[1] || VIEW_H;
      }
      canvas.innerHTML = svgText;
      canvas.removeAttribute("aria-hidden");
      svgEl = canvas.querySelector("svg");
      if (svgEl) {
        svgEl.setAttribute("width", String(VIEW_W));
        svgEl.setAttribute("height", String(VIEW_H));
        svgEl.style.display = "block";
        svgEl.style.width = VIEW_W + "px";
        svgEl.style.height = VIEW_H + "px";
      }
      wirePins();
      addLife();
      resetView();
      loaded = true;
      root.classList.add("is-ready");
      root.classList.remove("is-loading");
      root.removeAttribute("data-explore-error");
    } catch (err) {
      loading = false;
      root.classList.remove("is-loading");
      root.setAttribute("data-explore-error", "1");
      canvas.innerHTML = "<p class=\"explore-error\">The map could not load. Try refreshing.</p>";
      console.warn("Yooba explore map:", err);
    }
  }

  // Pointer pan (mouse / one finger). Pinch handled separately.
  // Track gestures ourselves: never clear panOrigin on lostpointercapture. Synthetic playtest
  // PointerEvents often make setPointerCapture throw or immediately lose capture; treating that
  // as pointerup aborted the drag while pinch (two sync downs+moves) still worked.
  var pointers = new Map();
  var dragMoved = false;
  var panOrigin = null;
  var pinchStart = null;

  function onPointerDown(e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    dragMoved = false;
    try { viewport.setPointerCapture(e.pointerId); } catch (err) { /* synthetic playtest events have no active pointer */ }
    if (pointers.size === 1) {
      panOrigin = { x: e.clientX, y: e.clientY, tx: tx, ty: ty };
    } else if (pointers.size === 2) {
      var pts = Array.from(pointers.values());
      var dx = pts[1].x - pts[0].x;
      var dy = pts[1].y - pts[0].y;
      pinchStart = {
        dist: Math.hypot(dx, dy) || 1,
        scale: scale,
        midX: (pts[0].x + pts[1].x) / 2,
        midY: (pts[0].y + pts[1].y) / 2,
        mx: 0,
        my: 0,
      };
      var r = viewport.getBoundingClientRect();
      pinchStart.mx = (pinchStart.midX - r.left - tx) / scale;
      pinchStart.my = (pinchStart.midY - r.top - ty) / scale;
      panOrigin = null;
    }
  }

  function onPointerMove(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2 && pinchStart) {
      var pts = Array.from(pointers.values());
      var dx = pts[1].x - pts[0].x;
      var dy = pts[1].y - pts[0].y;
      var dist = Math.hypot(dx, dy) || 1;
      var factor = dist / pinchStart.dist;
      var next = Math.min(MAX_SCALE, Math.max(MIN_SCALE * fitScale(), pinchStart.scale * factor));
      var r = viewport.getBoundingClientRect();
      var midX = (pts[0].x + pts[1].x) / 2;
      var midY = (pts[0].y + pts[1].y) / 2;
      setTransform(midX - r.left - pinchStart.mx * next, midY - r.top - pinchStart.my * next, next, false);
      dragMoved = true;
      e.preventDefault();
      return;
    }
    if (pointers.size === 1 && panOrigin) {
      var p = pointers.get(e.pointerId);
      var ox = p.x - panOrigin.x;
      var oy = p.y - panOrigin.y;
      if (Math.hypot(ox, oy) > 6) dragMoved = true;
      setTransform(panOrigin.tx + ox, panOrigin.ty + oy, scale, false);
      e.preventDefault();
    }
  }

  function onPointerUp(e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchStart = null;
    if (pointers.size === 0) {
      panOrigin = null;
      // Keep dragMoved true until the click that follows a drag is ignored, then clear.
      setTimeout(function () { dragMoved = false; }, 0);
    } else if (pointers.size === 1) {
      var only = pointers.values().next().value;
      panOrigin = { x: only.x, y: only.y, tx: tx, ty: ty };
    }
  }

  viewport.addEventListener("pointerdown", onPointerDown);
  viewport.addEventListener("pointermove", onPointerMove);
  viewport.addEventListener("pointerup", onPointerUp);
  viewport.addEventListener("pointercancel", onPointerUp);
  // Intentionally no lostpointercapture → onPointerUp: losing capture must not end the drag.

  viewport.addEventListener("wheel", function (e) {
    e.preventDefault();
    var factor = e.deltaY > 0 ? 0.9 : 1.1;
    zoomAt(factor, e.clientX, e.clientY);
  }, { passive: false });

  if (zoomIn) zoomIn.addEventListener("click", function () { zoomAt(1.2); });
  if (zoomOut) zoomOut.addEventListener("click", function () { zoomAt(1 / 1.2); });
  if (cardClose) cardClose.addEventListener("click", closeCard);

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && journey) { endJourney("skipped"); e.preventDefault(); return; }
    if (e.key === "Escape" && openId) {
      closeCard();
      e.preventDefault();
    }
  });

  window.addEventListener("resize", function () {
    if (!loaded) return;
    setTransform(tx, ty, scale, false);
  });

  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          io.disconnect();
          loadMap();
        }
      });
    }, { rootMargin: "360px 0px", threshold: 0.01 });
    io.observe(root);
  } else {
    loadMap();
  }
})();
