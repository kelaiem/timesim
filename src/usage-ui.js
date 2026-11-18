// §349 landing 1 — THE USAGE TALLY, the page half: what counts as a visitor
// using a feature, and the preview they read before sending anything.
//
// WHAT COUNTS. Three sources, and none of them is a setter:
//   · a panel CONTROL tagged `data-usage="<key>"`, read by ONE delegated
//     listener here. setXray, setSchematic and their siblings are also called
//     by the state restore at boot and by every tour step, neither of which is
//     the visitor exploring, so instrumenting them would count the tour. A DOM
//     event a person made is `isTrusted`; one code dispatched is not.
//   · a keyboard SHORTCUT: the shortcut table clicks the button it drives,
//     synchronously, inside the trusted keydown. So an untrusted click while
//     a trusted keydown is being dispatched counts as `k`, and any other
//     untrusted click (a deep link's `?cycle`, a script) counts as nothing.
//   · a GESTURE with no control (a crown turned, a part tapped): main.js calls
//     usageMark(key, 'g') where the gesture commits, never per frame.
//   · and the deep-link parameter NAMES the page was opened with, as `l`.
//     Values are never read off a URL.
//
// WHEN IT IS OFF. Everything here is inert, writing nothing and listening to
// nothing, when the page is driven by automation (`navigator.webdriver`: the
// battery, every probe and smoke test) unless `?usage=1` forces it on for this
// landing's own probe, on a `?trial` boot (§33's throwaway iframes), and under
// the native host (§338), which has no real document. Landing 1 also STORES
// nothing: the tally lives in memory for this page load, which is the owner's
// ruling until a visitor turns remembering on (landing 2).
//
// WHAT LEAVES. Nothing, from here. The dialog's Copy puts the text the visitor
// is looking at on their clipboard; landing 2 adds the two ways out (a mail
// to an address they type, a prefilled GitHub discussion), both of them
// navigations the visitor presses.

import { createTally, formatReport, FEATURE, LINK_PARAMS, monthOf } from './usage.js';
import { t } from './i18n.js';

const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();

function computeEnabled() {
  if (typeof document === 'undefined' || typeof navigator === 'undefined') return false;
  if (navigator.userAgent === 'timesim-native') return false;   // §338's host (tools/native/host.mjs)
  if (params.has('trial')) return false;                        // §33's verdict boots
  if (params.get('usage') === '0') return false;
  if (params.get('usage') === '1') return true;                 // this landing's probe
  return !navigator.webdriver;
}
export const USAGE_ON = computeEnabled();

const tally = createTally();
const since = monthOf(new Date());

// main.js' gesture sites call this. A refused key is a bug at the call site,
// so it warns (boot-silent: no site marks during the build).
export function usageMark(key, via = 'g') {
  if (!USAGE_ON) return false;
  const ok = tally.mark(key, via);
  if (!ok) console.warn(`usage: refused mark ${key} via ${via} — not a USAGE_FEATURES row`);
  return ok;
}

// The probe's handle. It is the visitor's own data, read-only from here.
export const usageTally = () => tally;

let headerOf = () => ({});
export const usageReport = () => formatReport(tally, headerOf(), { sessions: 1, since });

const optionValues = (sel) => [...sel.options].map((o) => o.value);
const FORM = 'input, select, textarea';

function onClick(e, keyActive) {
  const el = e.target && e.target.closest && e.target.closest('[data-usage]');
  if (!el || el.tagName !== 'BUTTON') return;   // a container's or a form control's use is its `change`
  const via = e.isTrusted ? 'c' : keyActive() ? 'k' : null;
  if (via) usageMark(el.dataset.usage, via);
}

function onChange(e) {
  if (!e.isTrusted) return;
  const target = e.target;
  if (!target || !target.matches || !target.matches(FORM)) return;
  const el = target.closest('[data-usage]');
  if (!el) return;
  const key = el.dataset.usage;
  const r = FEATURE.get(key);
  // A value only from the dropdown that IS the tagged control, and only one
  // its own option list carries (src/usage.js: the owner's ruling).
  if (r && r.values === 'options' && target === el && target.tagName === 'SELECT') {
    tally.mark(key, 'c', target.value, optionValues(target)) || usageMark(key, 'c');
  } else {
    usageMark(key, 'c');
  }
}

function readLinkParams() {
  for (const name of params.keys()) {
    const key = LINK_PARAMS[name];
    if (key) usageMark(key, 'l');
  }
}

