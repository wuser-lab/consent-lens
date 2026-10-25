import test from 'node:test';
import assert from 'node:assert/strict';
import { redactAudit, redactSignal, redactVendor, redactedMarkdown } from './redaction.js';
import { GROUPS, FIELDS } from './review.js';
import { parseAuditReport } from './import-report.js';

const SECRET = 'REDACTION_CANARY_7c5d9f';
const RAW_SIGNAL = 'COwK6gaOwK6gaFmAAAENAPCAAAAAAAAAAAAAAAAAAAAA';
const SECRET_DATE = '2037-09-23T12:34:56.789Z';
const ID_VALUES = [43210, 54321, 55556];

function signal() {
  return {
    version: 2, cmpId: 43210, cmpVersion: 54321, policyVersion: 55, vendorListVersion: 1234,
    language: SECRET, created: SECRET_DATE, updated: SECRET_DATE, serviceSpecific: true,
    purposeConsentIds: [3, 8], purposeLegitimateInterestIds: [2],
    vendorConsentIds: [...ID_VALUES], vendorLegitimateInterestIds: [54321],
    vendorDisclosedIds: [43210, 54321], vendorAllowedIds: [55556],
    vendorDisclosureSegmentPresent: true, vendorAllowedSegmentPresent: false,
    specialFeatureOptinIds: [1, 2],
    publisherRestrictions: [
      { purposeId: 4, vendorId: 43210, restrictionTypes: [0, 1], extra: SECRET },
      { purposeId: 8, vendorId: 54321, restrictionTypes: [2] },
    ],
    notes: [SECRET], rawSignal: RAW_SIGNAL, source: { fileName: SECRET, sha256: SECRET },
    extra: { nested: { author: 'wuser-lab', value: SECRET } },
  };
}

function audit() {
  return {
    tool: 'Consent Lens', schemaVersion: '1.0', comparisonCoverage: SECRET,
    exportedAt: SECRET_DATE, reviewer: SECRET, author: 'wuser-lab',
    context: { caseId: SECRET, reviewer: SECRET, source: `https://example.invalid/${SECRET}`, action: SECRET, controlsVersion: SECRET, evidenceNotes: SECRET, beforeCapturedAt: SECRET_DATE, afterCapturedAt: SECRET_DATE },
    captures: { before: RAW_SIGNAL, after: `${RAW_SIGNAL}.IAAA` },
    comparison: {
      before: signal(), after: signal(), rawStringsEqual: false, totalFlagChanges: 3,
      groups: Object.entries(GROUPS).map(([key], index) => ({
        key, label: SECRET, comparable: true,
        added: index === 0 ? [43210, 54321] : [], removed: index === 0 ? [55556] : [],
        unchangedCount: index === 0 ? 3 : 0, nested: { value: SECRET },
      })),
      metadata: [
        { key: 'cmpId', label: SECRET, before: SECRET, after: SECRET, changed: true },
        { key: 'language', label: SECRET, before: SECRET, after: SECRET, changed: true },
        { key: SECRET, label: SECRET, before: SECRET, after: SECRET, changed: true },
      ],
      publisherRestrictions: { addedCount: 1, removedCount: 2, changedCount: 3, unchangedCount: 4, totalChanges: 6, rows: [{ purposeId: 4, vendorId: 43210, before: [0], after: [2], extra: SECRET }] },
    },
    reviewState: 'draft', outcome: 'incomplete',
    checks: ['pass', 'fail', 'skipped', 'needs-review'].map((status, index) => ({ id: ['capture', 'signal', 'metadata', 'evidence'][index], status, title: SECRET, description: SECRET, rationale: SECRET, evidence: SECRET })),
    limitations: [SECRET], outstanding: [SECRET], importWarnings: [SECRET],
    unknown: { [SECRET]: { values: [SECRET, RAW_SIGNAL, SECRET_DATE] } },
  };
}

