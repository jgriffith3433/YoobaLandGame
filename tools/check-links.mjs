// Every local page link (href/src ending .html or /) on every site page must point at a file in the repo: `npm run check:links`.
// Catches a renamed or deleted page (Contact, What's new, blog posts) before it becomes a dead nav link.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
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

for (const rel of pages(root)) {
  const html = fs.readFileSync(path.join(root, rel), 'utf8');
  for (const m of html.matchAll(/\b(?:href|src)="([^"]*)"/g)) {
    const url = m[1].split('#')[0].split('?')[0];
    if (!url || /^([a-z][a-z0-9+.-]*:|\/\/)/i.test(url) || url.startsWith('data:')) continue;
    if (url.startsWith('/')) { problems.push(`${rel}: root-absolute link ${m[1]} (404s under the beta path prefix; use ./ or ../)`); continue; }
    if (!/\.html$/.test(url) && !url.endsWith("/")) continue; // pages only: assets may be sparse or LFS
    let target = path.resolve(root, path.dirname(rel), decodeURIComponent(url));
    if (url.endsWith('/') || (fs.existsSync(target) && fs.statSync(target).isDirectory())) target = path.join(target, 'index.html');
    if (!fs.existsSync(target)) problems.push(`${rel}: ${m[1]} -> missing ${path.relative(root, target)}`);
  }
}

if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log('links ok');
