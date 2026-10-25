import { inspect } from './decode.js';
import { compareRestrictions, restrictionTypesLabel, RESTRICTION_COVERAGE } from './restrictions.js';

export const GROUPS = {
  purposeConsentIds: 'Purpose consent',
  purposeLegitimateInterestIds: 'Purpose legitimate interest',
  vendorConsentIds: 'Vendor consent',
  vendorLegitimateInterestIds: 'Vendor legitimate interest',
  specialFeatureOptinIds: 'Special feature opt-ins',
  vendorDisclosedIds: 'Disclosed vendor IDs',
  vendorAllowedIds: 'Allowed vendor IDs',
};
export const FIELDS = {
  version: 'TCF encoding version', policyVersion: 'Policy version', cmpId: 'CMP ID',
  cmpVersion: 'CMP version', vendorListVersion: 'Vendor list version',
  language: 'Language', created: 'Created (UTC)', updated: 'Updated (UTC)',
  serviceSpecific: 'Service specific',
  vendorDisclosureSegmentPresent: 'Disclosed-vendor segment present',
  vendorAllowedSegmentPresent: 'Allowed-vendor segment present',
};
export const CHECKS = [
  { id: 'capture', title: 'Capture context', description: 'Confirm the source, capture times, and user action for both signals.' },
  { id: 'signal', title: 'Signal transition', description: 'Review added and removed flags and publisher-restriction changes against the recorded user action and supporting evidence.' },
  { id: 'metadata', title: 'Metadata changes', description: 'Review CMP, policy, vendor-list, language, and timestamp differences. Explain relevant differences.' },
  { id: 'evidence', title: 'Evidence coverage', description: 'Confirm references support the finding. Record missing screenshots, network captures, or other limitations.' },
];
export const STATUSES = ['needs-review', 'pass', 'fail', 'skipped'];

export function compareSignals(beforeInput, afterInput) {
  let before, after;
  try { before = inspect(beforeInput); } catch (error) { throw new Error(`Before: ${error.message}`); }
  try { after = inspect(afterInput); } catch (error) { throw new Error(`After: ${error.message}`); }
  const groups = Object.entries(GROUPS).map(([key, label]) => {
    const presenceKey = { vendorDisclosedIds: 'vendorDisclosureSegmentPresent', vendorAllowedIds: 'vendorAllowedSegmentPresent' }[key];
    const comparable = !presenceKey || (before[presenceKey] && after[presenceKey]);
    const previous = new Set(before[key]);
    const current = new Set(after[key]);
    return { key, label, comparable,
      ...(presenceKey ? { beforeSegmentPresent: before[presenceKey], afterSegmentPresent: after[presenceKey], beforeCount: before[presenceKey] ? previous.size : null, afterCount: after[presenceKey] ? current.size : null } : {}),
      added: comparable ? [...current].filter(id => !previous.has(id)) : [],
      removed: comparable ? [...previous].filter(id => !current.has(id)) : [],
      unchangedCount: comparable ? [...current].filter(id => previous.has(id)).length : null };
  });
  const metadata = Object.entries(FIELDS).map(([key, label]) => ({ key, label, before: before[key], after: after[key], changed: before[key] !== after[key] }));
  return { before, after, groups, metadata, publisherRestrictions: compareRestrictions(before.publisherRestrictions, after.publisherRestrictions), rawStringsEqual: beforeInput.trim() === afterInput.trim(), totalFlagChanges: groups.reduce((sum, group) => sum + group.added.length + group.removed.length, 0) };
}

