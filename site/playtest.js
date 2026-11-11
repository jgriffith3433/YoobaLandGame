// Hawkes playtest contract for the home page (spec: hawkesstudio/docs/playtest.md). Loaded only when a bot drives the
// page (index.html: navigator.webdriver or ?playtest=), so players download nothing.
//
// Scenarios (all open Game/ in a full-window frame so the bot keeps its log, except map):
//   play-flow   — hero holds still, Play, loading (bar + lore), canvas without moving, failed load + Try again
//                 (at "load-failed": only the failure part)
//   play-fail   — Game/?playtest=fail-load shows the failure screen (and Try again)
//   play-rotate — phone portrait: rotate prompt, then landscape; Tap to play gets the first pointerdown
//   play-chrome — fullscreen button toggles; the back-to-home link returns to the site home
//   map         — Explore Yooba Land: pan, zoom, open three place cards; screenshots at desktop and 390 px
//   cast        — Meet the people: tap three characters, captions + reactions; screenshots at desktop and 390 px
//   whatsnew    — What's new + home Devlog + blog: picture cards, latest expanded, no empty date promise;
//                 overflow check at 1280 and 390 px
//   pages       — every page at 1280 and 390 px: scroll, measure (sideways scroll, tap targets, tiny text, images
//                 without size, console errors), gallery lightbox by tap, then Play from every page by touch at 390 px
//                 (the game page must open and start loading). The Unity game shell is measured but not counted.
//   map-alive   — Explore map sound, Road Home journey, idle life
//   trailer     — Hero Watch the trailer: sound, first 5 s, portrait full-bleed, close restores scroll
//   first-minute — Home first impression: eat/grow/home copy, phone fold, no live-moment, Gnash villain, gallery hooks
// The contract registers on every page (each page loads this file when a bot drives it); paths resolve from BASE.
import { installPlaytest } from './hawkes-playtest.js';

const BASE = new URL('../', import.meta.url).href;
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
  }, {
    id: 'map',
    title: 'Explore map: pan, zoom, three place cards',
    seconds: 90,
    tags: ['full', 'phone'],
    description: 'Home Explore Yooba Land: scroll to the map, pan and zoom, open three place cards with pictures and Play; ' +
      'screenshots at desktop and at 390 px (bottom sheet). Play href stays ./Game/.',
  }, {
    id: 'cast',
    title: 'Cast: tap three characters, captions on desktop and phone',
    seconds: 75,
    tags: ['full', 'phone'],
    description: 'Home Meet the people: tap three cast cards so each shows a caption and a portrait reaction; ' +
      'a second tap stops speech; a third character cycles a different line; screenshots at desktop and 390 px swipe row.',
  }, {
    id: 'pages',
    title: 'Every page at 1280 and 390 px: layout, tap targets, text, lightbox',
    seconds: 150,
    tags: ['full', 'phone'],
    description: 'Visits home, blog index, a post, What\'s new, privacy, contact and the game shell; scrolls each top to bottom at ' +
      '1280 and 390 px with screenshots; reports sideways scroll (with the widest element), tap targets under 44 px, ' +
      'images without width/height, text under 14 px and console errors; opens and closes the gallery lightbox by tap. ' +
      'At 390 px it then taps Play on every site page (header, and the hero too on home) and checks the game page opens and starts loading. ' +
      'Run once with prefers-reduced-motion emulated (the run says whether it was). Layout findings are warnings; a Play that does not start the game is a bug. The Unity game shell is measured but not counted (it is built by the Unity deploy).',
  }, {
    id: 'map-alive',
    title: 'Map alive: sound crossfade, Road Home journey, idle life',
    seconds: 90,
    tags: ['full'],
    description: 'Home Explore map: turn sound on, open two places (ambience crossfades), watch the idle life, ' +
      'run Follow the Road Home through chapters 1-8, and skip a second run.',
  }, {
    id: 'trailer',
    title: 'Hero Watch the trailer: sound, first 5 s, portrait cut, close restores page',
    seconds: 90,
    tags: ['full', 'phone', 'menus'],
    description: 'Home hero: press Watch the trailer (real click unlocks audio), play with sound, log the first 5 s, ' +
      'on a portrait phone (390x844) use the vertical cut full-screen, then close and confirm scroll and hero stay put.',
  }, {
    id: 'whatsnew',
    title: 'Visual What\'s new cards on desktop and phone',
    seconds: 90,
    tags: ['full', 'phone'],
    description: 'What\'s new picture cards (version/date chip, media, 3-5 notes, newest expanded), home Devlog strip, ' +
      'blog cards in the same style; no empty live-moment date; overflow check at 1280 and 390 px.',
  }, {
    id: 'first-minute',
    title: 'First-minute promise: eat, grow, home — phone fold and honest copy',
    seconds: 75,
    tags: ['full', 'phone'],
    description: 'Home page first impression at desktop then 390x844 touch: hero headline has eat+grow, premise names ' +
      'finding the way home, headline/key art/premise/Play sit above the fold with no sideways scroll; no empty ' +
      'live-moment; Gnash is villain or absent from cast (never friendly); Play together says online-only; gallery ' +
      'captions have no metres or distance numbers.',
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

    if (id === 'pages') {
      try { await runPages({ t }); } finally { window.removeEventListener('click', holdPlay, true); }
      return;
    }

    if (id === 'first-minute') {
      try {
        await runFirstMinute({ t, flag, finish: (ok) => t.finish(ok && !bad ? 'won' : 'lost') });
      } finally {
        window.removeEventListener('click', holdPlay, true);
      }
      return;
    }

    if (id === 'whatsnew') {
      try { await runWhatsNew({ t, flag, finish: (ok) => t.finish(ok && !bad ? 'won' : 'lost') }); } finally {
        window.removeEventListener('click', holdPlay, true);
      }
      return;
    }

    if (id === 'map-alive') {
      try { await runMapAlive({ t, flag, finish: (ok) => t.finish(ok && !bad ? 'won' : 'lost') }); } finally {
        window.removeEventListener('click', holdPlay, true);
      }
      return;
    }

    if (id === 'trailer') {
      try {
        await runTrailer({ t, flag, finish: (ok) => t.finish(ok && !bad ? 'won' : 'lost') });
      } finally {
        window.removeEventListener('click', holdPlay, true);
      }
      return;
    }

    if (id === 'map') {
      try {
        await runMapExplore({ t, flag, finish: (ok) => t.finish(ok && !bad ? 'won' : 'lost') });
      } finally {
        window.removeEventListener('click', holdPlay, true);
      }
      return;
    }

    if (id === 'cast') {
      try {
        await runCast({ t, flag, finish: (ok) => t.finish(ok && !bad ? 'won' : 'lost') });
      } finally {
        window.removeEventListener('click', holdPlay, true);
      }
      return;
    }

    const openGame = (query, size) => {
      if (overlay) overlay.remove();
      overlay = document.createElement('iframe');
      overlay.setAttribute('title', 'Yooba Land (playtest)');
      overlay.setAttribute('allow', 'fullscreen');
      const box = size
        ? `position:fixed;left:0;top:0;width:${size.w}px;height:${size.h}px;border:0;z-index:2147483000;background:#143226;`
        : 'position:fixed;inset:0;width:100vw;height:100vh;border:0;z-index:2147483000;background:#143226;';
      overlay.style.cssText = box;
      overlay.src = BASE + 'Game/' + (query || '');
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
    document.querySelectorAll('iframe[title="Yooba Land (playtest)"], iframe[title="Yooba Land (pages)"]').forEach((f) => f.remove());
  },
});

