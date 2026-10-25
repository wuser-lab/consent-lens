import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { createRestrictionSignal } from './restriction-fixtures.js';
import { buildAudit, CHECKS } from './review.js';

function signal(groups = []) {
  return createRestrictionSignal(groups.map(({ purposeId, type, vendors }) => ({
    purposeId, restrictionType: type, entries: vendors.map(id => [id]),
  })));
}

test('publisher restrictions show exact changes, invalidate stale rows, and cap the visible table', async () => {
  const dom = new JSDOM(await readFile(new URL('../index.html', import.meta.url), 'utf8'), { url: 'http://localhost/' });
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  globalThis.document = dom.window.document;
  globalThis.window = dom.window;
  try {
    await import('./audit-ui.js');
    const $ = id => document.getElementById(id);
    const submit = () => $('comparison-form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    $('before-signal').value = signal([
      { purposeId: 2, type: 0, vendors: [2] },
      { purposeId: 2, type: 1, vendors: [7] },
      { purposeId: 3, type: 2, vendors: [9] },
    ]);
    $('after-signal').value = signal([
      { purposeId: 2, type: 1, vendors: [2] },
      { purposeId: 2, type: 2, vendors: [3] },
      { purposeId: 3, type: 2, vendors: [9] },
    ]);
    submit();
    assert.equal($('comparison-results').hidden, false);
    assert.equal($('change-count').textContent, '0 flag changes · 3 restriction changes');
    assert.match($('restriction-summary').textContent, /1 added, 1 removed, 1 changed; 1 unchanged/);
    assert.deepEqual([...$('restriction-rows').rows].map(row => [...row.cells].map(cell => cell.textContent)), [
      ['2', '2', 'Not allowed', 'Require consent', 'Changed'],
      ['2', '3', 'No encoded restriction', 'Require legitimate interest', 'Added'],
      ['2', '7', 'Require consent', 'No encoded restriction', 'Removed'],
    ]);
    assert.match($('restriction-comparison').textContent, /does not establish permission to process/);
    assert.equal($('decision-signal').value, 'needs-review', 'Restriction differences do not create a reviewer verdict');
    assert.equal($('export-audit').disabled, false);
    $('after-signal').dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    assert.equal($('comparison-results').hidden, true);
    assert.equal($('restriction-rows').rows.length, 0, 'Old differences must be removed when captures change');
    assert.equal($('restriction-summary').textContent, '');
    assert.equal($('restriction-table').hidden, true);
    assert.equal($('export-audit').disabled, true);
    $('before-signal').value = $('after-signal').value = signal();
    submit();
    assert.equal($('change-count').textContent, '0 flag changes · 0 restriction changes');
    assert.match($('restriction-row-count').textContent, /No publisher-restriction changes detected/);
    assert.equal($('restriction-table').hidden, true);
    $('after-signal').value = signal([{ purposeId: 2, type: 1, vendors: Array.from({ length: 201 }, (_, index) => index + 1) }]);
    submit();
    assert.equal($('restriction-rows').rows.length, 200);
    assert.match($('restriction-row-count').textContent, /Showing 200 of 201/);
    assert.match($('restriction-row-count').textContent, /JSON export includes the complete difference table/);
    assert.match($('change-count').textContent, /201 restriction changes/);
    $('after-signal').value = signal([{ purposeId: 2, type: 0, vendors: [7] }, { purposeId: 2, type: 2, vendors: [7] }]);
    submit();
    assert.equal($('restriction-rows').rows.length, 1);
    const multipleTypes = $('restriction-rows').rows[0].cells[3].textContent;
    assert.match(multipleTypes, /multiple/i, 'Conflicting encoded types must remain explicit');
    assert.match(multipleTypes, /Not allowed/);
    assert.match(multipleTypes, /Require legitimate interest/);
    // An unparseable replacement cannot leave the previous restriction table visible.
    $('after-signal').value = 'C';
    submit();
    assert.equal($('comparison-results').hidden, true);
    assert.equal($('restriction-rows').rows.length, 0);
    assert.equal($('export-audit').disabled, true);
    const legacyReport = buildAudit({
      before: signal([{ purposeId: 2, type: 0, vendors: [7] }]),
      after: signal([{ purposeId: 2, type: 1, vendors: [7] }]), context: {},
      checks: CHECKS.map(check => ({ id: check.id, status: 'pass', rationale: 'Earlier review rationale', evidence: 'E1: earlier review' })),
    });
    delete legacyReport.comparisonCoverage;
    window.confirm = () => true;
    const savedSource = JSON.stringify(legacyReport);
    Object.defineProperty($('import-report'), 'files', { configurable: true, value: [{ size: savedSource.length, text: async () => savedSource }] });
    $('import-report').dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await new Promise(resolve => setImmediate(resolve));
    assert.match($('import-status').textContent, /Report reopened/);
    assert.match($('import-status').textContent, /restriction/i, 'New comparison coverage must be explained after an older review is imported');
    assert.equal($('decision-signal').value, 'needs-review');
    assert.equal($('rationale-signal').value, 'Earlier review rationale');
    assert.equal($('evidence-signal').value, 'E1: earlier review');
    assert.equal($('decision-capture').value, 'pass');
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
    dom.window.close();
  }
});
