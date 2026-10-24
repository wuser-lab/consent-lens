import test from 'node:test';
import assert from 'node:assert/strict';
import { compareSignals, buildAudit, auditMarkdown, CHECKS } from './review.js';
import { EXAMPLE_BEFORE, EXAMPLE_AFTER } from './examples.js';

const context = { caseId: 'TEST-1', reviewer: 'Test reviewer', source: 'Synthetic fixture', action: 'Add purposes 1 and 2', participantType: 'Other', controlsVersion: 'Exploratory', beforeCapturedAt: '2026-10-24T08:00:00Z', afterCapturedAt: '2026-10-24T08:01:00Z' };
function audit(overrides = {}) {
  return buildAudit({ before: EXAMPLE_BEFORE, after: EXAMPLE_AFTER, context,
    checks: CHECKS.map(check => ({ id: check.id, status: 'pass', rationale: 'Verified synthetic fixture.', evidence: 'E1: fixture source' })), ...overrides });
}
test('compares synthetic signals and reports exact purpose additions', () => {
  const diff = compareSignals(EXAMPLE_BEFORE, EXAMPLE_AFTER);
  assert.deepEqual(diff.groups[0].added, [1, 2]);
  assert.deepEqual(diff.groups[0].removed, []);
  assert.equal(diff.totalFlagChanges, 2);
  assert.equal(diff.metadata.find(item => item.key === 'updated').changed, true);
  assert.equal(diff.metadata.find(item => item.key === 'cmpId').changed, false);
});
test('reverse comparison reports removals rather than additions', () => {
  const diff = compareSignals(EXAMPLE_AFTER, EXAMPLE_BEFORE);
  assert.deepEqual(diff.groups[0].removed, [1, 2]);
  assert.deepEqual(diff.groups[0].added, []);
});
test('identical strings report no changes', () => {
  const diff = compareSignals(EXAMPLE_BEFORE, EXAMPLE_BEFORE);
  assert.equal(diff.totalFlagChanges, 0);
  assert.equal(diff.rawStringsEqual, true);
  assert.ok(diff.metadata.every(item => !item.changed));
});
test('errors identify the failing capture', () => {
  assert.throws(() => compareSignals('C', EXAMPLE_AFTER), /^Error: Before:/);
  assert.throws(() => compareSignals(EXAMPLE_BEFORE, 'C'), /^Error: After:/);
});
test('complete review preserves captures, context and reviewer evidence', () => {
  const result = audit();
  assert.equal(result.reviewState, 'reviewed');
  assert.equal(result.outcome, 'reviewed-no-failures-recorded');
  assert.deepEqual(result.outstanding, []);
  assert.equal(result.captures.before, EXAMPLE_BEFORE);
  assert.equal(result.context.caseId, 'TEST-1');
  assert.equal(result.checks[0].evidence, 'E1: fixture source');
});
test('missing context and unresolved decisions produce a draft', () => {
  const result = audit({ context: {}, checks: CHECKS.map(check => ({ id: check.id, status: 'needs-review' })) });
  assert.equal(result.reviewState, 'draft');
  assert.equal(result.outcome, 'incomplete');
  assert.ok(result.outstanding.some(item => item.includes('reviewer')));
});
test('pass or fail without evidence remains draft', () => {
  for (const status of ['pass', 'fail']) {
    const result = audit({ checks: CHECKS.map(check => ({ id: check.id, status, rationale: 'Reviewed' })) });
    assert.equal(result.reviewState, 'draft');
  }
});
test('skipped checks require reasons and never become passes', () => {
  const checks = CHECKS.map(check => ({ id: check.id, status: 'skipped', rationale: 'Not applicable to synthetic capture.' }));
  assert.equal(audit({ checks }).outcome, 'reviewed-with-skips');
  assert.ok(audit({ checks }).checks.every(check => check.status === 'skipped'));
  checks[0].rationale = '';
  assert.equal(audit({ checks }).reviewState, 'draft');
});
test('a reviewed failure is preserved as a finding', () => {
  const checks = CHECKS.map(check => ({ id: check.id, status: 'fail', rationale: 'Observed discrepancy.', evidence: 'E2' }));
  assert.equal(audit({ checks }).outcome, 'findings-recorded');
});
test('bad timestamps are rejected and reversed chronology stays draft', () => {
  assert.throws(() => audit({ context: { ...context, beforeCapturedAt: 'yesterdayish' } }), /Invalid beforeCapturedAt/);
  assert.equal(audit({ context: { ...context, afterCapturedAt: '2026-10-23T08:00:00Z' } }).reviewState, 'draft');
});
test('unknown statuses cannot enter reports', () => {
  assert.throws(() => audit({ checks: CHECKS.map(check => ({ id: check.id, status: 'approved' })) }), /valid status/);
});
test('readable export includes traceable evidence, changes, raw signals and limits', () => {
  const text = auditMarkdown(audit());
  for (const expected of ['TEST-1', 'added 1, 2', 'E1: fixture source', EXAMPLE_BEFORE, EXAMPLE_AFTER, 'not an official IAB']) assert.ok(text.includes(expected));
});