async function runFirstMinute({ t, flag, finish }) {
  const frame = document.createElement('iframe');
  frame.setAttribute('title', 'Yooba Land (first-minute)');
  document.body.appendChild(frame);
  const setSize = (w, h) => {
    frame.style.cssText =
      `position:fixed;left:0;top:0;width:${w}px;height:${h}px;border:0;z-index:2147483000;background:#f7fbf6;`;
  };
  const loadHome = async (w, h, label) => {
    setSize(w, h);
    frame.src = 'about:blank';
    await t.wait(40);
    frame.src = BASE + 'index.html';
    await t.until(() => {
      const d = frame.contentDocument;
      return d && d.readyState === 'complete' && frame.contentWindow.location.href !== 'about:blank';
    }, 20000, label);
    await t.wait(500);
    return { win: frame.contentWindow, doc: frame.contentDocument };
  };
  const aboveFold = (win, el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const vh = win.innerHeight;
    return r.width > 0 && r.height > 0 && r.top >= -1 && r.bottom <= vh + 1;
  };
  const overflowX = (win, doc, tag) => {
    const vw = win.innerWidth;
    const sw = doc.documentElement.scrollWidth;
    t.metric(`${tag}OverflowX`, Math.max(0, sw - vw));
    if (sw > vw + 1) {
      flag(`${tag}: sideways scroll, scrollWidth ${sw} > ${vw}`);
      return true;
    }
    t.event('no-sideways', `${tag}: scrollWidth ${sw} ≤ ${vw}`);
    return false;
  };
  const checkCopy = (doc, tag) => {
    const h1 = ((doc.querySelector('.hero h1') || {}).textContent || '').trim();
    const premise = ((doc.querySelector('.hero .hero-premise') || {}).textContent || '').trim();
    const h1Low = h1.toLowerCase();
    const premiseLow = premise.toLowerCase();
    t.event('hero-copy', `${tag}: h1="${h1.slice(0, 80)}" premise="${premise.slice(0, 80)}"`);
    if (!/\beat\b/i.test(h1Low) || !/\bgrow\b/i.test(h1Low)) {
      flag(`${tag}: hero headline must contain "eat" and "grow" (got "${h1}").`);
    }
    if (!/find(?:ing)? the way home|way home/i.test(premiseLow)) {
      flag(`${tag}: premise must name finding the way home (got "${premise}").`);
    }
    const live = doc.querySelector('[data-live-moment], .live');
    if (live) flag(`${tag}: home still has a next-live-moment block.`);
    if (/will be posted here|date and time will be posted|Be there when it happens/i.test(doc.body.textContent || '')) {
      flag(`${tag}: home still promises a live moment without a date.`);
    }
    t.event('no-live-promise', live ? 'still present' : 'next-live-moment block gone');

    const castText = ((doc.querySelector('#characters') || {}).textContent || '');
    // Only judge sentences that name Gnash — Pip/Kelp "friendly" who-lines must not false-fail.
    const gnashBits = (castText.match(/[^.!?]*\bgnash\b[^.!?]*/gi) || []).map((s) => s.trim()).filter(Boolean);
    const gnashBlob = gnashBits.join(' | ');
    const gnashFriendly = gnashBits.some((s) => /\b(friend|friendly|walk together|wants to walk|kind|nice)\b/i.test(s));
    const gnashVillain = gnashBits.some((s) => /\b(evil|villain|says no|bridge)\b/i.test(s));
    const gnashAbsent = gnashBits.length === 0;
    t.event('gnash-cast', `${tag}: absent=${gnashAbsent}, villain=${gnashVillain}, friendly=${gnashFriendly}` +
      (gnashBlob ? `; bits="${gnashBlob.slice(0, 120)}"` : ''));
    if (gnashFriendly) flag(`${tag}: cast must not call Gnash friendly.`);
    if (!gnashAbsent && !gnashVillain) flag(`${tag}: Gnash is on the cast strip without being the bridge villain.`);

    const playTogether = [...doc.querySelectorAll('.card')].find((c) => /Play together/i.test((c.querySelector('h3') || {}).textContent || ''));
    const together = ((playTogether && playTogether.textContent) || '').toLowerCase();
    t.event('play-together', `${tag}: "${((playTogether && playTogether.textContent) || '').replace(/\s+/g, ' ').trim().slice(0, 120)}"`);
    if (!playTogether || !(/online/.test(together) && /(only when|when they are|appear only)/i.test(together))) {
      flag(`${tag}: Play together must say other players appear only when they are online.`);
    }

    const caps = [...doc.querySelectorAll('.gallery figcaption, .gallery [data-caption]')].map((el) =>
      (el.getAttribute('data-caption') || el.textContent || '').trim());
    const badCap = caps.find((c) => /\bmetres?\b|\bmeters?\b|\b\d+\s*(m|metres?|meters?)\b/i.test(c) || /\b\d+\s*(metres?|meters?|m)\s*off\b/i.test(c));
    t.event('gallery-caps', `${tag}: ${caps.length} captions` + (badCap ? `; bad "${badCap}"` : '; no distance HUD quotes'));
    if (badCap) flag(`${tag}: gallery caption still has metres or a distance number ("${badCap}").`);
    return { h1, premise };
  };

  try {
    t.scene('First-minute desktop');
    let { win, doc } = await loadHome(1280, 800, 'home desktop');
    win.scrollTo(0, 0);
    await t.wait(400);
    checkCopy(doc, 'desktop');
    overflowX(win, doc, 'desktop');
    t.event('screenshot', 'first-minute @1280 hero');
    t.progress(0.35);

    t.scene('First-minute phone');
    ({ win, doc } = await loadHome(390, 844, 'home phone 390x844'));
    win.scrollTo(0, 0);
    await t.wait(500);
    // Touch-first: a real pointerdown on the hero Play (no mouse/keyboard).
    const play = doc.querySelector('.hero .play-large');
    if (play) {
      const r = play.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      const opts = { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, pointerType: 'touch', isPrimary: true };
      play.dispatchEvent(new win.PointerEvent('pointerdown', opts));
      play.dispatchEvent(new win.PointerEvent('pointerup', opts));
      t.event('phone-touch', 'pointerdown on hero Play');
    } else {
      flag('phone: no hero Play button.');
    }
    checkCopy(doc, 'phone');
    const h1 = doc.querySelector('.hero h1');
    const premise = doc.querySelector('.hero .hero-premise');
    const art = doc.querySelector('.hero .hero-photo, .hero video.hero-photo, .hero img.hero-photo');
    const foldBits = [
      ['headline', h1],
      ['key-art', art],
      ['premise', premise],
      ['play', play],
    ];
    for (const [name, el] of foldBits) {
      const ok = aboveFold(win, el);
      const r = el ? el.getBoundingClientRect() : null;
      t.event('fold', `phone ${name}: ${ok ? 'above fold' : 'BELOW'} ` +
        (r ? `top=${px(r.top)} bottom=${px(r.bottom)} vh=${win.innerHeight}` : 'missing'));
      if (!el) flag(`phone: hero ${name} is missing.`);
      else if (!ok) flag(`phone @390x844: hero ${name} is not above the fold.`);
    }
    overflowX(win, doc, 'phone');
    t.metric('phoneViewport', win.innerHeight);
    t.event('screenshot', 'first-minute @390 hero fold');
    t.progress(1);
    t.scene('Done');
    finish(true);
  } finally {
    frame.remove();
  }
}

