// BUILT §304 — THE BOOKLET PAGE: builds one LEGO build's booklet in the browser and sets it on sheets of the
// paper chosen. The decisions are the pure half's (src/technic-booklet.js); this module makes the DOM, MEASURES
// every item at the sheet's content width, and lets `paginate` break pages from the measured heights, so the
// number of steps a page holds is whatever the rendered content allows and never a typed count. Pictures are
// drawn by src/technic-booklet-view.js, one at a time, after the pages stand (a picture is a fixed box, so
// drawing it moves nothing). DISPLAY ONLY: nothing here reads or writes a placement.
import { parseLibrary } from './ldraw.js';
import * as B from './technic-bom.js';
import { deriveSteps } from './technic-steps.js';
import { frameAlarm, alarmStates, alarmBuild } from './technic-alarm.js';
import { BOOKLET_FLAGS } from './technic-booklet-flags.js';
import * as K from './technic-booklet.js';
import { makeGeoOf, makeStepRenderer } from './technic-booklet-view.js';
import { makePartPictures } from './technic-bom-view.js';
import { copyText } from './technic-clipboard.js';

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
const svgNS = 'http://www.w3.org/2000/svg';
const sv = (tag, attrs = {}) => { const e = document.createElementNS(svgNS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };
const GEN_LABEL = { technic_2026: 'technic_2026 (the 2026 catalogue)', technic_classic: 'technic_classic (parts on sale today)' };
const PIC_PX = 192;

const HERO_K = 1.35, FINAL_K = 1.7;                                 // the cover's and the closing page's picture, as multiples of a step's height
export const KIND_LABEL = { row: 'a gear-train row', keyless: 'the keyless works and motion works', fusee: 'the fusee, maintaining power and centre pinion', alarm: 'the alarm: column wheel, pusher and strike', escapement: 'the escapement and balance' };

// The mode the plan is derived for: the alarm's three states, the keyless cell's three places of the ring, a row's one.
export function resolveMode(cell, build, param) {
  if (cell === 'alarm') return ['armed', 'ringing', 'off'].includes(param) ? param : 'armed';
  return build.modes?.includes(param) ? param : build.modes?.[0];
}
export async function loadBuild(lib, gen, cell, mode) {
  if (cell === 'alarm' && mode && mode !== 'armed') {
    const af = frameAlarm(), st = alarmStates(lib, af);
    if (!st[mode]) throw new Error(`booklet: no alarm state ${mode}`);
    const built = B.buildOf(lib, gen, cell);                      // for the title and kind
    return { ...built, build: alarmBuild(af, lib, st[mode]) };
  }
  return B.buildOf(lib, gen, cell);
}

// --- arrows ---------------------------------------------------------------------------------------------------
function headOf(a, b, size) {                                       // a triangle at b, pointing from a
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, ux = (b[0] - a[0]) / d, uy = (b[1] - a[1]) / d, nx = -uy, ny = ux;
  const p = (s, t) => `${b[0] - ux * s + nx * t},${b[1] - uy * s + ny * t}`;
  return `${b[0]},${b[1]} ${p(size, size * 0.55)} ${p(size, -size * 0.55)}`;
}
export function overlayOf(spec, box) {
  const s = sv('svg', { class: 'over', viewBox: `0 0 ${box.w} ${box.h}`, width: box.w, height: box.h, 'aria-hidden': 'true' });
  const X = (q) => [q[0] * box.w, q[1] * box.h];
  for (const a of spec.arrows) {
    const pts = a.img.map(X);
    if (a.type === 'insert') {
      const [t, h] = pts, head = headOf(t, h, 13);
      s.append(sv('line', { x1: t[0], y1: t[1], x2: h[0], y2: h[1], class: 'halo' }), sv('polygon', { points: head, class: 'halo-fill' }),
        sv('line', { x1: t[0], y1: t[1], x2: h[0], y2: h[1], class: 'ink' }), sv('polygon', { points: head, class: 'ink-fill' }));
    } else {
      const line = pts.map((q) => q.join(',')).join(' '), n = pts.length;
      const h0 = headOf(pts[2], pts[0], 11), h1 = headOf(pts[n - 3], pts[n - 1], 11);
      s.append(sv('polyline', { points: line, class: 'halo turn-line' }), sv('polygon', { points: h0, class: 'halo-fill' }), sv('polygon', { points: h1, class: 'halo-fill' }),
        sv('polyline', { points: line, class: 'turn turn-line' }), sv('polygon', { points: h0, class: 'turn-fill' }), sv('polygon', { points: h1, class: 'turn-fill' }));
    }
  }
  return s;
}
function bandDiagram() {
  const s = sv('svg', { class: 'band', viewBox: '0 0 160 100', width: 160, height: 100, role: 'img', 'aria-label': 'a rubber band round two posts; its position is not in the model' });
  s.append(sv('circle', { cx: 42, cy: 50, r: 11, class: 'post' }), sv('circle', { cx: 118, cy: 50, r: 11, class: 'post' }),
    sv('path', { d: 'M42 31 H118 A19 19 0 0 1 118 69 H42 A19 19 0 0 1 42 31 Z', class: 'rband' }));
  const t = sv('text', { x: 80, y: 94, class: 'bandtext', 'text-anchor': 'middle' }); t.textContent = 'where: not in the model'; s.append(t);
  return s;
}

// --- the elements of the book ----------------------------------------------------------------------------------
export function buildBook(model, ctx) {
  const { pics, paper } = ctx, box = K.imageBox(paper);
  const nodes = new Map(), pictures = [];                           // item id -> element; [{ img, spec }] to draw
  const pip = (c) => {
    const p = el('div', `pip${c.status === 'unofficial' ? ' unofficial' : ''}`);
    const im = el('img'); im.alt = `${c.title ?? c.part}, ${c.colourName ?? ''}`; im.src = pics.render(c.part, c.colour); im.width = im.height = 56;
    p.append(im, el('span', 'qty', `×${c.qty}`), el('span', 'pid', c.status === 'unofficial' ? `${c.part} · unofficial` : c.part));
    p.title = `${c.title ?? ''} — ${c.colourName ?? ''}`;
    return p;
  };
  const picBox = (s) => {
    const w = el('div', 'pic'); w.style.width = `${box.w}px`; w.style.height = `${box.h}px`;
    const im = el('img'); im.alt = `Step ${s.n}: ${s.title}`; im.width = box.w; im.height = box.h; w.append(im);
    if (s.view) { w.append(overlayOf(s.view, box)); pictures.push({ img: im, spec: s.view, n: s.n, box: w }); }
    return w;
  };
  const marks = (s) => s.marks.map((m) => { const d = el('div', `mark ${m.kind}`); d.append(el('strong', '', { flagged: '', overlap: '', unchecked: '', turn: 'Turn to mesh', 'two-leg': 'Two moves', posed: 'Posed, not measured', 'not-in-model': 'Not in the model', analogue: 'An analogue', unofficial: 'Unofficial part', string: 'By hand' }[m.kind] ?? m.kind), el('span', '', ` ${m.text}`)); return d; });
  const cardOf = (s) => {
    const a = el('article', `card step k-${s.kind}${s.sub ? ' sub' : ''}${s.marks.some((m) => m.kind === 'flagged' || m.kind === 'overlap' || m.kind === 'unchecked') ? ' hasflag' : ''}`);
    a.dataset.step = s.n; a.dataset.kind = s.kind;
    if (s.kind === 'note') {
      const m = el('div', 'media note'); m.append(bandDiagram());
      const b = el('div', 'notebody'); b.append(el('div', 'num sm', String(s.n)), el('h3', '', `${s.title}. ${s.statement}`), ...marks(s)); m.append(b); a.append(m);
      return a;
    }
    const media = el('div', 'media'), call = el('div', 'call');
    call.append(el('div', 'num', String(s.n)));
    const pips = el('div', 'pips'); for (const c of s.callout) pips.append(pip(c)); call.append(pips);
    if (s.kind === 'place') call.append(el('div', 'unit', 'the finished sub-assembly'));
    media.append(call, picBox(s)); a.append(media);
    const body = el('div', 'body');
    if (s.sub && !s.places) body.append(el('div', 'subtag', `Sub-assembly, off the model${s.subTitle ? `: ${s.subTitle.replace(/^.*?: /, '')}` : ''}`));
    body.append(el('h3', '', s.title));
    if (s.text) body.append(el('p', 'text', s.text));
    for (const n of s.notes) body.append(el('p', 'turnnote', n));
    if (s.placeN) body.append(el('p', 'next', `The finished sub-assembly goes into the model in step ${s.placeN}.`));
    body.append(...marks(s));
    a.append(body);
    return a;
  };
  const cover = () => {
    const a = el('section', 'cover');
    a.append(el('div', 'kicker', 'A booklet for a model that has not been built'), el('h1', '', model.meta.title),
      el('div', 'sub', `LEGO Technic fork — ${KIND_LABEL[model.meta.kind] ?? model.meta.kind}`),
      el('div', 'gen', `${GEN_LABEL[model.meta.gen] ?? model.meta.gen}${model.meta.mode ? ` · ${model.meta.mode}` : ''} · ${paper.name}`));
    const fin = model.steps.find((s) => s.kind === 'final');
    const hero = el('div', 'hero'); hero.style.height = `${Math.round(box.h * HERO_K)}px`;
    const im = el('img'); im.alt = 'The finished model, as modelled'; hero.append(im); a.append(hero);
    if (fin?.view) pictures.push({ img: im, spec: { ...fin.view, frame: ctx.heroFrame }, n: 'cover', hero: true });
    const facts = el('ul', 'facts');
    for (const t of [`${model.meta.total} parts in ${model.meta.lines} lines`, `${model.meta.steps - 1} steps in ${model.meta.chapters - 1} chapters${model.meta.subs ? `, with ${model.meta.subs} sub-assemblies` : ''}`, `${model.bom.colours.length} colours`]) facts.append(el('li', '', t));
    const pg = el('li', 'pagecount'); pg.dataset.pages = ''; facts.append(pg); a.append(facts);
    const mn = el('div', 'mnb'); mn.append(el('strong', '', 'Modelled, not built. '), el('span', '', model.honesty[0].replace(/^Modelled, not built\.\s*/, '')));
    if (model.meta.posedForces) mn.append(el('p', '', model.honesty[1]));
    a.append(mn);
    const legend = el('div', 'legend');
    const sw = (cls, t) => { const r = el('div', 'lg'); r.append(el('i', cls), el('span', '', t)); return r; };
    legend.append(sw('lg-ghost', 'Pale: already built'), sw('lg-fresh', 'In colour: added in this step'), sw('lg-insert', 'The way in'), sw('lg-turn', 'Turn the gear until its teeth mesh'), sw('lg-x', 'A tinted shadow: a new part behind another'), sw('lg-flag', 'Red box: the check could not clear this step, or two parts stand in each other'));
    a.append(legend);
    a.append(el('p', 'attr', model.honesty[model.honesty.length - 1]));
    return a;
  };
  const partsHead = () => {
    const a = el('section', 'parts-head');
    a.append(el('h2', '', 'Parts list'), el('p', 'lede', `${model.meta.total} parts in ${model.meta.lines} lines for ${model.meta.title} (${model.meta.gen}). The purchase catalogue is BrickLink: item, colour id and element codes are BrickLink's, read from its catalogue download. Colours are this page's choice by role.`));
    const cols = el('div', 'cols'); for (const t of ['', 'Qty', 'Part', 'Colour', 'BrickLink']) cols.append(el('span', '', t)); a.append(cols);
    return a;
  };
  const partsRow = (line) => {
    const r = el('div', 'prow'); r.dataset.part = line.part;
    const im = el('img'); im.src = pics.render(line.part, line.colour); im.width = im.height = 56; im.alt = line.title ?? line.part;
    const name = el('div', 'pname'); name.append(el('strong', '', line.title ?? line.part), el('span', 'pid', ` · LDraw ${line.part}${line.purchase.differs ? ` · buy ${line.purchase.id}` : ''}`));
    for (const f of line.flags) name.append(el('div', `pflag${/unofficial/.test(f) ? ' unofficial' : ''}`, f));
    const col = el('div', 'pcol'); const dot = el('i', 'dot'); dot.style.background = line.hex ?? '#888'; col.append(dot, el('span', '', line.colourName ?? String(line.colour)));
    const bl = el('div', 'pbl');
    if (line.bricklink) { bl.append(el('div', '', `item ${line.bricklink.item}`), el('div', '', `colour ${line.bricklink.colourId ?? '?'} ${line.bricklink.colour ?? ''}`), el('div', 'els', line.bricklink.listed ? `element ${line.bricklink.elements.join(', ')}` : 'no element listed')); }
    else bl.append(el('div', '', 'bought as one string'));
    r.append(im, el('div', 'pqty', `×${line.qty}`), name, col, bl);
    return r;
  };
  const partsFoot = () => {
    const a = el('section', 'parts-foot');
    a.append(el('h3', '', 'Not in the model'));
    const ul = el('ul'); for (const n of model.notes) { const li = el('li'); li.append(el('strong', '', n.item), el('span', '', ` — ${n.quantity}. ${n.why}.`)); ul.append(li); } a.append(ul);
    a.append(el('h3', '', 'What this booklet claims'));
    for (const t of model.honesty.slice(0, -1)) a.append(el('p', 'honest', t));
    a.append(el('p', 'attr', model.honesty[model.honesty.length - 1]));
    return a;
  };
  const chapter = (id) => {
    const i = model.chapters.findIndex((c) => c.id === id), c = model.chapters[i];
    const last = model.chapters.filter((x) => x.id !== 'done').length, steps = model.steps.slice(c.from, c.to);
    const a = el('div', 'chapter'); a.dataset.chapter = id;
    a.append(el('span', 'cn', `Chapter ${i + 1} of ${last}`), el('span', 'ct', c.title), el('span', 'cs', steps.length > 1 ? `steps ${steps[0].n}–${steps[steps.length - 1].n}` : `step ${steps[0].n}`));
    return a;
  };
  const finalPage = () => {
    const a = el('section', 'final');
    a.append(el('h2', '', 'Finished — modelled, not built'));
    const hero = el('div', 'hero'); hero.style.height = `${Math.round(box.h * FINAL_K)}px`;
    const im = el('img'); im.alt = 'The finished model, as modelled'; hero.append(im); a.append(hero);
    const fin = model.steps.find((s) => s.kind === 'final');
    if (fin?.view) pictures.push({ img: im, spec: { ...fin.view, frame: ctx.finalFrame }, n: fin.n, final: true });
    a.dataset.step = fin?.n ?? '';
    for (const t of model.honesty.slice(0, -1)) a.append(el('p', 'honest', t));
    a.append(el('p', 'honest', 'Every step above is derived from the model and swept for insertion against the part geometry. Steps the sweep could not clear are marked in red. A page marked so is a finding about the model, not a promise that it can be built.'));
    a.append(el('p', 'attr', model.honesty[model.honesty.length - 1]));
    return a;
  };
  const items = K.layoutItems(model, paper);
  for (const it of items) {
    let n;
    if (it.type === 'cover') n = cover();
    else if (it.type === 'parts-head') n = partsHead();
    else if (it.type === 'parts-row') n = partsRow(model.bom.lines[it.k]);
    else if (it.type === 'parts-foot') n = partsFoot();
    else if (it.type === 'chapter') n = chapter(it.chapter);
    else if (it.type === 'step') n = cardOf(model.steps[it.n - 1]);
    else n = finalPage();
    n.dataset.item = it.id;
    nodes.set(it.id, n);
  }
  return { items, nodes, pictures };
}

// --- measure, paginate, set the sheets ----------------------------------------------------------------------------
export function setSheets(book, model, ctx) {
  const { paper } = ctx, c = K.contentBox(paper);
  const measure = document.getElementById('measure'); measure.replaceChildren(); measure.style.width = `${c.w}px`;
  for (const n of book.nodes.values()) measure.append(n);
  const items = book.items.map((it) => {
    const n = book.nodes.get(it.id), cs = getComputedStyle(n), mb = parseFloat(cs.marginBottom) || 0;
    return { ...it, est: it.h, h: it.own ? it.h : n.getBoundingClientRect().height + mb };
  });
  const flow = K.paginate(items, c.h);
  const host = document.getElementById('book'); host.replaceChildren();
  flow.pages.forEach((pg, k) => {
    const sheet = el('section', 'sheet'); sheet.dataset.page = k + 1;
    const content = el('div', 'content');
    for (const id of pg.items) content.append(book.nodes.get(id));
    const foot = el('footer', 'foot');
    foot.append(el('span', '', `${model.meta.title} · ${model.meta.gen}${model.meta.mode ? ` · ${model.meta.mode}` : ''} · modelled, not built`), el('span', 'pn', `${k + 1} / ${flow.pages.length}`));
    sheet.append(content, foot); host.append(sheet);
  });
  measure.replaceChildren();
  const pc = document.querySelector('.pagecount'); if (pc) pc.textContent = `${flow.pages.length} pages on ${paper.name}`;
  return { flow, items };
}

// --- the run ----------------------------------------------------------------------------------------------------
// `libUrl` comes from the DOCUMENT (booklet.html), whose quoted ./vendor/ URLs the release stamper versions and precaches;
// a URL spelled in a module would ship unstamped and fall out of the offline set.
export async function startBooklet({ params, libUrl }) {
  const status = document.getElementById('status'), say = (t) => { if (status) status.textContent = t; };
  const cells = B.cellIds();
  const cell = cells.includes(params.get('cell')) ? params.get('cell') : 'row-2';
  const gen = B.GENERATIONS.includes(params.get('gen')) ? params.get('gen') : B.GENERATIONS[0];
  const paper = K.PAPERS[params.get('paper')] ?? K.PAPERS[K.defaultPaper(navigator.language)];
  document.documentElement.dataset.paper = paper.id;
  const style = document.createElement('style'); style.id = 'page-size';
  style.textContent = `@page{size:${paper.css};margin:0}:root{--pw:${paper.id === 'a4' ? '210mm' : '8.5in'};--ph:${paper.id === 'a4' ? '297mm' : '11in'};--m:${K.MARGIN_PX}px;--cw:${K.contentBox(paper).w}px;--ch:${K.contentBox(paper).h}px;--foot:${K.FOOT_PX}px;`
    + `--callw:${K.LAYOUT.callW}px;--gap:${K.LAYOUT.gap}px;--imgh:${K.LAYOUT.imgH}px;--pipw:${K.LAYOUT.pipW}px;--piph:${K.LAYOUT.pipH}px;--pipgap:${K.LAYOUT.pipGap}px;--numh:${K.LAYOUT.numH}px;`
    + `--pad:${K.LAYOUT.cardPad}px;--cgap:${K.LAYOUT.cardGap}px;--chh:${K.LAYOUT.chapterH}px}`;
  document.head.append(style);
  const state = { cell, gen, paper: paper.id, stage: 'loading', rendered: 0, total: 0, errors: [] };
  window.__booklet = state;
  say('reading the part library…');
  const lib = parseLibrary(await (await fetch(libUrl)).text());
  say(`building ${cell}${cell === 'keyless' ? ' (the keyless works take several seconds)' : ''}…`);
  await new Promise((r) => setTimeout(r, 0));
  const built = await loadBuild(lib, gen, cell, params.get('mode'));
  if (!built.build) { say(`${cell} is not framed in ${gen}: ${built.reason}`); state.stage = 'unframed'; return state; }
  const mode = resolveMode(cell, built.build, params.get('mode'));
  say('deriving the steps…');
  await new Promise((r) => setTimeout(r, 0));
  const plan = deriveSteps(built.build, { lib, mode });
  const bom = B.bomOf(built.build, lib, { cell });   // BUILT §309: the line's substitutes are judged per build
  // BUILT §306: the build's BrickLink wanted list (condition any), the same function technic.html's list offers
  const wanted = document.getElementById('wanted');
  if (wanted) {
    try {
      const xml = B.wantedListXml({ cell, kind: built.kind, title: built.title, bom }, gen);
      wanted.href = URL.createObjectURL(new Blob([xml], { type: 'application/xml' }));
      wanted.download = `${gen}-${cell}-bricklink-wanted.xml`; wanted.title = `BrickLink: Wanted > Upload > BrickLink XML takes this text pasted into its box. Condition: any. ${B.WANTED_NOTE}`; wanted.hidden = false;
      // the upload page wants the XML pasted, so the same text also goes to the clipboard
      const cp = document.getElementById('wanted-copy');
      if (cp) {
        cp.hidden = false;
        cp.onclick = async () => say((await copyText(xml)) ? 'wanted list copied: paste it into BrickLink, Wanted > Upload > BrickLink XML' : 'could not copy: open the .xml in a text editor and copy it from there');
      }
    } catch (e) { state.errors.push(`wanted list: ${e.message}`); }
  }
  const model = K.bookletOf({ lib, gen, cell, mode: plan.mode, built, plan, bom, flagsTable: BOOKLET_FLAGS, paper });
  const box = K.imageBox(paper);
  const geoOf = makeGeoOf(lib);
  const pics = makePartPictures(lib, geoOf, PIC_PX);
  const ctx = { pics, paper, heroFrame: K.wholeFrame(plan, lib, box.w / (box.h * HERO_K)), finalFrame: K.wholeFrame(plan, lib, box.w / (box.h * FINAL_K)) };
  state.model = model; state.plan = plan; state.paperObj = paper; state.lib = lib;
  say('setting the pages…');
  await new Promise((r) => setTimeout(r, 0));
  const book = buildBook(model, ctx);
  const sheets = setSheets(book, model, ctx);
  state.flow = sheets.flow; state.items = sheets.items; state.pages = sheets.flow.pages.length;
  state.pictures = book.pictures.length; state.total = book.pictures.length;
  document.title = `${model.meta.title} — booklet (${paper.name})`;
  fitScreen();
  state.stage = 'pages';
  // the pictures, one at a time, in reading order
  let renderer;
  try { renderer = makeStepRenderer(lib, plan, geoOf, { w: box.w, h: box.h }); } catch (e) { state.errors.push(String(e)); say(`WebGL is not available: ${e.message}`); state.stage = 'nogl'; return state; }
  state.renderer = renderer;
  const renderers = new Map();
  const rendererFor = (w, h) => { const k = `${w}x${h}`; if (!renderers.has(k)) renderers.set(k, (w === box.w && h === box.h) ? renderer : makeStepRenderer(lib, plan, geoOf, { w, h })); return renderers.get(k); };
  state.rendererFor = rendererFor;
  for (const p of book.pictures) {
    try {
      const r = p.hero ? rendererFor(box.w, Math.round(box.h * HERO_K)) : p.final ? rendererFor(box.w, Math.round(box.h * FINAL_K)) : renderer;
      p.img.src = await r.render(p.spec);
      p.img.dataset.drawn = '1';
    } catch (e) { state.errors.push(`step ${p.n}: ${e.message}`); }
    state.rendered++;
    say(`drawing the pictures: ${state.rendered} of ${state.total}…`);
    await new Promise((r) => setTimeout(r, 0));
  }
  await Promise.all([...document.querySelectorAll('img')].map((i) => (i.decode ? i.decode().catch(() => {}) : null)));
  state.stage = 'ready';
  document.body.dataset.ready = '1';
  say(`${state.pages} pages on ${paper.name}. Print, then choose “Save as PDF”.`);
  return state;
}

// On a screen narrower than a sheet the pages are zoomed down to fit; print is never zoomed. The sheet's natural width is
// the paper's (a zoomed rect would be read back scaled).
export function fitScreen() {
  const host = document.getElementById('book'); if (!host || !window.__booklet?.paperObj) return;
  const w = window.__booklet.paperObj.w;
  const z = Math.min(1, (document.documentElement.clientWidth - 24) / w);
  host.style.zoom = z < 1 ? String(z) : '';
}
window.addEventListener('resize', fitScreen);
