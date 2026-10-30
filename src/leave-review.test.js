import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

let instance = 0;
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
  await import(`./audit-ui.js?leave-review=${++instance}`);
  const $ = id => dom.window.document.getElementById(id);
  const edit = (id, value, event = 'input') => {
    $(id).value = value;
    $(id).dispatchEvent(new dom.window.Event(event, { bubbles: true }));
  };
  const warns = () => {
    const event = new dom.window.Event('beforeunload', { cancelable: true });
    dom.window.dispatchEvent(event);
    return event.defaultPrevented;
  };
  return { $, edit, warns, dom };
}

test('empty reviews do not warn and clearing all entries removes the warning', async t => {
  const { edit, warns } = await workspace(t);
  assert.equal(warns(), false);
  edit('evidence-notes', 'Keep this evidence reference.');
  assert.equal(warns(), true);
  edit('evidence-notes', '');
  assert.equal(warns(), false);
});

test('invalid captures, context-only entries, and change-only controls are protected', async t => {
  const { edit, warns } = await workspace(t);
  for (const [id, value, event] of [
    ['before-signal', 'not decoded yet', 'input'],
    ['reviewer', 'Reviewer name', 'input'],
    ['participant-type', 'Other', 'change'],
    ['before-time', '2026-10-30T10:00', 'change'],
    ['rationale-capture', 'An unfinished decision.', 'input'],
    ['evidence-capture', 'E1', 'input'],
    ['decision-capture', 'skipped', 'change'],
  ]) {
    edit(id, value, event);
    assert.equal(warns(), true, id);
    edit(id, id === 'participant-type' ? 'unspecified' : id === 'decision-capture' ? 'needs-review' : '', event);
    assert.equal(warns(), false, id);
  }
});

test('synthetic reviews remain protected while viewing single-string inspection', async t => {
  const { $, warns } = await workspace(t);
  $('comparison-sample').click();
  assert.equal(warns(), true);
  $('inspect-tab').click();
  assert.equal(warns(), true);
});

test('reopening a report protects restored entries and download attempts keep the warning', async t => {
  const { $, warns, dom } = await workspace(t);
  const text = await readFile(new URL('../public/examples/synthetic-review.json', import.meta.url), 'utf8');
  Object.defineProperty($('import-report'), 'files', { value: [{ size: text.length, text: async () => text }] });
  $('import-report').dispatchEvent(new dom.window.Event('change'));
  await new Promise(resolve => setImmediate(resolve));
  assert.match($('import-status').textContent, /Report reopened/);
  assert.equal(warns(), true);
  const createURL = URL.createObjectURL;
  URL.createObjectURL = () => { throw new Error('Download cancelled'); };
  t.after(() => { URL.createObjectURL = createURL; });
  $('export-audit').click();
  assert.equal(warns(), true);
  $('export-privacy').value = 'full';
  $('export-audit').click();
  assert.equal(warns(), true);
});