function vendor() {
  return {
    tool: SECRET, generatedAt: SECRET_DATE, matched: true, mismatches: [SECRET],
    source: { fileName: `${SECRET}.json`, sha256: SECRET },
    signalMetadata: { vendorListVersion: 1234, policyVersion: 55 },
    vendorListMetadata: { vendorListVersion: 1234, policyVersion: 55, specificationVersion: 3, lastUpdated: SECRET_DATE },
    rows: [
      { id: 43210, name: SECRET, membership: 'listed', deletedDate: null, flags: ['Consent'] },
      { id: 54321, name: SECRET, membership: 'listed', deletedDate: SECRET_DATE, flags: ['Disclosed'] },
      { id: 55556, name: null, membership: 'not-listed', deletedDate: null, flags: ['Allowed'] },
      { id: 65432, name: SECRET, membership: 'listed', deletedDate: null, flags: ['Legitimate interest'] },
    ],
    segmentPresence: { disclosed: true, allowed: true }, limitations: [SECRET],
    unknown: { nested: SECRET },
  };
}

function assertNoSecrets(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  for (const secret of [SECRET, RAW_SIGNAL, SECRET_DATE, 'wuser-lab', ...ID_VALUES.map(String)]) {
    assert.equal(text.includes(secret), false, `Must omit ${secret}`);
  }
  assert.equal(/\d{4}-\d{2}-\d{2}T/.test(text), false, 'No original or newly generated timestamps');
}

function assertEnvelope(result, kind) {
  assert.equal(result.schemaVersion, '1.0');
  assert.equal(result.tool, 'Consent Lens');
  assert.equal(result.reportType, 'redacted-summary');
  assert.equal(result.kind, kind);
  assert.deepEqual(Object.keys(result).sort(), ['schemaVersion', 'tool', 'reportType', 'kind', 'summary', 'limitations'].sort());
  assert.ok(Array.isArray(result.limitations) && result.limitations.length > 0);
  assert.ok(result.limitations.every(item => typeof item === 'string'));
  assertNoSecrets(result);
}

test('audit redaction keeps meaningful counts and replaces source labels with fixed allowlists', () => {
  const full = audit();
  full.comparison.groups.push({ key: SECRET, label: SECRET, comparable: true, added: [SECRET], removed: [SECRET], unchangedCount: 99 });
  const result = redactAudit(full);
  assertEnvelope(result, 'audit');
  assert.equal(result.summary.flagChanges, 3);
  const group = result.summary.signalGroups.find(item => item.key === 'purposeConsentIds');
  assert.deepEqual(group, { key: 'purposeConsentIds', label: GROUPS.purposeConsentIds, comparable: true, addedCount: 2, removedCount: 1, unchangedCount: 3 });
  assert.ok(result.summary.signalGroups.every(item => Object.hasOwn(GROUPS, item.key) && item.label === GROUPS[item.key]));
  assert.equal(result.summary.signalGroups.some(item => item.key === SECRET), false);
  assert.equal(result.summary.metadataChanged.length, 2);
  const allowedMetadata = new Set(Object.keys(FIELDS));
  assert.ok(result.summary.metadataChanged.every(item => allowedMetadata.has(item)));
  assert.deepEqual(Object.keys(result.summary).sort(), ['flagChanges', 'signalGroups', 'metadataChanged', 'publisherRestrictions', 'review'].sort());
  for (const item of result.summary.signalGroups) assert.deepEqual(Object.keys(item).sort(), ['key', 'label', 'comparable', 'addedCount', 'removedCount', 'unchangedCount'].sort());
  assert.deepEqual(result.summary.publisherRestrictions, { addedCount: 1, removedCount: 2, changedCount: 3, unchangedCount: 4, totalChanges: 6 });
  assert.equal(result.summary.review.state, 'draft');
  assert.equal(result.summary.review.outcome, 'incomplete');
  assert.deepEqual(result.summary.review.decisions, { needsReview: 1, pass: 1, fail: 1, skipped: 1 });
});

test('single-signal redaction counts vectors but removes IDs, versions, metadata and free text', () => {
  const result = redactSignal(signal());
  assertEnvelope(result, 'signal');
  assert.deepEqual(result.summary, {
    purposeConsentCount: 2, purposeLegitimateInterestCount: 1,
    vendorConsentCount: 3, vendorLegitimateInterestCount: 1,
    vendorsDisclosedCount: 2, vendorsAllowedCount: null,
    specialFeatureOptinCount: 2, publisherRestrictionPairCount: 2,
  });
});

