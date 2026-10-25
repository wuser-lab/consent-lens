import { Base64Url } from '@iabtechlabtcf/core';
import { SAMPLE } from './decode.js';

// Synthetic test/demo captures only, not real CMP output or audit evidence.
// The published v2 bit layout places the first vendor vector at bit 213.
// Encode the restriction section independently of the application's normalizer.
const header = Base64Url.decode(SAMPLE).slice(0, 213);
const emptyVendorVector = '0'.repeat(17); // MaxVendorId=0; bitfield encoding.
function integer(value, width) {
  if (!Number.isInteger(value) || value < 0 || value >= 2 ** width) {
    throw new Error(`Synthetic fixture integer does not fit ${width} bits.`);
  }
  return value.toString(2).padStart(width, '0');
}

/**
 * groups: [{ purposeId, restrictionType, entries: [[startVendorId, endVendorId?], ...] }]
 * Repeated groups and overlapping entries intentionally remain in the encoding.
 */
export function createRestrictionSignal(groups = []) {
  const restrictions = integer(groups.length, 12) + groups.map(group => {
    const entries = group.entries.map(([first, last = first]) => (
      (first === last ? '0' : '1') + integer(first, 16) + (first === last ? '' : integer(last, 16))
    ));
    return integer(group.purposeId, 6) + integer(group.restrictionType, 2)
      + integer(entries.length, 12) + entries.join('');
  }).join('');
  return Base64Url.encode(header + emptyVendorVector + emptyVendorVector + restrictions);
}
