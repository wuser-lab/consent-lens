import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

export function verifyOffline(html) {
  const dom = new JSDOM(html);
  const document = dom.window.document;
  assert.equal(document.documentElement.dataset.offline, 'true', 'Missing offline edition marker');
  const security = document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content || '';
  for (const directive of ["default-src 'none'", "script-src 'unsafe-inline'", "style-src 'unsafe-inline'", "connect-src 'none'", "base-uri 'none'", "form-action 'none'", "frame-src 'none'", "object-src 'none'"]) {
    assert.ok(security.split(';').map(value => value.trim()).includes(directive), `Missing offline CSP directive: ${directive}`);
  }
  assert.equal(document.querySelector('meta[name="referrer"]')?.content, 'no-referrer');
  assert.equal(document.querySelectorAll('script').length, 1, 'Offline edition must contain one inline script');
  const script = document.querySelector('script');
  assert.ok(!script.hasAttribute('src') && !script.hasAttribute('type'), 'Offline script must run without modules or external files');
  assert.ok(script.textContent.length > 1000, 'Missing application bundle');
  assert.equal(document.querySelectorAll('style').length, 1, 'Missing inline stylesheet');
  assert.equal(document.querySelectorAll('[src], [srcset], [ping], link, iframe, object, embed, base, meta[http-equiv="refresh"]').length, 0, 'Offline edition contains an external asset or navigation reference');
  for (const link of document.querySelectorAll('a[href]')) {
    assert.ok(link.getAttribute('href').startsWith('#'), `Offline link points outside the file: ${link.getAttribute('href')}`);
  }
  assert.ok(!document.querySelector('#offline-download'), 'Offline edition must not offer a second offline download');
  assert.ok(!html.includes('%BASE_URL%'), 'Unresolved application base');
  const css = document.querySelector('style').textContent;
  assert.ok(!/@import\b/i.test(css), 'Offline stylesheet imports an external stylesheet');
  for (const match of css.matchAll(/url\(([^)]*)\)/gi)) {
    const source = match[1].trim().replace(/^['"]|['"]$/g, '');
    assert.ok(/^(data:|blob:)/i.test(source), 'Offline stylesheet references an external asset');
  }
  // The pinned IAB library also names an internal static method "fetch".
  // It is not the browser fetch API and its unused XHR path is blocked by CSP.
  const withoutMethodDefinitions = script.textContent.replace(/\bstatic\s+fetch\s*\([^)]*\)\s*\{/g, '');
  assert.ok(!/(?<![\w.$])fetch\s*\(/.test(withoutMethodDefinitions), 'Offline application still contains a browser fetch call');
  const notices = document.querySelector('#offline-third-party-notices pre')?.textContent || '';
  assert.ok(notices.includes('Apache License') && notices.includes('MIT License'), 'Bundled third-party license notices are missing');
  for (const name of ['synthetic-review.json', 'synthetic-restrictions.json']) {
    assert.ok(script.textContent.includes(name), `Example is not embedded: ${name}`);
    assert.ok(document.querySelector(`.import-panel a[data-example-file="${name}"]`), `Missing local example control: ${name}`);
  }
  dom.window.close();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const path = fileURLToPath(new URL('../dist/consent-lens-offline.html', import.meta.url));
  verifyOffline(await readFile(path, 'utf8'));
  console.log('Offline edition verified: inline assets, embedded examples/notices, local links, and blocked network connections.');
}
