// Lightweight trailer player for the hero. Nothing loads until Watch the trailer is pressed.
// Portrait phones play the vertical cut full-bleed; desktop/landscape use the 16:9 cut in a box.
// Close restores the page scroll; Escape, the × button, or a tap on the backdrop all close it.
(function () {
  var root = document.querySelector("[data-trailer]");
  if (!root) return;

  var openBtn = root.querySelector("[data-trailer-open]");
  if (!openBtn) return;

  var wide = root.getAttribute("data-video") || "./images/trailer.mp4";
  var tall = root.getAttribute("data-video-portrait") || "./images/trailer-portrait.mp4";
  var poster = root.getAttribute("data-poster") || "./images/trailer-poster.jpg";
  var overlay = null;
  var video = null;
  var savedScroll = 0;
  var lastFocus = null;

  function portrait() {
    return window.matchMedia && window.matchMedia("(orientation: portrait) and (max-width: 520px)").matches;
  }

  function srcFor() {
    return portrait() ? tall : wide;
  }

  function close() {
    if (!overlay) return;
    document.removeEventListener("keydown", onKey);
    window.removeEventListener("resize", onResize);
    if (video) {
      try { video.pause(); } catch (e) { /* ignore */ }
      video.removeAttribute("src");
      video.load();
    }
    overlay.remove();
    overlay = null;
    video = null;
    document.documentElement.classList.remove("trailer-open");
    window.scrollTo(0, savedScroll);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    window.dispatchEvent(new CustomEvent("trailer:close"));
  }

  function onKey(e) {
    if (e.key === "Escape") close();
  }

  function onResize() {
    if (!video || !overlay) return;
    var next = srcFor();
    var wantPortrait = next === tall;
    overlay.classList.toggle("is-portrait", wantPortrait);
    if (video.getAttribute("src") !== next && video.currentSrc.indexOf(next.replace(/^\.\//, "")) < 0) {
      var t = video.currentTime || 0;
      var wasPaused = video.paused;
      video.src = next;
      video.addEventListener("loadedmetadata", function once() {
        video.removeEventListener("loadedmetadata", once);
        try { video.currentTime = t; } catch (e) { /* ignore */ }
        if (!wasPaused) video.play().catch(function () {});
      });
    }
  }

  function open() {
    if (overlay) return;
    lastFocus = document.activeElement;
    savedScroll = window.scrollY || window.pageYOffset || 0;
    var usePortrait = portrait();

    overlay = document.createElement("div");
    overlay.className = "trailer-overlay" + (usePortrait ? " is-portrait" : "");
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Yooba Land trailer");

    var box = document.createElement("div");
    box.className = "trailer-box";

    video = document.createElement("video");
    video.setAttribute("playsinline", "");
    video.setAttribute("controls", "");
    video.setAttribute("preload", "auto");
    video.setAttribute("poster", poster);
    video.src = srcFor();
    // Real user click unlocks audio; keep muted false so the trailer plays with sound.
    video.muted = false;
    video.autoplay = true;

    var closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "trailer-close";
    closeBtn.setAttribute("aria-label", "Close the trailer");
    closeBtn.textContent = "\u00d7";

    var missing = document.createElement("p");
    missing.className = "trailer-missing";
    missing.hidden = true;
    missing.textContent = "The trailer cut is not on this build yet.";

    box.appendChild(video);
    box.appendChild(missing);
    overlay.appendChild(box);
    overlay.appendChild(closeBtn);
    document.body.appendChild(overlay);
    document.documentElement.classList.add("trailer-open");

    closeBtn.addEventListener("click", close);
    overlay.addEventListener("click", function (e) {
      if (!box.contains(e.target)) close();
    });
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);

    video.addEventListener("error", function () {
      missing.hidden = false;
      window.dispatchEvent(new CustomEvent("trailer:missing", { detail: { src: video.getAttribute("src") } }));
    });
    video.addEventListener("playing", function () {
      window.dispatchEvent(new CustomEvent("trailer:playing", {
        detail: {
          src: video.currentSrc || video.src,
          muted: video.muted,
          portrait: usePortrait,
          width: video.videoWidth,
          height: video.videoHeight,
        },
      }));
    });
    video.addEventListener("timeupdate", function onTime() {
      if (video.currentTime >= 5) {
        video.removeEventListener("timeupdate", onTime);
        window.dispatchEvent(new CustomEvent("trailer:five", {
          detail: { time: video.currentTime, portrait: overlay.classList.contains("is-portrait") },
        }));
      }
    });

    closeBtn.focus();
    var playPromise = video.play();
    if (playPromise && playPromise.catch) playPromise.catch(function () { /* controls stay; visitor can press play */ });
    window.dispatchEvent(new CustomEvent("trailer:open", {
      detail: { src: video.getAttribute("src"), portrait: usePortrait, scrollY: savedScroll },
    }));
  }

  openBtn.addEventListener("click", open);

  // Playtest / page helpers
  window.yoobaTrailer = {
    open: open,
    close: close,
    isOpen: function () { return !!overlay; },
    video: function () { return video; },
    scrollSaved: function () { return savedScroll; },
  };
})();
