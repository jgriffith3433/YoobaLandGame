// Hawkes playtest contract for the home page (spec: hawkesstudio/docs/playtest.md). Loaded only when a bot drives the
// page (index.html: navigator.webdriver or ?playtest=), so players download nothing.
//
// Scenarios (all open Game/ in a full-window frame so the bot keeps its log):
//   play-flow   — hero holds still, Play, loading (bar + lore), canvas without moving, failed load + Try again
//                 (at "load-failed": only the failure part)
//   play-fail   — Game/?playtest=fail-load shows the failure screen (and Try again)
//   play-rotate — phone portrait: rotate prompt, then landscape; Tap to play gets the first pointerdown
//   play-chrome — fullscreen button toggles; the back-to-home link returns to the site home
import { installPlaytest } from './hawkes-playtest.js';

const px = (n) => Math.round(n * 10) / 10;
const rectOf = (el) => { const r = el.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; };
const drift = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));

// Layout shifts from the first paint (buffered), told apart: the ones inside the hero, and all of them.
let clsAll = 0;
let clsHero = 0;
try {
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      if (e.hadRecentInput) continue;
      clsAll += e.value;
      if ((e.sources || []).some((s) => s.node && s.node.closest && s.node.closest('.hero'))) clsHero += e.value;
    }
  }).observe({ type: 'layout-shift', buffered: true });
} catch { /* no layout-shift entries in this browser: the rectangle checks below still run */ }

// Where the hero Play button first stood, as soon as the page could be measured. The check below compares against this,
// not against where it stands when the scenario starts, so a jump before the bot began (the "What's new" line filling
// in, a font swap) still counts.
// Measured on screen (getBoundingClientRect), so a slide-in animation counts as the movement a player sees: the hero
// words fade in without moving, and the button must stand still from its first frame.
const layoutOf = rectOf;
let firstPlay = null;
const noteFirstPlay = () => {
  const el = document.querySelector('.hero .play-large');
  if (el && !firstPlay) firstPlay = layoutOf(el);
};
noteFirstPlay();
if (!firstPlay) document.addEventListener('DOMContentLoaded', noteFirstPlay);

const phoneish = () => {
  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  const short = Math.min(window.innerWidth, window.innerHeight) <= 500;
  return !!(coarse && short);
};

