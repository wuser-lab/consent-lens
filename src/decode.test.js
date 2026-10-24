import test from 'node:test';
import assert from 'node:assert/strict';
import { inspect, SAMPLE } from './decode.js';
test('decodes known fixture with expected metadata and empty consent vectors', () => {
  const report = inspect(SAMPLE);
  assert.equal(report.version, 2);
  assert.equal(report.policyVersion, 2);
  assert.equal(report.cmpId, 358);
  assert.equal(report.vendorListVersion, 15);
  assert.equal(report.created, '2020-03-12T23:21:38.600Z');
  assert.deepEqual(report.vendorConsentIds, []);
  assert.deepEqual(report.purposeConsentIds, []);
});
test('extracts non-empty purpose and vendor flags from an independent fixture', () => {
  const report = inspect('CQcrdcAQcrdcAAKA9AENCKFsAP_AAEPAACRQL3wDwAdABcAGyAl8BooEVwKWgVmgtuC3cFvQW_guCC60F2AXZgu4C7sF3wXrgvaC94L2QEQAuADZAZ8A0WC3ALcwW7BbwC4AFwgLiwXHBciC5YLmQXWBdgC7UF3QXgAvIBeoC9gAAAAA.IL3wDQAdABcAGyAl8BooEVwKWgVmgtuC38FwQXWguwC7MF3AXdgu-C94.YAAAAAAAAAAA');
  assert.ok(report.vendorConsentIds.length > 0);
  assert.ok(report.purposeConsentIds.length > 0);
  assert.ok(report.vendorConsentIds.every(id => Number.isInteger(id) && id > 0));
});
test('ignores surrounding whitespace', () => assert.deepEqual(inspect('  ' + SAMPLE + '\n'), inspect(SAMPLE)));
test('rejects empty, malformed, truncated, GPP, and oversized inputs', () => {
  for (const input of ['', 'not-a-string', 'C!!!', 'C', 'DBABMA~' + SAMPLE, 'C' + 'A'.repeat(100000)]) assert.throws(() => inspect(input));
});
