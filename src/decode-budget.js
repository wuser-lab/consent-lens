import { Base64Url, BitLength, FieldSequence, Fields, Segment, SegmentIDs } from '@iabtechlabtcf/core';

// This is a local processing limit, not a TCF validity or compliance rule.
export const MAX_VENDOR_OPERATIONS = 1_000_000;
export const MAX_RESTRICTION_OPERATIONS = 10_000;
export const MAX_SIGNAL_CHARACTERS = 100000;
const fieldSequences = new FieldSequence();
const vendorVectors = new Set([
  Fields.vendorConsents, Fields.vendorLegitimateInterests,
  Fields.vendorsDisclosed, Fields.vendorsAllowed,
]);

class BitReader {
  constructor(bits) { this.bits = bits; this.position = 0; }
  require(length) {
    if (!Number.isInteger(length) || length < 0 || this.position + length > this.bits.length) {
      throw new Error('The TCF signal is incomplete or truncated. Check the original capture.');
    }
  }
  peek(length) {
    this.require(length);
    return Number.parseInt(this.bits.slice(this.position, this.position + length), 2);
  }
  read(length) { const value = this.peek(length); this.position += length; return value; }
  skip(length) { this.require(length); this.position += length; }
}

/**
 * Walk the pinned IAB library's field layouts without expanding vendor IDs.
 * The upstream vendor and publisher-restriction decoders expand every range,
 * including overlapping ranges; charge each expansion, not only distinct IDs.
 * This does not replace the library decoder or validate framework policies.
 */
export function assertDecodeBudget(encoded) {
  if (typeof encoded !== 'string' || !encoded || encoded.length > MAX_SIGNAL_CHARACTERS) {
    throw new Error(`This inspector supports signals up to ${MAX_SIGNAL_CHARACTERS.toLocaleString('en-US')} characters.`);
  }
  let vendorOperations = 0;
  let restrictionOperations = 0;
  function charge(amount) {
    vendorOperations += amount;
    if (vendorOperations > MAX_VENDOR_OPERATIONS) {
      throw new Error('This signal exceeds the local decoding limit of 1,000,000 vendor-ID expansion steps. Inspect it with an offline tool that limits resource use. This is a processing limit, not a compliance result.');
    }
  }
  function ranges(reader, count, publisherRestriction = false) {
    for (let index = 0; index < count; index++) {
      const isRange = reader.read(BitLength.singleOrRange);
      const first = reader.read(BitLength.vendorId);
      const last = isRange ? reader.read(BitLength.vendorId) : first;
      // Reversed ranges do no work in the vendor decoder (and are rejected by
      // the restriction decoder). Leave their semantic handling to the library.
      const operations = Math.max(0, last - first + 1);
      if (publisherRestriction) {
        restrictionOperations += operations;
        if (restrictionOperations > MAX_RESTRICTION_OPERATIONS) {
          throw new Error('This signal exceeds the local processing limit of 10,000 publisher-restriction expansion steps. This is a processing limit, not a compliance result.');
        }
      }
      charge(operations);
    }
  }
  function vendorVector(reader, version) {
    const maxId = reader.read(BitLength.maxId);
    const isRange = reader.read(BitLength.encodingType);
    if (isRange) {
      if (version === 1) reader.skip(1); // Legacy default-consent flag.
      ranges(reader, reader.read(BitLength.numEntries));
    } else {
      reader.skip(maxId);
      charge(maxId); // Fixed-vector decoding visits every encoded position.
    }
  }
  function restrictions(reader) {
    const groups = reader.read(BitLength.numRestrictions);
    for (let index = 0; index < groups; index++) {
      reader.skip(BitLength.purposeId + BitLength.restrictionType);
      ranges(reader, reader.read(BitLength.numEntries), true);
    }
  }

  let version = 2;
  for (const encodedSegment of encoded.split('.')) {
    const reader = new BitReader(Base64Url.decode(encodedSegment));
    const segment = SegmentIDs.ID_TO_KEY[reader.peek(BitLength.segmentType)];
    if (segment === Segment.CORE) version = reader.peek(BitLength.version);
    else reader.skip(BitLength.segmentType);
    const sequence = fieldSequences[String(version)]?.[segment];
    if (!sequence) throw new Error('This signal uses a segment layout this inspector does not support.');
    let customPurposes = 0;
    for (const field of sequence) {
      if (vendorVectors.has(field)) vendorVector(reader, version);
      else if (field === Fields.publisherRestrictions) restrictions(reader);
      else if (field === Fields.numCustomPurposes) customPurposes = reader.read(BitLength.numCustomPurposes);
      else if (field === Fields.publisherCustomConsents || field === Fields.publisherCustomLegitimateInterests) reader.skip(customPurposes);
      else reader.skip(BitLength[field]);
    }
  }
  return { vendorOperations, restrictionOperations, limit: MAX_VENDOR_OPERATIONS };
}
