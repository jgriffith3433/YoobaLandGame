// Hawkes errors: on the beta site, every error Yooba Land hits is filed in Hawkes Studio's bug tracker by itself, the
// way J's 🐞 button files a report (POST /dev/__studio/report on the same origin: a finding with source "J", area
// "J's playtest"). It catches the page's errors (window "error", "unhandledrejection"), Unity's (YoobaErrorReporter.cs
// sends Application.logMessageReceived's errors and exceptions through YoobaErrors.jslib) and the network's
// (hawkes-net.js reports WebRTC link failures, lost relay routes, no signalling relay and failed joins), each with its
// message, stack, scene, online state (room, peers, relays) and device, a screenshot of the game when the canvas
// allows, and the game's hawkesPlaytest state.
//
// Beta only: Studio puts its 🐞 hook (script[data-hawkes-report]) into the beta site's pages and never into the live
// one, so without it (and always on yoobalandgame.com) nothing is sent; errors are still counted in state().
// Flood control: one report per message and stack, at most one a minute (the rest wait their turn) and 20 a session
// (the browser tab: sessionStorage, so a reload keeps the count). While a playtest other than "errors" runs nothing is
// sent (the playtest's own review files those). Copied into Game/v<n>/ by the deploy (YoobaWebBuild.InstallErrorReporter)
// and loaded right after the sound prompt, before Unity's loader. Edit it here, never in the website.
(function () {
  "use strict";
  if (window.hawkesErrors) return;

  var ENDPOINT = "/dev/__studio/report";
  var GAP_MS = 60000;
  var SESSION_CAP = 20;
  var STORE = "hawkes.errors";
  var LIVE = /(^|\.)yoobalandgame\.com$/i;
  var now = window.__hawkesErrorsNow || function () { return Date.now(); };
  var later = function (fn, ms) { return (window.__hawkesErrorsTimer || window.setTimeout)(fn, ms); };

  var context = {};
  var queue = [];
  var sending = false;
  var timer = null;
  var busy = false;
  var recent = [];
  var counts = { caught: 0, sent: 0, duplicate: 0, capped: 0, notSent: 0, playtest: 0, failed: 0 };

  // What this tab has sent so far (kept over a reload): keys of reports sent, when the last one went, how many.
  var session = { sent: 0, last: 0, keys: [], ids: [] };
  try {
    var saved = JSON.parse(window.sessionStorage.getItem(STORE) || "null");
    if (saved && typeof saved.sent === "number") session = { sent: saved.sent, last: saved.last || 0, keys: saved.keys || [], ids: saved.ids || [] };
  } catch (e) { }
  function persist() {
    try { window.sessionStorage.setItem(STORE, JSON.stringify(session)); } catch (e) { }
  }

  function where() {
    try {
      if (LIVE.test(location.hostname)) return { on: false, why: "live site (" + location.hostname + ")" };
      if (!document.querySelector("script[data-hawkes-report]")) return { on: false, why: "no Hawkes Studio bug button on this page (not the beta site)" };
      return { on: true, why: "beta site" };
    } catch (e) {
      return { on: false, why: "page unreadable" };
    }
  }
  var site = where();

  function cut(text, n) {
    text = text == null ? "" : String(text);
    return text.length > n ? text.slice(0, n) + "…" : text;
  }

  // The same error twice: same source, first line (numbers aside) and the top of the stack.
  function keyOf(source, message, stack) {
    var first = String(message || "").split("\n")[0].replace(/\d+/g, "#").trim();
    var top = String(stack || "").split("\n").map(function (l) { return l.trim(); }).filter(Boolean).slice(0, 4).join(" | ").replace(/:\d+(:\d+)?/g, "");
    return cut(source + " · " + first + " · " + top, 400);
  }

  function online() {
    var net = window.hawkesNet;
    if (!net || typeof net.state !== "function") return { network: "no hawkes-net on this page" };
    try {
      var s = JSON.parse(net.state());
      var out = {
        room: s.room || "", self: s.self || "", peers: (s.peers || []).length, host: s.host || "", isHost: !!s.isHost,
        joining: !!s.joining, signal: s.signal || "", relays: { nostr: (s.nostr || []).length, trackers: (s.torrent || []).length },
        relayed: (s.peers || []).filter(function (p) { return !p.direct; }).length, bots: s.bots || 0,
      };
      if (typeof net.failures === "function") out.failures = net.failures();
      return out;
    } catch (e) {
      return { network: "state() threw: " + (e && e.message || e) };
    }
  }

  function onlineLine(o) {
    if (!o || o.network) return o ? o.network : "?";
    if (!o.room) return "not in a room" + (o.joining ? " (joining)" : "") + "; relays nostr " + o.relays.nostr + ", trackers " + o.relays.trackers;
    return o.room + ", " + o.peers + " peer" + (o.peers === 1 ? "" : "s") + (o.relayed ? " (" + o.relayed + " through a relay)" : "")
      + ", host " + (o.isHost ? "this page" : o.host) + "; relays nostr " + o.relays.nostr + ", trackers " + o.relays.trackers;
  }

  function device() {
    var n = window.navigator || {};
    var touch = false;
    try { touch = window.matchMedia("(pointer: coarse)").matches; } catch (e) { }
    return {
      ua: n.userAgent || "", touch: touch, touchPoints: n.maxTouchPoints || 0,
      platform: (n.userAgentData && n.userAgentData.platform) || n.platform || "", lang: n.language || "",
      memory: n.deviceMemory || 0, cores: n.hardwareConcurrency || 0,
    };
  }

  function playtestRunning() {
    var p = context.playtest || "";
    if (!p) {
      try { p = new URLSearchParams(location.search).get("playtest") || ""; } catch (e) { }
    }
    return p && p !== "errors" ? p : "";
  }

  function remember(entry) {
    recent.push(entry);
    if (recent.length > 30) recent.shift();
  }

  // Report one error: { source: "unity" | "page" | "net", message, stack, test, detail }. Returns what became of it.
  function report(e) {
    if (busy) return "ignored";
    busy = true;
    try {
      e = e || {};
      var source = String(e.source || "page");
      var message = cut(e.message || "error", 2000);
      var stack = cut(e.stack || "", 6000);
      var key = keyOf(source, message, stack);
      counts.caught++;
      var entry = { at: now(), source: source, message: cut(message, 200), key: key, test: !!e.test, result: "" };
      remember(entry);
      if (!site.on) { counts.notSent++; return (entry.result = "not sent: " + site.why); }
      var running = playtestRunning();
      if (running) { counts.playtest++; return (entry.result = "not sent: playtest " + running + " is running"); }
      for (var i = 0; i < queue.length; i++) {
        if (queue[i].key === key) { queue[i].count++; counts.duplicate++; return (entry.result = "duplicate (waiting to send)"); }
      }
      if (session.keys.indexOf(key) >= 0) { counts.duplicate++; return (entry.result = "duplicate (already sent)"); }
      if (session.sent + queue.length + (sending ? 1 : 0) >= SESSION_CAP) { counts.capped++; return (entry.result = "not sent: " + SESSION_CAP + " this session already"); }
      queue.push({
        key: key, source: source, message: message, stack: stack, test: !!e.test, detail: e.detail || null, count: 1, at: now(), tries: 0,
        scene: context.scene || "", online: online(), entry: entry,
      });
      entry.result = "queued";
      pump();
      return "queued";
    } finally {
      busy = false;
    }
  }

  function pump() {
    if (sending || timer || !queue.length) return;
    var wait = session.last + GAP_MS - now();
    if (wait > 0) {
      timer = later(function () { timer = null; pump(); }, wait + 50);
      return;
    }
    var item = queue.shift();
    sending = true;
    session.last = now();
    session.keys.push(item.key);
    if (session.keys.length > 60) session.keys.shift();
    persist();
    send(item).then(function () { sending = false; pump(); }, function () { sending = false; pump(); });
  }

  // The game's frame: the biggest canvas, read right after a frame is drawn (Studio's hook keeps WebGL's drawing
  // buffer on beta, so phones read it too). Nothing when it reads all one colour or can't be read.
  function screenshot() {
    return new Promise(function (resolve) {
      var done = false;
      var finish = function (v) { if (!done) { done = true; resolve(v); } };
      later(function () { finish(null); }, 1500);
      var read = function () {
        try {
          var list = [].slice.call(document.querySelectorAll("canvas")).filter(function (c) { return c.width && c.height; });
          list.sort(function (a, b) { return b.width * b.height - a.width * a.height; });
          var game = list[0];
          if (!game) return finish(null);
          var k = Math.min(1, 960 / Math.max(game.width, game.height));
          var c = document.createElement("canvas");
          c.width = Math.max(1, Math.round(game.width * k));
          c.height = Math.max(1, Math.round(game.height * k));
          var g = c.getContext("2d");
          g.drawImage(game, 0, 0, c.width, c.height);
          var px = g.getImageData(0, 0, c.width, c.height).data;
          var same = true;
          for (var i = 4; i < px.length && same; i += 4 * 97) same = px[i] === px[0] && px[i + 1] === px[1] && px[i + 2] === px[2];
          finish(same ? null : c.toDataURL("image/jpeg", 0.7));
        } catch (err) {
          finish(null);
        }
      };
      if (window.requestAnimationFrame) window.requestAnimationFrame(read); else read();
    });
  }

  function json(read, n) {
    try {
      var v = read();
      if (v == null) return null;
      var s = typeof v === "string" ? v : JSON.stringify(v);
      return cut(s, n);
    } catch (e) {
      return "threw: " + (e && e.message || e);
    }
  }

  function build() {
    try {
      var tag = document.querySelector("script[src$='/dev/__studio/report.js']");
      return tag ? JSON.parse(tag.getAttribute("data-hawkes") || "{}") : {};
    } catch (e) {
      return {};
    }
  }

  function send(item) {
    item.tries++;
    return screenshot().then(function (shot) {
      var pt = window.hawkesPlaytest;
      var line = String(item.message).split("\n")[0];
      var text = [
        "Caught automatically (" + item.source + (item.test ? ", a deliberate test error" : "") + ", no click): " + cut(line, 300),
        "Scene: " + (item.scene || "?") + " · Online: " + onlineLine(item.online),
        item.count > 1 ? "Seen " + item.count + " times before it was sent." : "",
        item.message.indexOf("\n") >= 0 ? "Message:\n" + item.message : "",
        "Stack:\n" + (item.stack || "(none)"),
        item.detail ? "Detail: " + cut(JSON.stringify(item.detail), 1500) : "",
      ].filter(Boolean).join("\n");
      var body = {
        text: text, blocker: false, url: location.href, title: document.title, shot: shot,
        shotNote: shot ? null : "no screenshot: the game's canvas couldn't be read",
        viewport: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio || 1 },
        device: device(), console: (window.__hawkesLog || []).slice(-25),
        state: json(function () { return pt && pt.state && pt.state(); }, 4000),
        report: json(function () { return pt && pt.report && pt.report(); }, 4000),
        build: build(),
        auto: {
          source: item.source, message: cut(item.message, 2000), stack: item.stack, scene: item.scene, online: item.online,
          key: item.key, count: item.count, test: item.test, at: item.at, session: session.sent + 1,
        },
      };
      return window.fetch(ENDPOINT, {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (out) {
          if (!r.ok) { var bad = new Error(((out && out.error) || "refused") + " (HTTP " + r.status + ")"); bad.status = r.status; throw bad; }
          session.sent++;
          session.ids.push(out.id || "?");
          if (session.ids.length > SESSION_CAP) session.ids.shift();
          persist();
          counts.sent++;
          item.entry.result = "sent: " + (out.id || "?") + (out.deduped ? " (already in the backlog)" : "");
          item.entry.id = out.id || "";
          lastSent = { id: out.id || "", at: now(), key: item.key, source: item.source, deduped: !!out.deduped, shot: !!shot };
        });
      });
    }).catch(function (err) {
      counts.failed++;
      item.entry.result = "send failed: " + (err && err.message || err);
      lastFailure = { at: now(), error: String(err && err.message || err), key: item.key };
      // Let it go again once (the next free minute) unless the page has no bug endpoint at all.
      var i = session.keys.indexOf(item.key);
      if (i >= 0) session.keys.splice(i, 1);
      persist();
      var status = err && err.status || 0;
      if (item.tries < 2 && status !== 403 && status !== 404 && status !== 413) queue.unshift(item);
    });
  }

  var lastSent = null;
  var lastFailure = null;

  function errorText(reason) {
    if (reason instanceof Error) return { message: (reason.name ? reason.name + ": " : "") + reason.message, stack: reason.stack || "" };
    if (reason && typeof reason === "object") return { message: reason.message ? String(reason.message) : json(function () { return reason; }, 500), stack: reason.stack || "" };
    return { message: String(reason), stack: "" };
  }

  window.addEventListener("error", function (e) {
    var t = e && e.target;
    if (t && t !== window && (t.tagName === "SCRIPT" || t.tagName === "LINK")) {
      report({ source: "page", message: "Failed to load " + t.tagName.toLowerCase() + " " + (t.src || t.href || ""), stack: "" });
      return;
    }
    if (!e || (!e.message && !e.error)) return;
    var err = e.error ? errorText(e.error) : { message: e.message, stack: "" };
    if (!err.stack && e.filename) err.stack = "at " + e.filename + ":" + (e.lineno || 0) + ":" + (e.colno || 0);
    report({ source: "page", message: err.message || e.message, stack: err.stack, test: /deliberate test error/i.test(err.message || e.message || "") });
  }, true);

  window.addEventListener("unhandledrejection", function (e) {
    var err = errorText(e && e.reason);
    report({ source: "page", message: "Unhandled rejection: " + err.message, stack: err.stack, test: /deliberate test error/i.test(err.message) });
  });

  window.hawkesErrors = {
    version: 1,
    report: report,
    // What the game knows (YoobaErrorReporter.cs): { scene, playtest, outside, ... }.
    setContext: function (c) {
      if (typeof c === "string") { try { c = JSON.parse(c); } catch (e) { return; } }
      for (var k in c) if (Object.prototype.hasOwnProperty.call(c, k)) context[k] = c[k];
    },
    state: function () {
      return {
        enabled: site.on, why: site.why, caught: counts.caught, sent: counts.sent, sentThisSession: session.sent, duplicate: counts.duplicate,
        capped: counts.capped, notSent: counts.notSent, playtest: counts.playtest, failed: counts.failed, queued: queue.length + (sending ? 1 : 0),
        nextInMs: queue.length ? Math.max(0, session.last + GAP_MS - now()) : 0, lastSent: lastSent, lastFailure: lastFailure,
        limits: { gapMs: GAP_MS, perSession: SESSION_CAP }, context: context, recent: recent.slice(-12),
      };
    },
    // A deliberate page error and an unhandled rejection (the hidden debug action and the errors playtest).
    deliberate: function (what) {
      if (what !== "rejection") later(function () { throw new Error("Yooba deliberate test error (page): the hidden debug action"); }, 0);
      if (what !== "error") Promise.reject(new Error("Yooba deliberate test error (rejection): the hidden debug action"));
    },
  };
})();
