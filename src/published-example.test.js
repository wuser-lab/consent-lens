import test from 'node:test';
import assert from 'node:assert/strict';
import { inspect } from './decode.js';
import { compareSignals } from './review.js';

// Published example from the IAB TC String Format specification:
// https://github.com/InteractiveAdvertisingBureau/GDPR-Transparency-and-Consent-Framework/blob/master/TCFv2/IAB%20Tech%20Lab%20-%20Consent%20string%20and%20vendor%20list%20formats%20v2.md#tc-string-format
// Its policy value is historical. It is a decoding example, not evidence of
// present-day compliance. Header values were independently checked against the
// specification's bit layout; disclosed IDs use the documented range format.
const PUBLISHED = 'CQSbk4AQSbk4ANwAAAENAwCgAAAAAAAAAAYgACPAAAAA.IDKQA4AAgAKAGQAygAAA.YAAAAAAAAAAA';

test('decodes the published IAB example with expected metadata and disclosure IDs', () => {
  const report = inspect(PUBLISHED);
  assert.equal(report.version, 2);
  assert.equal(report.cmpId, 880);
  assert.equal(report.cmpVersion, 0);
  assert.equal(report.vendorListVersion, 48);
  assert.equal(report.policyVersion, 2);
  assert.equal(report.serviceSpecific, true);
  assert.deepEqual(report.vendorConsentIds, [1, 2, 3, 4]);
  assert.deepEqual(report.vendorDisclosedIds, [1, 2, 3, 4, 5, 100, 404]);
  assert.equal(report.vendorDisclosureSegmentPresent, true);
});
test('published example comparison distinguishes missing disclosure from an empty vector', () => {
  const diff = compareSignals(PUBLISHED, PUBLISHED.split('.')[0]);
  const group = diff.groups.find(item => item.key === 'vendorDisclosedIds');
  assert.equal(group.beforeSegmentPresent, true);
  assert.equal(group.afterSegmentPresent, false);
  assert.equal(group.comparable, false);
  assert.deepEqual(group.removed, []);
});
