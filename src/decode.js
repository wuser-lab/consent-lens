import { TCString, Base64Url, BitLength, Segment, SegmentIDs } from '@iabtechlabtcf/core';

export const SAMPLE = 'COwK6gaOwK6gaFmAAAENAPCAAAAAAAAAAAAAAAAAAAAA';
function ids(vector) {
  const result = [];
  vector.forEach((enabled, id) => { if (enabled) result.push(id); });
  return result;
}
export function inspect(input) {
  const value = input.trim();
  if (!value) throw new Error('Paste a TCF v2 consent string to begin.');
  if (value.length > 100000) throw new Error('This inspector supports strings up to 100,000 characters.');
  if (value.includes('~')) throw new Error('This looks like a GPP string. This version supports standalone TCF v2 strings.');
  if (!/^C[A-Za-z0-9_-]*(\.[A-Za-z0-9_-]+)*$/.test(value)) throw new Error('Expected a TCF v2 string beginning with C, using base64url characters.');
  let model;
  try { model = TCString.decode(value); } catch { throw new Error('The TCF library could not decode this string. Check that it is complete and unmodified.'); }
  const segmentTypes = new Set(value.split('.').slice(1).map(segment => parseInt(Base64Url.decode(segment[0]).slice(0, BitLength.segmentType), 2)));
  const report = {
    version: model.version, policyVersion: model.policyVersion,
    cmpId: model.cmpId, cmpVersion: model.cmpVersion,
    vendorListVersion: model.vendorListVersion, language: model.consentLanguage,
    created: model.created.toISOString(), updated: model.lastUpdated.toISOString(),
    serviceSpecific: model.isServiceSpecific,
    purposeConsentIds: ids(model.purposeConsents),
    purposeLegitimateInterestIds: ids(model.purposeLegitimateInterests),
    vendorConsentIds: ids(model.vendorConsents),
    vendorLegitimateInterestIds: ids(model.vendorLegitimateInterests),
    vendorDisclosedIds: ids(model.vendorsDisclosed),
    vendorAllowedIds: ids(model.vendorsAllowed),
    vendorDisclosureSegmentPresent: segmentTypes.has(SegmentIDs.KEY_TO_ID[Segment.VENDORS_DISCLOSED]),
    vendorAllowedSegmentPresent: segmentTypes.has(SegmentIDs.KEY_TO_ID[Segment.VENDORS_ALLOWED]),
    specialFeatureOptinIds: ids(model.specialFeatureOptins),
    notes: ['This decoded report contains vendor IDs only. Use the separate vendor lookup to resolve names against a local version-matched list.', 'A successful decode does not validate all framework requirements.'],
  };
  if (model.lastUpdated < model.created) report.notes.push('The last-updated timestamp precedes the creation timestamp.');
  if (model.created > new Date() || model.lastUpdated > new Date()) report.notes.push('The signal contains a future timestamp.');
  if (!report.vendorConsentIds.length) report.notes.push('No vendor consent flags are set. Other legal-basis signals must be considered separately.');
  if (!report.vendorDisclosureSegmentPresent) report.notes.push('The disclosed-vendor segment is absent. This is different from an included segment listing no vendors; applicability depends on the policy and capture context.');
  return report;
}
