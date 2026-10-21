/*
 * Hawkes standard sound setup for the Yooba Land game page (shared memory m_d00535b22659).
 *
 * The deploy (YoobaWebBuild.InstallSoundPrompt) copies this file to the website's Game/v<n>/ and puts
 * <script src="v<n>/hawkes-sound.js"></script> at the top of Game/index.html's <head>, before Unity's loader.
 * Edit it here (YoobaLand/Tools/Web), not in the website: the deploy overwrites the website's copy.
 *
 * 1. A full-screen "Tap to play" prompt shows as soon as the page loads, in any orientation. The game loads behind it.
 * 2. That tap unlocks audio. Unity keeps its AudioContext private (WEBAudio.audioContext inside the framework), so this
 *    script wraps window.AudioContext before the loader runs: every context Unity makes is tracked and resumed. Unity
 *    always gets a fresh context of its own, never one that is already running: its framework (_JS_Sound_Init) only
 *    marks its audio as running from the context's statechange event, so a context handed over already running left
 *    every sound queued for good (J's "the sound doesn't work at all now"). If the player taps before Unity has made
 *    its context, it is resumed as soon as Unity makes it; Unity's own touch/mouse handler and any later gesture try
 *    again. The tap also plays a silent buffer and, on iOS only, primes a pool of <audio> elements that Unity's
 *    `new Audio` is handed (iOS only lets an element play if it was started in a touch).
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
  var unlocked = false;
  var taps = 0;
  var trusted = false;  // the tap was a real user gesture
  var pool = [];
  var priming = 0;
  // Only iPhones/iPads need the primed <audio> pool (an element must be started inside a touch). Elsewhere Unity
  // gets the browser's own Audio untouched: swapping it broke all sound on desktop Chrome.
  var needsPool = /iP(hone|ad|od)/.test(navigator.userAgent || '') ||
    (/Macintosh/.test(navigator.userAgent || '') && (navigator.maxTouchPoints || 0) > 1);

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
    // Never hand Unity a context that is already running (see the top): always a new one, resumed once the player has
    // tapped. Unity sets onstatechange right after `new AudioContext`, and the resume settles later, so Unity sees
    // "running" arrive.
    var HawkesAudioContext = function (options) {
      var context = track(options === undefined ? new NativeContext() : new NativeContext(options));
      if (unlocked) resumeAll();
      return context;
    };
    HawkesAudioContext.prototype = NativeContext.prototype;
    try { Object.setPrototypeOf(HawkesAudioContext, NativeContext); } catch (e) { /* old browsers */ }
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
    if (!NativeAudio || !needsPool) return;
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

  if (NativeAudio && needsPool) {
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
    // No context of our own here: if Unity hasn't made its context yet, the wrapper resumes it when Unity does.
    unlocked = true;
    resumeAll();
    for (var i = 0; i < contexts.length; i++) playSilence(contexts[i]);
    primePool();
  }

  // ─── The prompt ────────────────────────────────────────────────

  // The title screen's look (J, 2026-10-19: "a proper title card with Yooba art"): a sunny sky, two rows of hills and
  // the meadow, Yooba drawn inline (SVG, on-model: a green box of a body, the wide open toothy mouth, two eyes on
  // stalks, four stubby legs), the logo in cream with a dark green edge. Unity's own title card (YoobaTitleCard)
  // carries on in the same colours once the game starts. Nothing is downloaded for it.
  var css =
    '#hawkes-tap{position:fixed;top:0;left:0;right:0;bottom:0;z-index:8000;display:flex;flex-direction:column;' +
    'align-items:center;justify-content:center;overflow:hidden;' +
    'background:radial-gradient(ellipse 70% 40% at 22% 108%,#3f8a2c 0 60%,transparent 61%),' +
    'radial-gradient(ellipse 80% 45% at 85% 112%,#4c9a33 0 60%,transparent 61%),' +
    'radial-gradient(ellipse 90% 34% at 50% 104%,#6cbc3e 0 60%,transparent 61%),' +
    'radial-gradient(ellipse 70% 30% at 15% 82%,#7fb98a 0 60%,transparent 61%),' +
    'radial-gradient(ellipse 75% 28% at 80% 84%,#8cc596 0 60%,transparent 61%),' +
    'radial-gradient(circle at 78% 18%,rgba(255,248,205,.95) 0,rgba(255,248,205,.35) 7vmin,transparent 22vmin),' +
    'linear-gradient(#3b8ce6 0%,#7dbdf3 45%,#d6efff 78%);' +
    'color:#fff;font-family:"Arial Rounded MT Bold","Trebuchet MS",Arial,sans-serif;text-align:center;cursor:pointer;' +
    '-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;touch-action:manipulation;' +
    'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);' +
    'transition:opacity .45s ease}' +
    '#hawkes-tap.gone{opacity:0;pointer-events:none}' +
    '#hawkes-tap h1{font-size:clamp(40px,12vmin,120px);letter-spacing:.03em;line-height:1;color:#fff28c;' +
    'text-shadow:.04em .04em 0 #12451f,-.04em .04em 0 #12451f,.04em -.04em 0 #12451f,-.04em -.04em 0 #12451f,' +
    '0 .1em 0 #12451f,0 .16em .3em rgba(0,0,0,.4)}' +
    '#hawkes-tap>*{margin:1.4vmin 0;position:relative}' +
    '#hawkes-tap svg{width:clamp(110px,26vmin,240px);height:auto;filter:drop-shadow(0 1.2vmin .8vmin rgba(10,50,10,.35));' +
    'animation:hawkes-tap-bob 2.2s ease-in-out infinite}' +
    '#hawkes-tap button{font:inherit;font-weight:bold;font-size:clamp(22px,6vmin,52px);color:#0f2a1a;background:#fff28c;border:0;' +
    'border-radius:999px;padding:.45em 1.4em;min-height:56px;box-shadow:0 .14em 0 #12451f,0 .3em .8em rgba(0,0,0,.35);' +
    'cursor:pointer;animation:hawkes-tap-pulse 1.4s ease-in-out infinite}' +
    '#hawkes-tap p{font-family:Arial,sans-serif;font-weight:bold;font-size:clamp(14px,3.2vmin,24px);color:#fff;' +
    'text-shadow:0 1px 3px rgba(0,40,10,.8);padding:0 6vw}' +
    '@keyframes hawkes-tap-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}' +
    '@keyframes hawkes-tap-bob{0%,100%{transform:translateY(0) scaleY(1)}50%{transform:translateY(-1.2vmin) scaleY(1.03)}}' +
    '@media (prefers-reduced-motion:reduce){#hawkes-tap button,#hawkes-tap svg{animation:none}}';

  var yoobaSvg =
    '<svg viewBox="0 0 200 250" aria-hidden="true">' +
    '<g fill="#4f9a3a"><rect x="38" y="200" width="22" height="36" rx="10"/><rect x="66" y="204" width="22" height="34" rx="10"/>' +
    '<rect x="112" y="204" width="22" height="34" rx="10"/><rect x="140" y="200" width="22" height="36" rx="10"/>' +
    '<rect x="62" y="22" width="12" height="70" rx="6"/><rect x="126" y="22" width="12" height="70" rx="6"/>' +
    '<circle cx="68" cy="26" r="22"/><circle cx="132" cy="26" r="22"/></g>' +
    '<rect x="28" y="80" width="144" height="134" rx="30" fill="#5eaf45"/>' +
    '<rect x="46" y="96" width="108" height="100" rx="22" fill="#6e1620"/>' +
    '<ellipse cx="100" cy="176" rx="38" ry="14" fill="#ef7d8a"/>' +
    '<g fill="#fbf2d2"><rect x="54" y="96" width="20" height="22" rx="5"/><rect x="78" y="96" width="20" height="24" rx="5"/>' +
    '<rect x="102" y="96" width="20" height="24" rx="5"/><rect x="126" y="96" width="20" height="22" rx="5"/>' +
    '<rect x="58" y="180" width="18" height="16" rx="5"/><rect x="80" y="182" width="18" height="14" rx="5"/>' +
    '<rect x="102" y="182" width="18" height="14" rx="5"/><rect x="124" y="180" width="18" height="16" rx="5"/></g>' +
    '<circle cx="68" cy="26" r="16" fill="#fff"/><circle cx="132" cy="26" r="16" fill="#fff"/>' +
    '<circle cx="71" cy="24" r="7" fill="#6553b4"/><circle cx="135" cy="24" r="7" fill="#6553b4"/>' +
    '<circle cx="73" cy="22" r="2.5" fill="#fff"/><circle cx="137" cy="22" r="2.5" fill="#fff"/></svg>';

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
    overlay.innerHTML = '<h1>YOOBA LAND</h1>' + yoobaSvg + '<button type="button">Tap to play</button><p>' +
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
    setTimeout(function () { if (gone.parentNode) gone.parentNode.removeChild(gone); }, 500);
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