async function runWhatsNew({ t, flag, finish }) {
  const frame = document.createElement('iframe');
  frame.setAttribute('title', 'Yooba Land (whatsnew)');
  document.body.appendChild(frame);
  const setSize = (w, h) => {
    frame.style.cssText =
      `position:fixed;left:0;top:0;width:${w}px;height:${h}px;border:0;z-index:2147483000;background:#f7fbf6;`;
  };
  const load = async (path, label, w, h) => {
    setSize(w, h);
    frame.src = 'about:blank';
    await t.wait(40);
    frame.src = BASE + path;
    await t.until(() => {
      const d = frame.contentDocument;
      return d && d.readyState === 'complete' && frame.contentWindow.location.href !== 'about:blank';
    }, 20000, label);
    await t.wait(500);
    return { win: frame.contentWindow, doc: frame.contentDocument };
  };
  const overflow = (win, doc, tag) => {
    const vw = win.innerWidth;
    if (doc.documentElement.scrollWidth <= vw + 1) {
      t.event('no-sideways', `${tag}: scrollWidth ${doc.documentElement.scrollWidth} ≤ ${vw}`);
      return;
    }
    let widest = null;
    let right = vw;
    for (const el of doc.body ? doc.body.querySelectorAll('*') : []) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.right > right) { right = r.right; widest = el; }
    }
    flag(`${tag}: sideways scroll, scrollWidth ${doc.documentElement.scrollWidth} > ${vw}; widest ${widest ? nameOf(widest) : '?'}`);
  };
  const waitCards = async (doc, min) => {
    await t.until(() => doc.querySelectorAll('article.hawkes-release').length >= min, 10000, `${min} release cards`);
  };

  try {
    t.scene('Whatsnew 1280');
    let { win, doc } = await load('whatsnew.html', 'whatsnew desktop', 1280, 800);
    await waitCards(doc, 3);
    const cards = [...doc.querySelectorAll('article.hawkes-release')];
    const open = cards.filter((c) => c.classList.contains('is-open'));
    const withMedia = cards.filter((c) => c.querySelector('.hawkes-release-media img, .hawkes-release-media video'));
    const chips = cards.filter((c) => c.querySelector('.hawkes-release-chip .hawkes-release-version') && c.querySelector('.hawkes-release-date'));
    const notes = open[0] ? open[0].querySelectorAll('.hawkes-release-notes li').length : 0;
    t.metric('releaseCards', cards.length);
    t.metric('releaseCardsOpen', open.length);
    t.metric('releaseCardsWithMedia', withMedia.length);
    t.event('whatsnew-cards', `${cards.length} cards, ${open.length} open, ${withMedia.length} with media, ${chips.length} with version/date chip, open notes ${notes}`);
    if (!cards.length) flag('What\'s new has no release cards.');
    if (open.length !== 1 || open[0] !== cards[0]) flag('The newest What\'s new card should be the only one expanded.');
    if (withMedia.length < cards.length) flag(`Only ${withMedia.length}/${cards.length} release cards have a picture or clip.`);
    if (chips.length < cards.length) flag('A release card is missing its version/date chip.');
    if (notes < 1 || notes > 5) flag(`Expanded card shows ${notes} notes (want 1-5).`);
    win.scrollTo(0, 0);
    await t.wait(700);
    t.event('screenshot', 'whatsnew @1280 top');
    win.scrollTo(0, Math.min(900, doc.documentElement.scrollHeight));
    await t.wait(700);
    overflow(win, doc, 'whatsnew @1280');
    t.progress(0.25);

    t.scene('Whatsnew 390');
    ({ win, doc } = await load('whatsnew.html', 'whatsnew phone', 390, 844));
    await waitCards(doc, 3);
    win.scrollTo(0, 0);
    await t.wait(800);
    t.event('screenshot', 'whatsnew @390 top');
    const phoneCards = doc.querySelectorAll('article.hawkes-release');
    const phoneOpen = doc.querySelector('article.hawkes-release.is-open');
    if (phoneOpen) {
      phoneOpen.querySelector('.hawkes-release-toggle')?.click();
      await t.wait(300);
      phoneOpen.querySelector('.hawkes-release-toggle')?.click();
      await t.wait(400);
      t.event('card-toggled', 'expanded card toggled on phone');
    }
    win.scrollTo(0, Math.min(700, doc.documentElement.scrollHeight));
    await t.wait(700);
    overflow(win, doc, 'whatsnew @390');
    t.metric('phoneCards', phoneCards.length);
    t.progress(0.5);

    t.scene('Home Devlog');
    ({ win, doc } = await load('index.html', 'home desktop', 1280, 800));
    await t.until(() => doc.querySelector('#devlog article.hawkes-release'), 10000, 'home Devlog cards');
    const live = doc.querySelector('[data-live-moment], .live');
    const liveText = ((live && live.textContent) || '');
    if (live) flag('Home still has a next-live-moment block.');
    if (/will be posted here|date and time will be posted/i.test(doc.body.textContent || '')) {
      flag('Home still promises a date or event that is not scheduled.');
    }
    t.event('no-live-promise', live ? `still present: "${liveText.slice(0, 80)}"` : 'next-live-moment block gone');
    const homeCards = doc.querySelectorAll('#devlog article.hawkes-release');
    const homeOpen = doc.querySelectorAll('#devlog article.hawkes-release.is-open');
    const homeMedia = doc.querySelectorAll('#devlog .hawkes-release-media img, #devlog .hawkes-release-media video');
    t.event('home-devlog', `${homeCards.length} cards, ${homeOpen.length} open, ${homeMedia.length} media`);
    if (homeCards.length < 1) flag('Home Devlog has no release cards.');
    if (homeOpen.length !== 1) flag('Home Devlog should expand only the latest release card.');
    if (!homeMedia.length) flag('Home Devlog cards have no pictures or clips.');
    const section = doc.getElementById('devlog');
    if (section) section.scrollIntoView({ block: 'center' });
    await t.wait(900);
    t.event('screenshot', 'home Devlog @1280');
    overflow(win, doc, 'home @1280');
    t.progress(0.72);

    t.scene('Home phone');
    ({ win, doc } = await load('index.html', 'home phone', 390, 844));
    await t.until(() => doc.querySelector('#devlog article.hawkes-release'), 10000, 'home Devlog phone');
    const homeDev = doc.getElementById('devlog');
    if (homeDev) homeDev.scrollIntoView({ block: 'center' });
    await t.wait(900);
    t.event('screenshot', 'home Devlog @390');
    overflow(win, doc, 'home @390');
    t.progress(0.85);

    t.scene('Blog cards');
    ({ win, doc } = await load('blog.html', 'blog desktop', 1280, 800));
    const posts = doc.querySelectorAll('.post-card');
    const postMedia = doc.querySelectorAll('.post-card-media img');
    t.event('blog-cards', `${posts.length} post cards, ${postMedia.length} with pictures`);
    if (posts.length < 3) flag('Blog index should use picture cards for each post.');
    if (postMedia.length < posts.length) flag('A blog card is missing its picture.');
    await t.wait(800);
    t.event('screenshot', 'blog @1280');
    overflow(win, doc, 'blog @1280');
    ({ win, doc } = await load('blog.html', 'blog phone', 390, 844));
    await t.wait(800);
    overflow(win, doc, 'blog @390');
    t.progress(1);
    t.scene('Done');
    finish(true);
  } finally {
    frame.remove();
  }
}