test('vendor redaction retains membership totals without names, IDs or file fingerprints', () => {
  const result = redactVendor(vendor());
  assertEnvelope(result, 'vendor');
  assert.deepEqual(result.summary, { matched: true, referencedVendorCount: 4, listedVendorCount: 3, notListedVendorCount: 1, deletedEntryCount: 1 });
  const unmatched = vendor(); unmatched.matched = false; unmatched.rows = [];
  const blocked = redactVendor(unmatched);
  assertEnvelope(blocked, 'vendor');
  assert.deepEqual(blocked.summary, { matched: false, referencedVendorCount: null, listedVendorCount: null, notListedVendorCount: null, deletedEntryCount: null });
});

test('absent optional segments and noncomparable audit groups remain unknown instead of zero evidence', () => {
  const full = audit();
  const group = full.comparison.groups.find(item => item.key === 'vendorDisclosedIds');
  Object.assign(group, { comparable: false, added: [SECRET], removed: [SECRET], unchangedCount: 99, beforeCount: 43210, afterCount: 54321 });
  const result = redactAudit(full);
  assert.deepEqual(result.summary.signalGroups.find(item => item.key === 'vendorDisclosedIds'), { key: 'vendorDisclosedIds', label: GROUPS.vendorDisclosedIds, comparable: false, addedCount: 0, removedCount: 0, unchangedCount: null });
  const inspected = signal();
  inspected.vendorDisclosureSegmentPresent = false;
  inspected.vendorAllowedSegmentPresent = true;
  const counts = redactSignal(inspected).summary;
  assert.equal(counts.vendorsDisclosedCount, null);
  assert.equal(counts.vendorsAllowedCount, 1);
  assertNoSecrets(redactedMarkdown(result));
});

test('JSON and readable redacted output omit canaries from all three full-report flows', () => {
  for (const [kind, result] of [['audit', redactAudit(audit())], ['signal', redactSignal(signal())], ['vendor', redactVendor(vendor())]]) {
    assertEnvelope(result, kind);
    const markdown = redactedMarkdown(result);
    assert.equal(typeof markdown, 'string');
    assertNoSecrets(markdown);
    assert.match(markdown, /redact|summary/i);
    assert.match(markdown, /\d/);
  }
});

test('redacting never mutates local captures, reviewer notes, or vendor-list data', () => {
  for (const [make, redact] of [[audit, redactAudit], [signal, redactSignal], [vendor, redactVendor]]) {
    const full = make();
    const original = structuredClone(full);
    const result = redact(full);
    assert.deepEqual(full, original);
    result.limitations.push('Local output mutation');
    assert.deepEqual(full, original, 'Output data must not share mutable source arrays');
    assert.equal(redact(full).limitations.includes('Local output mutation'), false, 'Output data must not mutate later summaries');
  }
});

test('equivalent counts produce identical summaries despite different signals and identifying details', () => {
  const first = signal();
  const second = signal();
  second.rawSignal = `${RAW_SIGNAL}.IAAA`;
  second.cmpId = 65432; second.cmpVersion = 65431; second.policyVersion = 10; second.vendorListVersion = 3456;
  second.created = '2038-10-24T01:02:03.000Z'; second.updated = second.created;
  second.vendorConsentIds = [10101, 20202, 30303];
  second.vendorLegitimateInterestIds = [40404]; second.vendorDisclosedIds = [50505, 60606];
  second.publisherRestrictions = [{ purposeId: 12, vendorId: 10101, restrictionTypes: [2] }, { purposeId: 13, vendorId: 20202, restrictionTypes: [0] }];
  assert.deepEqual(redactSignal(first), redactSignal(second), 'No data-dependent identifiers or hashes may be introduced');
  const firstAudit = audit(); const secondAudit = audit();
  secondAudit.captures = { before: 'DIFFERENT_RAW_BEFORE', after: 'DIFFERENT_RAW_AFTER' };
  secondAudit.context = { caseId: 'DIFFERENT_CASE', reviewer: 'DIFFERENT_REVIEWER', source: 'https://different.invalid/' };
  secondAudit.comparison.before = second;
  secondAudit.comparison.after = second;
  assert.deepEqual(redactAudit(firstAudit), redactAudit(secondAudit));
  const firstVendor = vendor(); const secondVendor = vendor();
  secondVendor.source = { fileName: 'different-private-name.json', sha256: 'different-fingerprint' };
  secondVendor.rows = secondVendor.rows.map((row, index) => ({ ...row, id: index + 10101, name: `Different vendor ${index}`, deletedDate: row.deletedDate ? '2038-10-24T01:02:03.000Z' : null }));
  assert.deepEqual(redactVendor(firstVendor), redactVendor(secondVendor));
});

