import test from 'node:test';
import assert from 'node:assert/strict';
import { Base64Url, BitLength, FieldSequence, Fields, Segment, TCString } from '@iabtechlabtcf/core';
import { assertDecodeBudget, MAX_VENDOR_OPERATIONS, MAX_SIGNAL_CHARACTERS } from './decode-budget.js';
import { inspect, SAMPLE } from './decode.js';

const integer = (value, length) => value.toString(2).padStart(length, '0');
const range = (first, last = first) => first === last ? `0${integer(first, 16)}` : `1${integer(first, 16)}${integer(last, 16)}`;
const ranges = (entries, maxId = 65535) => `${integer(maxId, 16)}1${integer(entries.length, 12)}${entries.map(([first, last]) => range(first, last)).join('')}`;
const fieldVector = (length, bits = '0'.repeat(length)) => `${integer(length, 16)}0${bits}`;
const emptyVector = fieldVector(0);
const emptyRestrictions = integer(0, 12);
const coreFields = new FieldSequence()['2'][Segment.CORE];
const vendorOffset = coreFields.slice(0, coreFields.indexOf(Fields.vendorConsents)).reduce((sum, field) => sum + BitLength[field], 0);
const corePrefix = Base64Url.decode(SAMPLE).slice(0, vendorOffset);
const core = ({ consent = emptyVector, li = emptyVector, restrictions = emptyRestrictions } = {}) => Base64Url.encode(corePrefix + consent + li + restrictions);
const segment = (type, vector) => Base64Url.encode(integer(type, 3) + vector);
const fullRanges = count => Array.from({ length: count }, () => [1, 65535]);

test('preflight preserves ordinary core, empty segments and publisher-custom layouts', () => {
  assert.equal(assertDecodeBudget(SAMPLE).vendorOperations, 0);
  assert.equal(assertDecodeBudget(`${SAMPLE}.IAAA`).vendorOperations, 0);
  const publisher = Base64Url.encode(integer(3, 3) + '0'.repeat(48) + integer(63, 6) + '0'.repeat(126));
  assert.equal(assertDecodeBudget(`${SAMPLE}.${publisher}`).vendorOperations, 0);
});

test('supported ranges and bitfields decode with the original library', () => {
  const disclosed = segment(1, ranges([[1, 1000], [1001, 2000]], 2000));
  const signal = `${core({ consent: fieldVector(10, '1'.repeat(10)) })}.${disclosed}`;
  assert.equal(assertDecodeBudget(signal).vendorOperations, 2010);
  const report = inspect(signal);
  assert.equal(report.vendorConsentIds.length, 10);
  assert.equal(report.vendorDisclosedIds.length, 2000);
  assert.equal(report.vendorDisclosedIds.at(-1), 2000);
  assert.equal(assertDecodeBudget(`${SAMPLE}.${segment(2, fieldVector(65535))}`).vendorOperations, 65535);
});

test('overlapping ranges are charged repeatedly without adding a new validity rule', () => {
  const signal = `${SAMPLE}.${segment(1, ranges(Array.from({ length: 5 }, () => [1, 100]), 100))}`;
  assert.equal(assertDecodeBudget(signal).vendorOperations, 500);
  assert.equal(inspect(signal).vendorDisclosedIds.length, 100);
});

test('rejects repeated full-ID ranges in either core vendor vector', () => {
  for (const field of ['consent', 'li']) {
    assert.throws(() => assertDecodeBudget(core({ [field]: ranges(fullRanges(16)) })), /local decoding limit/);
  }
});

test('aggregates disclosed and allowed segment work under one budget', () => {
  const eight = ranges(fullRanges(8));
  assert.ok(assertDecodeBudget(`${SAMPLE}.${segment(1, eight)}`).vendorOperations < MAX_VENDOR_OPERATIONS);
  assert.throws(() => assertDecodeBudget(`${SAMPLE}.${segment(1, eight)}.${segment(2, eight)}`), /local decoding limit/);
  assert.throws(() => assertDecodeBudget(`${SAMPLE}.${segment(1, eight)}.${segment(1, eight)}`), /local decoding limit/);
});

test('counts publisher-restriction ranges across entries and groups', () => {
  const group = entries => integer(1, 6) + integer(0, 2) + integer(entries.length, 12) + entries.map(([first, last]) => range(first, last)).join('');
  const supported = integer(1, 12) + group([[1, 10], [11, 20]]);
  const signal = core({ restrictions: supported });
  assert.equal(assertDecodeBudget(signal).vendorOperations, 20);
  assert.doesNotThrow(() => inspect(signal));
  const excessive = integer(2, 12) + group(fullRanges(8)) + group(fullRanges(8));
  assert.throws(() => assertDecodeBudget(core({ restrictions: excessive })), /10,000 publisher-restriction/);
});

test('recognises the legacy default-consent bit when walking a version 1 core', () => {
  const v1Fields = new FieldSequence()['1'][Segment.CORE];
  const prefixLength = v1Fields.slice(0, v1Fields.indexOf(Fields.vendorConsents)).reduce((sum, field) => sum + BitLength[field], 0);
  const prefix = integer(1, 6) + '0'.repeat(prefixLength - 6);
  const vector = integer(65535, 16) + '10' + integer(16, 12) + fullRanges(16).map(([first, last]) => range(first, last)).join('');
  assert.throws(() => assertDecodeBudget(Base64Url.encode(prefix + vector)), /local decoding limit/);
});

test('truncated headers, bitfields and ranges fail before expansion', () => {
  for (const value of ['C', corePrefix ? Base64Url.encode(corePrefix) : 'C', `${SAMPLE}.${segment(1, integer(65535, 16) + '0')}`, `${SAMPLE}.${segment(1, integer(65535, 16) + '1' + integer(10, 12))}`]) {
    assert.throws(() => assertDecodeBudget(value), /incomplete or truncated/);
  }
  assert.throws(() => assertDecodeBudget('C'.repeat(MAX_SIGNAL_CHARACTERS + 1)), /characters/);
});

test('adversarial 22k-character payload is stopped before the library is invoked', { timeout: 1000 }, () => {
  const signal = `${SAMPLE}.${segment(1, ranges(fullRanges(4095)))}`;
  assert.ok(signal.length < MAX_SIGNAL_CHARACTERS);
  const original = TCString.decode;
  let decoderCalled = false;
  TCString.decode = () => { decoderCalled = true; throw new Error('Decoder should not be called'); };
  try {
    assert.throws(() => inspect(signal), /local decoding limit/);
    assert.equal(decoderCalled, false);
  } finally { TCString.decode = original; }
});