installPlaytest({
  product: 'yoobaland',
  isReady: () => document.readyState !== 'loading',
  stallSeconds: 90,
  scenarios: [{
    id: 'play-flow',
    title: 'Press Play: loading screen, game, failed load and retry',
    seconds: 150,
    tags: ['full'],
    starts: ['load-failed'],
    description: 'Home page: hero stays still, press Play, the game page shows its progress bar and rotating lore lines, ' +
      'the canvas appears without moving; then a failed load shows Try again and the retry works. ' +
      'options.at "load-failed": only the failure part.',
  }, {
    id: 'play-fail',
    title: 'Game page failure screen (?playtest=fail-load)',
    seconds: 45,
    tags: ['full', 'menus'],
    description: 'Opens Game/?playtest=fail-load so the loader simulates a failed Unity load; logs the failure screen and Try again.',
  }, {
    id: 'play-rotate',
    title: 'Phone portrait rotate prompt, then Tap to play',
    seconds: 60,
    tags: ['full', 'phone'],
    description: 'Phone portrait: the rotate prompt shows; the frame turns to landscape and the prompt goes; ' +
      'Tap to play receives the first pointerdown (taps logged). Run with device phone (390x844, touch).',
  }, {
    id: 'play-chrome',
    title: 'Fullscreen toggle and back-to-home',
    seconds: 45,
    tags: ['full', 'menus'],
    description: 'Game page chrome: the fullscreen button toggles, then the Home link returns to the site home.',
  }],

  async start(id, options, t) {
    let bad = 0;
    const flag = (message) => { bad++; t.problem('bug', message); };
    let overlay = null;
    // While the bot runs, Play opens the game in a frame instead of navigating away, and sends no play_click.
    const holdPlay = (event) => {
      if (!event.target.closest || !event.target.closest('a[href$="Game/"]')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    window.addEventListener('click', holdPlay, true);

    const openGame = (query, size) => {
      if (overlay) overlay.remove();
      overlay = document.createElement('iframe');
      overlay.setAttribute('title', 'Yooba Land (playtest)');
      overlay.setAttribute('allow', 'fullscreen');
      const box = size
        ? `position:fixed;left:0;top:0;width:${size.w}px;height:${size.h}px;border:0;z-index:2147483000;background:#143226;`
        : 'position:fixed;inset:0;width:100vw;height:100vh;border:0;z-index:2147483000;background:#143226;';
      overlay.style.cssText = box;
      overlay.src = './Game/' + (query || '');
      document.body.appendChild(overlay);
      return overlay;
    };
    const setFrameSize = (w, h) => {
      if (!overlay) return;
      overlay.style.cssText =
        `position:fixed;left:0;top:0;width:${w}px;height:${h}px;border:0;z-index:2147483000;background:#143226;`;
    };
    const gameDoc = () => { try { return overlay && overlay.contentDocument; } catch { return null; } };
    const gameWin = () => { try { return overlay && overlay.contentWindow; } catch { return null; } };
    const visible = (el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      const s = el.ownerDocument.defaultView.getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden';
    };
    // The game page's "Tap to play" sound prompt (hawkes-sound.js) is a button a player presses; so does the bot.
    const pressTap = (d) => {
      const tap = d && d.querySelector('#hawkes-tap button');
      if (tap && visible(tap) && !pressTap.done) { pressTap.done = true; tap.click(); t.event('tap-to-play', 'pressed'); }
    };
    pressTap.done = false;

    const finish = (ok) => t.finish(ok && !bad ? 'won' : 'lost');

    try {
      if (id === 'play-fail') {
        await runPlayFail({ t, flag, openGame, gameDoc, visible, pressTap, finish });
        return;
      }
      if (id === 'play-rotate') {
        await runPlayRotate({ t, flag, openGame, setFrameSize, gameDoc, gameWin, visible, finish });
        return;
      }
      if (id === 'play-chrome') {
        await runPlayChrome({ t, flag, openGame, gameDoc, gameWin, visible, pressTap, finish });
        return;
      }

      // ---- play-flow -------------------------------------------------------------------------------------------
      if (t.at !== 'load-failed') {
        t.scene('Home');
        const play = document.querySelector('.hero .play-large');
        if (!play) throw new Error('no hero Play button on the page');
        noteFirstPlay();
        const top0 = firstPlay || layoutOf(play);
        const versionLine = document.querySelector('.hero-version [data-hawkes-version]');
        await t.until(() => !versionLine || !versionLine.hidden, 8000, "the What's new line").catch(() => t.log("What's new line never appeared"));
        await t.wait(1200);
        const moved = drift(top0, layoutOf(play));
        t.metric('heroPlayMovedPx', px(moved));
        t.metric('heroShift', Math.round(clsHero * 10000) / 10000);
        t.metric('pageShift', Math.round(clsAll * 10000) / 10000);
        t.event('hero-stable', `Play button moved ${px(moved)}px, hero layout shift ${clsHero.toFixed(4)}` +
          (versionLine && !versionLine.hidden ? `, "${versionLine.textContent.trim()}" showing` : ''));
        if (moved > 2 || clsHero > 0.002) flag(`The hero moved when late content filled in (Play button ${px(moved)}px, shift score ${clsHero.toFixed(4)}).`);
        t.progress(0.1);

        play.click();
        t.event('play-pressed', 'hero Play button, ' + play.getAttribute('href'));
        t.scene('Loading');
        openGame('');
        await t.until(() => { const d = gameDoc(); return d && d.getElementById('unity-loading-bar'); }, 20000, 'the game page');

        let shown = false;
        let rect0 = null;
        let canvasMoved = 0;
        let lastPct = -1;
        let lastTip = '';
        const tips = new Set();
        const started = performance.now();
        let outcome = null;
        while (!outcome) {
          if (performance.now() - started > 150000) { outcome = 'timeout'; break; }
          await t.wait(200);
          const d = gameDoc();
          if (!d) continue;
          pressTap(d);
          const bar = d.getElementById('unity-loading-bar');
          const container = d.getElementById('unity-container');
          const canvas = d.getElementById('unity-canvas');
          if (!bar || !container || !canvas) continue;
          if (!rect0) rect0 = rectOf(canvas);
          canvasMoved = Math.max(canvasMoved, drift(rect0, rectOf(canvas)));
          if (bar.classList.contains('failed')) { outcome = 'failed'; break; }
          if (container.classList.contains('loaded')) { outcome = 'loaded'; break; }
          if (!visible(bar)) continue;
          const pctText = (d.getElementById('unity-progress-text') || {}).textContent || '0%';
          const pct = parseInt(pctText, 10) || 0;
          const tip = ((d.getElementById('unity-tip') || {}).textContent || '').trim();
          if (!shown) {
            shown = true;
            const title = (bar.querySelector('.ld-title') || {}).textContent;
            const hasBar = visible(d.getElementById('unity-progress-bar-empty'));
            t.event('loading-screen', `"${title}", progress bar ${hasBar ? 'visible' : 'MISSING'}, lore line "${tip}"`);
            if (!hasBar) flag('The loading screen has no progress bar.');
            if (!tip) flag('The loading screen shows no lore line.');
          }
          if (pct !== lastPct) {
            if (lastPct < 0 || pct === 100 || Math.floor(pct / 25) !== Math.floor(lastPct / 25)) t.event('progress', `${pct}%`);
            lastPct = pct;
            t.metric('loadPercent', pct);
          }
          if (tip && tip !== lastTip) {
            if (lastTip) t.event('lore-rotated', tip);
            lastTip = tip;
            tips.add(tip);
            t.metric('loreLinesSeen', tips.size);
          }
          t.progress(0.1 + 0.5 * (pct / 100));
        }
        const loadSeconds = (performance.now() - started) / 1000;
        t.metric('loadSeconds', px(loadSeconds));

        if (outcome === 'loaded') {
          const d = gameDoc();
          const canvas = d.getElementById('unity-canvas');
          const bar = d.getElementById('unity-loading-bar');
          t.scene('Game');
          await t.wait(600);
          canvasMoved = Math.max(canvasMoved, drift(rect0, rectOf(canvas)));
          t.metric('canvasMovedPx', px(canvasMoved));
          t.event('game-running', `canvas ${Math.round(canvas.getBoundingClientRect().width)}x${Math.round(canvas.getBoundingClientRect().height)}, ` +
            `moved ${px(canvasMoved)}px since the loading screen, loading card ${visible(bar) ? 'STILL SHOWING' : 'gone'}, loaded in ${px(loadSeconds)} s`);
          if (canvasMoved > 1) flag(`The canvas moved ${px(canvasMoved)}px between the loading screen and the game.`);
          if (visible(bar)) flag('The loading card stayed on screen after the game started.');
          if (loadSeconds > 6 && tips.size < 2) flag('A load of ' + px(loadSeconds) + ' s showed only one lore line (they should rotate).');
          if (loadSeconds <= 6) t.event('lore-note', `load took ${px(loadSeconds)} s, under the 4.5 s a lore line stays: ${tips.size} seen`);
          await t.wait(1500);
        } else if (outcome === 'failed') {
          const d = gameDoc();
          t.event('load-failed', ((d.getElementById('unity-fail-detail') || {}).textContent || 'no detail').slice(0, 120));
          t.problem('warning', 'The real game build did not load here (the failure screen showed), so the canvas appearing was not seen.');
        } else {
          flag('The game did not finish loading in 150 s and showed no failure screen.');
        }
        t.progress(0.6);
      }

      t.scene('Load failed');
      openGame('?loadfail=1');
      pressTap.done = false;
      const failed = () => { const d = gameDoc(); const b = d && d.getElementById('unity-loading-bar'); return b && b.classList.contains('failed') && b; };
      await t.until(() => { pressTap(gameDoc()); return failed(); }, 30000, 'the failure screen');
      let d = gameDoc();
      const retry = d.getElementById('unity-retry');
      const card = failed();
      const title = (card.querySelector('.ld-fail .ld-title') || {}).textContent;
      const cardRect = rectOf(card);
      const retryRect = rectOf(retry);
      t.event('failure-screen', `"${title}", Try again button ${visible(retry) ? `visible ${Math.round(retryRect[2])}x${Math.round(retryRect[3])}` : 'MISSING'}, ` +
        `${(d.getElementById('unity-fail-detail') || {}).textContent ? 'with the file named' : 'no detail'}`);
      if (!visible(retry)) flag('A failed load shows no Try again button.');
      else if (retryRect[1] < 0 || retryRect[1] + retryRect[3] > window.innerHeight) flag('The Try again button is off screen.');
      if (!visible(card) || cardRect[2] < 100) flag('A failed load shows no message card (a blank canvas).');
      if (d.getElementById('unity-container').classList.contains('loaded')) flag('The failure screen sits on a container marked as loaded.');
      t.progress(0.8);
      await t.wait(1200);

      const attempt0 = d.getElementById('unity-container').getAttribute('data-attempt');
      overlay.contentWindow.__playtestMarker = 1;
      retry.click();
      t.event('retry-pressed', 'Retry');
      await t.until(() => { const c = gameDoc() && gameDoc().getElementById('unity-container'); return c && c.getAttribute('data-attempt') !== attempt0; }, 15000, 'the loader to start again');
      if (overlay.contentWindow.__playtestMarker !== 1) flag('Retry reloaded the whole page instead of the game.');
      t.event('retry-reloaded', 'the loader started again without a page reload');
      await t.until(() => failed(), 30000, 'the failure screen again');
      t.event('failure-screen', 'Still failing (?loadfail=1 keeps failing on purpose): the screen came back with Try again');
      t.progress(1);
      t.scene('Done');

      finish(true);
    } finally {
      window.removeEventListener('click', holdPlay, true);
      if (overlay) overlay.remove();
    }
  },

  stop() {
    document.querySelectorAll('iframe[title="Yooba Land (playtest)"]').forEach((f) => f.remove());
  },
});

async function runPlayFail({ t, flag, openGame, gameDoc, visible, pressTap, finish }) {
  t.scene('Load failed');
  openGame('?playtest=fail-load');
  pressTap.done = false;
  const failed = () => {
    const d = gameDoc();
    const b = d && d.getElementById('unity-loading-bar');
    return b && b.classList.contains('failed') && b;
  };
  await t.until(() => { pressTap(gameDoc()); return failed(); }, 30000, 'the failure screen');
  const d = gameDoc();
  const retry = d.getElementById('unity-retry');
  const home = d.getElementById('home-link') || (d.querySelector && d.querySelector('.ld-fail a.home'));
  const card = failed();
  const title = (card.querySelector('.ld-fail .ld-title') || {}).textContent;
  const detail = ((d.getElementById('unity-fail-detail') || {}).textContent || '').slice(0, 120);
  t.event('failure-screen', `"${title}", Try again ${visible(retry) ? 'visible' : 'MISSING'}, ` +
    `Home ${home && visible(home) ? 'visible' : 'missing'}, detail "${detail}"`);
  if (!visible(retry)) flag('A failed load shows no Try again button.');
  if (!visible(card) || card.getBoundingClientRect().width < 100) flag('A failed load shows no message card (a blank canvas).');
  t.metric('failScreen', 1);
  t.progress(0.7);
  await t.wait(1500); // failure screen on screen for the footage / screenshots
  t.progress(1);
  t.scene('Done');
  finish(true);
}

async function runPlayRotate({ t, flag, openGame, setFrameSize, gameDoc, gameWin, visible, finish }) {
  if (!phoneish()) {
    t.event('need-phone', `play-rotate needs a phone run (pointer: coarse, short side ≤ 500); this window is ${window.innerWidth}x${window.innerHeight}`);
    t.problem('warning', 'play-rotate was started on a desktop-sized window; run it with device phone (390x844).');
    t.scene('Need phone');
    t.finish('stuck');
    return;
  }

  // Keep the game frame at phone portrait so (orientation: portrait) and the iframe's own viewport match.
  const pw = 390;
  const ph = 844;
  t.scene('Rotate prompt');
  openGame('', { w: pw, h: ph });
  await t.until(() => gameDoc() && gameDoc().getElementById('rotate-prompt'), 20000, 'the game page');

  const promptShown = () => {
    const d = gameDoc();
    const el = d && d.getElementById('rotate-prompt');
    if (!el) return false;
    const s = d.defaultView.getComputedStyle(el);
    return s.display !== 'none' && s.visibility !== 'hidden' && el.getBoundingClientRect().width > 0;
  };

  await t.until(promptShown, 8000, 'the rotate prompt').catch(() => {});
  if (!promptShown()) {
    const w = gameWin();
    flag(`Portrait phone showed no rotate prompt (frame ${w ? w.innerWidth + 'x' + w.innerHeight : '?'}, coarse ${!!(w && w.matchMedia && w.matchMedia('(pointer: coarse)').matches)}).`);
  } else {
    const d = gameDoc();
    const h2 = (d.querySelector('#rotate-prompt h2') || {}).textContent || '';
    t.event('rotate-prompt', `shown at ${pw}x${ph}: "${h2}"`);
  }
  t.progress(0.3);
  await t.wait(1200); // prompt on screen for screenshots

  t.scene('Landscape');
  // Content viewport 844x390 (landscape media), scaled to fit the phone screenshot (390x844).
  const lw = 844;
  const lh = 390;
  const scale = Math.min(window.innerWidth / lw, window.innerHeight / lh, 1);
  setFrameSize(lw, lh);
  const frame = document.querySelector('iframe[title="Yooba Land (playtest)"]');
  if (frame) {
    frame.style.transform = `scale(${scale})`;
    frame.style.transformOrigin = 'top left';
  }
  await t.wait(600);
  const w = gameWin();
  // Some browsers only recompute orientation media after a resize event on the frame.
  try { w && w.dispatchEvent(new Event('resize')); } catch { /* ignore */ }
  await t.wait(400);

  if (promptShown()) flag('The rotate prompt stayed up after switching the frame to landscape.');
  else t.event('rotate-gone', `landscape ${w ? w.innerWidth + 'x' + w.innerHeight : '844x390'}: prompt gone`);
  t.progress(0.55);
  await t.wait(800);

  t.scene('Tap to play');
  const d = gameDoc();
  const tapBtn = d && d.querySelector('#hawkes-tap button');
  if (!tapBtn || !visible(tapBtn)) {
    // Prompt may still be covering, or sound script missing on this host: wait a moment for it.
    await t.until(() => {
      const b = gameDoc() && gameDoc().querySelector('#hawkes-tap button');
      return b && visible(b) && !promptShown();
    }, 10000, 'Tap to play').catch(() => {});
  }
  const btn = gameDoc() && gameDoc().querySelector('#hawkes-tap button');
  if (!btn || !visible(btn)) {
    flag('Tap to play was not visible after rotating to landscape.');
    t.progress(1);
    t.scene('Done');
    finish(false);
    return;
  }

  let taps = 0;
  let firstType = '';
  const onPtr = (e) => {
    taps += 1;
    if (!firstType) firstType = e.type;
    t.event('tap', `${e.type} #${taps} on Tap to play`);
  };
  btn.addEventListener('pointerdown', onPtr, true);
  btn.addEventListener('touchstart', onPtr, true);
  const r = btn.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const win = gameWin();
  try {
    btn.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, cancelable: true, composed: true,
      clientX: cx, clientY: cy, pointerId: 1, pointerType: 'touch', isPrimary: true,
      view: win,
    }));
  } catch {
    btn.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true, clientX: cx, clientY: cy, view: win }));
  }
  btn.click();
  await t.wait(300);
  btn.removeEventListener('pointerdown', onPtr, true);
  btn.removeEventListener('touchstart', onPtr, true);

  if (taps < 1) flag('Tap to play did not receive a pointerdown after rotating.');
  else t.event('tap-to-play-received', `first ${firstType} after landscape; ${taps} tap event(s) logged`);
  t.metric('tapAfterRotate', taps);
  t.progress(1);
  await t.wait(800);
  t.scene('Done');
  finish(true);
}

