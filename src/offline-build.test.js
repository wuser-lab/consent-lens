import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';
import { buildOffline } from '../scripts/build-offline.mjs';
import { verifyOffline } from '../scripts/verify-offline.mjs';
import { EMBEDDED_EXAMPLE_NAMES, getEmbeddedExample } from './embedded-examples.js';

test('single-file offline edition runs inspection, comparison, and example downloads without a server', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'consent-lens-offline-'));
  let dom;
  try {
    const outputPath = join(directory, 'consent-lens-offline.html');
    const { html } = await buildOffline({ outputPath });
    assert.equal(await readFile(outputPath, 'utf8'), html);
    verifyOffline(html);
    const errors = [];
    const networkAttempts = [];
    const downloads = [];
    const console = new VirtualConsole();
    console.on('jsdomError', error => errors.push(error.message));
    dom = new JSDOM(html, {
      url: pathToFileURL(outputPath).href,
      runScripts: 'dangerously',
      virtualConsole: console,
      beforeParse(window) {
        window.TextEncoder = TextEncoder;
        window.TextDecoder = TextDecoder;
        window.Blob = Blob;
        window.confirm = () => true;
        window.fetch = async (...args) => { networkAttempts.push(args); throw new Error('Offline edition attempted a network request'); };
        window.XMLHttpRequest = class {
          constructor() { networkAttempts.push('XMLHttpRequest'); throw new Error('Offline edition attempted an XHR request'); }
        };
        window.WebSocket = class {
          constructor() { networkAttempts.push('WebSocket'); throw new Error('Offline edition attempted a WebSocket connection'); }
        };
        window.URL.createObjectURL = blob => {
          const url = `blob:offline-test/${downloads.length}`;
          downloads.push({ blob, url });
          return url;
        };
        window.URL.revokeObjectURL = () => {};
        window.HTMLAnchorElement.prototype.click = function () {
          const download = downloads.find(item => item.url === this.href);
          if (download) download.fileName = this.download;
        };
      },
    });
    const { document, MouseEvent } = dom.window;
    document.getElementById('comparison-sample').click();
    assert.match(document.getElementById('change-count').textContent, /2 flag changes/);
    assert.equal(document.getElementById('comparison-results').hidden, false);
    document.getElementById('reviewer').value = 'OFFLINE-PRIVATE-REVIEWER';
    document.getElementById('export-audit').click();
    const summaryDownload = downloads.find(item => item.fileName === 'consent-summary.json');
    assert.ok(summaryDownload);
    const summaryText = await summaryDownload.blob.text();
    assert.equal(JSON.parse(summaryText).reportType, 'redacted-summary');
    assert.ok(!summaryText.includes('OFFLINE-PRIVATE-REVIEWER'));
    document.getElementById('export-privacy').value = 'full';
    document.getElementById('export-audit').click();
    assert.equal(document.getElementById('export-privacy').value, 'redacted');
    const fullDownload = downloads.find(item => item.fileName === 'consent-review.json');
    const fullText = await fullDownload.blob.text();
    assert.equal(JSON.parse(fullText).context.reviewer, 'OFFLINE-PRIVATE-REVIEWER');
    const importControl = document.getElementById('import-report');
    Object.defineProperty(importControl, 'files', { configurable: true, value: [{ size: fullText.length, text: async () => fullText }] });
    importControl.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await new Promise(resolve => setImmediate(resolve));
    assert.match(document.getElementById('import-status').textContent, /Report reopened/);
    assert.equal(document.getElementById('reviewer').value, 'OFFLINE-PRIVATE-REVIEWER');
    document.getElementById('inspect-tab').click();
    document.getElementById('sample').click();
    assert.match(document.getElementById('status').textContent, /Decoded successfully/);
    assert.equal(document.getElementById('results').hidden, false);
    document.getElementById('export').click();
    assert.equal(JSON.parse(await downloads.find(item => item.fileName === 'signal-summary.json').blob.text()).kind, 'signal');
    document.getElementById('vendor-demo').click();
    document.getElementById('vendor-export').click();
    assert.equal(JSON.parse(await downloads.find(item => item.fileName === 'vendor-summary.json').blob.text()).kind, 'vendor');
    for (const name of EMBEDDED_EXAMPLE_NAMES) {
      const link = document.querySelector(`.import-panel a[data-example-file="${name}"]`);
      assert.ok(link, `Missing offline example control: ${name}`);
      link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      await new Promise(resolve => setImmediate(resolve));
      const download = downloads.find(item => item.fileName === name);
      assert.ok(download, `Offline example was not downloaded: ${name}`);
      assert.equal(await download.blob.text(), getEmbeddedExample(name));
      assert.equal(getEmbeddedExample(name), await readFile(new URL(`../public/examples/${name}`, import.meta.url), 'utf8'));
    }
    assert.deepEqual(networkAttempts, []);
    assert.deepEqual(errors, []);
  } finally {
    dom?.window.close();
    await rm(directory, { recursive: true, force: true });
  }
});
