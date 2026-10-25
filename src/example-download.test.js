import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { MAX_REPORT_BYTES } from './report-limits.js';

test('example links download validated original JSON as a Blob and preserve the current review', async () => {
  const html = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).replaceAll('%BASE_URL%', '/consent-lens/');
  const dom = new JSDOM(html, { url: 'https://wuser-lab.github.io/consent-lens/' });
  const previous = { document: globalThis.document, window: globalThis.window, fetch: globalThis.fetch, createObjectURL: URL.createObjectURL, revokeObjectURL: URL.revokeObjectURL };
  const blobs = [], downloads = [], requests = [];
  let respond;
  globalThis.document = dom.window.document;
  globalThis.window = dom.window;
  globalThis.fetch = async (url, options) => { requests.push({ url, options }); return respond(url); };
  URL.createObjectURL = blob => { blobs.push(blob); return `blob:synthetic-example-${blobs.length}`; };
  URL.revokeObjectURL = () => {};
  dom.window.HTMLAnchorElement.prototype.click = function () { downloads.push({ href: this.href, fileName: this.download }); };
  try {
    await import('./audit-ui.js');
    const $ = id => document.getElementById(id);
    $('comparison-sample').click();
    $('reviewer').value = 'Existing reviewer';
    $('decision-signal').value = 'pass';
    $('rationale-signal').value = 'Keep this current decision';
    $('evidence-signal').value = 'E1: existing evidence';
    const fields = ['before-signal', 'after-signal', 'case-id', 'reviewer', 'source', 'decision-signal', 'rationale-signal', 'evidence-signal'];
    const currentValues = fields.map(id => $(id).value);
    const links = [...document.querySelectorAll('.import-panel a[download]')];
    assert.equal(links.length, 2);
    async function click(link) {
      assert.equal(link.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })), false, 'Intercept the normal navigation');
      await new Promise(resolve => setImmediate(resolve));
      assert.deepEqual(fields.map(id => $(id).value), currentValues, 'Downloading must retain captures, context, and decisions');
      assert.equal($('comparison-results').hidden, false);
      assert.equal($('export-audit').disabled, false);
    }
    for (const [index, fileName] of ['synthetic-review.json', 'synthetic-restrictions.json'].entries()) {
      const example = await readFile(new URL(`../public/examples/${fileName}`, import.meta.url), 'utf8');
      // Keep legacy coverage and original formatting in downloaded bytes, even
      // though validation re-decodes and normalizes an independent copy.
      const legacy = JSON.parse(example);
      delete legacy.comparisonCoverage;
      legacy.context.source += ' — café';
      const originalText = ` \n${JSON.stringify(legacy, null, 2)}\n `;
      respond = () => new Response(originalText, { status: 200, headers: { 'Content-Length': String(new TextEncoder().encode(originalText).length) } });
      await click(links[index]);
      assert.deepEqual(requests.at(-1), { url: `https://wuser-lab.github.io/consent-lens/examples/${fileName}`, options: { credentials: 'omit', mode: 'same-origin' } });
      assert.equal(downloads.at(-1).fileName, fileName);
      assert.equal(downloads.at(-1).href, `blob:synthetic-example-${index + 1}`);
      assert.equal(blobs.at(-1).type, 'application/json');
      assert.equal(await blobs.at(-1).text(), originalText, 'Download the original text rather than the normalized report');
      assert.match($('import-status').textContent, /Synthetic example downloaded\. Use Resume a saved review to choose it/);
    }
    const successfulDownloads = downloads.length;
    for (const response of [
      () => new Response('Not found', { status: 404 }),
      () => new Response('not JSON', { status: 200 }),
      () => ({ ok: true, status: 200, headers: new Headers({ 'Content-Length': String(MAX_REPORT_BYTES + 1) }), text: async () => { assert.fail('Oversized advertised response must be rejected before reading'); } }),
      () => new Response('界'.repeat(Math.ceil(MAX_REPORT_BYTES / 3)), { status: 200 }),
      () => { throw new Error('Connection unavailable'); },
    ]) {
      respond = response;
      await click(links[0]);
      assert.equal(downloads.length, successfulDownloads, 'Invalid examples must not trigger a download');
      assert.match($('import-status').textContent, /Synthetic example not downloaded:/);
      assert.match($('import-status').textContent, /Current review retained/);
    }
    const previousRequests = requests.length;
    links[0].href = 'https://example.com/another-example.json';
    await click(links[0]);
    assert.equal(requests.length, previousRequests, 'Only same-origin example assets may be fetched');
    assert.match($('import-status').textContent, /must come from this site/);
    assert.equal(document.querySelector('img'), null);
  } finally {
    globalThis.document = previous.document;
    globalThis.window = previous.window;
    globalThis.fetch = previous.fetch;
    URL.createObjectURL = previous.createObjectURL;
    URL.revokeObjectURL = previous.revokeObjectURL;
    dom.window.close();
  }
});
