import { CHECKS, compareSignals, buildAudit, auditMarkdown } from './review.js';
import { EXAMPLE_BEFORE, EXAMPLE_AFTER } from './examples.js';

const $ = id => document.getElementById(id);
const contextFields = { caseId: 'case-id', reviewer: 'reviewer', source: 'source', participantType: 'participant-type', action: 'action', controlsVersion: 'controls-version', evidenceNotes: 'evidence-notes' };
let comparisonReady = false;
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function field(label, id, node) {
  const wrapper = element('div');
  const caption = element('label', label); caption.htmlFor = id; node.id = id;
  wrapper.append(caption, node); return wrapper;
}
for (const check of CHECKS) {
  const card = element('section', undefined, 'review-check');
  card.append(element('h3', check.title), element('p', check.description, 'hint'));
  const select = element('select'); select.setAttribute('aria-label', `${check.title} status`);
  for (const [value, label] of [['needs-review', 'Needs review'], ['pass', 'Pass'], ['fail', 'Fail'], ['skipped', 'Skipped']]) {
    const option = element('option', label); option.value = value; select.append(option);
  }
  const rationale = element('textarea'); rationale.maxLength = 10000; rationale.rows = 2; rationale.placeholder = 'What did you check? Explain the decision, or why the check was skipped.';
  const evidence = element('input'); evidence.maxLength = 4000; evidence.placeholder = 'e.g. E1 screenshot, E2 request log, or a reference URL';
  card.append(field('Decision', `decision-${check.id}`, select), field('Rationale / skip reason', `rationale-${check.id}`, rationale), field('Evidence references', `evidence-${check.id}`, evidence));
  $('review-checks').append(card);
}
function iso(id) {
  const value = $(id).value;
  return value ? new Date(value).toISOString() : '';
}
function collect() {
  const context = Object.fromEntries(Object.entries(contextFields).map(([key, id]) => [key, $(id).value.trim()]));
  context.beforeCapturedAt = iso('before-time'); context.afterCapturedAt = iso('after-time');
  context.captureTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return buildAudit({ before: $('before-signal').value, after: $('after-signal').value, context,
    checks: CHECKS.map(check => ({ id: check.id, status: $(`decision-${check.id}`).value, rationale: $(`rationale-${check.id}`).value, evidence: $(`evidence-${check.id}`).value })) });
}
function readiness() {
  $('export-audit').disabled = $('export-markdown').disabled = !comparisonReady;
  $('outstanding-items').replaceChildren();
  if (!comparisonReady) {
    $('review-state').textContent = 'Draft';
    $('report-readiness').textContent = 'Compare the current signals to prepare a report.';
    return;
  }
  try {
    const audit = collect();
    $('review-state').textContent = audit.reviewState === 'draft' ? 'Draft · incomplete' : audit.outcome === 'reviewed-with-skips' ? 'Reviewed · includes skips' : audit.outcome === 'findings-recorded' ? 'Reviewed · findings recorded' : 'Reviewed';
    $('report-readiness').textContent = audit.outstanding.length ? `${audit.outstanding.length} outstanding items. You can export a draft now.` : 'Required review fields are complete. This describes review completion, not a compliance certification.';
    $('outstanding-items').append(...audit.outstanding.map(item => element('li', item)));
  } catch (error) {
    $('report-readiness').textContent = error.message;
    $('export-audit').disabled = $('export-markdown').disabled = true;
  }
}
function compare() {
  comparisonReady = false; $('comparison-results').hidden = true;
  try {
    const comparison = compareSignals($('before-signal').value, $('after-signal').value);
    $('diff-groups').replaceChildren();
    for (const group of comparison.groups) {
      const card = element('section', undefined, 'metric');
      card.append(element('h3', group.label), element('p', `Added IDs: ${group.added.join(', ') || 'None'}`, 'added'), element('p', `Removed IDs: ${group.removed.join(', ') || 'None'}`, 'removed'), element('p', `Unchanged set flags: ${group.unchangedCount}`, 'hint'));
      $('diff-groups').append(card);
    }
    $('metadata-diff').replaceChildren(...comparison.metadata.map(item => {
      const row = element('tr'); if (item.changed) row.className = 'changed';
      row.append(element('th', item.label), element('td', String(item.before)), element('td', String(item.after))); return row;
    }));
    $('change-count').textContent = `${comparison.totalFlagChanges} flag changes`;
    $('comparison-caveat').textContent = comparison.rawStringsEqual ? 'The input strings are identical. No signal changes were observed.' : 'Comparison covers the five signal groups and metadata below. Other TCF fields and publisher restrictions are outside this comparison.';
    $('comparison-status').className = 'success'; $('comparison-status').textContent = 'Both signals decoded. Changes are observations; review their meaning against your evidence.';
    $('comparison-results').hidden = false; comparisonReady = true;
  } catch (error) { $('comparison-status').className = 'error'; $('comparison-status').textContent = error.message; }
  readiness();
}
function invalidateSignals() {
  comparisonReady = false; $('comparison-results').hidden = true;
  for (const check of CHECKS) $(`decision-${check.id}`).value = 'needs-review';
  $('comparison-status').textContent = 'Signals changed. Decisions reset to Needs review; existing notes are retained for rechecking. Compare again to refresh the report.';
  readiness();
}
function download(text, type, extension) {
  const blob = new Blob([text], { type }); const url = URL.createObjectURL(blob);
  const link = element('a'); link.href = url; link.download = `consent-review.${extension}`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('comparison-form').addEventListener('submit', event => { event.preventDefault(); compare(); });
for (const id of ['before-signal', 'after-signal']) $(id).addEventListener('input', invalidateSignals);
const contextInputIds = new Set([...Object.values(contextFields), 'before-time', 'after-time']);
function handleReviewEdit(event) {
  if (contextInputIds.has(event.target.id)) {
    for (const check of CHECKS) $(`decision-${check.id}`).value = 'needs-review';
    $('comparison-status').textContent = 'Audit context changed. Decisions reset to Needs review; existing notes and signal differences are retained for rechecking.';
  }
  readiness();
}
$('audit-workspace').addEventListener('input', handleReviewEdit);
$('audit-workspace').addEventListener('change', handleReviewEdit);
for (const [id, kind] of [['export-audit', 'json'], ['export-markdown', 'md']]) $(id).addEventListener('click', () => {
  if (!comparisonReady) return;
  try { const audit = collect(); download(kind === 'json' ? JSON.stringify(audit, null, 2) : auditMarkdown(audit), kind === 'json' ? 'application/json' : 'text/markdown;charset=utf-8', kind); }
  catch (error) { $('report-readiness').textContent = error.message; }
});
$('comparison-sample').addEventListener('click', () => {
  if (Object.values(contextFields).some(id => id !== 'participant-type' && $(id).value) || $('before-signal').value || $('after-signal').value || CHECKS.some(check => $(`rationale-${check.id}`).value || $(`evidence-${check.id}`).value || $(`decision-${check.id}`).value !== 'needs-review')) {
    if (!window.confirm('Replace the current captures, context, and review notes with a synthetic example? Export your current report first if you need it.')) return;
  }
  $('before-signal').value = EXAMPLE_BEFORE; $('after-signal').value = EXAMPLE_AFTER;
  for (const id of Object.values(contextFields)) $(id).value = '';
  $('participant-type').value = 'Other';
  $('case-id').value = 'SYNTHETIC-DEMO'; $('source').value = 'Generated locally with IAB encoder; no real site or CMP';
  $('action').value = 'Synthetic addition of purpose consent flags 1 and 2';
  $('controls-version').value = 'Exploratory technical review; no official controls applied';
  $('evidence-notes').value = 'Demo signals generated from an empty synthetic vendor list. CMP ID is illustrative. No actual user action or screenshots were captured.';
  $('before-time').value = ''; $('after-time').value = '';
  for (const check of CHECKS) { $(`decision-${check.id}`).value = 'needs-review'; $(`rationale-${check.id}`).value = ''; $(`evidence-${check.id}`).value = ''; }
  compare();
});
for (const mode of ['compare', 'inspect']) $(`${mode}-tab`).addEventListener('click', () => {
  const comparing = mode === 'compare';
  $('audit-workspace').hidden = !comparing; $('single-workspace').hidden = comparing;
  for (const name of ['compare', 'inspect']) {
    $(`${name}-tab`).setAttribute('aria-pressed', String(name === mode));
    $(`${name}-tab`).classList.toggle('secondary', name !== mode);
  }
});
