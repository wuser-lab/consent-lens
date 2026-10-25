import test from 'node:test';
import assert from 'node:assert/strict';
import { inspect } from './decode.js';
import { compareSignals, buildAudit, auditMarkdown, CHECKS } from './review.js';
import { parseAuditReport } from './import-report.js';
import { createRestrictionSignal } from './restriction-fixtures.js';
import { TCString } from '@iabtechlabtcf/core';
import { assertDecodeBudget, MAX_RESTRICTION_OPERATIONS } from './decode-budget.js';
import { assertReportSize, MAX_REPORT_BYTES } from './report-limits.js';

const group = (purposeId, restrictionType, ...entries) => ({ purposeId, restrictionType, entries });
const row = (purposeId, vendorId, restrictionTypes) => ({ purposeId, vendorId, restrictionTypes });
const changed = (purposeId, vendorId, before, after, change) => ({ purposeId, vendorId, before, after, change });
const empty = createRestrictionSignal();
const before = createRestrictionSignal([group(2, 0, [7])]);
const after = createRestrictionSignal([group(2, 1, [7])]);
const context = {
  caseId: 'SYNTHETIC-RESTRICTIONS', reviewer: 'Synthetic reviewer', source: 'Synthetic bit-level fixtures',
  action: 'Synthetic publisher restriction change', participantType: 'Other', controlsVersion: 'Exploratory technical review',
  beforeCapturedAt: '2026-10-25T08:00:00.000Z', afterCapturedAt: '2026-10-25T08:01:00.000Z',
};
function audit() {
  return buildAudit({ before, after, context,
    checks: CHECKS.map(check => ({ id: check.id, status: 'pass', rationale: 'Synthetic fixture checked.', evidence: 'E1: fixture' })) });
}

test('decodes all three restriction types and an empty restriction section', () => {
  const signal = createRestrictionSignal([group(3, 2, [9]), group(2, 1, [8]), group(1, 0, [7])]);
  assert.deepEqual(inspect(signal).publisherRestrictions, [row(1, 7, [0]), row(2, 8, [1]), row(3, 9, [2])]);
  assert.deepEqual(inspect(empty).publisherRestrictions, []);
});

test('restriction-only changes are counted even when every flag is unchanged', () => {
  const comparison = compareSignals(before, after);
  assert.equal(comparison.totalFlagChanges, 0);
  assert.ok(comparison.metadata.every(field => !field.changed));
  assert.equal(comparison.publisherRestrictions.totalChanges, 1);
  assert.equal(comparison.publisherRestrictions.changedCount, 1);
  assert.equal(comparison.publisherRestrictions.addedCount, 0);
  assert.equal(comparison.publisherRestrictions.removedCount, 0);
  assert.deepEqual(comparison.publisherRestrictions.rows, [changed(2, 7, [0], [1], 'changed')]);
});

test('reports added, removed, changed, and unchanged vendor-purpose pairs independently', () => {
  const first = createRestrictionSignal([group(2, 0, [7]), group(3, 1, [9]), group(4, 2, [10])]);
  const second = createRestrictionSignal([group(2, 1, [7]), group(4, 2, [10]), group(5, 0, [11])]);
  const diff = compareSignals(first, second).publisherRestrictions;
  assert.deepEqual(diff.rows, [
    changed(2, 7, [0], [1], 'changed'),
    changed(3, 9, [1], [], 'removed'),
    changed(5, 11, [], [0], 'added'),
  ]);
  assert.deepEqual([diff.addedCount, diff.removedCount, diff.changedCount, diff.unchangedCount], [1, 1, 1, 1]);
  assert.equal(diff.totalChanges, 3);
  assert.equal(diff.beforeCount, 3);
  assert.equal(diff.afterCount, 3);
  const reverse = compareSignals(second, first).publisherRestrictions;
  assert.deepEqual(reverse.rows, [
    changed(2, 7, [1], [0], 'changed'),
    changed(3, 9, [], [1], 'added'),
    changed(5, 11, [0], [], 'removed'),
  ]);
});

