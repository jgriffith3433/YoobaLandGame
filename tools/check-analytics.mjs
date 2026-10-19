// Hawkes Analytics on every page, nothing else: `npm run check`.
// Each site page (Game/v<n>/ is Unity's build output and is left out) loads Gen's SDK exactly once with product
// yoobaland and no other tracker; the game page sets window.HAWKES_BUILD before it; the Play buttons send play_click;
// the privacy page says what is collected.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SDK = 'https://gen.hawkesgen.com/sdk/analytics@1.js';
const TRACKERS = /goatcounter|umami|gtag\(|googletagmanager|google-analytics|plausible|clarity\.ms|hotjar|fbq\(|connect\.facebook|segment\.com|mixpanel|amplitude|posthog|matomo|piwik|cloudflareinsights|statcounter|yandex|tiktok|linkedin\.com\/insight|doubleclick/i;
const problems = [];

function pages(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    const rel = path.relative(root, p).split(path.sep).join('/');
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name.startsWith('.') || /^Game\/v/.test(rel)) continue;
      out.push(...pages(p));
    } else if (e.name.endsWith('.html')) out.push(rel);
  }
  return out;
}

const list = pages(root);
for (const rel of list) {
  const html = fs.readFileSync(path.join(root, rel), 'utf8');
  const tags = html.match(/<script\b[^>]*analytics@1\.js[^>]*>/g) || [];
  if (tags.length !== 1) problems.push(`${rel}: ${tags.length} Hawkes Analytics script tags (want 1)`);
  for (const t of tags) {
    if (!t.includes(`src="${SDK}"`)) problems.push(`${rel}: SDK not from ${SDK}`);
    if (!t.includes('data-product="yoobaland"')) problems.push(`${rel}: SDK without data-product="yoobaland"`);
    if (!/\bdata-hawkes-analytics\b/.test(t)) problems.push(`${rel}: SDK tag without data-hawkes-analytics (the Unity bridge would add a second)`);
  }
  const head = html.indexOf('</head>');
  if (head < 0 || html.indexOf(SDK) > head) problems.push(`${rel}: SDK not in <head>`);
  const m = TRACKERS.exec(html);
  if (m) problems.push(`${rel}: another tracker (${m[0]})`);
  for (const t of ['html', 'head', 'body']) {
    if ((html.match(new RegExp(`<${t}[\\s>]`, 'g')) || []).length !== 1 || (html.match(new RegExp(`</${t}>`, 'g')) || []).length !== 1) problems.push(`${rel}: <${t}> not opened and closed once`);
  }
  if (html.includes('href="/Game/"') && !html.includes('src="/site/site.js"')) problems.push(`${rel}: has Play links but no site.js (no play_click)`);
}

for (const f of ['site/site.js', 'js/hawkes-release.js']) {
  const js = fs.readFileSync(path.join(root, f), 'utf8');
  const m = TRACKERS.exec(js);
  if (m) problems.push(`${f}: another tracker (${m[0]})`);
}
if (!/track\("play_click"/.test(fs.readFileSync(path.join(root, 'site/site.js'), 'utf8'))) problems.push('site/site.js: no play_click');

const game = fs.readFileSync(path.join(root, 'Game/index.html'), 'utf8');
const buildAt = game.indexOf('window.HAWKES_BUILD =');
if (buildAt < 0 || buildAt > game.indexOf(SDK)) problems.push('Game/index.html: window.HAWKES_BUILD not set before the SDK');

const privacy = fs.readFileSync(path.join(root, 'privacypolicy.html'), 'utf8');
for (const [what, re] of [['anonymous statistics', /anonymous statistics/i], ['no cookies', /No cookies/], ['no personal data', /No personal data/], ['no IP stored', /No IP address stored/]]) {
  if (!re.test(privacy)) problems.push(`privacypolicy.html: doesn't say ${what}`);
}

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`Hawkes Analytics: ${list.length} pages, one SDK each, no other tracker. OK`);
