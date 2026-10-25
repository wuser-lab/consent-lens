import { buildAudit, CHECKS, STATUSES } from './review.js';
import { RESTRICTION_COVERAGE } from './restrictions.js';
import { assertReportSize } from './report-limits.js';

export { MAX_REPORT_BYTES } from './report-limits.js';
const CONTEXT_LIMITS = { caseId: 200, reviewer: 200, source: 2000, participantType: 100, action: 1000, controlsVersion: 500, evidenceNotes: 20000, captureTimeZone: 200 };
const PARTICIPANTS = ['unspecified', 'Web CMP', 'Native mobile CMP', 'Web vendor', 'Native mobile vendor', 'Other'];
function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid ${name}: expected an object.`);
  return value;
}
function text(value, name, limit, optional = false) {
  if (optional && value === undefined) return '';
  if (typeof value !== 'string' || value.length > limit) throw new Error(`Invalid ${name}: expected text up to ${limit} characters.`);
  return value;
}
function timestamp(value, name) {
  if (value === undefined || value === '') return '';
  text(value, name, 50);
  const match = /^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);
  const date = new Date(value);
  if (!match || !Number.isFinite(date.getTime()) || new Date(`${match[1]}T00:00:00Z`).toISOString().slice(0, 10) !== match[1]) throw new Error(`Invalid ${name}: use an ISO timestamp with timezone.`);
  return date.toISOString();
}

export function parseAuditReport(source) {
  assertReportSize(source);
  let data;
  try { data = JSON.parse(source); } catch { throw new Error('This file is not valid JSON. Choose a Consent Lens JSON report.'); }
  object(data, 'report');
  if (data.tool !== 'Consent Lens' || data.schemaVersion !== '1.0') throw new Error('Expected a Consent Lens report with schema version 1.0.');
  const captures = object(data.captures, 'captures');
  const before = text(captures.before, 'before signal', 100000);
  const after = text(captures.after, 'after signal', 100000);
  const inputContext = object(data.context, 'context');
  const context = {};
  for (const [key, limit] of Object.entries(CONTEXT_LIMITS)) context[key] = text(inputContext[key], key, limit, true);
  context.participantType ||= 'unspecified';
  if (!PARTICIPANTS.includes(context.participantType)) throw new Error('Unrecognised participant type.');
  for (const key of ['beforeCapturedAt', 'afterCapturedAt']) context[key] = timestamp(inputContext[key], key);
  if (!Array.isArray(data.checks) || data.checks.length !== CHECKS.length) throw new Error('The report must contain all four review checks.');
  const checks = CHECKS.map(definition => {
    const matches = data.checks.filter(check => check && check.id === definition.id);
    if (matches.length !== 1) throw new Error(`Missing or duplicate ${definition.title} check.`);
    const check = matches[0];
    if (!STATUSES.includes(check.status)) throw new Error(`Invalid decision for ${definition.title}.`);
    return { id: definition.id, status: check.status, rationale: text(check.rationale, 'rationale', 10000, true), evidence: text(check.evidence, 'evidence', 4000, true) };
  });
  // Ignore imported outcomes and decoded data: rebuild everything from captures.
  const legacyCoverage = data.comparisonCoverage !== RESTRICTION_COVERAGE;
  if (legacyCoverage) checks.find(check => check.id === 'signal').status = 'needs-review';
  const audit = buildAudit({ before, after, context, checks });
  if (legacyCoverage) audit.importWarnings = ['This report predates publisher-restriction comparison or has no matching coverage marker. Signal transition was reset to Needs review; existing notes and evidence references were retained.'];
  return audit;
}

export function localCaptureValue(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  const pad = number => String(number).padStart(2, '0');
  return `${String(date.getFullYear()).padStart(4, '0')}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function captureInstant(localValue, restored) {
  if (!localValue) return '';
  // Preserve milliseconds and the exact instant during DST's repeated hour.
  if (restored && localValue === restored.display) return restored.iso;
  return new Date(localValue).toISOString();
}
