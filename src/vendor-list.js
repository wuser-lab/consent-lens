import { inspect } from './decode.js';

export const MAX_VENDOR_LIST_BYTES = 16 * 1024 * 1024;
const VENDOR_FLAGS = { vendorConsentIds: 'Consent', vendorLegitimateInterestIds: 'Legitimate interest', vendorDisclosedIds: 'Disclosed', vendorAllowedIds: 'Allowed' };
function integer(value, name, minimum, maximum) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) throw new Error(`Invalid ${name}.`);
  return value;
}
export function parseVendorList(source) {
  if (typeof source !== 'string' || source.length > MAX_VENDOR_LIST_BYTES || new TextEncoder().encode(source).length > MAX_VENDOR_LIST_BYTES) throw new Error('Vendor list exceeds the 16 MiB limit.');
  let data;
  try { data = JSON.parse(source); } catch { throw new Error('Choose a valid vendor-list JSON file.'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Expected a vendor-list object.');
  const metadata = {
    vendorListVersion: integer(data.vendorListVersion, 'vendor list version', 1, 65535),
    policyVersion: integer(data.tcfPolicyVersion, 'TCF policy version', 1, 63),
    specificationVersion: integer(data.gvlSpecificationVersion, 'GVL specification version', 2, 3),
  };
  if (typeof data.lastUpdated !== 'string' || data.lastUpdated.length > 50 || !Number.isFinite(Date.parse(data.lastUpdated))) throw new Error('Invalid vendor-list update timestamp.');
  metadata.lastUpdated = new Date(data.lastUpdated).toISOString();
  if (!data.vendors || typeof data.vendors !== 'object' || Array.isArray(data.vendors)) throw new Error('Expected a vendors object.');
  const entries = Object.entries(data.vendors);
  if (entries.length > 65535) throw new Error('Too many vendor entries.');
  const vendors = new Map();
  for (const [key, vendor] of entries) {
    const id = Number(key);
    integer(id, 'vendor ID', 1, 65535);
    if (String(id) !== key || !vendor || vendor.id !== id) throw new Error(`Vendor key and ID do not match: ${key}.`);
    if (typeof vendor.name !== 'string' || !vendor.name.trim() || vendor.name.length > 1000) throw new Error(`Invalid name for vendor ${id}.`);
    let deletedDate = null;
    if (vendor.deletedDate !== undefined) {
      if (typeof vendor.deletedDate !== 'string' || vendor.deletedDate.length > 50 || !Number.isFinite(Date.parse(vendor.deletedDate))) throw new Error(`Invalid deletedDate for vendor ${id}.`);
      deletedDate = new Date(vendor.deletedDate).toISOString();
    }
    vendors.set(id, { id, name: vendor.name, deletedDate });
  }
  return { ...metadata, vendors };
}

export function checkVendorMembership(signal, vendorList, source = {}) {
  const decoded = inspect(signal);
  const mismatches = [];
  if (decoded.vendorListVersion !== vendorList.vendorListVersion) mismatches.push(`Signal uses vendor list ${decoded.vendorListVersion}; loaded list is ${vendorList.vendorListVersion}.`);
  if (decoded.policyVersion !== vendorList.policyVersion) mismatches.push(`Signal uses policy ${decoded.policyVersion}; loaded list uses policy ${vendorList.policyVersion}.`);
  const report = {
    tool: 'Consent Lens vendor lookup', generatedAt: new Date().toISOString(),
    source: { fileName: String(source.fileName || ''), sha256: source.sha256 || null },
    signalMetadata: { vendorListVersion: decoded.vendorListVersion, policyVersion: decoded.policyVersion },
    vendorListMetadata: { vendorListVersion: vendorList.vendorListVersion, policyVersion: vendorList.policyVersion, specificationVersion: vendorList.specificationVersion, lastUpdated: vendorList.lastUpdated },
    matched: mismatches.length === 0, mismatches, rows: [],
    limitations: ['Membership and names from a user-supplied list only; list authenticity and completeness are not verified.', 'Vendor declarations, legal bases and compliance are not evaluated.', 'A vendor not listed in the supplied file is not automatically a compliance failure.'],
  };
  if (mismatches.length) return report;
  const memberships = new Map();
  for (const [field, label] of Object.entries(VENDOR_FLAGS)) {
    for (const id of decoded[field]) {
      if (!memberships.has(id)) memberships.set(id, []);
      memberships.get(id).push(label);
    }
  }
  report.rows = [...memberships].sort(([first], [second]) => first - second).map(([id, flags]) => {
    const vendor = vendorList.vendors.get(id);
    return { id, name: vendor?.name || null, membership: vendor ? 'listed' : 'not-listed', deletedDate: vendor?.deletedDate || null, flags };
  });
  report.segmentPresence = { disclosed: decoded.vendorDisclosureSegmentPresent, allowed: decoded.vendorAllowedSegmentPresent };
  return report;
}
