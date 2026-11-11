// Home page cast: loads site/cast/cast.json into #characters.
// Tap a card to play the next voice line (never the same twice in a row) with a caption bubble and a portrait
// reaction. A second tap while that card is speaking stops it. Only one character speaks at a time.
(function () {
  var root = document.querySelector("[data-cast]");
  if (!root) return;

  var CAST_BASE = "./site/cast/";
  var list = root.querySelector("[data-cast-list]");
  var hint = root.querySelector("[data-cast-hint]");
  if (!list) return;

  var data = null;
  var audio = null;
  var speakingId = null;
  var lastLine = Object.create(null);
  var hintShown = false;
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function resolve(src) {
    if (!src) return "";
    if (/^(https?:|data:|blob:|\/)/i.test(src)) return src;
    return CAST_BASE + src.replace(/^\.\//, "");
  }

  function cardFor(id) {
    return list.querySelector('.cast-hit[data-cast-id="' + id + '"]');
  }

  function stopSpeaking() {
    if (audio) {
      try { audio.pause(); } catch (e) {}
      audio = null;
    }
    if (speakingId) {
      var card = cardFor(speakingId);
      if (card) {
        card.classList.remove("is-speaking");
        card.setAttribute("aria-pressed", "false");
        var bubble = card.querySelector("[data-cast-bubble]");
        if (bubble) {
          bubble.hidden = true;
          bubble.textContent = "";
        }
        var art = card.querySelector(".cast-art");
        if (art) art.classList.remove("is-react-bounce", "is-react-blink", "is-react-lean");
      }
      speakingId = null;
    }
  }

  function pickLine(c) {
    var lines = c.voice || [];
    if (!lines.length) return null;
    if (lines.length === 1) return { line: lines[0], index: 0 };
    var prev = lastLine[c.id];
    var opts = [];
    for (var i = 0; i < lines.length; i++) if (i !== prev) opts.push(i);
    var index = opts[Math.floor(Math.random() * opts.length)];
    return { line: lines[index], index: index };
  }

  function react(card, kind) {
    var art = card.querySelector(".cast-art");
    if (!art || reduced) return;
    art.classList.remove("is-react-bounce", "is-react-blink", "is-react-lean");
    // Retrigger CSS animation
    void art.offsetWidth;
    art.classList.add("is-react-" + (kind || "bounce"));
  }

  function showHint() {
    if (hintShown || !hint) return;
    hintShown = true;
    hint.hidden = false;
    window.setTimeout(function () {
      if (hint) hint.hidden = true;
    }, 4200);
  }

  function speak(c, card) {
    var pick = pickLine(c);
    if (!pick) return;
    lastLine[c.id] = pick.index;
    stopSpeaking();

    var bubble = card.querySelector("[data-cast-bubble]");
    if (bubble) {
      bubble.textContent = pick.line.caption || "";
      bubble.hidden = !pick.line.caption;
    }
    card.classList.add("is-speaking");
    card.setAttribute("aria-pressed", "true");
    speakingId = c.id;
    react(card, c.react || "bounce");
    showHint();

    var src = resolve(pick.line.src);
    if (!src) return;
    audio = new Audio(src);
    audio.preload = "auto";
    var done = function () {
      if (speakingId === c.id) stopSpeaking();
    };
    audio.addEventListener("ended", done);
    audio.addEventListener("error", done);
    var play = audio.play();
    if (play && play.catch) {
      play.catch(function () {
        // Sound blocked or missing file: caption + reaction still stand.
      });
    }
  }

  function onCardActivate(c, card) {
    if (speakingId === c.id) {
      stopSpeaking();
      return;
    }
    speak(c, card);
  }

  function buildCard(c, i) {
    var li = document.createElement("li");
    li.className = "cast-card";
    li.style.setProperty("--i", String(i));
    li.dataset.castId = c.id;

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cast-hit";
    btn.setAttribute("aria-label", "Hear " + c.name);
    btn.setAttribute("aria-pressed", "false");
    btn.dataset.castId = c.id;

    var art = document.createElement("div");
    art.className = "cast-art";
    art.dataset.react = c.react || "bounce";

    if (c.portraitSvg) {
      art.innerHTML = c.portraitSvg;
      var svg = art.querySelector("svg");
      if (svg) {
        svg.setAttribute("role", "img");
        svg.setAttribute("aria-label", c.name + ". " + (c.who || ""));
      }
    } else {
      var img = document.createElement("img");
      img.loading = "lazy";
      img.decoding = "async";
      img.alt = c.name + (c.who ? ". " + c.who : "");
      img.width = 512;
      img.height = 512;
      img.src = resolve(c.portrait);
      if (c.objectPosition) img.style.objectPosition = c.objectPosition;
      art.appendChild(img);
    }

    var bubble = document.createElement("p");
    bubble.className = "cast-bubble";
    bubble.setAttribute("data-cast-bubble", "");
    bubble.setAttribute("role", "status");
    bubble.setAttribute("aria-live", "polite");
    bubble.hidden = true;

    var name = document.createElement("h3");
    name.textContent = c.name;
    var who = document.createElement("p");
    who.className = "cast-who";
    who.textContent = c.who || "";

    btn.appendChild(art);
    btn.appendChild(bubble);
    btn.appendChild(name);
    btn.appendChild(who);
    btn.addEventListener("click", function () { onCardActivate(c, btn); });

    li.appendChild(btn);
    return li;
  }

  function render(cast) {
    list.textContent = "";
    cast.forEach(function (c, i) {
      list.appendChild(buildCard(c, i));
    });
  }

  window.yoobaCast = {
    ready: function () { return !!data; },
    speakingId: function () { return speakingId; },
    lastLineIndex: function (id) { return lastLine[id]; },
    caption: function () {
      var card = speakingId && cardFor(speakingId);
      var bubble = card && card.querySelector("[data-cast-bubble]");
      return bubble && !bubble.hidden ? (bubble.textContent || "") : "";
    },
    stop: stopSpeaking,
    tap: function (id) {
      var c = (data && data.cast || []).filter(function (x) { return x.id === id; })[0];
      var card = cardFor(id);
      if (!c || !card) return false;
      onCardActivate(c, card);
      return true;
    },
    cards: function () {
      return Array.prototype.map.call(list.querySelectorAll(".cast-hit[data-cast-id]"), function (el) {
        return el.getAttribute("data-cast-id");
      });
    }
  };

  fetch(CAST_BASE + "cast.json", { credentials: "same-origin" })
    .then(function (r) { if (!r.ok) throw new Error("cast.json " + r.status); return r.json(); })
    .then(function (json) {
      data = json;
      render(json.cast || []);
    })
    .catch(function (err) {
      console.warn("cast:", err);
    });
})();
