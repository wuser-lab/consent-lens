import { CHECKS, compareSignals, buildAudit, auditMarkdown } from './review.js';
import { EXAMPLE_BEFORE, EXAMPLE_AFTER } from './examples.js';
import { parseAuditReport, MAX_REPORT_BYTES, localCaptureValue, captureInstant } from './import-report.js';
import { restrictionTypesLabel } from './restrictions.js';
import { assertReportSize } from './report-limits.js';

const $ = id => document.getElementById(id);
const contextFields = { caseId: 'case-id', reviewer: 'reviewer', source: 'source', participantType: 'participant-type', action: 'action', controlsVersion: 'controls-version', evidenceNotes: 'evidence-notes' };
let comparisonReady = false;
let editRevision = 0;
const restoredCaptureTimes = new Map();
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function clearRestrictionComparison() {
  $('restriction-rows').replaceChildren();
  $('restriction-summary').textContent = '';
  $('restriction-row-count').textContent = '';
  $('restriction-table').hidden = true;
}
function renderRestrictionComparison(diff) {
  $('restriction-summary').textContent = `${diff.totalChanges} restriction changes across vendor-purpose pairs: ${diff.addedCount} added, ${diff.removedCount} removed, ${diff.changedCount} changed; ${diff.unchangedCount} unchanged. Before: ${diff.beforeCount} restricted pairs; after: ${diff.afterCount}.`;
  $('restriction-rows').replaceChildren(...diff.rows.slice(0, 200).map(item => {
    const row = element('tr');
    const change = { added: 'Added', removed: 'Removed', changed: 'Changed' }[item.change];
    for (const value of [item.purposeId, item.vendorId, restrictionTypesLabel(item.before), restrictionTypesLabel(item.after), change]) row.append(element('td', String(value)));
    return row;
  }));
  $('restriction-table').hidden = !diff.rows.length;
  $('restriction-row-count').textContent = diff.rows.length ? `Showing ${Math.min(diff.rows.length, 200)} of ${diff.rows.length} changed vendor-purpose pairs. The JSON export includes the complete difference table.` : 'No publisher-restriction changes detected.';
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
  return captureInstant($(id).value, restoredCaptureTimes.get(id));
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
  clearRestrictionComparison();
  try {
    const comparison = compareSignals($('before-signal').value, $('after-signal').value);
    $('diff-groups').replaceChildren();
    for (const group of comparison.groups) {
      const card = element('section', undefined, 'metric');
      card.append(element('h3', group.label));
      if ('beforeSegmentPresent' in group) card.append(element('p', `Before: ${group.beforeSegmentPresent ? `present · ${group.beforeCount} IDs` : 'segment absent'}`, 'hint'), element('p', `After: ${group.afterSegmentPresent ? `present · ${group.afterCount} IDs` : 'segment absent'}`, 'hint'));
      if (group.comparable) card.append(element('p', `Added IDs: ${group.added.join(', ') || 'None'}`, 'added'), element('p', `Removed IDs: ${group.removed.join(', ') || 'None'}`, 'removed'), element('p', `Unchanged set flags: ${group.unchangedCount}`, 'hint'));
      else card.append(element('p', 'IDs not compared: a segment is absent.'));
      $('diff-groups').append(card);
    }
    renderRestrictionComparison(comparison.publisherRestrictions);
    $('metadata-diff').replaceChildren(...comparison.metadata.map(item => {
      const row = element('tr'); if (item.changed) row.className = 'changed';
      row.append(element('th', item.label), element('td', String(item.before)), element('td', String(item.after))); return row;
    }));
    $('change-count').textContent = `${comparison.totalFlagChanges} flag changes · ${comparison.publisherRestrictions.totalChanges} restriction changes`;
    $('comparison-caveat').textContent = comparison.rawStringsEqual ? 'The input strings are identical. No flag or publisher-restriction differences were detected. Optional segment IDs are compared only when present in both captures.' : 'Comparison covers seven signal groups, publisher restrictions, and the metadata below. Optional segment IDs are compared only when present in both captures.';
    $('comparison-status').className = 'success'; $('comparison-status').textContent = 'Both signals decoded. Changes are observations; review their meaning against your evidence.';
    $('comparison-results').hidden = false; comparisonReady = true;
  } catch (error) { $('comparison-status').className = 'error'; $('comparison-status').textContent = error.message; }
  readiness();
}
function invalidateSignals() {
  comparisonReady = false; $('comparison-results').hidden = true;
  clearRestrictionComparison();
  for (const check of CHECKS) $(`decision-${check.id}`).value = 'needs-review';
  $('comparison-status').textContent = 'Signals changed. Decisions reset to Needs review; existing notes are retained for rechecking. Compare again to refresh the report.';
  readiness();
}
function download(text, type, extension, fileName = `consent-review.${extension}`) {
  assertReportSize(text);
  const blob = new Blob([text], { type }); const url = URL.createObjectURL(blob);
  const link = element('a'); link.href = url; link.download = fileName; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
for (const link of document.querySelectorAll('.import-panel a[download]')) link.addEventListener('click', async event => {
  event.preventDefault();
  $('import-status').textContent = 'Preparing synthetic example download…';
  try {
    const source = new URL(link.href);
    if (source.origin !== window.location.origin) throw new Error('The example must come from this site.');
    const response = await fetch(source.href, { credentials: 'omit', mode: 'same-origin' });
    if (!response.ok) throw new Error(`The example could not be loaded (HTTP ${response.status}).`);
    if (Number(response.headers.get('content-length')) > MAX_REPORT_BYTES) throw new Error('Example exceeds the 32 MiB report limit.');
    const text = await response.text();
    assertReportSize(text);
    parseAuditReport(text); // Validate without changing the original file or current review.
    download(text, 'application/json', 'json', source.pathname.split('/').pop());
    $('import-status').textContent = 'Synthetic example downloaded. Use Resume a saved review to choose it.';
  } catch (error) {
    $('import-status').textContent = `Synthetic example not downloaded: ${error.message} Current review retained.`;
  }
});
$('comparison-form').addEventListener('submit', event => { event.preventDefault(); compare(); });
for (const id of ['before-signal', 'after-signal']) $(id).addEventListener('input', invalidateSignals);
const contextInputIds = new Set([...Object.values(contextFields), 'before-time', 'after-time']);
function handleReviewEdit(event) {
  editRevision++;
  if (['before-time', 'after-time'].includes(event.target.id)) restoredCaptureTimes.delete(event.target.id);
  if (contextInputIds.has(event.target.id)) {
    for (const check of CHECKS) $(`decision-${check.id}`).value = 'needs-review';
    $('comparison-status').textContent = 'Audit context changed. Decisions reset to Needs review; existing notes and signal differences are retained for rechecking.';
  }
  readiness();
}
$('audit-workspace').addEventListener('input', handleReviewEdit);
$('audit-workspace').addEventListener('change', handleReviewEdit);
function hasWork() {
  return Object.values(contextFields).some(id => id === 'participant-type' ? $(id).value !== 'unspecified' : $(id).value) || ['before-signal', 'after-signal', 'before-time', 'after-time'].some(id => $(id).value) || CHECKS.some(check => $(`rationale-${check.id}`).value || $(`evidence-${check.id}`).value || $(`decision-${check.id}`).value !== 'needs-review');
}
$('import-report').addEventListener('change', async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  const revision = editRevision;
  $('import-status').textContent = 'Reading report locally…';
  try {
    if (file.size > MAX_REPORT_BYTES) throw new Error('Report exceeds the 32 MiB import limit.');
    const audit = parseAuditReport(await file.text());
    if (revision !== editRevision) throw new Error('The review changed while the file was loading. Choose the report again when ready.');
    if (hasWork() && !window.confirm('Replace the current review with this report? Export your current work first if you need it.')) {
      $('import-status').textContent = 'Import cancelled. Current review retained.';
      return;
    }
    $('before-signal').value = audit.captures.before;
    $('after-signal').value = audit.captures.after;
    for (const [key, id] of Object.entries(contextFields)) $(id).value = audit.context[key];
    restoredCaptureTimes.clear();
    for (const [id, key] of [['before-time', 'beforeCapturedAt'], ['after-time', 'afterCapturedAt']]) {
      const iso = audit.context[key];
      $(id).value = localCaptureValue(iso);
      if (iso) restoredCaptureTimes.set(id, { display: $(id).value, iso });
    }
    for (const check of audit.checks) {
      $(`decision-${check.id}`).value = check.status;
      $(`rationale-${check.id}`).value = check.rationale;
      $(`evidence-${check.id}`).value = check.evidence;
    }
    editRevision++;
    $('compare-tab').click();
    compare();
    document.dispatchEvent(new window.Event('consent-captures-changed'));
    $('import-status').textContent = [audit.importWarnings?.length ? 'Report reopened. Signals re-decoded; notes and evidence references restored. Imported evidence and decisions are not independently verified.' : 'Report reopened. Signals re-decoded; recorded decisions and notes restored. Imported evidence and decisions are not independently verified.', ...(audit.importWarnings || [])].join(' ');
  } catch (error) {
    $('import-status').textContent = `Report not imported: ${error.message} Current review retained.`;
  } finally { event.target.value = ''; }
});
for (const [id, kind] of [['export-audit', 'json'], ['export-markdown', 'md']]) $(id).addEventListener('click', () => {
  if (!comparisonReady) return;
  try { const audit = collect(); download(kind === 'json' ? JSON.stringify(audit, null, 2) : auditMarkdown(audit), kind === 'json' ? 'application/json' : 'text/markdown;charset=utf-8', kind); }
  catch (error) { $('report-readiness').textContent = error.message; }
});
$('comparison-sample').addEventListener('click', () => {
  if (hasWork()) {
    if (!window.confirm('Replace the current captures, context, and review notes with a synthetic example? Export your current report first if you need it.')) return;
  }
  editRevision++;
  restoredCaptureTimes.clear();
  $('import-status').textContent = '';
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
  document.dispatchEvent(new window.Event('consent-captures-changed'));
});
for (const mode of ['compare', 'inspect']) $(`${mode}-tab`).addEventListener('click', () => {
  const comparing = mode === 'compare';
  $('audit-workspace').hidden = !comparing; $('single-workspace').hidden = comparing;
  for (const name of ['compare', 'inspect']) {
    $(`${name}-tab`).setAttribute('aria-pressed', String(name === mode));
    $(`${name}-tab`).classList.toggle('secondary', name !== mode);
  }
});
