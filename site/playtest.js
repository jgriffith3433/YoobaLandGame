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
//   whatsnew    — What's new + home Devlog + blog: picture cards, latest expanded, no empty date promise;
//                 overflow check at 1280 and 390 px
//   pages       — every page at 1280 and 390 px: scroll, measure (sideways scroll, tap targets, tiny text, images
//                 without size, console errors), gallery lightbox by tap. Measures only.
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
    id: 'pages',
    title: 'Every page at 1280 and 390 px: layout, tap targets, text, lightbox',
    seconds: 150,
    tags: ['full', 'phone'],
    description: 'Visits home, blog index, a post, What\'s new, privacy, contact and the game shell; scrolls each top to bottom at ' +
      '1280 and 390 px with screenshots; reports sideways scroll (with the widest element), tap targets under 44 px, ' +
      'images without width/height, text under 14 px and console errors; opens and closes the gallery lightbox by tap. ' +
      'Run once with prefers-reduced-motion emulated (the run says whether it was). Measure only: findings are warnings.',
  }, {
    id: 'map-alive',
    title: 'Map alive: sound crossfade, Road Home journey, idle life',
    seconds: 90,
    tags: ['full'],
    description: 'Home Explore map: turn sound on, open two places (ambience crossfades), watch the idle life, ' +
      'run Follow the Road Home through chapters 1-8, and skip a second run.',
  }, {
    id: 'whatsnew',
    title: 'Visual What\'s new cards on desktop and phone',
    seconds: 90,
    tags: ['full', 'phone'],
    description: 'What\'s new picture cards (version/date chip, media, 3-5 notes, newest expanded), home Devlog strip, ' +
      'blog cards in the same style; no empty live-moment date; overflow check at 1280 and 390 px.',
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

    if (id === 'map') {
      try {
        await runMapExplore({ t, flag, finish: (ok) => t.finish(ok && !bad ? 'won' : 'lost') });
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
  const before = window.yoobaExplore.getTransform();
  // Real pointer pan across the viewport (keeps the page from scrolling sideways via touch-action: none).
  const vr = viewport.getBoundingClientRect();
  const cx = vr.left + vr.width / 2;
  const cy = vr.top + vr.height / 2;
  const dispatchPtr = (type, x, y, id = 1) => {
    try {
      viewport.dispatchEvent(new PointerEvent(type, {
        bubbles: true, cancelable: true, composed: true,
        clientX: x, clientY: y, pointerId: id, pointerType: 'touch', isPrimary: id === 1,
        buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1,
      }));
    } catch {
      viewport.dispatchEvent(new MouseEvent(type === 'pointerdown' ? 'mousedown' : type === 'pointerup' ? 'mouseup' : 'mousemove', {
        bubbles: true, cancelable: true, clientX: x, clientY: y,
      }));
    }
  };
  dispatchPtr('pointerdown', cx, cy);
  dispatchPtr('pointermove', cx - 70, cy + 40);
  dispatchPtr('pointerup', cx - 70, cy + 40);
  await t.wait(200);
  const afterPan = window.yoobaExplore.getTransform();
  const panDist = Math.hypot(afterPan.x - before.x, afterPan.y - before.y);
  t.metric('mapPanPx', px(panDist));
  t.event('map-pan', `dragged ~${px(panDist)}px`);
  if (panDist < 8) flag('Panning the map did not move it.');
  t.progress(0.28);

  // Two-finger pinch zoom (acceptance: pinch feels smooth).
  const scaleBeforePinch = window.yoobaExplore.getTransform().scale;
  dispatchPtr('pointerdown', cx - 40, cy, 1);
  dispatchPtr('pointerdown', cx + 40, cy, 2);
  dispatchPtr('pointermove', cx - 70, cy, 1);
  dispatchPtr('pointermove', cx + 70, cy, 2);
  dispatchPtr('pointerup', cx - 70, cy, 1);
  dispatchPtr('pointerup', cx + 70, cy, 2);
  await t.wait(200);
  const afterPinch = window.yoobaExplore.getTransform();
  t.metric('mapPinchScale', px(afterPinch.scale));
  t.event('map-pinch', `scale ${px(scaleBeforePinch)} → ${px(afterPinch.scale)}`);
  if (afterPinch.scale <= scaleBeforePinch + 0.02) {
    // Fall back to the +/- control so the zoom criterion is still visible if PointerEvent multi-touch is limited.
    const zoomBtn = stage.querySelector('[data-explore-zoom="in"]');
    if (zoomBtn) zoomBtn.click();
    else window.yoobaExplore.zoomBy(1.25);
    await t.wait(200);
    const afterBtn = window.yoobaExplore.getTransform();
    t.event('map-zoom', `+/- fallback scale ${px(afterPinch.scale)} → ${px(afterBtn.scale)}`);
    if (afterBtn.scale <= scaleBeforePinch + 0.02) flag('Pinch and zoom-in did not raise the map scale.');
  }
  t.progress(0.4);
  await t.wait(700);

  const cards = ['yooba-town', 'mistwood', 'licorice-reach'];
  for (let i = 0; i < cards.length; i++) {
    const id = cards[i];
    const pin = stage.querySelector(`[data-place="${id}"]`);
    if (pin) {
      pin.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    } else {
      window.yoobaExplore.openPlace(id, false);
    }
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
  if (phonePin) phonePin.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  else window.yoobaExplore.openPlace(phoneId, false);
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
  // One-finger pan on the phone frame (page must not scroll sideways).
  const scrollX0 = window.scrollX || window.pageXOffset || 0;
  const pvr = viewport.getBoundingClientRect();
  const pcx = pvr.left + pvr.width / 2;
  const pcy = pvr.top + Math.min(120, pvr.height / 3);
  dispatchPtr('pointerdown', pcx, pcy);
  dispatchPtr('pointermove', pcx + 55, pcy);
  dispatchPtr('pointerup', pcx + 55, pcy);
  await t.wait(200);
  const scrollX1 = window.scrollX || window.pageXOffset || 0;
  t.metric('pageScrollX', px(Math.abs(scrollX1 - scrollX0)));
  t.event('map-phone-pan', `page scrollX delta ${px(Math.abs(scrollX1 - scrollX0))}`);
  if (Math.abs(scrollX1 - scrollX0) > 2) flag('Panning the map scrolled the page sideways.');
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
  ['game shell', 'Game/?playtest=fail-load'],
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
  const totals = { overflow: 0, tiny: 0, small: 0, noDims: 0, errors: 0 };
  try {
    for (const [label, path] of PAGES) {
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
        const note = (kind, list, what) => {
          if (!list.length) return;
          const shown = list.slice(0, 6).join('; ') + (list.length > 6 ? `; +${list.length - 6} more` : '');
          t.problem('warning', `${tag}: ${list.length} ${what}: ${shown}`);
        };
        if (m.overflow) {
          totals.overflow++;
          t.problem('warning', `${tag}: sideways scroll, scrollWidth ${m.overflow.scrollWidth} > ${m.overflow.innerWidth}; widest ${m.overflow.widest} reaches ${m.overflow.right}px`);
        }
        note('tiny', m.tiny, 'tap targets under 44 px'); totals.tiny += m.tiny.length;
        note('small', m.smallText, 'text runs under 14 px'); totals.small += m.smallText.length;
        note('dims', m.noDims, 'images without width and height'); totals.noDims += m.noDims.length;
        note('err', [...new Set(errors)], 'console errors'); totals.errors += new Set(errors).size;
        t.event('page-measured', `${tag}: overflow ${m.overflow ? 'YES' : 'no'}, tap targets <44 ${m.tiny.length}, text <14px ${m.smallText.length}, images w/o size ${m.noDims.length}, errors ${new Set(errors).size}, looping animations ${m.animations}`);
        if (reduced && m.animations) t.problem('warning', `${tag}: ${m.animations} looping animations still run with reduced motion on`);

        if (label === 'home') await lightbox({ t, win, doc, tag, touch: sizeName === '390' });
        done++;
        t.progress(done / total);
      }
    }
  } finally { frame.remove(); }
  for (const [k, v] of Object.entries(totals)) t.metric('total_' + k, v);
  t.scene('Done');
  t.finish('done');
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
