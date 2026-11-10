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
    getOpenId: function () { return openId; },
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
    // Keep at least 28% of the shorter side of the map on screen so it can't be lost.
    var marginX = Math.min(mw * 0.28, vw * 0.45);
    var marginY = Math.min(mh * 0.28, vh * 0.45);
    var minX = vw - mw - marginX;
    var maxX = marginX;
    var minY = vh - mh - marginY;
    var maxY = marginY;
    if (mw <= vw) {
      minX = maxX = (vw - mw) / 2;
    }
    if (mh <= vh) {
      minY = maxY = (vh - mh) / 2;
    }
    return {
      x: Math.min(maxX, Math.max(minX, x)),
      y: Math.min(maxY, Math.max(minY, y)),
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
    var s = fitScale();
    var r = viewport.getBoundingClientRect();
    setTransform((r.width - VIEW_W * s) / 2, (r.height - VIEW_H * s) / 2, s, false);
  }

  function resolveImage(path) {
    if (!path) return "";
    if (/^https?:\/\//i.test(path) || path.charAt(0) === "/") return path;
    return MAP_BASE + path.replace(/^\.\//, "");
  }

  function stopAmbient() {
    if (!ambient) return;
    try { ambient.pause(); } catch (e) { /* ignore */ }
    ambient = null;
  }

  function playAmbient(path) {
    stopAmbient();
    if (!path) return;
    try {
      // Ambient paths in places.json are relative like audio/Foo-0.ogg
      ambient = new Audio(MAP_BASE + String(path).replace(/^\.\//, ""));
      ambient.loop = true;
      ambient.volume = 0.45;
      ambient.play().catch(function () { /* autoplay may need a prior gesture; pin tap counts */ });
    } catch (e) {
      ambient = null;
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
  viewport.addEventListener("lostpointercapture", onPointerUp);

  viewport.addEventListener("wheel", function (e) {
    e.preventDefault();
    var factor = e.deltaY > 0 ? 0.9 : 1.1;
    zoomAt(factor, e.clientX, e.clientY);
  }, { passive: false });

  if (zoomIn) zoomIn.addEventListener("click", function () { zoomAt(1.2); });
  if (zoomOut) zoomOut.addEventListener("click", function () { zoomAt(1 / 1.2); });
  if (cardClose) cardClose.addEventListener("click", closeCard);

  document.addEventListener("keydown", function (e) {
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
    }, { rootMargin: "120px 0px", threshold: 0.05 });
    io.observe(root);
  } else {
    loadMap();
  }
})();