async function runCast({ t, flag, finish }) {
  const section = document.getElementById('characters');
  if (!section) {
    flag('Meet the people (#characters) is missing from the home page.');
    t.scene('Missing');
    finish(false);
    return;
  }
  t.scene('Cast desktop');
  section.scrollIntoView({ behavior: 'auto', block: 'center' });
  await t.until(() => window.yoobaCast && window.yoobaCast.ready(), 15000, 'the cast strip');
  const cast = window.yoobaCast;
  const ids = cast.cards();
  t.event('cast-ready', `cards: ${ids.join(',')}`);
  if (ids.length < 3) flag(`Cast should list at least 3 characters (got ${ids.length}).`);

  const tapCard = (id, type = 'mouse') => {
    const btn = section.querySelector(`.cast-hit[data-cast-id="${id}"]`);
    if (!btn) return false;
    // Real pointer sequence, then the click a player's tap produces.
    const r = btn.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + Math.min(40, r.height / 3);
    const opts = { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, pointerType: type, isPrimary: true };
    btn.dispatchEvent(new PointerEvent('pointerdown', opts));
    btn.dispatchEvent(new PointerEvent('pointerup', opts));
    btn.click();
    return true;
  };
  // The caption and reaction appear synchronously on a tap, but a missing or short voice file clears them within
  // moments, so read them right at the tap instead of waiting for them.
  const reactingNow = (id) => !!section.querySelector(`.cast-hit[data-cast-id="${id}"] .cast-art.is-react-bounce, .cast-hit[data-cast-id="${id}"] .cast-art.is-react-blink, .cast-hit[data-cast-id="${id}"] .cast-art.is-react-lean, .cast-hit[data-cast-id="${id}"].is-speaking`);
  const voiceRequests = () => (performance.getEntriesByType('resource') || []).filter((e) => /\/cast\/voice\//.test(e.name)).length;

  if (ids.some((id) => cast.momentLoaded(id))) flag('A cast moment loaded before any card was opened.');
  else t.event('cast-moments-idle', 'no moment media loaded before the first tap');
  if (voiceRequests() > 0) flag('Cast audio was requested before the first tap.');
  else t.event('cast-audio-idle', 'no cast audio requested before the first tap');
  const firstThree = ids.slice(0, 3);
  const seenCaptions = [];
  for (let i = 0; i < firstThree.length; i++) {
    const id = firstThree[i];
    if (!tapCard(id)) {
      flag(`No cast button for ${id}.`);
      continue;
    }
    const caption = cast.caption();
    const reacting = reactingNow(id);
    t.event('cast-moment', `${id}: moment loaded=${cast.momentLoaded(id)}, others loaded=${ids.filter((o) => o !== id && cast.momentLoaded(o)).length}`);
    t.event('cast-speak', `${id}: "${caption.slice(0, 80)}" react=${reacting ? 'yes' : 'no'}`);
    if (!caption) flag(`${id} showed no caption bubble.`);
    if (!reacting) flag(`${id} portrait did not show a speaking/react state.`);
    seenCaptions.push(caption);
    t.metric('castSpoken', i + 1);
    await t.wait(900); // caption on screen for screenshots
    // Same character again: if still speaking the tap stops it, and the next tap plays a different line.
    if (i === 0) {
      const first = caption;
      if (cast.speakingId() === id) {
        tapCard(id);
        if (cast.speakingId() === id) flag('A tap on a speaking card should stop it.');
        else t.event('cast-stop', `${id} stopped on second tap`);
      } else {
        t.event('cast-line-ended', `${id} line already finished; next tap plays another line`);
      }
      tapCard(id);
      const next = cast.caption();
      const nextReact = reactingNow(id);
      t.event('cast-cycle', `${id} first: "${(first || '').slice(0, 60)}" next: "${(next || '').slice(0, 60)}" react=${nextReact ? 'yes' : 'no'} different=${next && next !== first ? 'yes' : 'no'}`);
      if (!next) flag(`${id} tapped again showed no caption.`);
      else if (next === first) flag(`${id} tapped again repeated the same line.`);
      await t.wait(900);
    }
    t.progress(0.15 + 0.18 * (i + 1));
  }
  t.event('cast-audio-after-tap', `voice requests after taps: ${voiceRequests()}`);
  t.event('cast-shot-desktop', 'cast strip at desktop width');
  t.progress(0.75);

  t.scene('Cast phone');
  document.documentElement.classList.add('cast-force-phone');
  await t.wait(200);
  window.dispatchEvent(new Event('resize'));
  section.scrollIntoView({ behavior: 'auto', block: 'center' });
  const row = section.querySelector('[data-cast-list]');
  const scrollX0 = window.scrollX || window.pageXOffset || 0;
  if (row) {
    row.scrollLeft = Math.min(120, row.scrollWidth);
    await t.wait(200);
    // One-finger swipe along the row
    const rr = row.getBoundingClientRect();
    const cx = rr.left + Math.min(120, rr.width / 2);
    const cy = rr.top + rr.height / 2;
    row.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: cx, clientY: cy, pointerId: 2, pointerType: 'touch' }));
    row.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: cx - 80, clientY: cy, pointerId: 2, pointerType: 'touch' }));
    row.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: cx - 80, clientY: cy, pointerId: 2, pointerType: 'touch' }));
    await t.wait(250);
  }
  const phoneId = firstThree[1] || firstThree[0];
  tapCard(phoneId, 'touch');
  const phoneCap = cast.caption();
  t.event('cast-phone-touch', `${phoneId} tapped by touch, react=${reactingNow(phoneId) ? 'yes' : 'no'}`);
  const phoneW = Math.round(section.getBoundingClientRect().width);
  const scrollX1 = window.scrollX || window.pageXOffset || 0;
  t.metric('castPhoneWidth', phoneW);
  t.metric('pageScrollX', Math.round(Math.abs(scrollX1 - scrollX0) * 10) / 10);
  t.event('cast-shot-phone', `390-style width ${phoneW}px, caption "${(phoneCap || '').slice(0, 60)}", page scrollX Δ ${Math.abs(scrollX1 - scrollX0)}`);
  if (!phoneCap) flag('Phone cast tap showed no caption.');
  if (Math.abs(scrollX1 - scrollX0) > 2) flag('Swiping the cast row scrolled the page sideways.');
  const small = Array.from(section.querySelectorAll('.cast-hit')).filter((b) => { const r = b.getBoundingClientRect(); return r.width < 44 || r.height < 44; });
  t.event('cast-tap-targets', `${small.length} of ${ids.length} cards under 44 px`);
  if (small.length) flag('A cast card tap target is under 44 px.');
  // Cards must not be clipped off the forced phone frame
  const card = section.querySelector('.cast-card');
  if (card) {
    const cr = card.getBoundingClientRect();
    const sr = section.getBoundingClientRect();
    if (cr.right < sr.left + 8 || cr.left > sr.right - 8) flag('A cast card sits outside the phone frame.');
  }
  await t.wait(1100);
  document.documentElement.classList.remove('cast-force-phone');
  cast.stop();
  t.progress(1);
  t.scene('Done');
  finish(true);
}