test('treats reordered groups, single IDs, ranges, and repeated entries as equivalent', () => {
  const ranged = createRestrictionSignal([group(5, 2, [20, 23]), group(2, 0, [7, 9])]);
  const singles = createRestrictionSignal([
    group(2, 0, [9], [7], [8], [8]), group(5, 2, [23], [21]),
    group(5, 2, [20, 22]), group(2, 0, [7, 9]),
  ]);
  assert.notEqual(ranged, singles);
  assert.deepEqual(inspect(ranged).publisherRestrictions, inspect(singles).publisherRestrictions);
  const diff = compareSignals(ranged, singles).publisherRestrictions;
  assert.equal(diff.totalChanges, 0);
  assert.equal(diff.unchangedCount, 7);
  assert.deepEqual(diff.rows, []);
});

test('preserves multiple encoded types for one pair rather than selecting a winner', () => {
  const first = createRestrictionSignal([group(2, 2, [7]), group(2, 0, [7]), group(2, 1, [7]), group(2, 0, [7])]);
  const second = createRestrictionSignal([group(2, 2, [7]), group(2, 0, [7])]);
  assert.deepEqual(inspect(first).publisherRestrictions, [row(2, 7, [0, 1, 2])]);
  const diff = compareSignals(first, second).publisherRestrictions;
  assert.equal(diff.totalChanges, 1);
  assert.deepEqual(diff.rows, [changed(2, 7, [0, 1, 2], [0, 2], 'changed')]);
});

test('retains the maximum encoded vendor ID and sorts vendor IDs numerically', () => {
  const signal = createRestrictionSignal([group(2, 1, [65535], [100], [2])]);
  assert.deepEqual(inspect(signal).publisherRestrictions, [row(2, 2, [1]), row(2, 100, [1]), row(2, 65535, [1])]);
});

test('keeps empty versus populated restriction sections visible in both directions', () => {
  const added = compareSignals(empty, before).publisherRestrictions;
  const removed = compareSignals(before, empty).publisherRestrictions;
  assert.deepEqual(added.rows, [changed(2, 7, [], [0], 'added')]);
  assert.deepEqual(removed.rows, [changed(2, 7, [0], [], 'removed')]);
  assert.equal(compareSignals(empty, empty).publisherRestrictions.totalChanges, 0);
});

test('JSON and readable exports include restriction-only findings', () => {
  const report = audit();
  const decoded = JSON.parse(JSON.stringify(report));
  assert.deepEqual(decoded.comparison.publisherRestrictions.rows, [changed(2, 7, [0], [1], 'changed')]);
  const markdown = auditMarkdown(report);
  assert.match(markdown, /Publisher restrictions/i);
  assert.match(markdown, /Not allowed/i);
  assert.match(markdown, /Require consent/i);
  assert.match(markdown, /purpose\s*2/i);
  assert.match(markdown, /vendor\s*7/i);
});

test('reopening ignores forged restriction results and rebuilds from source captures', () => {
  const report = audit();
  report.comparison.publisherRestrictions = { totalChanges: 0, rows: [] };
  report.comparison.before.publisherRestrictions = [];
  report.comparison.after.publisherRestrictions = [];
  const reopened = parseAuditReport(JSON.stringify(report));
  assert.equal(reopened.comparison.totalFlagChanges, 0);
  assert.equal(reopened.comparison.publisherRestrictions.totalChanges, 1);
  assert.deepEqual(reopened.comparison.publisherRestrictions.rows, [changed(2, 7, [0], [1], 'changed')]);
});

test('retains encoded vendor ID zero when returned by the library', () => {
  const signal = createRestrictionSignal([group(2, 0, [0, 1])]);
  const vector = TCString.decode(signal).publisherRestrictions;
  assert.deepEqual(vector.getVendors(), [0, 1]);
  assert.deepEqual(inspect(signal).publisherRestrictions, [row(2, 0, [0]), row(2, 1, [0])]);
});

test('accepts exactly 10,000 restriction expansion steps', () => {
  const signal = createRestrictionSignal([group(2, 0, [1, 10000])]);
  assert.equal(MAX_RESTRICTION_OPERATIONS, 10000);
  assert.equal(assertDecodeBudget(signal).restrictionOperations, 10000);
  const restrictions = inspect(signal).publisherRestrictions;
  assert.equal(restrictions.length, 10000);
  assert.deepEqual(restrictions[0], row(2, 1, [0]));
  assert.deepEqual(restrictions.at(-1), row(2, 10000, [0]));
});

