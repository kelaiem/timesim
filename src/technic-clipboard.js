// Copy text for a paste elsewhere (BUILT §306's BrickLink wanted list: BrickLink's
// Wanted > Upload page takes the XML pasted into its box, not every file a browser
// saves). The Clipboard API first; where a page is not allowed it (an insecure origin,
// a denied permission) a selected textarea and execCommand('copy'), which browsers
// still honour inside a click. Resolves true when one of the two reported success.
export async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; }
  } catch { /* fall through to the textarea */ }
  const ta = document.createElement('textarea');
  ta.value = text; ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;inset-block-start:0;inset-inline-start:0;opacity:0;pointer-events:none';
  document.body.appendChild(ta); ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  ta.remove();
  return ok;
}