async function runMapExplore({ t, flag, finish }) {
  const section = document.getElementById('explore');
  const stage = document.querySelector('[data-explore-map]');
  if (!section || !stage) {
    flag('Explore Yooba Land section is missing from the home page.');
    t.scene('Missing');
    finish(false);
    return;
  }

  t.scene('Map desktop');
  section.scrollIntoView({ behavior: 'auto', block: 'center' });
  // Nudge into view so IntersectionObserver loads the SVG.
  stage.scrollIntoView({ behavior: 'auto', block: 'nearest' });
  await t.until(() => window.yoobaExplore && window.yoobaExplore.ready(), 20000, 'the explore map');
  t.event('map-ready', 'SVG and places.json loaded');
  t.progress(0.15);
  await t.wait(900); // map on screen for screenshots

  const viewport = stage.querySelector('.explore-viewport');
  const ex = window.yoobaExplore;
  // Wait until the map has stopped moving (a card's centring glide, a resize re-fit) before measuring a gesture.
  const settle = async () => {
    let last = ex.getTransform();
    let still = 0;
    for (let k = 0; k < 60 && still < 3; k++) {
      await t.wait(90);
      const cur = ex.getTransform();
      still = (cur.x === last.x && cur.y === last.y && cur.scale === last.scale && !(ex.panRoom && ex.panRoom().moving)) ? still + 1 : 0;
      last = cur;
    }
  };
  // Pointer events go to whatever element is under the finger (a pin, the map art, the frame), like a real touch,
  // and bubble to the frame's handlers.
  const dispatchPtr = (type, x, y, id = 1, kind = 'touch') => {
    const target = document.elementFromPoint(x, y) || viewport;
    const host = viewport.contains(target) ? target : viewport;
    try {
      host.dispatchEvent(new PointerEvent(type, {
        bubbles: true, cancelable: true, composed: true,
        clientX: x, clientY: y, pointerId: id, pointerType: kind, isPrimary: id === 1,
        button: 0, buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1,
      }));
    } catch {
      host.dispatchEvent(new MouseEvent(type === 'pointerdown' ? 'mousedown' : type === 'pointerup' ? 'mouseup' : 'mousemove', {
        bubbles: true, cancelable: true, clientX: x, clientY: y,
      }));
    }
  };
  // One-finger drag with the pointer sequence a finger makes, toward the side that has room to move.
  // Moves are synchronous so lostpointercapture on a synthetic pointer cannot clear the drag mid-way.
  const drag = (distance) => {
    const room = ex.panRoom();
    const dirX = room.right >= room.left ? 1 : -1;
    const dirY = room.down >= room.up ? 1 : -1;
    const roomX = dirX > 0 ? room.right : room.left;
    const roomY = dirY > 0 ? room.down : room.up;
    // Aim at `distance` px along x if there is room there, else along y.
    const useX = roomX >= distance * 0.5 || roomX >= roomY;
    const total = Math.max(0, Math.min(distance, useX ? roomX : roomY));
    const vr = viewport.getBoundingClientRect();
    const sx = vr.left + vr.width / 2;
    const sy = vr.top + Math.min(vr.height / 2, 150);
    const steps = 10;
    dispatchPtr('pointerdown', sx, sy);
    for (let k = 1; k <= steps; k++) {
      const d = (total * k) / steps;
      dispatchPtr('pointermove', useX ? sx + dirX * d : sx, useX ? sy : sy + dirY * d);
    }
    dispatchPtr('pointerup', useX ? sx + dirX * total : sx, useX ? sy : sy + dirY * total);
    return { axis: useX ? 'x' : 'y', asked: total, room: { x: roomX, y: roomY } };
  };
  const dragAndMeasure = async (label, distance) => {
    await settle();
    const b = ex.getTransform();
    const scrollX0 = window.scrollX || window.pageXOffset || 0;
    const info = drag(distance);
    await t.wait(250);
    const a = ex.getTransform();
    const moved = Math.hypot(a.x - b.x, a.y - b.y);
    const scrollDelta = Math.abs((window.scrollX || window.pageXOffset || 0) - scrollX0);
    t.metric(`${label}Px`, px(moved));
    t.event(`${label}`, `one-finger drag along ${info.axis}: asked ${px(info.asked)}px, map moved ${px(moved)}px ` +
      `(room x ${px(info.room.x)} / y ${px(info.room.y)}, scale ${px(a.scale)}), page scrollX delta ${px(scrollDelta)}`);
    if (info.asked >= 8 && moved < 8) flag(`One-finger drag (${label}) did not move the map.`);
    if (info.asked < 8) flag(`The map had no room to drag (${label}): the clamp pins it.`);
    if (scrollDelta > 2) flag('Dragging the map scrolled the page sideways.');
    return moved;
  };
  const tap = async (el) => {
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    dispatchPtr('pointerdown', x, y);
    dispatchPtr('pointerup', x, y);
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
  };

  await settle();
  const before = ex.getTransform();
  const slack = ex.panSlack();
  t.metric('mapPanSlackX', px(slack.x));
  t.metric('mapPanSlackY', px(slack.y));
  t.event('map-pan-slack', `clamp allows ~${px(slack.x)}px x / ${px(slack.y)}px y from start view (scale ${px(before.scale)})`);
  if (slack.x < 16 && slack.y < 16) flag('Start view has almost no pan room (clamp still pins the map).');
  const panMoved = await dragAndMeasure('map-pan', 96);
  t.metric('mapPanPx', px(panMoved));
  t.progress(0.28);

  // Two-finger pinch: spread two fingers apart, then bring them together, around the middle of the frame.
  const pinch = async (from, to, steps = 8) => {
    const vr = viewport.getBoundingClientRect();
    const cx = vr.left + vr.width / 2;
    const cy = vr.top + Math.min(vr.height / 2, 150);
    dispatchPtr('pointerdown', cx - from, cy, 1);
    dispatchPtr('pointerdown', cx + from, cy, 2);
    for (let k = 1; k <= steps; k++) {
      const h = from + ((to - from) * k) / steps;
      dispatchPtr('pointermove', cx - h, cy, 1);
      dispatchPtr('pointermove', cx + h, cy, 2);
    }
    dispatchPtr('pointerup', cx - to, cy, 1);
    dispatchPtr('pointerup', cx + to, cy, 2);
  };
  await settle();
  const scaleBeforePinch = ex.getTransform().scale;
  await pinch(40, 90); // fingers spread: zoom in
  await t.wait(250);
  const afterPinch = ex.getTransform();
  t.metric('mapPinchScale', px(afterPinch.scale));
  t.event('map-pinch', `two fingers spread, scale ${px(scaleBeforePinch)} → ${px(afterPinch.scale)}`);
  if (afterPinch.scale <= scaleBeforePinch + 0.02) flag('Pinching out did not zoom the map in.');
  await t.wait(300);
  await pinch(90, 50); // fingers together: zoom out a little
  await t.wait(250);
  const afterPinchIn = ex.getTransform();
  t.event('map-pinch-in', `two fingers together, scale ${px(afterPinch.scale)} → ${px(afterPinchIn.scale)}`);
  if (afterPinchIn.scale >= afterPinch.scale - 0.02) flag('Pinching in did not zoom the map out.');
  // The +/- buttons too.
  const zoomBtn = stage.querySelector('[data-explore-zoom="in"]');
  const scaleBeforeBtn = ex.getTransform().scale;
  if (zoomBtn) { await tap(zoomBtn); await t.wait(200); }
  const afterBtn = ex.getTransform();
  t.event('map-zoom-button', `+ button, scale ${px(scaleBeforeBtn)} → ${px(afterBtn.scale)}`);
  if (zoomBtn && afterBtn.scale <= scaleBeforeBtn + 0.02) flag('The + button did not zoom the map in.');
  t.progress(0.4);
  await t.wait(700);

  const cards = ['yooba-town', 'mistwood', 'licorice-reach'];
  for (let i = 0; i < cards.length; i++) {
    const id = cards[i];
    const pin = stage.querySelector(`[data-place="${id}"]`);
    if (pin) await tap(pin);
    else flag(`Pin for ${id} is missing from the map.`);
    await t.until(() => window.yoobaExplore.getOpenId() === id, 8000, `card ${id}`);
    const card = stage.querySelector('.explore-card');
    const img = stage.querySelector('.explore-card-img');
    const play = stage.querySelector('[data-explore-play]');
    const name = ((stage.querySelector('.explore-card-name') || {}).textContent || '').trim();
    const hook = ((stage.querySelector('.explore-card-hook') || {}).textContent || '').trim();
    const imgOk = !!(img && img.getAttribute('src'));
    const playHref = play && play.getAttribute('href');
    t.scene(`Card ${id}`);
    t.event('place-card', `${id}: "${name}", hook ${hook ? 'yes' : 'NO'}, picture ${imgOk ? 'yes' : 'NO'}, Play ${playHref || 'MISSING'}`);
    if (!card || card.hidden) flag(`Place card for ${id} did not open.`);
    if (!imgOk) flag(`Place card for ${id} has no picture.`);
    if (!hook) flag(`Place card for ${id} has no hook line.`);
    if (!play || playHref !== './Game/') flag(`Place card Play must link to ./Game/ (got ${playHref}).`);
    t.metric('cardsOpened', i + 1);
    t.progress(0.4 + 0.12 * (i + 1));
    await t.wait(1100); // open card on screen for screenshots
  }
  t.event('map-shot-desktop', 'map + open card at desktop width');
  t.progress(0.78);

  // 390 px phone frame: bottom-sheet card layout for screenshots (also covers a native phone run).
  t.scene('Map phone');
  document.documentElement.classList.add('explore-force-phone');
  window.yoobaExplore.closeCard();
  await t.wait(200);
  // Re-fit after the stage narrows.
  window.dispatchEvent(new Event('resize'));
  await t.wait(300);
  const phonePin = stage.querySelector('[data-place="sugarsand"]') || stage.querySelector('[data-place="yooba-town"]');
  const phoneId = phonePin && phonePin.getAttribute('data-place') || 'yooba-town';
  if (phonePin) await tap(phonePin);
  else flag(`Pin for ${phoneId} is missing from the map.`);
  await t.until(() => window.yoobaExplore.getOpenId() === phoneId, 8000, 'phone card');
  const phoneCard = stage.querySelector('.explore-card');
  const phoneW = Math.round(stage.getBoundingClientRect().width);
  const sheet = phoneCard && !phoneCard.hidden;
  const playPhone = stage.querySelector('[data-explore-play]');
  t.metric('mapPhoneWidth', phoneW);
  t.event('map-shot-phone', `390-style frame width ${phoneW}px, bottom sheet ${sheet ? 'open' : 'MISSING'}, Play ${playPhone && playPhone.getAttribute('href')}`);
  if (!sheet) flag('Phone layout did not show an open place card.');
  // Desktop run forces 390 via .explore-force-phone; native phone runs are already ~390.
  if (phoneW > 420) flag(`Phone map frame is ${phoneW}px wide (expected ~390).`);
  // One-finger drag on the phone frame (the page must not scroll sideways). The card's centring glide has to
  // finish first, and the drag goes toward the side with room: the pin just centred can pin the map to an edge.
  const phoneSlack = ex.panSlack();
  t.metric('mapPhonePanSlackX', px(phoneSlack.x));
  const phonePan = await dragAndMeasure('map-phone-drag', 96);
  t.metric('mapPhonePanPx', px(phonePan));
  t.metric('pageScrollX', px(Math.abs((window.scrollX || window.pageXOffset || 0))));
  t.event('map-phone-pan', `page scrollX ${px(window.scrollX || window.pageXOffset || 0)} after the drag`);
  if (phoneW <= 420) {
    // Pinch on the phone-sized frame too.
    await settle();
    const s0 = ex.getTransform().scale;
    await pinch(30, 70, 6);
    await t.wait(250);
    const s1 = ex.getTransform().scale;
    t.metric('mapPhonePinchScale', px(s1));
    t.event('map-phone-pinch', `phone-sized pinch, scale ${px(s0)} → ${px(s1)}`);
    if (s0 < 2.9 && s1 <= s0 + 0.02) flag('Pinching out on the phone-sized map did not zoom it in.');
  }
  const overflowX = document.documentElement.scrollWidth - document.documentElement.clientWidth;
  t.metric('pageOverflowX', overflowX);
  if (overflowX > 2) flag(`The page is ${overflowX}px wider than the screen (sideways scroll).`);
  await t.wait(1200); // phone card on screen for screenshots
  document.documentElement.classList.remove('explore-force-phone');
  t.progress(1);
  t.scene('Done');
  finish(true);
}