// --- the preview -----------------------------------------------------------
const STYLE = `
#usage-dialog { max-width: min(560px, calc(100vw - 32px)); width: 100%; box-sizing: border-box;
  color: #eaf0f7; background: #15181d; border: 1px solid rgba(255,255,255,0.22); border-radius: 8px;
  padding: 16px; font: 13px/1.45 system-ui, sans-serif; }
#usage-dialog::backdrop { background: rgba(0,0,0,0.55); }
#usage-dialog h2 { margin: 0 0 8px; font-size: 15px; }
#usage-dialog p { margin: 0 0 8px; color: #c4cfdc; }
#usage-dialog textarea { direction: ltr; text-align: left; width: 100%; box-sizing: border-box; min-height: 180px;
  font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; color: #eaf0f7; background: #0d0f12;
  border: 1px solid rgba(255,255,255,0.22); border-radius: 4px; padding: 8px; resize: vertical; white-space: pre; }
#usage-dialog .usage-actions { display: flex; gap: 8px; align-items: center; margin-top: 10px; flex-wrap: wrap; }
#usage-dialog .usage-status { flex: 1 1 auto; color: #9fb6d9; min-height: 1.4em; }
`;

let dialog = null;
function buildDialog() {
  const style = document.createElement('style');
  style.textContent = STYLE;
  document.head.appendChild(style);
  dialog = document.createElement('dialog');
  dialog.id = 'usage-dialog';
  dialog.setAttribute('aria-labelledby', 'usage-title');
  const h = document.createElement('h2');
  h.id = 'usage-title';
  h.textContent = t('Usage report');
  const p1 = document.createElement('p');
  p1.textContent = t('This is everything the report says: which features you used on this visit, and how you reached them. Edit or delete any line before you send it. Nothing is sent unless you send it.');
  const p2 = document.createElement('p');
  p2.textContent = t('The report is in English so the maintainer can read it.');
  const ta = document.createElement('textarea');
  ta.id = 'usage-text';
  ta.spellcheck = false;
  ta.setAttribute('aria-label', t('Usage report'));
  const actions = document.createElement('div');
  actions.className = 'usage-actions';
  const status = document.createElement('span');
  status.className = 'usage-status';
  status.setAttribute('role', 'status');
  const copy = document.createElement('button');
  copy.id = 'usage-copy';
  copy.textContent = t('Copy');
  const close = document.createElement('button');
  close.id = 'usage-close';
  close.textContent = t('Close');
  actions.append(status, copy, close);
  dialog.append(h, p1, p2, ta, actions);
  // Typing in the report must not reach the movement's shortcuts.
  dialog.addEventListener('keydown', (e) => { if (e.key !== 'Escape') e.stopPropagation(); });
  close.addEventListener('click', () => dialog.close());
  copy.addEventListener('click', async () => {
    const text = ta.value;   // what is in the box is what is copied
    try {
      if (!navigator.clipboard) throw new Error('no clipboard api');
      await navigator.clipboard.writeText(text);
      status.textContent = t('Copied');
    } catch {
      try {
        ta.focus(); ta.select();
        if (!document.execCommand('copy')) throw new Error('execCommand refused');
        status.textContent = t('Copied');
      } catch {
        ta.focus(); ta.select();
        status.textContent = t('Copy failed: the text is selected, copy it by hand.');
      }
    }
  });
  document.body.appendChild(dialog);
}

export function openUsageDialog() {
  if (!dialog) buildDialog();
  dialog.querySelector('#usage-text').value = usageReport();
  dialog.querySelector('.usage-status').textContent = '';
  if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
}

// Called once, on main.js' last build line (after the build's input guard is
// released, so nothing the build does can count). `header` returns the build
// facts the report's second line carries.
export function installUsage({ header, button } = {}) {
  if (header) headerOf = header;
  // The row stays when collection is off (its report then lists nothing), so
  // the chrome probes, which run under automation, still see and localize it.
  if (button) button.addEventListener('click', openUsageDialog);
  // A read-only view for tools/probe-349-usage.mjs: the visitor's own data, in
  // their own page, and the same text the preview shows.
  window.__usage = Object.freeze({
    on: USAGE_ON,
    marks: () => Object.fromEntries([...tally.entries()].map(([k, e]) =>
      [k, { via: [...e.via].sort(), values: Object.fromEntries([...e.values].map(([v, s]) => [v, [...s].sort()])) }])),
    report: usageReport,
  });
  if (!USAGE_ON) return;
  let keyDepth = false;
  window.addEventListener('keydown', (e) => {
    if (!e.isTrusted) return;
    keyDepth = true;
    setTimeout(() => { keyDepth = false; }, 0);   // a handler that stops propagation still resets
  }, true);
  window.addEventListener('keydown', () => { keyDepth = false; });   // registered last: runs after the shortcut table's
  document.addEventListener('click', (e) => onClick(e, () => keyDepth), true);
  document.addEventListener('change', onChange, true);
  readLinkParams();
}
