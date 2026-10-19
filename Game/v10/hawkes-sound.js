/*
 * Hawkes standard sound setup for the Yooba Land game page (shared memory m_d00535b22659).
 *
 * The deploy (YoobaWebBuild.InstallSoundPrompt) copies this file to the website's Game/v<n>/ and puts
 * <script src="v<n>/hawkes-sound.js"></script> at the top of Game/index.html's <head>, before Unity's loader.
 * Edit it here (YoobaLand/Tools/Web), not in the website: the deploy overwrites the website's copy.
 *
 * 1. A full-screen "Tap to play" prompt shows as soon as the page loads, in any orientation. The game loads behind it.
 * 2. That tap unlocks audio. Unity keeps its AudioContext private (WEBAudio.audioContext inside the framework), so this
 *    script wraps window.AudioContext before the loader runs: every context Unity makes is tracked and resumed. If the
 *    player taps before Unity has made one, the tap makes it (inside the gesture, which iOS requires) and Unity's
 *    `new AudioContext` gets that already-unlocked one. The tap also plays a silent buffer and primes a pool of
 *    <audio> elements that Unity's `new Audio` is handed (iOS only lets an element play if it was started in a touch).
 * 3. Audio resumes when the tab comes back, the page is restored, or iOS reports the context "interrupted"; any
 *    later touch, click or key also resumes it.
 *
 * The game's Settings (Sound on/off, Music, Effects) are saved by Unity as "hawkes.sound" { on, music, sfx }; Unity
 * mirrors them to localStorage, so the prompt's line says "Sound off" when the player turned it off.
 *
 * window.hawkesSound: tap() presses the prompt (the playtest bot uses it), state() describes it as JSON.
 * Plain ES5, no dependencies: it must run on old iOS Safari too.
 */