async function runMapAlive({ t, flag, finish }) {
  const stage = document.querySelector('[data-explore-map]');
  if (!stage) { flag('Explore map is missing.'); finish(false); return; }
  const click = (sel) => stage.querySelector(sel).click();
  t.scene('Map alive');
  stage.scrollIntoView({ behavior: 'auto', block: 'center' });
  await t.until(() => window.yoobaExplore && window.yoobaExplore.ready(), 20000, 'the explore map');
  const ex = window.yoobaExplore;
  if (ex.soundOn()) click('[data-explore-sound]'); // start from the default (off)
  t.event('sound-default', 'sound off by default');
  click('[data-explore-sound]');
  if (!ex.soundOn()) flag('Sound toggle did not turn sound on.');
  const pin = (id) => stage.querySelector('[data-place="' + id + '"]');
  pin('yooba-town').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  await t.wait(1300);
  const a = ex.audioState().voices.filter((v) => v.to > 0);
  t.event('ambience', 'yooba-town: ' + a.map((v) => v.src.split('/').pop()).join(','));
  if (a.length !== 1) flag('Opening a place should play exactly one ambient loop.');
  pin('mistwood').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  await t.wait(300);
  const mid = ex.audioState().voices;
  t.event('crossfade', 'voices during switch: ' + mid.length);
  if (mid.length < 2) flag('Switching places did not crossfade (two loops expected mid-fade).');
  await t.wait(1200);
  const after = ex.audioState().voices.filter((v) => v.to > 0);
  if (after.length !== 1 || !/WhisperingForest/.test(after[0].src)) flag('After switching, only Mistwood ambience should remain.');
  ex.closeCard();
  t.progress(0.4);
  t.event('idle-life', 'clouds, water shimmer and walking Yooba running: ' + ex.lifeRunning());
  if (!ex.lifeRunning()) flag('Idle life on the map is not animating (it may be reduced-motion).');
  t.scene('Road Home');
  click('[data-explore-journey]');
  const seen = new Set();
  await t.until(() => { const o = ex.getOpenId(); if (o) seen.add(o); return !ex.journey().running; }, 60000, 'the journey to finish');
  t.metric('journeyChapters', ex.journey().visited);
  t.event('journey-done', 'chapters visited ' + ex.journey().visited + ', state ' + ex.journey().state);
  if (ex.journey().visited !== 8 || ex.journey().state !== 'done') flag('Follow the Road Home did not visit all 8 chapters.');
  t.progress(0.8);
  click('[data-explore-journey]');
  await t.wait(1500);
  click('[data-explore-journey]');
  await t.wait(200);
  t.event('journey-skipped', 'state ' + ex.journey().state);
  if (ex.journey().running || ex.journey().state !== 'skipped') flag('Skipping the journey did not stop it.');
  t.progress(1);
  finish(true);
}

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

async function runTrailer({ t, flag, finish }) {
  t.scene('Home');
  const watch = document.querySelector('.hero [data-trailer-open]');
  const play = document.querySelector('.hero .play-large');
  const trailerRoot = document.querySelector('.hero [data-trailer]');
  if (trailerRoot && trailerRoot.getAttribute('data-trailer-enabled') === 'false') {
    // Flag off: the cut has not shipped, so the hero must not offer it and must not ask for its files.
    await t.wait(800);
    t.event('trailer-off', 'trailer: off');
    t.log('trailer: off');
    const shown = watch && watch.getClientRects().length > 0 && getComputedStyle(watch).display !== 'none';
    if (shown) flag('Watch the trailer button is visible while the trailer flag is off.');
    const asked = performance.getEntriesByType('resource').filter((e) => /trailer/i.test(e.name));
    t.metric('trailerRequests', asked.length);
    if (asked.length) flag('Page requested a trailer file while the flag is off: ' + asked[0].name);
    if (play) {
      const r = play.getBoundingClientRect();
      t.metric('playBottom', px(r.bottom));
      t.event('hero-fold', `Play bottom ${px(r.bottom)} of ${innerHeight}`);
      if (r.bottom > innerHeight) flag('Hero Play is below the fold.');
    } else flag('No Play button in the hero.');
    t.scene('Done');
    finish(true);
    return;
  }
  if (!watch) {
    flag('No Watch the trailer button in the hero.');
    t.scene('Done');
    finish(false);
    return;
  }
  noteFirstPlay();
  const versionLine = document.querySelector('.hero-version [data-hawkes-version]');
  await t.until(() => !versionLine || !versionLine.hidden, 8000, "the What's new line").catch(() => t.log("What's new line never appeared"));
  await t.wait(800);

  // Scroll a little so restore-after-close is measurable, then open from that spot.
  // Capture hero rects AFTER this scroll so close+restore is not compared against a pre-scroll viewport.
  window.scrollTo(0, 120);
  await t.wait(200);
  const scrollBefore = window.scrollY || window.pageYOffset || 0;
  const playRect0 = play ? layoutOf(play) : null;
  const watchRect0 = layoutOf(watch);
  t.metric('scrollBeforeTrailer', px(scrollBefore));
  t.event('hero-ready', `Watch the trailer at ${watchRect0.map(px).join(',')}; scrolled to ${px(scrollBefore)}`);

  let opened = null;
  let playing = null;
  let five = null;
  let missing = null;
  const onOpen = (e) => { opened = e.detail || {}; };
  const onPlay = (e) => { playing = e.detail || {}; };
  const onFive = (e) => { five = e.detail || {}; };
  const onMissing = (e) => { missing = e.detail || {}; };
  window.addEventListener('trailer:open', onOpen);
  window.addEventListener('trailer:playing', onPlay);
  window.addEventListener('trailer:five', onFive);
  window.addEventListener('trailer:missing', onMissing);

  // Real click unlocks audio (element.click alone often leaves video muted/blocked).
  const r = watch.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  try {
    watch.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, cancelable: true, composed: true,
      clientX: cx, clientY: cy, pointerId: 1, pointerType: 'mouse', isPrimary: true,
    }));
  } catch { /* older browsers */ }
  watch.click();
  t.event('trailer-pressed', 'Watch the trailer');
  t.scene('Trailer');
  t.progress(0.2);

  await t.until(() => document.querySelector('.trailer-overlay') || missing, 8000, 'the trailer overlay');
  if (!document.querySelector('.trailer-overlay')) {
    flag('Trailer overlay did not open.');
    window.removeEventListener('trailer:open', onOpen);
    window.removeEventListener('trailer:playing', onPlay);
    window.removeEventListener('trailer:five', onFive);
    window.removeEventListener('trailer:missing', onMissing);
    t.scene('Done');
    finish(false);
    return;
  }
  t.event('trailer-open', opened ? JSON.stringify(opened) : 'overlay present');

  await t.until(() => playing || missing, 12000, 'trailer playing or missing file').catch(() => {});
  // Final mp4s are held until grow juice + grounded town are on beta (docs/trailer.md). While they are
  // absent, log it — do not fail the player/scroll criteria. Once files land, muted / short / fill flags apply.
  const hasCut = !missing && !!playing;
  if (missing) {
    t.event('trailer-missing', `${missing.src || ''} (hold: cut after k_6c339fe0702c + k_3001ea3be60f on beta)`);
    t.log('Trailer media not on this build yet; player and close/scroll still checked.');
  } else if (!playing) {
    flag('Trailer did not start playing.');
  } else {
    t.event('trailer-playing', `src=${playing.src || ''}, muted=${playing.muted}, ${playing.width}x${playing.height}, portrait=${playing.portrait}`);
    t.metric('trailerMuted', playing.muted ? 1 : 0);
    if (playing.muted) flag('Trailer is muted; it must play with sound.');
  }
  t.progress(0.45);

  const phone = phoneish() || (window.innerWidth <= 420 && window.innerHeight >= window.innerWidth);
  const overlayEl = document.querySelector('.trailer-overlay');
  if (phone) {
    if (!overlayEl || !overlayEl.classList.contains('is-portrait')) {
      if (hasCut) flag('Portrait phone did not use the vertical trailer cut (missing is-portrait).');
      else t.event('trailer-portrait', 'is-portrait expected once vertical cut ships');
    } else {
      const box = overlayEl.querySelector('.trailer-box');
      const br = box && box.getBoundingClientRect();
      const fills = br && br.width >= window.innerWidth * 0.95 && br.height >= window.innerHeight * 0.95;
      t.event('trailer-portrait', fills
        ? `vertical cut full-bleed ${px(br.width)}x${px(br.height)} in ${window.innerWidth}x${window.innerHeight}`
        : `is-portrait but box ${br ? `${px(br.width)}x${px(br.height)}` : 'missing'}`);
      t.metric('trailerFillW', br ? px(br.width) : 0);
      t.metric('trailerFillH', br ? px(br.height) : 0);
      if (hasCut && !fills) flag('Portrait trailer box does not fill the 390x844 screen.');
    }
  } else {
    t.event('trailer-desktop', 'landscape/desktop 16:9 box');
  }

  // Hold through the first 5 s so the review can see eat/grow when the real cut is present.
  await t.until(() => five || missing, 8000, 'first 5 seconds').catch(() => {});
  if (five) {
    t.event('trailer-five', `t=${px(five.time)}s`);
    t.metric('trailerFiveAt', px(five.time));
  } else if (hasCut) {
    const v = window.yoobaTrailer && window.yoobaTrailer.video && window.yoobaTrailer.video();
    const tNow = v ? v.currentTime : 0;
    t.metric('trailerTime', px(tNow));
    if (tNow < 4.5) flag(`Trailer had only ${px(tNow)}s before close; need the first 5 s on screen.`);
    else t.event('trailer-five', `timeupdate fallback t=${px(tNow)}s`);
  } else {
    t.event('trailer-five', 'skipped while cut is held');
  }
  t.progress(0.7);
  await t.wait(600);

  const closeBtn = document.querySelector('.trailer-close');
  if (closeBtn) closeBtn.click();
  else if (window.yoobaTrailer) window.yoobaTrailer.close();
  await t.until(() => !document.querySelector('.trailer-overlay'), 5000, 'trailer closed');
  t.event('trailer-closed', 'close control');
  await t.wait(300);

  const scrollAfter = window.scrollY || window.pageYOffset || 0;
  t.metric('scrollAfterTrailer', px(scrollAfter));
  t.metric('scrollDelta', px(Math.abs(scrollAfter - scrollBefore)));
  if (Math.abs(scrollAfter - scrollBefore) > 4) {
    flag(`Closing the trailer moved the page (scroll ${px(scrollBefore)} → ${px(scrollAfter)}).`);
  } else {
    t.event('scroll-restored', `back at ${px(scrollAfter)}`);
  }

  if (play && playRect0) {
    const moved = drift(playRect0, layoutOf(play));
    t.metric('heroPlayMovedPx', px(moved));
    if (moved > 2) flag(`Hero Play button jumped ${px(moved)}px after closing the trailer.`);
    else t.event('hero-stable', `Play button moved ${px(moved)}px after trailer`);
  }
  const watchMoved = drift(watchRect0, layoutOf(watch));
  t.metric('watchMovedPx', px(watchMoved));
  if (watchMoved > 2) flag(`Watch the trailer button jumped ${px(watchMoved)}px after close.`);

  window.removeEventListener('trailer:open', onOpen);
  window.removeEventListener('trailer:playing', onPlay);
  window.removeEventListener('trailer:five', onFive);
  window.removeEventListener('trailer:missing', onMissing);
  t.progress(1);
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
  // Leaving asks first: answer the question the way a player would (Leave), and log that it was asked.
  const gw0 = gameWin();
  try {
    gw0.confirm = (q) => { t.event('leave-asked', `"${q}" answered yes`); return true; };
  } catch { /* cross-origin: native dialog */ }
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

