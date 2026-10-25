import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildAudit, CHECKS } from './review.js';
import { EXAMPLE_BEFORE, EXAMPLE_AFTER } from './examples.js';
import { parseAuditReport, captureInstant, localCaptureValue, MAX_REPORT_BYTES } from './import-report.js';

export function savedReport() {
  return buildAudit({ before: EXAMPLE_BEFORE, after: EXAMPLE_AFTER,
    context: { caseId: 'SYNTHETIC-RESUME', reviewer: 'Synthetic reviewer', source: 'Generated fixture', participantType: 'Other', action: 'Add flags', controlsVersion: 'Exploratory', evidenceNotes: 'E1: synthetic fixture', beforeCapturedAt: '2026-10-25T01:30:00.123Z', afterCapturedAt: '2026-10-25T01:31:00.456Z' },
    checks: CHECKS.map(check => ({ id: check.id, status: 'pass', rationale: 'Synthetic example', evidence: 'E1' })) });
}
test('bundled sample is an importable synthetic draft', async () => {
  const source = await readFile(new URL('../public/examples/synthetic-review.json', import.meta.url), 'utf8');
  const restored = parseAuditReport(source);
  assert.equal(restored.context.caseId, 'SYNTHETIC-REOPEN-DEMO');
  assert.equal(restored.reviewState, 'draft');
  assert.equal(restored.comparison.totalFlagChanges, 2);
});
test('reopens an exported review with captures, context, decisions and evidence intact', () => {
  const original = savedReport();
  const restored = parseAuditReport(JSON.stringify(original));
  for (const key of ['caseId', 'reviewer', 'source', 'action', 'evidenceNotes', 'beforeCapturedAt', 'afterCapturedAt']) assert.equal(restored.context[key], original.context[key]);
  assert.deepEqual(restored.captures, original.captures);
  assert.deepEqual(restored.checks, original.checks);
  assert.equal(restored.reviewState, 'reviewed');
});
test('recalculates comparison and completeness instead of trusting imported outcomes', () => {
  const original = savedReport();
  original.comparison = { totalFlagChanges: 99999 };
  original.reviewState = 'reviewed';
  original.checks[0].status = 'needs-review';
  const restored = parseAuditReport(JSON.stringify(original));
  assert.equal(restored.comparison.totalFlagChanges, 2);
  assert.equal(restored.reviewState, 'draft');
});
test('supports draft exports and older reports without derived disclosure fields', () => {
  const original = savedReport();
  original.context = {};
  delete original.comparison;
  const restored = parseAuditReport(JSON.stringify(original));
  assert.equal(restored.reviewState, 'draft');
  assert.equal(restored.context.participantType, 'unspecified');
  assert.equal(restored.comparison.groups.length, 7);
});
test('rejects malformed files, unsupported schemas and invalid field types', () => {
  for (const value of ['no JSON', 'null', '[]', '{}']) assert.throws(() => parseAuditReport(value));
  for (const change of [
    report => { report.schemaVersion = '99'; },
    report => { report.context.source = { url: 'unexpected object' }; },
    report => { report.context.caseId = 'x'.repeat(201); },
    report => { report.context.participantType = 'Unknown'; },
    report => { report.captures.before = 'C'; },
    report => { report.context.beforeCapturedAt = '2026-02-30T01:00:00Z'; },
    report => { report.context.beforeCapturedAt = '2026-10-25T01:30:00'; },
    report => { report.checks[0].status = 'approved'; },
    report => { report.checks[1] = report.checks[0]; },
    report => { report.checks.pop(); },
  ]) {
    const report = savedReport(); change(report);
    assert.throws(() => parseAuditReport(JSON.stringify(report)));
  }
});
test('enforces import size using UTF-8 bytes as well as character count', () => {
  assert.throws(() => parseAuditReport(' '.repeat(MAX_REPORT_BYTES + 1)), /32 MiB/);
  assert.throws(() => parseAuditReport('界'.repeat(Math.ceil(MAX_REPORT_BYTES / 3))), /32 MiB/);
});
test('ignores unknown context properties', () => {
  const original = savedReport();
  original.context.unexpected = 'not restored';
  assert.equal('unexpected' in parseAuditReport(JSON.stringify(original)).context, false);
});
test('preserves exact imported instants through the repeated DST hour and milliseconds', () => {
  const previousTimezone = process.env.TZ;
  process.env.TZ = 'Europe/Brussels';
  try {
    const iso = '2026-10-25T01:30:00.123Z';
    const display = localCaptureValue(iso);
    assert.equal(display, '2026-10-25T02:30:00');
    assert.equal(captureInstant(display, { display, iso }), iso);
    assert.notEqual(captureInstant(display), iso);
    assert.equal(captureInstant(''), '');
    assert.equal(localCaptureValue(''), '');
  } finally {
    if (previousTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimezone;
  }
});
