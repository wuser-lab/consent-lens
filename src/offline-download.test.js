import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

test('offline edition downloads only on request without including the current review', async () => {
  const html = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).replaceAll('%BASE_URL%', '/consent-lens/');
  const dom = new JSDOM(html, { url: 'https://wuser-lab.github.io/consent-lens/' });
  const original = { document: globalThis.document, window: globalThis.window, fetch: globalThis.fetch, create: URL.createObjectURL, revoke: URL.revokeObjectURL };
  const requests = [], blobs = [], downloads = [];
  let response;
  globalThis.document = dom.window.document; globalThis.window = dom.window;
  globalThis.fetch = async (url, options) => { requests.push({ url, options }); return response; };
  URL.createObjectURL = blob => { blobs.push(blob); return 'blob:offline-edition-test'; };
  URL.revokeObjectURL = () => {};
  dom.window.HTMLAnchorElement.prototype.click = function () { downloads.push({ name: this.download, href: this.href }); };
  try {
    await import('./offline-download.js');
    const link = document.getElementById('offline-download');
    const source = '<!doctype html><html data-offline="true"><meta http-equiv="Content-Security-Policy" content="connect-src \'none\'"></html>';
    const reviewer = document.getElementById('reviewer'); reviewer.value = 'PRIVATE-REVIEWER-SENTINEL';
    document.getElementById('export-privacy').value = 'full';
    assert.equal(requests.length, 0, 'Loading the app must not prefetch the offline edition');
    response = new Response(source, { status: 200 });
    link.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(requests, [{ url: 'https://wuser-lab.github.io/consent-lens/consent-lens-offline.html', options: { credentials: 'omit', mode: 'same-origin' } }]);
    assert.equal(await blobs[0].text(), source);
    assert.deepEqual(downloads, [{ name: 'consent-lens-offline.html', href: 'blob:offline-edition-test' }]);
    assert.equal(reviewer.value, 'PRIVATE-REVIEWER-SENTINEL');
    assert.equal(document.getElementById('export-privacy').value, 'full', 'Public package download does not consume a report choice');
    assert.match(document.getElementById('offline-download-status').textContent, /Offline edition downloaded/);
    for (const invalid of [new Response('missing', { status: 404 }), new Response('<html>Not an offline build</html>', { status: 200 })]) {
      response = invalid;
      link.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
      await new Promise(resolve => setImmediate(resolve));
      assert.equal(downloads.length, 1);
      assert.match(document.getElementById('offline-download-status').textContent, /not downloaded/);
      assert.equal(reviewer.value, 'PRIVATE-REVIEWER-SENTINEL');
    }
    const previousRequests = requests.length;
    link.href = 'https://example.com/offline.html';
    link.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(requests.length, previousRequests);
    assert.equal(downloads.length, 1);
  } finally {
    globalThis.document = original.document; globalThis.window = original.window; globalThis.fetch = original.fetch;
    URL.createObjectURL = original.create; URL.revokeObjectURL = original.revoke;
    dom.window.close();
  }
});