test('rejects 10,001 restriction steps before calling the library decoder', () => {
  const signal = createRestrictionSignal([group(2, 0, [1, 10001])]);
  const original = TCString.decode;
  let decoderCalled = false;
  TCString.decode = () => { decoderCalled = true; throw new Error('Decoder must not be called'); };
  try {
    assert.throws(() => inspect(signal), /10,000 publisher-restriction expansion steps/);
    assert.equal(decoderCalled, false);
  } finally { TCString.decode = original; }
});

test('charges repeated restriction groups before de-duplicating identical pairs', () => {
  const supported = createRestrictionSignal([group(2, 0, [1, 5000]), group(2, 0, [1, 5000])]);
  assert.equal(assertDecodeBudget(supported).restrictionOperations, 10000);
  assert.equal(inspect(supported).publisherRestrictions.length, 5000);
  const excessive = createRestrictionSignal([
    group(2, 0, [1, 5000]), group(2, 0, [1, 5000]), group(2, 0, [1]),
  ]);
  assert.throws(() => inspect(excessive), /10,000 publisher-restriction expansion steps/);
});

test('full reports round-trip two disjoint captures at the restriction budget', () => {
  const first = createRestrictionSignal([group(2, 0, [1, 10000])]);
  const second = createRestrictionSignal([group(2, 1, [10001, 20000])]);
  const report = buildAudit({ before: first, after: second, context,
    checks: CHECKS.map(check => ({ id: check.id, status: 'needs-review', rationale: '', evidence: '' })) });
  const json = JSON.stringify(report, null, 2);
  assert.ok(new TextEncoder().encode(json).length < MAX_REPORT_BYTES);
  assert.doesNotThrow(() => assertReportSize(json));
  const reopened = parseAuditReport(json);
  assert.equal(reopened.comparison.publisherRestrictions.totalChanges, 20000);
  assert.equal(reopened.comparison.publisherRestrictions.addedCount, 10000);
  assert.equal(reopened.comparison.publisherRestrictions.removedCount, 10000);
  assert.deepEqual(reopened.comparison.publisherRestrictions, report.comparison.publisherRestrictions);
  assert.deepEqual(reopened.captures, report.captures);
});

test('report size guard rejects oversized ASCII and UTF-8 content', () => {
  assert.equal(MAX_REPORT_BYTES, 32 * 1024 * 1024);
  assert.doesNotThrow(() => assertReportSize('a'.repeat(MAX_REPORT_BYTES)));
  assert.throws(() => assertReportSize('a'.repeat(MAX_REPORT_BYTES + 1)), /32 MiB/);
  const unicode = '界'.repeat(Math.floor(MAX_REPORT_BYTES / 3) + 1);
  assert.ok(unicode.length < MAX_REPORT_BYTES);
  assert.throws(() => assertReportSize(unicode), /32 MiB/);
});

test('legacy report coverage resets only the signal decision and retains review evidence', () => {
  const report = audit();
  assert.equal(report.comparisonCoverage, 'publisher-restrictions-v1');
  for (const coverage of [undefined, 'unknown-coverage']) {
    const saved = structuredClone(report);
    if (coverage === undefined) delete saved.comparisonCoverage;
    else saved.comparisonCoverage = coverage;
    const reopened = parseAuditReport(JSON.stringify(saved));
    assert.equal(reopened.comparisonCoverage, 'publisher-restrictions-v1');
    assert.equal(reopened.reviewState, 'draft');
    const signal = reopened.checks.find(check => check.id === 'signal');
    const original = report.checks.find(check => check.id === 'signal');
    assert.deepEqual(signal, { ...original, status: 'needs-review' });
    assert.deepEqual(reopened.checks.filter(check => check.id !== 'signal'), report.checks.filter(check => check.id !== 'signal'));
    assert.equal(reopened.comparison.publisherRestrictions.totalChanges, 1);
    assert.ok(reopened.importWarnings.some(warning => /Signal transition.*Needs review/.test(warning)));
  }
  const current = parseAuditReport(JSON.stringify(report));
  assert.equal(current.reviewState, 'reviewed');
  assert.deepEqual(current.checks, report.checks);
  assert.equal(current.importWarnings, undefined);
});