const PAGES = [
  ['home', 'index.html'],
  ['blog index', 'blog.html'],
  ['blog post', 'blog/eat-and-grow.html'],
  ['whatsnew', 'whatsnew.html'],
  ['privacy', 'privacypolicy.html'],
  ['contact', 'contact.html'],
  ['game shell', 'Game/?playtest=fail-load', 'shell'],
];
const SIZES = [['1280', 1280, 800], ['390', 390, 844]];

function nameOf(el) {
  if (!el || !el.tagName) return '?';
  let s = el.tagName.toLowerCase();
  if (el.id) s += '#' + el.id;
  else if (typeof el.className === 'string' && el.className.trim()) s += '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.');
  const label = (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24);
  return label ? `${s} "${label}"` : s;
}

function measureFrame(win, doc) {
  const vw = win.innerWidth;
  const out = { overflow: null, tiny: [], noDims: [], smallText: [] };
  const root = doc.documentElement;
  if (root.scrollWidth > vw) {
    let widest = null;
    let right = vw;
    for (const el of doc.body ? doc.body.querySelectorAll('*') : []) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.right > right) { right = r.right; widest = el; }
    }
    out.overflow = { scrollWidth: root.scrollWidth, innerWidth: vw, widest: widest ? nameOf(widest) : 'none found', right: Math.round(right) };
  }
  const shown = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return null;
    const s = win.getComputedStyle(el);
    return s.visibility === 'hidden' || s.display === 'none' ? null : { r, s };
  };
  for (const el of doc.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button]')) {
    const m = shown(el);
    if (!m) continue;
    if (m.s.display === 'inline' && el.closest('p, li, figcaption')) continue; // links inside a sentence are not tap targets
    if (m.r.width < 44 || m.r.height < 44) out.tiny.push(`${nameOf(el)} ${Math.round(m.r.width)}x${Math.round(m.r.height)}`);
  }
  for (const img of doc.querySelectorAll('img')) {
    if (!img.hasAttribute('width') || !img.hasAttribute('height')) out.noDims.push(img.getAttribute('src') || nameOf(img));
  }
  const seen = new Set();
  const walker = doc.createTreeWalker(doc.body || root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.nodeValue.trim()) continue;
    const el = n.parentElement;
    if (!el || seen.has(el) || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(el.tagName)) continue;
    const m = shown(el);
    if (!m) continue;
    const size = parseFloat(m.s.fontSize);
    if (size < 14) { seen.add(el); out.smallText.push(`${nameOf(el)} ${px(size)}px`); }
  }
  out.animations = (doc.getAnimations ? doc.getAnimations() : []).filter((a) => a.effect && a.effect.getComputedTiming().iterations === Infinity && a.playState === 'running').length;
  return out;
}