export function buildAudit({ before, after, context, checks, now = new Date() }) {
  const comparison = compareSignals(before, after);
  const normalised = CHECKS.map(definition => {
    const check = checks.find(item => item.id === definition.id);
    if (!check || !STATUSES.includes(check.status)) throw new Error(`Choose a valid status for ${definition.title}.`);
    return { ...definition, status: check.status, rationale: String(check.rationale || '').trim(), evidence: String(check.evidence || '').trim() };
  });
  const missing = [];
  for (const key of ['caseId', 'reviewer', 'source', 'action', 'beforeCapturedAt', 'afterCapturedAt', 'controlsVersion']) {
    if (!String(context[key] || '').trim()) missing.push(`Missing ${key}.`);
  }
  if (!context.participantType || context.participantType === 'unspecified') missing.push('Specify the participant type.');
  for (const key of ['beforeCapturedAt', 'afterCapturedAt']) {
    if (context[key] && !Number.isFinite(Date.parse(context[key]))) throw new Error(`Invalid ${key}.`);
  }
  if (context.beforeCapturedAt && context.afterCapturedAt && Date.parse(context.afterCapturedAt) < Date.parse(context.beforeCapturedAt)) missing.push('The after capture precedes the before capture; explain or correct the chronology.');
  for (const check of normalised) {
    if (check.status === 'needs-review') missing.push(`${check.title} needs review.`);
    if (check.status !== 'needs-review' && !check.rationale) missing.push(`${check.title} needs a rationale.`);
    if (['pass', 'fail'].includes(check.status) && !check.evidence) missing.push(`${check.title} needs an evidence reference.`);
  }
  return {
    schemaVersion: '1.0', tool: 'Consent Lens', exportedAt: now.toISOString(),
    comparisonCoverage: RESTRICTION_COVERAGE,
    reviewState: missing.length ? 'draft' : 'reviewed',
    outcome: missing.length ? 'incomplete' : normalised.some(check => check.status === 'fail') ? 'findings-recorded' : normalised.some(check => check.status === 'skipped') ? 'reviewed-with-skips' : 'reviewed-no-failures-recorded',
    context: { ...context }, captures: { before: before.trim(), after: after.trim() },
    comparison, checks: normalised, outstanding: missing,
    limitations: [
      'Reviewer-defined technical review, not an official IAB Controls Catalogue assessment or legal compliance verdict.',
      'No vendor-list, domain-ownership, network-traffic, screenshot-content, or evidence-link validation.',
      'Diff covers the displayed metadata, seven signal groups, and encoded publisher restrictions, not every TCF field. Optional segment IDs are compared only when that segment is present in both captures.',
      'Publisher-restriction differences describe encoded vendor-purpose pairs. No encoded restriction does not establish permission; vendor declarations and policy applicability are not evaluated. Multiple encoded types are retained without choosing a winner.',
      'Evidence entries are references and notes; linked files are not embedded in this report.',
      'Decoded flags alone do not establish permission to process personal data.',
    ],
  };
}

function safe(value) { return String(value ?? '').replaceAll('`', "'").replaceAll('\r', '').split('\n').join(' / '); }
export function auditMarkdown(audit) {
  const lines = ['# Consent Lens — technical review', '', `Exported: ${audit.exportedAt}`, `State: ${audit.reviewState}`, `Outcome: ${audit.outcome}`, '', '## Context', ''];
  for (const [key, value] of Object.entries(audit.context)) lines.push(`- ${key}: ${safe(value) || 'Not recorded'}`);
  lines.push('', '## Signal changes', '');
  for (const group of audit.comparison.groups) {
    if (group.comparable) lines.push(`- ${group.label}: added ${group.added.join(', ') || 'none'}; removed ${group.removed.join(', ') || 'none'}; unchanged ${group.unchangedCount}.`);
    else lines.push(`- ${group.label}: not compared because a segment is absent. Before: ${group.beforeSegmentPresent ? `present (${group.beforeCount} IDs)` : 'absent'}; after: ${group.afterSegmentPresent ? `present (${group.afterCount} IDs)` : 'absent'}.`);
  }
  const restrictions = audit.comparison.publisherRestrictions;
  lines.push('', '## Publisher restrictions', '', `${restrictions.totalChanges} changed vendor-purpose pairs: ${restrictions.addedCount} added, ${restrictions.removedCount} removed, ${restrictions.changedCount} changed; ${restrictions.unchangedCount} unchanged.`, '', 'No encoded restriction does not establish permission to process. Vendor declarations and policy applicability require separate review. Multiple encoded types are preserved.', '');
  for (const row of restrictions.rows) lines.push(`- Purpose ${row.purposeId}, vendor ${row.vendorId}: ${restrictionTypesLabel(row.before)} → ${restrictionTypesLabel(row.after)} (${row.change}).`);
  if (!restrictions.rows.length) lines.push('No publisher-restriction changes detected.');
  lines.push('', '## Metadata', '');
  for (const field of audit.comparison.metadata) lines.push(`- ${field.label}: ${safe(field.before)} → ${safe(field.after)}${field.changed ? ' (changed)' : ''}`);
  lines.push('', '## Reviewer decisions', '');
  for (const check of audit.checks) lines.push(`### ${check.title} — ${check.status}`, '', `Rationale: ${safe(check.rationale) || 'Not recorded'}`, `Evidence: ${safe(check.evidence) || 'Not recorded'}`, '');
  lines.push('## Outstanding items', '', ...audit.outstanding.map(item => `- ${item}`));
  if (!audit.outstanding.length) lines.push('None recorded.');
  lines.push('', '## Source strings', '', 'Before:', '```text', audit.captures.before, '```', '', 'After:', '```text', audit.captures.after, '```', '', '## Limitations', '', ...audit.limitations.map(item => `- ${item}`));
  return lines.join('\n');
}
