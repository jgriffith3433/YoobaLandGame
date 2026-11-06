// Hawkes playtest contract for the home page (spec: hawkesstudio/docs/playtest.md). Loaded only when a bot drives the
// page (index.html: navigator.webdriver or ?playtest=), so players download nothing.
//
// Scenario "play-flow": the Play flow end to end, for the three things the play flow promises:
//   1. Loading shows a progress bar and rotating lore lines
//   2. A failed load shows a retry button, not a blank canvas
//   3. No layout shift when the canvas appears (and none in the hero when "What's new" fills in)
// The bot presses the hero Play button (a real click; while the bot runs, the page opens the game in a full-window
// frame instead of leaving, so the bot keeps its log), then watches the game page load the way a player would see it.
// Then it opens the game page with ?loadfail=1 (the page's own way to fail a load), looks at the failure screen and
// presses Try again. Start point: at "load-failed" skips the real load and plays only the failure part.
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
// Measured as layout position (offsetTop/Left up the parents), which ignores transforms: the hero's entrance animation
// and parallax move the button on screen without shifting the layout.
const layoutOf = (el) => {
  let x = 0;
  let y = 0;
  for (let n = el; n; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; }
  return [x, y, el.offsetWidth, el.offsetHeight];
};
let firstPlay = null;
const noteFirstPlay = () => {
  const el = document.querySelector('.hero .play-large');
  if (el && !firstPlay) firstPlay = layoutOf(el);
};
noteFirstPlay();
if (!firstPlay) document.addEventListener('DOMContentLoaded', noteFirstPlay);

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

    const openGame = (query) => {
      if (overlay) overlay.remove();
      overlay = document.createElement('iframe');
      overlay.setAttribute('title', 'Yooba Land (playtest)');
      overlay.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;border:0;z-index:2147483000;background:#143226';
      overlay.src = './Game/' + (query || '');
      document.body.appendChild(overlay);
      return overlay;
    };
    const gameDoc = () => { try { return overlay && overlay.contentDocument; } catch { return null; } };
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

    try {
      // ---- 1. The home page: the hero holds still, then Play ---------------------------------------------------
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
        const frame = openGame('');
        await t.until(() => { const d = gameDoc(); return d && d.getElementById('unity-loading-bar'); }, 20000, 'the game page');

        // ---- 2. The game page loads: bar, lore lines, then the canvas, without moving --------------------------
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
          await t.wait(1500); // a moment of the game itself, for the footage
        } else if (outcome === 'failed') {
          const d = gameDoc();
          t.event('load-failed', ((d.getElementById('unity-fail-detail') || {}).textContent || 'no detail').slice(0, 120));
          t.problem('warning', 'The real game build did not load here (the failure screen showed), so the canvas appearing was not seen.');
        } else {
          flag('The game did not finish loading in 150 s and showed no failure screen.');
        }
        t.progress(0.6);
      }

      // ---- 3. A failed load: a retry button, not a blank canvas -----------------------------------------------
      t.scene('Load failed');
      const frame = openGame('?loadfail=1');
      const failed = () => { const d = gameDoc(); const b = d && d.getElementById('unity-loading-bar'); return b && b.classList.contains('failed') && b; };
      await t.until(failed, 30000, 'the failure screen');
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
      await t.wait(1200); // the failure screen stays on screen a moment, for the footage

      // Try again: the page reloads. The marker on the old window is gone once the new page is up.
      overlay.contentWindow.__playtestMarker = 1;
      retry.click();
      t.event('retry-pressed', 'Try again');
      await t.until(() => { try { return overlay.contentWindow.__playtestMarker === undefined; } catch { return true; } }, 15000, 'the page to reload');
      t.event('retry-reloaded', 'the game page loaded again');
      await t.until(failed, 30000, 'the failure screen again');
      t.event('failure-screen', 'Still failing (?loadfail=1 keeps failing on purpose): the screen came back with Try again');
      t.progress(1);
      t.scene('Done');

      t.finish(bad ? 'lost' : 'won');
    } finally {
      window.removeEventListener('click', holdPlay, true);
      if (overlay) overlay.remove();
    }
  },

  stop() {
    document.querySelectorAll('iframe[title="Yooba Land (playtest)"]').forEach((f) => f.remove());
  },
});
