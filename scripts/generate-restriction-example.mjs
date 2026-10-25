import { writeFile } from 'node:fs/promises';
import { buildAudit, CHECKS } from '../src/review.js';
import { createRestrictionSignal } from '../src/restriction-fixtures.js';

// Independent bit-level synthetic examples; not real CMP captures.
const group = (purposeId, restrictionType, vendorId) => ({ purposeId, restrictionType, entries: [[vendorId]] });
const report = buildAudit({
  before: createRestrictionSignal([group(2, 0, 7), group(3, 1, 9), group(4, 2, 10)]),
  after: createRestrictionSignal([group(2, 1, 7), group(4, 2, 10), group(5, 0, 11)]),
  context: { caseId: 'SYNTHETIC-RESTRICTIONS', reviewer: '', source: 'Independently encoded synthetic TC strings; not a real CMP capture', participantType: 'Other', action: 'Synthetic restriction changes only; no real user action', controlsVersion: 'Exploratory demonstration; no official controls applied', evidenceNotes: 'Demonstration only. Purpose 2/vendor 7 changes from Not allowed to Require consent. Purpose 3/vendor 9 is removed. Purpose 5/vendor 11 is added. Purpose 4/vendor 10 is unchanged. No actual screenshots or user actions support these synthetic values.', beforeCapturedAt: '2026-10-25T08:00:00.000Z', afterCapturedAt: '2026-10-25T08:01:00.000Z', captureTimeZone: 'UTC' },
  checks: CHECKS.map(check => ({ id: check.id, status: 'needs-review', rationale: '', evidence: '' })),
  now: new Date('2026-10-25T08:02:00.000Z'),
});
await writeFile(new URL('../public/examples/synthetic-restrictions.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
