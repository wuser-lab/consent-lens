import test from 'node:test';
import assert from 'node:assert/strict';
import { inspect, SAMPLE } from './decode.js';
import { compareSignals, buildAudit, auditMarkdown, CHECKS } from './review.js';

// Synthetic segments generated with the IAB SegmentEncoder. Expected IDs are
// fixed here independently of the inspector and comparison code.
const BEFORE = `${SAMPLE}.IADkIAAA.QAEiCAAA`;
const AFTER = `${SAMPLE}.IAEAMAAA.QAGACQAA`;

test('extracts disclosed and allowed vendor IDs from separate segments', () => {
  const report = inspect(BEFORE);
  assert.deepEqual(report.vendorDisclosedIds, [2, 7]);
  assert.deepEqual(report.vendorAllowedIds, [3, 9]);
  assert.equal(report.vendorDisclosureSegmentPresent, true);
  assert.equal(report.vendorAllowedSegmentPresent, true);
});
test('distinguishes an absent disclosed segment from an explicitly empty one', () => {
  const absent = inspect(SAMPLE);
  const empty = inspect(`${SAMPLE}.IAAA`);
  assert.deepEqual(absent.vendorDisclosedIds, []);
  assert.deepEqual(empty.vendorDisclosedIds, []);
  assert.equal(absent.vendorDisclosureSegmentPresent, false);
  assert.equal(empty.vendorDisclosureSegmentPresent, true);
});
test('reports exact disclosed and allowed ID additions and removals', () => {
  const comparison = compareSignals(BEFORE, AFTER);
  const disclosed = comparison.groups.find(group => group.key === 'vendorDisclosedIds');
  assert.deepEqual(disclosed.added, [8]);
  assert.deepEqual(disclosed.removed, [2]);
  assert.equal(disclosed.unchangedCount, 1);
  const allowed = comparison.groups.find(group => group.key === 'vendorAllowedIds');
  assert.deepEqual(allowed.added, [12]);
  assert.deepEqual(allowed.removed, [3]);
  assert.equal(comparison.totalFlagChanges, 4);
});
test('does not invent vendor additions or removals when a capture lacks the segment', () => {
  for (const [before, after] of [[SAMPLE, BEFORE], [BEFORE, SAMPLE], [SAMPLE, SAMPLE]]) {
    const diff = compareSignals(before, after);
    for (const key of ['vendorDisclosedIds', 'vendorAllowedIds']) {
      const group = diff.groups.find(item => item.key === key);
      assert.equal(group.comparable, false);
      assert.deepEqual(group.added, []);
      assert.deepEqual(group.removed, []);
      assert.equal(group.unchangedCount, null);
    }
    assert.equal(diff.totalFlagChanges, 0);
  }
});
test('empty present segments can be compared with non-empty segments', () => {
  const diff = compareSignals(`${SAMPLE}.IAAA`, BEFORE);
  const disclosed = diff.groups.find(group => group.key === 'vendorDisclosedIds');
  assert.equal(disclosed.comparable, true);
  assert.deepEqual(disclosed.added, [2, 7]);
  assert.equal(disclosed.beforeCount, 0);
  assert.equal(disclosed.afterCount, 2);
});
test('report exports preserve missing-segment evidence without claiming zero vendors', () => {
  const report = buildAudit({ before: SAMPLE, after: BEFORE, context: {}, checks: CHECKS.map(check => ({ id: check.id, status: 'needs-review' })) });
  const text = auditMarkdown(report);
  assert.match(text, /Disclosed vendor IDs: not compared because a segment is absent/);
  assert.match(text, /Before: absent; after: present \(2 IDs\)/);
  assert.ok(report.comparison.metadata.some(item => item.key === 'vendorDisclosureSegmentPresent' && item.changed));
});
