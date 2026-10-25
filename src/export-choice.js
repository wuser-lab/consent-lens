// Full details require a fresh explicit choice for every download. Missing or
// unrecognised controls fail closed to the redacted summary.
export function consumeFullExportChoice() {
  const selector = globalThis.document?.getElementById('export-privacy');
  const full = selector?.value === 'full';
  if (selector && selector.value !== 'redacted') {
    selector.value = 'redacted';
    selector.dispatchEvent(new selector.ownerDocument.defaultView.Event('change', { bubbles: true }));
  }
  return full;
}