(function () {
  'use strict';
  if (window.hawkesSound) return;

  var SILENCE_WAV = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
  var POOL_SIZE = 24;

  var NativeContext = window.AudioContext || window.webkitAudioContext;
  var NativeAudio = window.Audio;
  var contexts = [];
  var pending = null;   // made in the tap before Unity asked for one
  var unlocked = false;
  var taps = 0;
  var trusted = false;  // the tap was a real user gesture
  var pool = [];
  var priming = 0;

  function log(message) {
    if (window.console && console.log) console.log('[HawkesSound] ' + message);
  }

  // ─── AudioContext: track Unity's ───────────────────────────────

  function track(context) {
    if (contexts.indexOf(context) >= 0) return context;
    contexts.push(context);
    // Unity sets onstatechange itself, so listen instead of assigning.
    if (context.addEventListener) {
      context.addEventListener('statechange', function () {
        // iOS: a call, Siri or the lock screen leaves the context "interrupted"; resume once the page is visible.
        if (unlocked && context.state !== 'running' && context.state !== 'closed' && !document.hidden) resumeAll();
      });
    }
    return context;
  }

  if (NativeContext) {
    var HawkesAudioContext = function (options) {
      var context;
      // The tap may already have made (and unlocked) a context; hand it to Unity whatever options it asks with.
      if (pending) {
        context = pending;
        pending = null;
      } else {
        context = options === undefined ? new NativeContext() : new NativeContext(options);
      }
      return track(context);
    };
    HawkesAudioContext.prototype = NativeContext.prototype;
    window.AudioContext = HawkesAudioContext;
    if (window.webkitAudioContext) window.webkitAudioContext = HawkesAudioContext;
  }

  function resumeAll() {
    // Unity's own handle, where a build exposes it (most keep it private; the wrapper above has it then).
    try { if (window.WEBAudio && window.WEBAudio.audioContext) track(window.WEBAudio.audioContext); } catch (e) { /* fine */ }
    for (var i = 0; i < contexts.length; i++) {
      var context = contexts[i];
      if (context.state === 'running' || context.state === 'closed') continue;
      try {
        var p = context.resume();
        if (p && p.catch) p.catch(function () {});
      } catch (e) { /* resume needs a gesture here; the next touch tries again */ }
    }
  }

  function playSilence(context) {
    try {
      var source = context.createBufferSource();
      source.buffer = context.createBuffer(1, 1, 22050);
      source.connect(context.destination);
      source.start ? source.start(0) : source.noteOn(0);
    } catch (e) { /* the resume may still have worked */ }
  }

  // ─── <audio> elements: a primed pool for Unity's `new Audio` ───

  function primePool() {
    if (!NativeAudio) return;
    while (pool.length + priming < POOL_SIZE) {
      var element = new NativeAudio(SILENCE_WAV);
      element.muted = true;
      element.setAttribute('playsinline', 'true');
      priming++;
      (function (el) {
        function done(ok) {
          priming--;
          try { el.pause(); el.currentTime = 0; } catch (e) { /* not loaded yet */ }
          if (ok) pool.push(el);
        }
        var p;
        try { p = el.play(); } catch (e) { done(false); return; }
        if (p && p.then) p.then(function () { done(true); }, function () { done(false); });
        else done(true);
      })(element);
    }
  }

  if (NativeAudio) {
    var HawkesAudio = function (src) {
      var element = pool.pop();
      if (element) {
        element.removeAttribute('src');
        element.muted = false;
        element.loop = false;
        element.autoplay = false;
        if (src !== undefined) element.src = src;
        return element;
      }
      return src === undefined ? new NativeAudio() : new NativeAudio(src);
    };
    HawkesAudio.prototype = NativeAudio.prototype;
    window.Audio = HawkesAudio;
  }

  // ─── The unlock (inside a gesture) ─────────────────────────────

  function unlock() {
    // iOS 16.4+: play through the ring/silent switch like a video does, so "no sound on my iPhone" isn't the switch.
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* older iOS */ }
    if (NativeContext && contexts.length === 0 && !pending) {
      try { pending = new NativeContext(); } catch (e) { pending = null; }
      if (pending) track(pending);
    }
    unlocked = true;
    resumeAll();
    for (var i = 0; i < contexts.length; i++) playSilence(contexts[i]);
    primePool();
  }

  // ─── The prompt ────────────────────────────────────────────────

  var css =
    '#hawkes-tap{position:fixed;top:0;left:0;right:0;bottom:0;z-index:8000;display:flex;flex-direction:column;' +
    'align-items:center;justify-content:center;background:radial-gradient(circle at 50% 42%,#2f6b4c 0%,#16301f 58%,#0b140e 100%);' +
    'color:#fff;font-family:"Arial Rounded MT Bold","Trebuchet MS",Arial,sans-serif;text-align:center;cursor:pointer;' +
    '-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;touch-action:manipulation;' +
    'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);' +
    'transition:opacity .25s ease}' +
    '#hawkes-tap.gone{opacity:0;pointer-events:none}' +
    '#hawkes-tap h1{font-size:clamp(34px,11vmin,110px);letter-spacing:.03em;line-height:1;color:#c8f7a8;' +
    'text-shadow:0 .06em 0 #2f9e6b,0 .12em .3em rgba(0,0,0,.55)}' +
    '#hawkes-tap>*{margin:1.5vmin 0}' +
    '#hawkes-tap button{font:inherit;font-weight:bold;font-size:clamp(22px,6vmin,52px);color:#0f2a1a;background:#59e680;border:0;' +
    'border-radius:999px;padding:.45em 1.4em;min-height:56px;box-shadow:0 .14em 0 #2f9e6b,0 .3em .8em rgba(0,0,0,.45);' +
    'cursor:pointer;animation:hawkes-tap-pulse 1.4s ease-in-out infinite}' +
    '#hawkes-tap p{font-family:Arial,sans-serif;font-size:clamp(14px,3.2vmin,24px);color:rgba(255,255,255,.78);padding:0 6vw}' +
    '@keyframes hawkes-tap-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}' +
    '@media (prefers-reduced-motion:reduce){#hawkes-tap button{animation:none}}';

  // The saved Settings (Unity mirrors PlayerPrefs "hawkes.sound" here); missing or unreadable means sound on.
  function soundOn() {
    try {
      var saved = JSON.parse(window.localStorage.getItem('hawkes.sound') || 'null');
      return !saved || saved.on !== false;
    } catch (e) {
      return true;
    }
  }

  var overlay = null;

  function addStyle() {
    var style = document.createElement('style');
    style.id = 'hawkes-tap-style';
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  }

  function show() {
    if (overlay || !document.body) return;
    overlay = document.createElement('div');
    overlay.id = 'hawkes-tap';
    overlay.setAttribute('role', 'button');
    overlay.setAttribute('aria-label', 'Tap to play');
    overlay.innerHTML = '<h1>YOOBA LAND</h1><button type="button">Tap to play</button><p>' +
      (soundOn() ? 'Sound on. Help Yooba eat, grow and find the way home.' : 'Sound is off. Turn it on in Settings (the gear).') + '</p>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', onTap);
    // touchend counts as a gesture on iOS (touchstart doesn't); preventDefault stops the follow-up mouse
    // events from landing on the game once the prompt is gone (a tap mustn't press a menu button underneath).
    overlay.addEventListener('touchend', function (e) { e.preventDefault(); onTap(e); }, { passive: false });
    window.addEventListener('keydown', onKey, true);
  }

  function onKey(e) {
    if (!overlay || e.repeat) return;
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      e.stopImmediatePropagation();
      onTap(e);
    }
  }

  function onTap(e) {
    if (!overlay) return;
    taps++;
    trusted = !!(e && e.isTrusted);
    unlock();
    var gone = overlay;
    overlay = null;
    window.removeEventListener('keydown', onKey, true);
    gone.className = 'gone';
    setTimeout(function () { if (gone.parentNode) gone.parentNode.removeChild(gone); }, 300);
    try { if (document.getElementById('unity-canvas')) document.getElementById('unity-canvas').focus(); } catch (err) { /* fine */ }
    log('prompt tapped (' + (trusted ? 'real gesture' : 'scripted') + '), audio ' + audioState());
  }

  // ─── Resuming later ────────────────────────────────────────────

  function onGesture() {
    if (!unlocked) return;
    resumeAll();
    primePool();
  }

  function onVisible() {
    if (unlocked && !document.hidden) resumeAll();
  }

  window.addEventListener('touchend', onGesture, true);
  window.addEventListener('pointerup', onGesture, true);
  window.addEventListener('click', onGesture, true);
  window.addEventListener('keydown', onGesture, true);
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('pageshow', onVisible);
  window.addEventListener('focus', onVisible);

  function audioState() {
    if (contexts.length === 0) return 'none';
    var states = [];
    for (var i = 0; i < contexts.length; i++) states.push(contexts[i].state);
    return states.join(',');
  }

  window.hawkesSound = {
    /** Presses the prompt (as a script: browsers only unlock audio for a real tap). False if it wasn't up. */
    tap: function () {
      if (!overlay) return false;
      overlay.click();
      return true;
    },
    /** {"prompt":"shown"|"gone"|"loading","taps":n,"trusted":bool,"audio":"running"|"suspended"|...|"none","pool":n} */
    state: function () {
      return JSON.stringify({
        prompt: overlay ? 'shown' : (taps > 0 ? 'gone' : 'loading'),
        taps: taps,
        trusted: trusted,
        audio: audioState(),
        pool: pool.length
      });
    },
  };

  addStyle();
  if (document.body) show();
  else document.addEventListener('DOMContentLoaded', show);
})();
