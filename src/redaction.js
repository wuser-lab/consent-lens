import { GROUPS, FIELDS, CHECKS } from './review.js';

const OUTCOMES = new Set(['incomplete', 'findings-recorded', 'reviewed-with-skips', 'reviewed-no-failures-recorded']);
const LIMITATIONS = [
  'Counts-only redacted summary. Names, free-text notes, source strings, timestamps, individual IDs, versions, filenames and file fingerprints are omitted.',
  'This summary cannot reopen a review or reproduce its evidence. Keep a full review file privately if needed.',
  'Unusual combinations of counts may still be linkable. Redaction does not guarantee anonymity or establish compliance.',
];
const count = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
const length = value => Array.isArray(value) ? value.length : 0;
const header = (kind, summary) => ({ schemaVersion: '1.0', tool: 'Consent Lens', reportType: 'redacted-summary', kind, summary, limitations: [...LIMITATIONS] });

// Construct a fresh allowlisted object. Never spread or copy context, capture,
// metadata values, source labels, evidence, or free text into a shared summary.
export function redactAudit(audit) {
  const comparison = audit.comparison;
  const restrictions = comparison.publisherRestrictions;
  const decisions = { needsReview: 0, pass: 0, fail: 0, skipped: 0 };
  for (const definition of CHECKS) {
    const status = audit.checks.find(check => check.id === definition.id)?.status;
    const key = status === 'needs-review' ? 'needsReview' : ['pass', 'fail', 'skipped'].includes(status) ? status : undefined;
    if (key) decisions[key]++;
  }
  return header('audit', {
    flagChanges: count(comparison.totalFlagChanges),
    signalGroups: Object.entries(GROUPS).map(([key, label]) => {
      const group = comparison.groups.find(group => group.key === key);
      const comparable = group?.comparable === true;
      return { key, label, comparable, addedCount: comparable ? length(group.added) : 0, removedCount: comparable ? length(group.removed) : 0, unchangedCount: comparable ? count(group.unchangedCount) : null };
    }),
    metadataChanged: Object.keys(FIELDS).filter(key => comparison.metadata.some(field => field.key === key && field.changed === true)),
    publisherRestrictions: Object.fromEntries(['addedCount', 'removedCount', 'changedCount', 'unchangedCount', 'totalChanges'].map(key => [key, count(restrictions[key])])),
    review: { state: audit.reviewState === 'reviewed' ? 'reviewed' : 'draft', outcome: OUTCOMES.has(audit.outcome) ? audit.outcome : 'incomplete', decisions },
  });
}

export function redactSignal(report) {
  return header('signal', {
    purposeConsentCount: length(report.purposeConsentIds),
    purposeLegitimateInterestCount: length(report.purposeLegitimateInterestIds),
    vendorConsentCount: length(report.vendorConsentIds),
    vendorLegitimateInterestCount: length(report.vendorLegitimateInterestIds),
    vendorsDisclosedCount: report.vendorDisclosureSegmentPresent === true ? length(report.vendorDisclosedIds) : null,
    vendorsAllowedCount: report.vendorAllowedSegmentPresent === true ? length(report.vendorAllowedIds) : null,
    specialFeatureOptinCount: length(report.specialFeatureOptinIds),
    publisherRestrictionPairCount: length(report.publisherRestrictions),
  });
}

export function redactVendor(report) {
  const matched = report.matched === true;
  return header('vendor', {
    matched,
    referencedVendorCount: matched ? length(report.rows) : null,
    listedVendorCount: matched ? report.rows.filter(row => row.membership === 'listed').length : null,
    notListedVendorCount: matched ? report.rows.filter(row => row.membership === 'not-listed').length : null,
    deletedEntryCount: matched ? report.rows.filter(row => row.deletedDate != null).length : null,
  });
}

export function redactedMarkdown(report) {
  if (report.reportType !== 'redacted-summary') throw new Error('Expected a redacted summary.');
  const summary = report.summary;
  const lines = ['# Consent Lens — redacted summary', '', 'Counts only. Source captures and identifying details are omitted.', ''];
  if (report.kind === 'audit') {
    lines.push(`Flag changes: ${count(summary.flagChanges)}`, '', '## Signal groups', '');
    for (const [key, label] of Object.entries(GROUPS)) {
      const group = summary.signalGroups.find(item => item.key === key);
      lines.push(group?.comparable === true ? `- ${label}: ${count(group.addedCount)} added, ${count(group.removedCount)} removed, ${count(group.unchangedCount)} unchanged.` : `- ${label}: not compared because a segment is absent.`);
    }
    const restrictions = summary.publisherRestrictions;
    lines.push('', '## Publisher restrictions', '', `${count(restrictions.totalChanges)} changed pairs: ${count(restrictions.addedCount)} added, ${count(restrictions.removedCount)} removed, ${count(restrictions.changedCount)} changed; ${count(restrictions.unchangedCount)} unchanged.`, '', '## Metadata fields changed', '');
    const changed = Object.entries(FIELDS).filter(([key]) => summary.metadataChanged.includes(key));
    lines.push(...(changed.length ? changed.map(([, label]) => `- ${label}`) : ['None recorded.']));
    const decisions = summary.review.decisions;
    lines.push('', '## Recorded decisions', '', `Needs review: ${count(decisions.needsReview)}; pass: ${count(decisions.pass)}; fail: ${count(decisions.fail)}; skipped: ${count(decisions.skipped)}.`);
  } else if (report.kind === 'signal') {
    for (const [key, label] of Object.entries({ purposeConsentCount: 'Purpose consent count', purposeLegitimateInterestCount: 'Purpose legitimate-interest count', vendorConsentCount: 'Vendor consent count', vendorLegitimateInterestCount: 'Vendor legitimate-interest count', vendorsDisclosedCount: 'Disclosed vendor count', vendorsAllowedCount: 'Allowed vendor count', specialFeatureOptinCount: 'Special-feature opt-in count', publisherRestrictionPairCount: 'Publisher-restriction pair count' })) lines.push(`- ${label}: ${summary[key] === null ? 'segment absent' : count(summary[key])}`);
  } else if (report.kind === 'vendor') {
    lines.push(summary.matched === true ? `Referenced vendors: ${count(summary.referencedVendorCount)}; listed: ${count(summary.listedVendorCount)}; not listed: ${count(summary.notListedVendorCount)}; deleted entries: ${count(summary.deletedEntryCount)}.` : 'Vendor membership not compared: list versions did not match.');
  } else throw new Error('Unknown redacted summary type.');
  lines.push('', '## Limits', '', ...LIMITATIONS.map(line => `- ${line}`));
  return lines.join('\n');
}
