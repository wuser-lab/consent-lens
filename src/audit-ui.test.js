import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { CHECKS } from './review.js';

test('changing audit context invalidates decisions while retaining evidence and comparison', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const dom = new JSDOM(html, { url: 'http://localhost/' });
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  globalThis.document = dom.window.document;
  globalThis.window = dom.window;
  try {
    await import('./audit-ui.js');
    const $ = id => document.getElementById(id);
    $('comparison-sample').click();
    $('reviewer').value = 'Synthetic reviewer';
    $('before-time').value = '2026-10-24T10:00:00';
    $('after-time').value = '2026-10-24T10:01:00';
    function finishReview() {
      for (const check of CHECKS) {
        $(`decision-${check.id}`).value = 'pass';
        $(`rationale-${check.id}`).value = 'Verified synthetic fixture';
        $(`evidence-${check.id}`).value = 'E1: synthetic example';
      }
      $('rationale-capture').dispatchEvent(new dom.window.Event('input', { bubbles: true }));
      assert.equal($('review-state').textContent, 'Reviewed');
    }
    for (const [id, value, event] of [
      ['source', 'Another app', 'input'],
      ['action', 'Reject all', 'input'],
      ['before-time', '2026-10-24T09:00:00', 'change'],
      ['participant-type', 'Web vendor', 'change'],
      ['controls-version', 'Updated reference', 'input'],
      ['evidence-notes', 'Revised evidence index', 'input'],
    ]) {
      finishReview();
      $(id).value = value;
      $(id).dispatchEvent(new dom.window.Event(event, { bubbles: true }));
      assert.match($('review-state').textContent, /Draft/, `${id} should invalidate review`);
      assert.equal($('comparison-results').hidden, false);
      assert.equal($('export-audit').disabled, false, 'Draft export remains available');
      for (const check of CHECKS) {
        assert.equal($(`decision-${check.id}`).value, 'needs-review');
        assert.equal($(`rationale-${check.id}`).value, 'Verified synthetic fixture');
        assert.equal($(`evidence-${check.id}`).value, 'E1: synthetic example');
      }
    }
    finishReview();
    $('rationale-capture').value = 'Updated review rationale';
    $('rationale-capture').dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    assert.equal($('review-state').textContent, 'Reviewed', 'Editing the review itself must preserve decisions');
  } finally {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
    dom.window.close();
  }
});
