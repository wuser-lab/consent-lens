import test from 'node:test';
import assert from 'node:assert/strict';
import { parseVendorList, checkVendorMembership, MAX_VENDOR_LIST_BYTES } from './vendor-list.js';
import { SYNTHETIC_VENDOR_LIST, SYNTHETIC_VENDOR_SIGNAL } from './vendor-demo.js';
const copy = () => structuredClone(SYNTHETIC_VENDOR_LIST);
test('matches names and memberships against an exact-version vendor list', () => {
  const report = checkVendorMembership(SYNTHETIC_VENDOR_SIGNAL, parseVendorList(JSON.stringify(copy())), { fileName: 'fixture.json', sha256: 'fixture-hash' });
  assert.equal(report.matched, true);
  assert.deepEqual(report.rows.map(row => row.id), [2, 3, 7, 9]);
  assert.equal(report.rows[0].name, 'Synthetic Exchange');
  assert.deepEqual(report.rows[0].flags, ['Disclosed']);
  assert.equal(report.rows[3].membership, 'not-listed');
  assert.equal(report.rows[2].deletedDate, '2020-03-11T00:00:00.000Z');
  assert.equal(report.source.sha256, 'fixture-hash');
});
test('refuses vendor lookup when either list version or policy differs', () => {
  for (const field of ['vendorListVersion', 'tcfPolicyVersion']) {
    const list = copy(); list[field]++;
    const report = checkVendorMembership(SYNTHETIC_VENDOR_SIGNAL, parseVendorList(JSON.stringify(list)));
    assert.equal(report.matched, false);
    assert.equal(report.mismatches.length, 1);
    assert.deepEqual(report.rows, []);
  }
});
test('empty supplied lists produce explicit not-listed observations', () => {
  const list = copy(); list.vendors = {};
  const report = checkVendorMembership(SYNTHETIC_VENDOR_SIGNAL, parseVendorList(JSON.stringify(list)));
  assert.ok(report.rows.every(row => row.membership === 'not-listed' && row.name === null));
});
test('absent optional segments do not invent vendor memberships', () => {
  const report = checkVendorMembership(SYNTHETIC_VENDOR_SIGNAL.split('.')[0], parseVendorList(JSON.stringify(copy())));
  assert.deepEqual(report.rows, []);
  assert.deepEqual(report.segmentPresence, { disclosed: false, allowed: false });
});
test('rejects invalid metadata and vendor entries', () => {
  for (const change of [
    list => { list.vendorListVersion = '15'; },
    list => { list.tcfPolicyVersion = 100; },
    list => { list.gvlSpecificationVersion = 99; },
    list => { list.lastUpdated = 'invalid'; },
    list => { list.vendors = []; },
    list => { list.vendors[2].id = 4; },
    list => { list.vendors[2].name = ''; },
    list => { list.vendors[2].name = {}; },
    list => { list.vendors[2].deletedDate = 'invalid'; },
    list => { list.vendors['02'] = list.vendors[2]; },
  ]) {
    const list = copy(); change(list);
    assert.throws(() => parseVendorList(JSON.stringify(list)));
  }
  for (const source of ['null', '[]', 'not JSON']) assert.throws(() => parseVendorList(source));
});
test('rejects oversized files before parsing', () => {
  assert.throws(() => parseVendorList(' '.repeat(MAX_VENDOR_LIST_BYTES + 1)), /16 MiB/);
});