async function runPlayChrome({ t, flag, openGame, gameDoc, gameWin, visible, pressTap, finish }) {
  t.scene('Game chrome');
  // fail-load brings chrome up without waiting on Unity. On a phone portrait run, open the frame in landscape
  // so the rotate prompt does not cover the fullscreen / Home controls.
  const phone = phoneish();
  const frame = openGame('?playtest=fail-load');
  if (phone && frame) {
    // Landscape content so the rotate prompt stays down; scale to fit the phone screenshot.
    const lw = 844;
    const lh = 390;
    const scale = Math.min(window.innerWidth / lw, window.innerHeight / lh, 1);
    frame.style.cssText =
      `position:fixed;left:0;top:0;width:${lw}px;height:${lh}px;border:0;z-index:2147483000;background:#143226;` +
      `transform:scale(${scale});transform-origin:top left;`;
  }
  pressTap.done = false;
  await t.until(() => gameDoc() && gameDoc().getElementById('fullscreen-button'), 20000, 'the game page');
  await t.until(() => { pressTap(gameDoc()); return true; }, 1000, 'ready').catch(() => {});
  // If a portrait prompt still covers chrome, dismiss it the way a player would.
  const upright = gameDoc() && gameDoc().getElementById('rp-upright');
  const rotateUp = () => {
    const d = gameDoc();
    const el = d && d.getElementById('rotate-prompt');
    if (!el) return false;
    const s = d.defaultView.getComputedStyle(el);
    return s.display !== 'none' && el.getBoundingClientRect().width > 0;
  };
  if (rotateUp() && upright) {
    upright.click();
    t.event('rotate-dismissed', 'Play upright anyway, so chrome is reachable');
    await t.wait(300);
  }
  await t.wait(400);

  const d0 = gameDoc();
  const fs = d0 && d0.getElementById('fullscreen-button');
  if (!fs) {
    flag('The game page has no fullscreen button.');
  } else if (!fs.classList.contains('available') && !visible(fs)) {
    t.event('fullscreen-api', 'this browser has no element fullscreen: the button stays hidden');
  } else {
    const before = fs.getAttribute('aria-pressed');
    t.event('fullscreen-button', `visible, aria-pressed=${before}`);
    fs.click();
    await t.wait(500);
    const mid = fs.getAttribute('aria-pressed');
    t.event('fullscreen-toggle', `after first click aria-pressed=${mid}`);
    if (mid === before) {
      // Playwright often refuses fullscreen without a real user gesture; still log the control was pressed.
      t.event('fullscreen-note', 'aria-pressed did not change (browser may block fullscreen without a real gesture)');
    }
    fs.click();
    await t.wait(400);
    t.event('fullscreen-toggle', `after second click aria-pressed=${fs.getAttribute('aria-pressed')}`);
  }
  t.progress(0.5);
  await t.wait(800); // chrome on screen for screenshots

  t.scene('Back home');
  const d = gameDoc();
  const home = (d && (d.getElementById('home-link') || d.querySelector('a.home[href="../"], a.home[href="./"]'))) || null;
  if (!home || !visible(home)) {
    flag('The game page has no visible back-to-home link.');
    t.progress(1);
    t.scene('Done');
    finish(false);
    return;
  }
  const href = home.getAttribute('href') || '';
  t.event('home-link', `visible, href=${href}`);
  home.click();
  await t.until(() => {
    const w = gameWin();
    try {
      const path = (w && w.location && (w.location.pathname || '')) || '';
      // Left Game/: path no longer ends with /Game or /Game/.
      return path && !/\/Game\/?$/.test(path);
    } catch {
      return true; // cross-origin after navigate still counts as left
    }
  }, 15000, 'the site home');
  let where = '';
  try {
    const w = gameWin();
    where = w && w.location ? (w.location.pathname + w.location.search) : '';
  } catch { where = '(opaque)'; }
  t.event('home-returned', `back-to-home left Game/ → ${where || 'home'}`);
  t.progress(1);
  await t.wait(800);
  t.scene('Done');
  finish(true);
}
