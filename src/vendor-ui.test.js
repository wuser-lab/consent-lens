import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { SYNTHETIC_VENDOR_LIST } from './vendor-demo.js';

test('vendor lookup filters names safely, blocks mismatches, and invalidates changed signals', { timeout: 5000 }, async () => {
  const dom = new JSDOM(await readFile(new URL('../index.html', import.meta.url), 'utf8'), { url: 'http://localhost/' });
  const previous = { document: globalThis.document, window: globalThis.window };
  globalThis.document = dom.window.document; globalThis.window = dom.window;
  try {
    await import('./vendor-ui.js');
    const $ = id => document.getElementById(id);
    $('vendor-demo').click();
    assert.equal($('vendor-results').hidden, false);
    assert.equal($('vendor-rows').children.length, 4);
    assert.match($('vendor-row-count').textContent, /1 not listed/);
    $('vendor-filter').value = 'Exchange';
    $('vendor-filter').dispatchEvent(new dom.window.Event('input'));
    assert.equal($('vendor-rows').children.length, 1);
    $('signal').dispatchEvent(new dom.window.Event('input'));
    assert.equal($('vendor-results').hidden, true);
    assert.equal($('vendor-export').disabled, true);
    async function load(list) {
      const source = JSON.stringify(list);
      Object.defineProperty($('vendor-list-file'), 'files', { configurable: true, value: [{ name: 'fixture.json', size: source.length, text: async () => source }] });
      await new Promise(resolve => {
        const observer = new dom.window.MutationObserver(() => {
          if (!$('vendor-list-status').textContent.startsWith('Reading')) { observer.disconnect(); resolve(); }
        });
        observer.observe($('vendor-list-status'), { childList: true, subtree: true });
        $('vendor-list-file').dispatchEvent(new dom.window.Event('change'));
      });
    }
    const list = structuredClone(SYNTHETIC_VENDOR_LIST);
    list.vendors[2].name = '<img src=x onerror=alert(1)>';
    await load(list);
    $('vendor-filter').value = '';
    $('vendor-run').click();
    assert.match($('vendor-rows').textContent, /<img src=x/);
    assert.equal(document.querySelector('img'), null);
    list.vendorListVersion++;
    await load(list);
    $('vendor-run').click();
    assert.equal($('vendor-results').hidden, true);
    assert.match($('vendor-list-status').textContent, /not compared/);
    $('vendor-clear').click();
    assert.equal($('vendor-run').disabled, true);
  } finally {
    globalThis.document = previous.document; globalThis.window = previous.window;
    dom.window.close();
  }
});
