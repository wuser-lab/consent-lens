import { parseVendorList, checkVendorMembership, MAX_VENDOR_LIST_BYTES } from './vendor-list.js';
import { SYNTHETIC_VENDOR_LIST, SYNTHETIC_VENDOR_SIGNAL } from './vendor-demo.js';
const $ = id => document.getElementById(id);
let vendorList;
let source;
let report;
let loadSequence = 0;
const targets = { before: 'before-signal', after: 'after-signal', single: 'signal' };
function invalidate() {
  report = undefined;
  $('vendor-results').hidden = true;
  $('vendor-export').disabled = true;
}
function render() {
  const query = $('vendor-filter').value.trim().toLowerCase();
  const rows = report.rows.filter(row => `${row.id} ${row.name || ''}`.toLowerCase().includes(query));
  $('vendor-rows').replaceChildren(...rows.slice(0, 200).map(row => {
    const tr = document.createElement('tr');
    for (const value of [row.id, row.name || 'Not listed in supplied file', row.flags.join(', '), row.deletedDate ? `Deleted date recorded: ${row.deletedDate}` : row.membership === 'listed' ? 'Listed; no deleted date recorded' : 'Not listed']) {
      const td = document.createElement('td'); td.textContent = String(value); tr.append(td);
    }
    return tr;
  }));
  const unknown = report.rows.filter(row => row.membership === 'not-listed').length;
  $('vendor-row-count').textContent = `${report.rows.length} referenced vendor IDs; ${unknown} not listed in the supplied file. Showing ${Math.min(rows.length, 200)} of ${rows.length} filter matches.`;
}
$('vendor-list-file').addEventListener('change', async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  const sequence = ++loadSequence;
  $('vendor-list-status').textContent = 'Reading vendor list locally…';
  try {
    if (file.size > MAX_VENDOR_LIST_BYTES) throw new Error('Vendor list exceeds the 16 MiB limit.');
    const text = await file.text();
    const parsed = parseVendorList(text);
    const hash = globalThis.crypto?.subtle ? Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))), byte => byte.toString(16).padStart(2, '0')).join('') : null;
    if (sequence !== loadSequence) return;
    vendorList = parsed; source = { fileName: file.name, sha256: hash };
    invalidate(); $('vendor-run').disabled = false;
    $('vendor-list-status').textContent = `Loaded list ${parsed.vendorListVersion}, policy ${parsed.policyVersion}, ${parsed.vendors.size} entries. Choose a signal to check. File authenticity is not verified.`;
  } catch (error) {
    if (sequence === loadSequence) $('vendor-list-status').textContent = `${error.message} ${vendorList ? 'Previous list retained.' : 'No list loaded.'}`;
  } finally { if (sequence === loadSequence) event.target.value = ''; }
});
$('vendor-run').addEventListener('click', () => {
  if (!vendorList) return;
  invalidate();
  try {
    const result = checkVendorMembership($(targets[$('vendor-target').value]).value, vendorList, source);
    if (!result.matched) { $('vendor-list-status').textContent = `${result.mismatches.join(' ')} Vendor names and membership are not compared. Load the matching archived list.`; return; }
    report = result;
    $('vendor-list-status').textContent = `List ${vendorList.vendorListVersion} and policy ${vendorList.policyVersion} match the signal. Source: ${source.fileName}. Names and membership only; source authenticity is not verified.`;
    $('vendor-results').hidden = false; $('vendor-export').disabled = false;
    render();
  } catch (error) { $('vendor-list-status').textContent = error.message; }
});
$('vendor-filter').addEventListener('input', () => { if (report) render(); });
$('vendor-target').addEventListener('change', invalidate);
for (const id of Object.values(targets)) $(id).addEventListener('input', invalidate);
document.addEventListener('consent-captures-changed', invalidate);
$('sample').addEventListener('click', invalidate);
$('vendor-demo').addEventListener('click', () => {
  if ((vendorList || $('signal').value) && !window.confirm('Replace the loaded vendor list and single-string input with a synthetic example? Audit captures and notes are retained.')) return;
  loadSequence++;
  vendorList = parseVendorList(JSON.stringify(SYNTHETIC_VENDOR_LIST));
  source = { fileName: 'Built-in synthetic example; not an official GVL', sha256: null };
  $('signal').value = SYNTHETIC_VENDOR_SIGNAL;
  $('signal').dispatchEvent(new window.Event('input', { bubbles: true }));
  $('vendor-target').value = 'single';
  $('vendor-run').disabled = false;
  $('vendor-run').click();
});
$('vendor-clear').addEventListener('click', () => {
  loadSequence++; vendorList = undefined; source = undefined; invalidate();
  $('vendor-list-file').value = ''; $('vendor-run').disabled = true;
  $('vendor-list-status').textContent = 'Vendor list cleared.';
});
$('vendor-export').addEventListener('click', () => {
  if (!report) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'vendor-membership-check.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