async function runPages({ t }) {
  const reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  t.metric('reducedMotion', reduced ? 1 : 0);
  t.event('motion-mode', reduced ? 'prefers-reduced-motion: reduce is ON for this run' : 'prefers-reduced-motion is not emulated in this run; run again with reduced motion on');
  const frame = document.createElement('iframe');
  frame.setAttribute('title', 'Yooba Land (pages)');
  document.body.appendChild(frame);
  const setSize = (w, h) => { frame.style.cssText = `position:fixed;left:0;top:0;width:${w}px;height:${h}px;border:0;z-index:2147483000;background:#fff;`; };
  const total = PAGES.length * SIZES.length;
  let done = 0;
  const totals = { overflow: 0, tiny: 0, small: 0, noDims: 0, errors: 0, playFailed: 0 };
  try {
    for (const [label, path, kind] of PAGES) {
      // The game shell is Game/index.html, written by the Unity deploy (YoobaWebBuild): measured and reported, but it
      // is not this site's to edit, so its findings stay out of the totals the criteria read.
      const shell = kind === 'shell';
      for (const [sizeName, w, h] of SIZES) {
        const tag = `${label} @${sizeName}`;
        t.scene(tag);
        setSize(w, h);
        const errors = [];
        frame.src = 'about:blank';
        await t.wait(50);
        frame.src = BASE + path;
        // Hook console errors as early as the document exists.
        const hooked = new Set();
        const hook = () => {
          const win = frame.contentWindow;
          if (!win || win.location.href === 'about:blank' || hooked.has(win)) return;
          try {
            hooked.add(win);
            const old = win.console.error;
            win.console.error = (...a) => { errors.push('console.error: ' + a.map(String).join(' ').slice(0, 160)); old.apply(win.console, a); };
            win.addEventListener('error', (e) => errors.push('error: ' + (e.message || (e.target && e.target.src) || '?').toString().slice(0, 160)), true);
            win.addEventListener('unhandledrejection', (e) => errors.push('rejection: ' + String(e.reason).slice(0, 160)));
          } catch { /* cross-origin: not ours to hook */ }
        };
        const hooker = setInterval(hook, 5);
        try {
          await t.until(() => { const d = frame.contentDocument; return d && d.readyState === 'complete' && frame.contentWindow.location.href !== 'about:blank'; }, 20000, tag);
        } finally { clearInterval(hooker); }
        const win = frame.contentWindow;
        const doc = frame.contentDocument;
        await t.wait(600);
        // Scroll top to bottom in steps so lazy images load and the page shows on screen for screenshots.
        const step = Math.max(200, Math.floor(h * 0.8));
        win.scrollTo(0, 0);
        t.event('screenshot', `${tag} top`);
        await t.wait(700);
        let y = 0;
        while (y + h < doc.documentElement.scrollHeight - 2 && y < 40000) {
          y += step;
          win.scrollTo(0, y);
          await t.wait(250);
        }
        t.event('screenshot', `${tag} bottom (scrolled ${Math.round(win.scrollY)} of ${doc.documentElement.scrollHeight}px)`);
        await t.wait(700);
        win.scrollTo(0, 0);
        await t.wait(200);

        const m = measureFrame(win, doc);
        for (const e of (win.performance.getEntriesByType('resource') || [])) {
          if (e.responseStatus >= 400) errors.push(`resource ${e.responseStatus}: ${e.name.slice(-80)}`);
        }
        const note = (list, what) => {
          if (!list.length) return;
          const shown = list.slice(0, 6).join('; ') + (list.length > 6 ? `; +${list.length - 6} more` : '');
          t.problem('warning', `${tag}${shell ? ' (Unity shell, not counted)' : ''}: ${list.length} ${what}: ${shown}`);
        };
        const count = (key, n) => { if (!shell) totals[key] += n; };
        if (m.overflow) {
          count('overflow', 1);
          t.problem('warning', `${tag}: sideways scroll, scrollWidth ${m.overflow.scrollWidth} > ${m.overflow.innerWidth}; widest ${m.overflow.widest} reaches ${m.overflow.right}px`);
        }
        note(m.tiny, 'tap targets under 44 px'); count('tiny', m.tiny.length);
        note(m.smallText, 'text runs under 14 px'); count('small', m.smallText.length);
        note(m.noDims, 'images without width and height'); count('noDims', m.noDims.length);
        // The shell is opened in its failure state on purpose, so its 404 is expected there.
        const seenErrors = [...new Set(errors)].filter((e) => !(shell && /does-not-exist/.test(e)));
        note(seenErrors, 'console errors'); count('errors', seenErrors.length);
        t.event('page-measured', `${tag}: overflow ${m.overflow ? 'YES' : 'no'}, tap targets <44 ${m.tiny.length}, text <14px ${m.smallText.length}, images w/o size ${m.noDims.length}, errors ${seenErrors.length}, looping animations ${m.animations}${shell ? ' (Unity shell, not counted)' : ''}`);
        if (reduced && m.animations) t.problem('warning', `${tag}: ${m.animations} looping animations still run with reduced motion on`);

        if (label === 'home') await lightbox({ t, win, doc, tag, touch: sizeName === '390' });
        // Last, because it leaves the page: Play from this page, by touch, at phone size.
        if (!shell && sizeName === '390') {
          const ok = await playFrom({ t, frame, win, doc, tag, label });
          totals.playFailed += ok ? 0 : 1;
        }
        done++;
        t.progress(done / total);
      }
    }
  } finally { frame.remove(); }
  for (const [k, v] of Object.entries(totals)) t.metric('total_' + k, v);
  t.scene('Done');
  t.finish('done');
}

// A finger on a link: touch pointer events, then the click the browser sends after a tap.
function tap(win, el) {
  const r = el.getBoundingClientRect();
  const at = { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, pointerType: 'touch', isPrimary: true };
  el.dispatchEvent(new win.PointerEvent('pointerdown', at));
  el.dispatchEvent(new win.PointerEvent('pointerup', at));
  el.click();
}

// Play from a page: tap its header Play (and, on home, the big hero Play too); the game page must open and begin its load
// (the Unity loader script is requested, or the Tap to play screen is up) rather than a 404 or a blank page.
async function playFrom({ t, frame, win, doc, tag, label }) {
  const targets = [['header', doc.querySelector('.topbar .play')]];
  if (label === 'home') targets.push(['hero', doc.querySelector('.hero .play-large')]);
  let allOk = true;
  for (const [where, el] of targets) {
    const what = `${tag}: ${where} Play`;
    if (!el) { t.problem('bug', `${what} is missing`); allOk = false; continue; }
    if (where !== 'header') {
      frame.src = BASE + 'index.html';
      await t.until(() => { const d = frame.contentDocument; return d && d.readyState === 'complete' && /index\.html$/.test(frame.contentWindow.location.pathname); }, 20000, 'the home page again');
      await t.wait(400);
    }
    const from = where === 'header' ? el : frame.contentDocument.querySelector('.hero .play-large');
    from.scrollIntoView({ block: 'center' });
    await t.wait(200);
    tap(frame.contentWindow, from);
    let started = false;
    try {
      await t.until(() => {
        const d = frame.contentDocument;
        let path = '';
        try { path = frame.contentWindow.location.pathname; } catch { return false; }
        if (!/\/Game\/?$/.test(path) || !d || d.readyState === 'loading' || !d.getElementById('unity-container')) return false;
        const loader = d.getElementById('unity-loader-script');
        return !!d.getElementById('hawkes-tap') || (!!loader && !/does-not-exist/.test(loader.src));
      }, 15000, `${what} to open the game`);
      started = true;
    } catch { /* reported below */ }
    if (started) {
      const d = frame.contentDocument;
      const failed = d.getElementById('unity-loading-bar') && d.getElementById('unity-loading-bar').classList.contains('failed');
      t.event('play-started', `${what}: game page opened and began loading${failed ? ' (this browser could not draw WebGL, so the game showed its failure screen)' : ''}`);
      t.event('screenshot', `${what} started the game`);
      await t.wait(600);
    } else {
      allOk = false;
      let at = '';
      try { at = frame.contentWindow.location.pathname; } catch { at = '(unreadable)'; }
      t.problem('bug', `${what} did not start the game: the frame is at ${at} and the loader was not requested`);
    }
  }
  frame.src = 'about:blank';
  return allOk;
}

async function lightbox({ t, win, doc, tag, touch }) {
  const shot = doc.querySelector('[data-lightbox]');
  if (!shot) { t.problem('warning', `${tag}: no gallery screenshot to open`); return; }
  shot.scrollIntoView({ block: 'center' });
  await t.wait(500);
  const r = shot.getBoundingClientRect();
  const at = { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, pointerType: touch ? 'touch' : 'mouse', isPrimary: true };
  shot.dispatchEvent(new win.PointerEvent('pointerdown', at));
  shot.dispatchEvent(new win.PointerEvent('pointerup', at));
  shot.click();
  const box = () => doc.querySelector('.lightbox');
  try { await t.until(() => box() && !box().hidden, 4000, 'the lightbox'); } catch { t.problem('warning', `${tag}: tapping a screenshot did not open the lightbox`); return; }
  await t.wait(900);
  t.event('lightbox-open', `${tag}: opened by tap on "${shot.getAttribute('data-caption') || ''}"`);
  t.event('screenshot', `${tag} lightbox open`);
  await t.wait(500);
  const close = box().querySelector('.lb-close');
  const cr = close.getBoundingClientRect();
  if (cr.width < 44 || cr.height < 44) t.problem('warning', `${tag}: lightbox close button ${Math.round(cr.width)}x${Math.round(cr.height)}px, under 44`);
  close.click();
  try { await t.until(() => box().hidden, 3000, 'the lightbox to close'); t.event('lightbox-closed', `${tag}: closed by tap`); } catch { t.problem('warning', `${tag}: lightbox did not close`); }
}
