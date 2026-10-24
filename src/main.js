import './style.css';
import './audit-ui.js';
import { inspect, SAMPLE } from './decode.js';
const $ = (id) => document.getElementById(id);
let report;
function run() {
  $('results').hidden = true;
  report = undefined;
  try {
    report = inspect($('signal').value);
    $('summary').replaceChildren();
    for (const [label, value] of [['CMP ID', report.cmpId], ['Policy version', report.policyVersion], ['Vendor list version', report.vendorListVersion], ['Language', report.language], ['Created (UTC)', report.created], ['Updated (UTC)', report.updated], ['Service specific', report.serviceSpecific ? 'Yes' : 'No'], ['Special feature opt-in IDs', report.specialFeatureOptinIds.join(', ') || 'None']]) {
      const card = document.createElement('div'); card.className = 'metric';
      const title = document.createElement('span'); title.textContent = label;
      const content = document.createElement('strong'); content.textContent = value;
      card.append(title, content); $('summary').append(card);
    }
    $('purposes').replaceChildren();
    for (let id = 1; id <= 24; id++) {
      const row = document.createElement('tr');
      for (const value of [id, report.purposeConsentIds.includes(id) ? 'Set' : 'Not set', report.purposeLegitimateInterestIds.includes(id) ? 'Set' : 'Not set']) {
        const cell = document.createElement('td'); cell.textContent = value; row.append(cell);
      }
      $('purposes').append(row);
    }
    $('vendors').textContent = report.vendorConsentIds.join(', ') || 'No flags set';
    $('interests').textContent = report.vendorLegitimateInterestIds.join(', ') || 'No flags set';
    $('disclosed').textContent = report.vendorDisclosureSegmentPresent ? report.vendorDisclosedIds.join(', ') || 'Segment present · no vendor IDs set' : 'Segment absent';
    $('allowed').textContent = report.vendorAllowedSegmentPresent ? report.vendorAllowedIds.join(', ') || 'Segment present · no vendor IDs set' : 'Segment absent';
    $('notes').replaceChildren(...report.notes.map(note => { const li = document.createElement('li'); li.textContent = note; return li; }));
    $('status').textContent = 'Decoded successfully. Purpose IDs 1–24 show the encoded bit positions; applicability depends on the policy version.';
    $('status').className = 'success'; $('results').hidden = false;
  } catch (error) { $('status').textContent = error.message; $('status').className = 'error'; }
}
$('form').addEventListener('submit', event => { event.preventDefault(); run(); });
$('sample').addEventListener('click', () => { $('signal').value = SAMPLE; run(); });
$('signal').addEventListener('input', () => { report = undefined; $('results').hidden = true; $('status').textContent = ''; });
$('export').addEventListener('click', () => {
  if (!report) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'consent-report.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});
