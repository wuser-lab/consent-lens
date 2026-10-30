import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { buildAudit, CHECKS } from './review.js';
import { EXAMPLE_BEFORE, EXAMPLE_AFTER } from './examples.js';

let instance = 0;
const flush = () => new Promise(resolve => setImmediate(resolve));
function report(caseId) {
  return JSON.stringify(buildAudit({ before: EXAMPLE_BEFORE, after: EXAMPLE_AFTER, context: { caseId }, checks: CHECKS.map(check => ({ id: check.id, status: 'needs-review' })) }));
}
async function workspace(t) {
  const dom = new JSDOM(await readFile(new URL('../index.html', import.meta.url), 'utf8'), { url: 'http://localhost/' });
  const previous = { document: globalThis.document, window: globalThis.window };
  globalThis.document = dom.window.document;
  globalThis.window = dom.window;
  t.after(() => {
    globalThis.document = previous.document;
    globalThis.window = previous.window;
    dom.window.close();
  });
  const confirmations = [];
  dom.window.confirm = message => { confirmations.push(message); return true; };
  await import(`./audit-ui.js?import-race=${++instance}`);
  const $ = id => dom.window.document.getElementById(id);
  function choose() {
    let resolve, reject;
    const text = new Promise((yes, no) => { resolve = yes; reject = no; });
    Object.defineProperty($('import-report'), 'files', { configurable: true, value: [{ size: 1000, text: () => text }] });
    $('import-report').dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    return { resolve, reject };
  }
  return { $, choose, confirmations };
}

test('an older read cannot import while a newer report is still loading', async t => {
  const { $, choose, confirmations } = await workspace(t);
  const older = choose();
  const newer = choose();
  older.resolve(report('OLDER'));
  await flush();
  assert.equal($('case-id').value, '');
  assert.equal($('import-status').textContent, 'Reading report locally…');
  assert.equal(confirmations.length, 0);
  newer.resolve(report('NEWER'));
  await flush();
  assert.equal($('case-id').value, 'NEWER');
  assert.match($('import-status').textContent, /Report reopened/);
});

test('a superseded read cannot overwrite the latest successful import status', async t => {
  const { $, choose, confirmations } = await workspace(t);
  const older = choose();
  const newer = choose();
  newer.resolve(report('NEWER'));
  await flush();
  const status = $('import-status').textContent;
  older.resolve(report('OLDER'));
  await flush();
  assert.equal($('case-id').value, 'NEWER');
  assert.equal($('import-status').textContent, status);
  assert.equal(confirmations.length, 0);
});

test('a superseded read failure cannot replace the latest loading status', async t => {
  const { $, choose } = await workspace(t);
  const older = choose();
  const newer = choose();
  older.reject(new Error('Older file could not be read'));
  await flush();
  assert.equal($('import-status').textContent, 'Reading report locally…');
  newer.resolve(report('NEWER'));
  await flush();
  assert.equal($('case-id').value, 'NEWER');
});

test('a rejected latest selection never falls back to a superseded file', async t => {
  const { $, choose } = await workspace(t);
  const older = choose();
  const newer = choose();
  newer.resolve('invalid JSON');
  await flush();
  const status = $('import-status').textContent;
  assert.match(status, /not valid JSON/);
  older.resolve(report('OLDER'));
  await flush();
  assert.equal($('case-id').value, '');
  assert.equal($('import-status').textContent, status);
});
