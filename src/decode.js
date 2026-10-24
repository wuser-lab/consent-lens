import { TCString } from '@iabtechlabtcf/core';

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
    specialFeatureOptinIds: ids(model.specialFeatureOptins),
    notes: ['Vendor IDs are shown without names; this version does not fetch a Global Vendor List.', 'A successful decode does not validate all framework requirements.'],
  };
  if (model.lastUpdated < model.created) report.notes.push('The last-updated timestamp precedes the creation timestamp.');
  if (model.created > new Date() || model.lastUpdated > new Date()) report.notes.push('The signal contains a future timestamp.');
  if (!report.vendorConsentIds.length) report.notes.push('No vendor consent flags are set. Other legal-basis signals must be considered separately.');
  return report;
}
