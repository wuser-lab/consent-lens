import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { getEmbeddedExample, EMBEDDED_EXAMPLE_NAMES } from './embedded-examples.js';

test('bundled examples download without network requests or changes to the current review', async () => {
  const html = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).replaceAll('%BASE_URL%', '/consent-lens/');
  const dom = new JSDOM(html, { url: 'https://wuser-lab.github.io/consent-lens/' });
  const previous = { document: globalThis.document, window: globalThis.window, fetch: globalThis.fetch, createObjectURL: URL.createObjectURL, revokeObjectURL: URL.revokeObjectURL };
  const blobs = [], downloads = [];
  let requests = 0;
  globalThis.document = dom.window.document;
  globalThis.window = dom.window;
  globalThis.fetch = () => { requests++; throw new Error('Examples must not use the network'); };
  URL.createObjectURL = blob => { blobs.push(blob); return `blob:example-${blobs.length}`; };
  URL.revokeObjectURL = () => {};
  dom.window.HTMLAnchorElement.prototype.click = function () { downloads.push({ href: this.href, fileName: this.download }); };
  try {
    await import('./audit-ui.js');
    const $ = id => document.getElementById(id);
    $('comparison-sample').click();
    $('reviewer').value = 'Existing private reviewer';
    $('decision-signal').value = 'pass';
    $('rationale-signal').value = 'Keep this current decision';
    $('evidence-signal').value = 'E1: private evidence';
    $('export-privacy').value = 'full';
    const fields = ['before-signal', 'after-signal', 'case-id', 'reviewer', 'source', 'decision-signal', 'rationale-signal', 'evidence-signal', 'export-privacy'];
    const values = fields.map(id => $(id).value);
    const links = [...document.querySelectorAll('.import-panel a[download]')];
    assert.equal(links.length, EMBEDDED_EXAMPLE_NAMES.length);
    const click = link => {
      assert.equal(link.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })), false);
      assert.deepEqual(fields.map(id => $(id).value), values);
    };
    for (const [index, fileName] of ['synthetic-review.json', 'synthetic-restrictions.json'].entries()) {
      const original = await readFile(new URL(`../public/examples/${fileName}`, import.meta.url), 'utf8');
      assert.equal(getEmbeddedExample(fileName), original);
      click(links[index]);
      assert.equal(downloads.at(-1).fileName, fileName);
      assert.equal(await blobs.at(-1).text(), original);
      assert.match($('import-status').textContent, /Synthetic example downloaded/);
    }
    const successes = downloads.length;
    links[0].href = 'https://example.com/private.json';
    click(links[0]);
    assert.equal(downloads.length, successes);
    assert.match($('import-status').textContent, /must come from this site/);
    links[0].href = 'https://wuser-lab.github.io/consent-lens/examples/not-bundled.json';
    click(links[0]);
    assert.equal(downloads.length, successes);
    assert.match($('import-status').textContent, /not bundled/);
    assert.equal(getEmbeddedExample('__proto__'), undefined);
    assert.equal(getEmbeddedExample('constructor'), undefined);
    assert.equal(requests, 0);
  } finally {
    globalThis.document = previous.document; globalThis.window = previous.window;
    globalThis.fetch = previous.fetch;
    URL.createObjectURL = previous.createObjectURL; URL.revokeObjectURL = previous.revokeObjectURL;
    dom.window.close();
  }
});
