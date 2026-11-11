// Hawkes release notes on a product site: the version label and the visual "What's new" cards, from the site's
// releases.json (written by Hawkes Studio at every go live: hawkesstudio/src/releases.ts). Extended here for Yooba Land's
// picture cards (optional image / clip / alt on each release). A fork of hawkesstudio/clients/web/hawkes-release.js.
//
//   <script src="js/hawkes-release.js" data-releases="releases.json" defer></script>
//
//   [data-hawkes-version]   gets the current version: "v1.4.0" (with " · beta" on the beta site and locally);
//                           its title says the build and date. data-prefix replaces the "v" (e.g. "Version ").
//   [data-hawkes-releases]  gets every release, newest first, as picture cards. data-limit shows only the newest n.
//                           data-expand="first" (default) opens the newest; "all" opens every card; "none" opens none.
//   window.hawkesRelease    a promise of the releases file (or null), for games that show the version in their own menu.
//
// data-releases is relative to the page (a page in Game/ uses "../releases.json"). No dependencies.
(function () {
  var script = document.currentScript;
  var src = (script && script.getAttribute('data-releases')) || 'releases.json';
  var base = src.replace(/[^/]+$/, '') || './';
  var host = location.hostname;
  var beta = /\.hawkesgen\.ai$/.test(host) || host === 'localhost' || host === '127.0.0.1' || location.protocol === 'file:';
  var NOTE_CAP = 5;

  function date(d) {
    var t = Date.parse(d + 'T12:00:00Z');
    return isNaN(t) ? d || '' : new Date(t).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function resolve(path) {
    if (!path) return '';
    if (/^(https?:|data:|\/)/i.test(path)) return path;
    return base + path.replace(/^\.\//, '');
  }
  function mediaFor(r) {
    var wrap = el('div', 'hawkes-release-media');
    var imgPath = resolve(r.image);
    var clipPath = resolve(r.clip);
    var alt = r.alt || ('Yooba Land ' + (r.version ? 'v' + r.version : 'release'));
    if (clipPath) {
      var v = document.createElement('video');
      v.className = 'hawkes-release-clip';
      v.setAttribute('muted', '');
      v.muted = true;
      v.setAttribute('playsinline', '');
      v.setAttribute('loop', '');
      v.setAttribute('preload', 'metadata');
      v.setAttribute('aria-label', alt);
      if (imgPath) v.setAttribute('poster', imgPath);
      var source = document.createElement('source');
      source.src = clipPath;
      source.type = 'video/mp4';
      v.appendChild(source);
      if (imgPath) {
        var fallback = document.createElement('img');
        fallback.src = imgPath;
        fallback.alt = alt;
        fallback.width = 1280;
        fallback.height = 720;
        fallback.loading = 'lazy';
        fallback.decoding = 'async';
        v.appendChild(fallback);
      }
      wrap.appendChild(v);
      if (!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) {
        v.setAttribute('autoplay', '');
        var play = function () { v.play().catch(function () {}); };
        if (v.readyState >= 2) play();
        else v.addEventListener('loadeddata', play, { once: true });
      }
    } else if (imgPath) {
      var img = document.createElement('img');
      img.src = imgPath;
      img.alt = alt;
      img.width = 1280;
      img.height = 720;
      img.loading = 'lazy';
      img.decoding = 'async';
      wrap.appendChild(img);
    } else {
      wrap.classList.add('hawkes-release-media-empty');
      wrap.setAttribute('aria-hidden', 'true');
    }
    return wrap;
  }
  function card(r, open) {
    var sec = el('article', 'hawkes-release' + (open ? ' is-open' : ''));
    sec.setAttribute('data-version', r.version || '');

    var chip = el('p', 'hawkes-release-chip');
    chip.appendChild(el('span', 'hawkes-release-version', 'v' + r.version));
    var t = el('time', 'hawkes-release-date', date(r.date));
    t.setAttribute('datetime', r.date || '');
    chip.appendChild(t);

    var head = el('div', 'hawkes-release-head');
    head.appendChild(chip);
    if (r.title) head.appendChild(el('h3', 'hawkes-release-title', r.title));

    var toggle = el('button', 'hawkes-release-toggle');
    toggle.type = 'button';
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.appendChild(mediaFor(r));
    toggle.appendChild(head);
    sec.appendChild(toggle);

    var body = el('div', 'hawkes-release-body');
    var ul = el('ul', 'hawkes-release-notes');
    var notes = (r.notes || []).slice(0, NOTE_CAP);
    if (!notes.length) notes = ['Improvements and fixes.'];
    for (var m = 0; m < notes.length; m++) ul.appendChild(el('li', null, notes[m]));
    body.appendChild(ul);
    var play = el('a', 'play hawkes-release-play');
    play.href = './Game/';
    play.innerHTML = '<span class="play-icon" aria-hidden="true"></span>Play';
    body.appendChild(play);
    sec.appendChild(body);

    toggle.addEventListener('click', function () {
      var next = !sec.classList.contains('is-open');
      sec.classList.toggle('is-open', next);
      toggle.setAttribute('aria-expanded', next ? 'true' : 'false');
    });
    return sec;
  }
  function fill(data) {
    var top = data && data.releases && data.releases[0];
    var nodes = document.querySelectorAll('[data-hawkes-version]');
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (!top) { n.hidden = true; continue; }
      var prefix = n.getAttribute('data-prefix');
      n.textContent = (prefix == null ? 'v' : prefix) + top.version + (beta ? ' · beta' : '');
      n.title = [top.build ? 'build ' + top.build : '', date(top.date)].filter(Boolean).join(' · ');
      n.hidden = false;
    }
    var lists = document.querySelectorAll('[data-hawkes-releases]');
    for (var j = 0; j < lists.length; j++) {
      var box = lists[j];
      var limit = parseInt(box.getAttribute('data-limit') || '0', 10);
      var expand = (box.getAttribute('data-expand') || 'first').toLowerCase();
      var rel = (data && data.releases) || [];
      if (limit > 0) rel = rel.slice(0, limit);
      box.textContent = '';
      box.classList.add('hawkes-release-list');
      if (!rel.length) { box.appendChild(el('p', 'hawkes-release-empty', 'Nothing here yet.')); continue; }
      for (var k = 0; k < rel.length; k++) {
        var open = expand === 'all' || (expand === 'first' && k === 0);
        box.appendChild(card(rel[k], open));
      }
    }
  }

  window.hawkesRelease = fetch(src, { cache: 'no-cache' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .catch(function () { return null; });
  function go() { window.hawkesRelease.then(fill); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go);
  else go();
})();