test('poisoned count and enum fields cannot carry free text through a summary', () => {
  const full = audit();
  full.comparison.totalFlagChanges = SECRET;
  for (const group of full.comparison.groups) group.unchangedCount = SECRET;
  for (const key of Object.keys(full.comparison.publisherRestrictions)) full.comparison.publisherRestrictions[key] = SECRET;
  full.reviewState = SECRET; full.outcome = SECRET;
  for (const check of full.checks) check.status = SECRET;
  const result = redactAudit(full);
  assertEnvelope(result, 'audit');
  assertNoSecrets(redactedMarkdown(result));
  assert.ok(['draft', 'reviewed'].includes(result.summary.review.state));
  assert.ok(['incomplete', 'findings-recorded', 'reviewed-with-skips', 'reviewed-no-failures-recorded'].includes(result.summary.review.outcome));
});

test('counts reject negative, fractional, nonfinite and unsafe numeric values', () => {
  for (const invalid of [-1, 1.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1]) {
    const full = audit();
    full.comparison.totalFlagChanges = invalid;
    full.comparison.groups[0].unchangedCount = invalid;
    full.comparison.publisherRestrictions.totalChanges = invalid;
    const result = redactAudit(full);
    assert.equal(result.summary.flagChanges, 0);
    assert.equal(result.summary.signalGroups[0].unchangedCount, 0);
    assert.equal(result.summary.publisherRestrictions.totalChanges, 0);
    assertNoSecrets(result);
  }
});

test('Markdown applies its own allowlist instead of trusting summary labels or limitations', () => {
  for (const result of [redactAudit(audit()), redactSignal(signal()), redactVendor(vendor())]) {
    result.tool = SECRET;
    result.schemaVersion = SECRET;
    result.limitations = [SECRET];
    result.author = SECRET;
    result.summary.unknown = SECRET;
    if (result.kind === 'audit') {
      for (const group of result.summary.signalGroups) {
        group.label = SECRET;
        group.addedCount = SECRET;
        group.removedCount = SECRET;
        group.unchangedCount = SECRET;
      }
      result.summary.signalGroups.push({ key: SECRET, label: SECRET, comparable: true, addedCount: 43210, removedCount: 54321, unchangedCount: 55556 });
      result.summary.metadataChanged.push(SECRET);
      result.summary.flagChanges = SECRET;
      for (const key of Object.keys(result.summary.publisherRestrictions)) result.summary.publisherRestrictions[key] = SECRET;
      result.summary.review.state = SECRET;
      result.summary.review.outcome = SECRET;
      for (const key of Object.keys(result.summary.review.decisions)) result.summary.review.decisions[key] = SECRET;
    } else {
      for (const key of Object.keys(result.summary)) if (key !== 'matched') result.summary[key] = SECRET;
    }
    assertNoSecrets(redactedMarkdown(result));
  }
});

test('redacted summaries cannot be mistaken for resumable audit backups', () => {
  for (const result of [redactAudit(audit()), redactSignal(signal()), redactVendor(vendor())]) {
    assert.throws(() => parseAuditReport(JSON.stringify(result)), /Redacted summaries cannot reopen a review because source captures and context were removed/);
  }
});
