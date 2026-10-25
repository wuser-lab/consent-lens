const LABELS = ['Not allowed', 'Require consent', 'Require legitimate interest'];
export const RESTRICTION_COVERAGE = 'publisher-restrictions-v1';

export function restrictionTypesLabel(types) {
  if (!types.length) return 'No encoded restriction';
  const labels = types.map(type => LABELS[type] ?? `Unknown encoded type ${type}`);
  return labels.length === 1 ? labels[0] : `Multiple encoded types: ${labels.join('; ')}`;
}

// Preserve every encoded type. The library's getRestrictionType() selects a
// single type when several are present and would hide contradictory evidence.
export function restrictionRows(vector) {
  const pairs = new Map();
  for (const restriction of vector.getRestrictions()) {
    for (const vendorId of vector.getVendors(restriction)) {
      const key = `${restriction.purposeId}:${vendorId}`;
      if (!pairs.has(key)) pairs.set(key, { purposeId: restriction.purposeId, vendorId, types: new Set() });
      pairs.get(key).types.add(restriction.restrictionType);
    }
  }
  return [...pairs.values()].map(({ purposeId, vendorId, types }) => ({ purposeId, vendorId, restrictionTypes: [...types].sort((a, b) => a - b) }))
    .sort((a, b) => a.purposeId - b.purposeId || a.vendorId - b.vendorId);
}

export function compareRestrictions(before, after) {
  const previous = new Map(before.map(row => [`${row.purposeId}:${row.vendorId}`, row]));
  const current = new Map(after.map(row => [`${row.purposeId}:${row.vendorId}`, row]));
  const result = { rows: [], addedCount: 0, removedCount: 0, changedCount: 0, unchangedCount: 0, totalChanges: 0, beforeCount: before.length, afterCount: after.length };
  for (const key of new Set([...previous.keys(), ...current.keys()])) {
    const first = previous.get(key), second = current.get(key);
    const beforeTypes = first?.restrictionTypes ?? [], afterTypes = second?.restrictionTypes ?? [];
    if (beforeTypes.length === afterTypes.length && beforeTypes.every((type, index) => type === afterTypes[index])) {
      result.unchangedCount++;
      continue;
    }
    const change = !first ? 'added' : !second ? 'removed' : 'changed';
    result[`${change}Count`]++;
    const { purposeId, vendorId } = first ?? second;
    result.rows.push({ purposeId, vendorId, before: beforeTypes, after: afterTypes, change });
  }
  result.rows.sort((a, b) => a.purposeId - b.purposeId || a.vendorId - b.vendorId);
  result.totalChanges = result.rows.length;
  return result;
}
