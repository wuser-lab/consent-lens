import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { SYNTHETIC_VENDOR_LIST, SYNTHETIC_VENDOR_SIGNAL } from './vendor-demo.js';
import { CHECKS } from './review.js';

// Execute the real entry module and handlers. Node does not load CSS, so omit
// only that styling import and resolve the remaining JS imports to file URLs.
async function loadEntry() {
  const main = (await readFile(new URL('./main.js', import.meta.url), 'utf8'))
    .replace("import './style.css';\n", '')
    .replace(/from '(\.\/[^']+)'/g, (_, relative) => `from '${new URL(relative, import.meta.url).href}'`)
    .replace(/import '(\.\/[^']+)'/g, (_, relative) => `import '${new URL(relative, import.meta.url).href}'`);
  await import(`data:text/javascript;base64,${Buffer.from(main).toString('base64')}`);
}

test('all export flows redact by default, full details apply once, and privacy choices preserve work', async () => {
  const html = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).replaceAll('%BASE_URL%', '/consent-lens/');
  const dom = new JSDOM(html, { url: 'https://wuser-lab.github.io/consent-lens/' });
  const previous = { document: globalThis.document, window: globalThis.window, fetch: globalThis.fetch, createObjectURL: URL.createObjectURL, revokeObjectURL: URL.revokeObjectURL };
  globalThis.document = dom.window.document;
  globalThis.window = dom.window;
  let networkRequests = 0;
  globalThis.fetch = async () => { networkRequests++; throw new Error('Exports must not make network requests'); };
  const downloads = [];
  const blobs = new Map();
  URL.createObjectURL = blob => { const href = `blob:privacy-test-${blobs.size + 1}`; blobs.set(href, blob); return href; };
  URL.revokeObjectURL = () => {};
  dom.window.HTMLAnchorElement.prototype.click = function () { downloads.push({ fileName: this.download, blob: blobs.get(this.href) }); };
  try {
    await loadEntry();
    const $ = id => document.getElementById(id);
    const chooseFull = () => {
      $('export-privacy').value = 'full';
      $('export-privacy').dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    };
    assert.equal($('export-privacy').value, 'redacted');
    assert.match($('export-audit').textContent, /redacted/i);
    assert.match($('privacy-panel').textContent, /Counts may still be linkable/);
    assert.match($('privacy-panel').textContent, /cannot be reopened/);
    assert.match($('visitor-privacy').textContent, /IP addresses/);
    assert.equal($('offline-download').getAttribute('href'), '/consent-lens/consent-lens-offline.html');
    $('comparison-sample').click();
    const privateValues = {
      'case-id': 'PRIVATE-CASE-78342', reviewer: 'PRIVATE-REVIEWER-MARA', source: 'https://private-source.example/audit-78342',
      action: 'PRIVATE-ACTION-CLICK', 'controls-version': 'PRIVATE-REFERENCE-78342', 'evidence-notes': 'PRIVATE-NOTES-78342',
      'before-time': '2026-10-24T10:00:00', 'after-time': '2026-10-24T10:01:00',
    };
    for (const [id, value] of Object.entries(privateValues)) $(id).value = value;
    for (const check of CHECKS) {
      $(`decision-${check.id}`).value = 'pass';
      $(`rationale-${check.id}`).value = `PRIVATE-RATIONALE-${check.id}`;
      $(`evidence-${check.id}`).value = `PRIVATE-EVIDENCE-${check.id}`;
    }
    $('rationale-capture').dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    assert.equal($('review-state').textContent, 'Reviewed');
    $('signal').value = SYNTHETIC_VENDOR_SIGNAL;
    $('form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    assert.equal($('results').hidden, false);
    const list = structuredClone(SYNTHETIC_VENDOR_LIST);
    list.vendors[2].name = 'PRIVATE-VENDOR-NAME-78342';
    const vendorSource = JSON.stringify(list);
    Object.defineProperty($('vendor-list-file'), 'files', { configurable: true, value: [{ name: 'PRIVATE-VENDOR-FILE-78342.json', size: vendorSource.length, text: async () => vendorSource }] });
    await new Promise(resolve => {
      const observer = new dom.window.MutationObserver(() => {
        if (!$('vendor-list-status').textContent.startsWith('Reading')) { observer.disconnect(); resolve(); }
      });
      observer.observe($('vendor-list-status'), { childList: true, subtree: true });
      $('vendor-list-file').dispatchEvent(new dom.window.Event('change'));
    });
    $('vendor-target').value = 'single';
    $('vendor-run').click();
    assert.equal($('vendor-results').hidden, false);
    const fieldIds = [...Object.keys(privateValues), 'before-signal', 'after-signal', 'signal', ...CHECKS.flatMap(check => [`decision-${check.id}`, `rationale-${check.id}`, `evidence-${check.id}`])];
    const snapshot = () => fieldIds.map(id => $(id).value);
    const currentWork = snapshot();
    const sensitive = [...Object.values(privateValues), $('before-signal').value, $('after-signal').value, SYNTHETIC_VENDOR_SIGNAL, 'PRIVATE-RATIONALE', 'PRIVATE-EVIDENCE', 'PRIVATE-VENDOR-NAME', 'PRIVATE-VENDOR-FILE', '2026-10-', '2020-03-12'];
    function assertPrivateDetailsOmitted(text) {
      for (const value of sensitive) assert.ok(!text.includes(value), `Summary exposed ${value}`);
      assert.deepEqual(snapshot(), currentWork, 'Exporting must not clear or alter the current review');
    }
    async function download(id, fileName) {
      const count = downloads.length;
      $(id).click();
      assert.equal(downloads.length, count + 1);
      const result = downloads.at(-1);
      assert.equal(result.fileName, fileName);
      const text = await result.blob.text();
      assert.deepEqual(snapshot(), currentWork);
      return text;
    }
    async function redacted(id, fileName, kind) {
      const text = await download(id, fileName);
      assertPrivateDetailsOmitted(text);
      const summary = JSON.parse(text);
      assert.equal(summary.reportType, 'redacted-summary');
      assert.equal(summary.kind, kind);
      for (const field of ['context', 'captures', 'comparison', 'rows', 'source', 'cmpId', 'vendorListVersion', 'created', 'updated', 'exportedAt', 'vendorDisclosedIds']) assert.equal(summary[field], undefined);
      return summary;
    }
    const auditSummary = await redacted('export-audit', 'consent-summary.json', 'audit');
    assert.equal(auditSummary.summary.flagChanges, 2);
    const markdown = await download('export-markdown', 'consent-summary.md');
    assertPrivateDetailsOmitted(markdown);
    assert.match(markdown, /redacted summary/i);
    const signalSummary = await redacted('export', 'signal-summary.json', 'signal');
    assert.ok(signalSummary.summary.vendorsDisclosedCount > 0);
    const vendorSummary = await redacted('vendor-export', 'vendor-summary.json', 'vendor');
    assert.equal(vendorSummary.summary.referencedVendorCount, 4);
    // One full audit download must not leave full mode active for another flow.
    chooseFull();
    assert.deepEqual(snapshot(), currentWork, 'Changing privacy must not reset decisions or notes');
    assert.match($('export-audit').textContent, /full/i);
    const fullAudit = JSON.parse(await download('export-audit', 'consent-review.json'));
    assert.equal(fullAudit.context.caseId, privateValues['case-id']);
    assert.equal(fullAudit.context.reviewer, privateValues.reviewer);
    assert.equal(fullAudit.captures.before, $('before-signal').value);
    assert.equal(fullAudit.checks[0].rationale, 'PRIVATE-RATIONALE-capture');
    assert.equal($('export-privacy').value, 'redacted');
    assert.match($('export-audit').textContent, /redacted/i);
    await redacted('vendor-export', 'vendor-summary.json', 'vendor');
    await redacted('export', 'signal-summary.json', 'signal');
    chooseFull();
    const fullMarkdown = await download('export-markdown', 'consent-review.md');
    assert.match(fullMarkdown, /PRIVATE-CASE-78342/);
    assert.equal($('export-privacy').value, 'redacted');
    chooseFull();
    const fullSignal = JSON.parse(await download('export', 'consent-report.json'));
    assert.equal(fullSignal.cmpId, 358);
    assert.ok(fullSignal.vendorDisclosedIds.length > 0);
    assert.equal($('export-privacy').value, 'redacted');
    chooseFull();
    const fullVendor = JSON.parse(await download('vendor-export', 'vendor-membership-check.json'));
    assert.equal(fullVendor.source.fileName, 'PRIVATE-VENDOR-FILE-78342.json');
    assert.ok(fullVendor.rows.some(row => row.id === 2 && row.name === 'PRIVATE-VENDOR-NAME-78342'));
    assert.equal($('export-privacy').value, 'redacted');
    // Even an export failure consumes full mode rather than arming a later click.
    const createURL = URL.createObjectURL;
    URL.createObjectURL = () => { throw new Error('Download unavailable'); };
    chooseFull();
    const count = downloads.length;
    $('export-audit').click();
    assert.equal(downloads.length, count);
    assert.equal($('export-privacy').value, 'redacted');
    assert.match($('report-readiness').textContent, /Download unavailable/);
    URL.createObjectURL = createURL;
    await redacted('export', 'signal-summary.json', 'signal');
    // Missing controls fail closed across all three flows.
    $('export-privacy').remove();
    await redacted('export-audit', 'consent-summary.json', 'audit');
    await redacted('export', 'signal-summary.json', 'signal');
    await redacted('vendor-export', 'vendor-summary.json', 'vendor');
    assert.equal(networkRequests, 0);
  } finally {
    globalThis.document = previous.document;
    globalThis.window = previous.window;
    globalThis.fetch = previous.fetch;
    URL.createObjectURL = previous.createObjectURL;
    URL.revokeObjectURL = previous.revokeObjectURL;
    dom.window.close();
  }
});
