import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { buildAudit, CHECKS } from './review.js';
import { EXAMPLE_BEFORE, EXAMPLE_AFTER } from './examples.js';

test('file import restores a review, rejects bad files atomically, and honours cancellation', async () => {
  const dom = new JSDOM(await readFile(new URL('../index.html', import.meta.url), 'utf8'), { url: 'http://localhost/' });
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  globalThis.document = dom.window.document;
  globalThis.window = dom.window;
  try {
    await import('./audit-ui.js');
    const $ = id => document.getElementById(id);
    const report = buildAudit({ before: EXAMPLE_BEFORE, after: EXAMPLE_AFTER, context: { caseId: 'REOPENED', reviewer: 'Synthetic reviewer', source: '<img src=x onerror=alert(1)>', participantType: 'Other', action: 'Synthetic action', controlsVersion: 'Exploratory', beforeCapturedAt: '2026-10-24T08:00:00.123Z', afterCapturedAt: '2026-10-24T08:01:00Z' }, checks: CHECKS.map(check => ({ id: check.id, status: 'skipped', rationale: 'Synthetic example only', evidence: '' })) });
    async function choose(source) {
      const input = $('import-report');
      Object.defineProperty(input, 'files', { configurable: true, value: [{ size: source.length, text: async () => source }] });
      input.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
      await new Promise(resolve => setImmediate(resolve));
    }
    await choose(JSON.stringify(report));
    assert.equal($('case-id').value, 'REOPENED');
    assert.equal($('source').value, report.context.source);
    assert.equal(document.querySelector('img'), null, 'Imported text must not become HTML');
    assert.match($('review-state').textContent, /Reviewed · includes skips/);
    assert.equal($('decision-capture').value, 'skipped');
    assert.equal($('rationale-capture').value, 'Synthetic example only');
    assert.equal($('comparison-results').hidden, false);
    assert.match($('import-status').textContent, /Report reopened/);
    await choose('broken JSON');
    assert.equal($('case-id').value, 'REOPENED');
    assert.equal($('decision-capture').value, 'skipped');
    assert.match($('import-status').textContent, /Current review retained/);
    window.confirm = () => false;
    report.context.caseId = 'SHOULD-NOT-REPLACE';
    await choose(JSON.stringify(report));
    assert.equal($('case-id').value, 'REOPENED');
    assert.match($('import-status').textContent, /cancelled/);
    // User edits while an asynchronous file read is pending must win.
    let finishRead;
    Object.defineProperty($('import-report'), 'files', { configurable: true, value: [{ size: 100, text: () => new Promise(resolve => { finishRead = resolve; }) }] });
    $('import-report').dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    $('case-id').value = 'NEW-UNSAVED-WORK';
    $('case-id').dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    finishRead(JSON.stringify(report));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal($('case-id').value, 'NEW-UNSAVED-WORK');
    assert.match($('import-status').textContent, /review changed while the file was loading/);
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
    dom.window.close();
  }
});
