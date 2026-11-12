// Pilote d'un module : decouvre les commandes, puis les teste une par une par de vrais clics CDP (souris, ou toucher en mode mobile).
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { launch, sleep } from '../e2e/harness.mjs';
import { classify, diffPaths, diffSemantic, diffUi, splitSnapshot, stable } from './logic.ts';
import { PAGE_JS, DIALOG_FIELDS, DIALOG_PRIMARY, TEXT_FOR } from './pagejs.mjs';
import { MODULES, expectDisabled, expectationsFor } from './config.mjs';

const j = JSON.stringify;

export async function openSession({ base, port, mobile }) {
  if (await fetch(`http://127.0.0.1:${port}/json/version`).then(() => true, () => false)) throw new Error(`le port de debogage ${port} est deja utilise (navigateur restant d'un essai precedent ?)`);
  const b = await launch({ port });
  await b.send('Page.addScriptToEvaluateOnNewDocument', { source: PAGE_JS });
  if (mobile) await b.viewport(390, 844, true);
  else await b.viewport(1680, 1000);
  b.touch = Boolean(mobile);
  b.base = base;
  return b;
}

async function clickBox(b, box) {
  if (b.touch) {
    await b.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x, y: box.y }] });
    await b.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x, y: box.y });
    await b.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1 });
    await b.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', clickCount: 1 });
  }
  await sleep(110);
}

/** Charge le document de test du module (ou rien) et attend qu'il soit lu. */
export async function loadFixture(b, cfg, fixtureB64) {
  await b.goto(`${b.base}/?app=${cfg.app}`, 300);
  await b.waitFor('window.__FO__', 10000);
  await resetDoc(b, cfg, fixtureB64);
}

export async function resetDoc(b, cfg, fixtureB64) {
  await b.ev('window.__FO__.consoleErrors(true).length');
  if (cfg.clearStorage) await b.ev('(() => { try { localStorage.clear(); sessionStorage.clear(); } catch { /* ignore */ } })()');
  await b.ev(`window.__FO__.reset(${j(cfg.fixture ?? '')}, ${j(fixtureB64 ?? '')}, ${j(cfg.app)})`);
  if (cfg.enter) {
    await b.waitFor(`document.querySelector(${j(cfg.enter)})`, 10000);
    await b.click(cfg.enter);
  }
  if (cfg.marker) {
    const ok = await b.waitFor(`(() => { try { return JSON.stringify(window.__FO__.snapshot()).includes(${j(cfg.marker)}); } catch { return false; } })()`, 15000);
    if (!ok) throw new Error(`document de test non charge (${cfg.app})`);
  } else {
    await sleep(900);
  }
  await b.waitFor("document.querySelector('.fo-ribbon [role=tab]')", 10000);
  for (const f of cfg.extra ?? []) await b.drop(cfg.dropTarget, f.name, f.bytes);
  if (cfg.extra?.length) await b.waitFor(`JSON.stringify(window.__FO__.snapshot()).includes(${j(cfg.extra[cfg.extra.length - 1].name)})`, 8000);
  await sleep(180);
  await b.ev('window.__FO__.consoleErrors(true).length');
}

const snap = (b) => b.ev('JSON.stringify(window.__FO__.snapshot())').then((s) => (s == null ? null : JSON.parse(s)));
const uiSig = (b, cfg) => b.ev(`JSON.stringify(window.__FO__.ui(${j(cfg.zones)}))`).then(JSON.parse);
const errors = (b) => b.ev('window.__FO__.consoleErrors(false)');

/** Decouverte : pour chaque selection preparee, les commandes dont l'onglet est visible. */
export async function discover(b, cfg, fixtureB64, log) {
  const presets = [cfg.defaultPreset, ...(await b.ev('window.__FO__.presets()')).filter((p) => p !== cfg.defaultPreset)];
  const byId = new Map();
  for (const p of presets) {
    await resetDoc(b, cfg, fixtureB64);
    const selected = await b.ev(`window.__FO__.select(${j(p)})`);
    if (!selected) { log(`  (contexte ${p} indisponible)`); continue; }
    await sleep(350);
    const list = JSON.parse(await b.ev('JSON.stringify(window.__FO__.commands())'));
    for (const c of list) {
      const e = byId.get(c.id) ?? { ...c, presets: [] };
      if (!c.tabHidden) e.presets.push(p);
      if (!e.disabledIn) e.disabledIn = [];
      if (c.disabled) e.disabledIn.push(p);
      byId.set(c.id, e);
    }
  }
  return { entries: [...byId.values()], presets };
}

async function showTab(b, cmd, info) {
  const labels = cmd.path[0];
  const t = await b.ev(`window.__c.tab(${j(labels)})`);
  if (!t) return false;
  await clickBox(b, t);
  info.tabClicked = true;
  return true;
}

/** Trouve et clique un controle du ruban ; ouvre le groupe replie si besoin. */
async function findControl(b, cmd, part) {
  let c = await b.ev(`window.__c.control(${j(cmd.control)}, ${j(part)})`);
  if (c) return c;
  const g = await b.ev(`window.__c.collapsedGroup(${j(cmd.path[1])})`);
  if (g) {
    await clickBox(b, g);
    c = await b.ev(`window.__c.control(${j(cmd.control)}, ${j(part)})`);
  }
  return c;
}

async function press(b, key) {
  await b.key(key, { code: key });
}

/** Execute la commande par clics reels. Renvoie { reached, disabled }. */
/** `tabShown` : l'onglet est deja affiche (l'etat « avant » de la mesure est pris apres le changement d'onglet, qui modifie le panneau). */
async function perform(b, cmd, all, info, tabShown = false) {
  if (!tabShown) {
    if (!(await showTab(b, cmd, info))) return { reached: false, disabled: false, why: `onglet « ${cmd.path[0]} » absent` };
    await sleep(50);
  }
  const parent = cmd.parent ? all.get(cmd.parent) : null;
  const click = async (c) => {
    if (!c) return { reached: false, disabled: false };
    if (c.disabled) return { reached: true, disabled: true };
    await clickBox(b, c);
    return { reached: true, disabled: false };
  };
  const seg = (cmd.item ?? '').split('/');
  switch (cmd.type) {
    case 'button': case 'toggle': case 'split': case 'color': case 'launcher':
      return click(await findControl(b, cmd, 'main'));
    case 'checkbox':
      return click(await findControl(b, cmd, 'check'));
    case 'menu': case 'gallery': case 'combo': case 'font':
      return click(await findControl(b, cmd, cmd.type === 'gallery' ? 'more' : cmd.type === 'menu' ? 'main' : 'arrow'));
    case 'number':
      return click(await findControl(b, cmd, 'up'));
    case 'menu-item': {
      const kind = parent?.type ?? 'menu';
      const opener = await click(await findControl(b, cmd, kind === 'split' ? 'arrow' : kind === 'gallery' ? 'more' : 'main'));
      if (!opener.reached || opener.disabled) return opener;
      let last = null;
      for (const s of cmd.id.split('#').slice(1).join('#').split('/')) {
        const gallery = kind === 'gallery' && s === cmd.id.split('#')[1].split('/')[0];
        const item = gallery ? await b.ev(`window.__c.popupTile(${j(s)})`) ?? await b.ev(`window.__c.menuItem(${j(s)})`) : await b.ev(`window.__c.menuItem(${j(s)})`);
        if (!item) return { reached: false, disabled: false, why: `entree « ${s} » absente du menu` };
        last = item;
        if (item.disabled) return { reached: true, disabled: true };
        await clickBox(b, item);
      }
      return { reached: Boolean(last), disabled: false };
    }
    case 'gallery-item': {
      const tile = await b.ev(`window.__c.galleryTile(${j(cmd.parent)}, ${j(cmd.item)})`);
      if (tile) return click(tile);
      const more = await findControl(b, { ...cmd, control: parent?.control ?? cmd.control }, 'more');
      if (!more) return { reached: false, disabled: false, why: 'galerie introuvable' };
      await clickBox(b, more);
      return click(await b.ev(`window.__c.popupTile(${j(cmd.item)})`));
    }
    case 'color-pick': {
      const arrow = await click(await findControl(b, { ...cmd, control: parent?.control ?? cmd.control }, 'arrow'));
      if (!arrow.reached || arrow.disabled) return arrow;
      const target = cmd.item === 'auto' ? await b.ev('window.__c.paletteRow()') : await b.ev(`window.__c.swatch(${j(cmd.label)})`);
      return click(target);
    }
    case 'combo-option': case 'font-option': {
      const open = await click(await findControl(b, { ...cmd, control: parent?.control ?? cmd.control }, 'arrow'));
      if (!open.reached || open.disabled) return open;
      await sleep(150);
      const o = await b.ev(`window.__c.option(${j(cmd.label)})`);
      return click(o);
    }
    case 'custom': {
      const c = await b.ev(`window.__c.customButton(${j(cmd.control)})`);
      return c ? click(c) : { reached: true, disabled: false, untestable: true };
    }
    case 'custom-item': {
      const c = await b.ev(`window.__c.customButton(${j(cmd.parent ? parent.control : cmd.control)}, true)`);
      if (!c) return { reached: true, disabled: false, untestable: true };
      if (c.disabled) return { reached: true, disabled: true };
      await clickBox(b, c);
      const it = await b.ev('window.__c.popupItem()');
      return it ? click(it) : { reached: false, disabled: false, why: 'aucun element dans le panneau ouvert' };
    }
    default:
      return { reached: false, disabled: false, why: `type ${cmd.type}` };
  }
}

/** Remplit les champs vides de la boite ouverte puis valide. Renvoie { title, validated, closed }. */
async function fillAndConfirm(b) {
  const info = await b.ev(DIALOG_FIELDS);
  if (!info) return null;
  for (const f of info.fields) {
    if (f.i < 0) continue;
    const box = await b.ev(`(() => { const e = document.querySelector('[data-cdp-f="${f.i}"]'); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
    if (!box) continue;
    await clickBox(b, box);
    await b.type(TEXT_FOR(f.label));
  }
  const btn = await b.ev(DIALOG_PRIMARY);
  if (!btn) return { title: info.title, validated: false, closed: false, note: 'aucun bouton de validation actif', platform: info.fields.some((f) => f.file) };
  await clickBox(b, btn);
  await sleep(450);
  const still = await b.ev('window.__c.dialogs().length');
  return { title: info.title, validated: true, closed: still === 0, button: btn.text, platform: info.fields.some((f) => f.file) };
}

export function makeRunner(b, cfg, fixtureB64, all, outDir, log) {
  let captures = 0;
  const save = (name, data) => {
    if (!data || captures >= 60) return undefined;
    captures++;
    mkdirSync(outDir, { recursive: true });
    const file = `${name.replace(/[^a-z0-9._-]/gi, '_').slice(0, 80)}.jpg`;
    writeFileSync(join(outDir, file), Buffer.from(data, 'base64'));
    return file;
  };

  /** Une tentative complete dans un contexte donne. */
  let clean = false;
  async function fresh(reuse) {
    if (reuse && clean) {
      // Etat intact apres la commande precedente : on garde le document, on referme les menus et on repart de la selection.
      await b.ev('window.__FO__.consoleErrors(true).length');
      return;
    }
    await resetDoc(b, cfg, fixtureB64);
  }

  const REMOVAL = /^(none|auto|clear|remove|off|aucun|automatique)$/i;
  const REMOVAL_LABEL = /^(aucun|aucune|automatique|supprimer|effacer|retirer|désactiver|desactiver)/i;
  /** Commande a executer d'abord pour qu'une commande de retrait ait quelque chose a retirer. */
  function preStep(cmd) {
    if (cfg.pre?.[cmd.id]) return cfg.pre[cmd.id];
    if (!cmd.parent || !(REMOVAL.test(cmd.item ?? '') || REMOVAL_LABEL.test(cmd.label))) return null;
    const sib = [...all.values()].find((e) => e.parent === cmd.parent && e.id !== cmd.id && !REMOVAL.test(e.item ?? '') && !REMOVAL_LABEL.test(e.label) && e.value !== 'submenu');
    return sib?.id ?? null;
  }

  async function attempt(cmd, preset, { withDialog = true, reuse = false } = {}) {
    await fresh(reuse);
    clean = false;
    if (preset) await b.ev(`window.__FO__.select(${j(preset)})`);
    await sleep(120);
    const pre = preStep(cmd);
    // Une pre-etape peut etre une liste : 'select:<contexte>' change la selection, le reste est une commande.
    for (const step of [pre].flat().filter(Boolean)) {
      if (step.startsWith('select:')) await b.ev(`window.__FO__.select(${j(step.slice(7))})`);
      else if (step.startsWith('key:')) await b.ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: ${j(step.slice(4))}, bubbles: true }))`);
      else await b.ev(`window.__FO__.invoke(${j(step)})`);
      await sleep(300);
    }
    const info = {};
    const tabOk = await showTab(b, cmd, info);
    await sleep(120);
    const before = await snap(b);
    const uiB = await uiSig(b, cfg);
    const res = tabOk ? await perform(b, cmd, all, info, true) : { reached: false, disabled: false, why: `onglet « ${cmd.path[0]} » absent` };
    await sleep(200);
    let uiA = await uiSig(b, cfg);
    let after = await snap(b);
    let dialog = null;
    if (withDialog && res.reached && !res.disabled && diffUi(uiB, uiA).dialogOpened && !(await b.ev('window.__c.backstage()'))) {
      dialog = await fillAndConfirm(b);
      await sleep(250);
      uiA = { ...(await uiSig(b, cfg)), dialogs: uiA.dialogs, popups: uiA.popups };
      const afterOk = await snap(b);
      if (stable(afterOk) !== stable(after)) after = afterOk;
    }
    const errs = await errors(b);
    const [bDoc, bUi] = splitSnapshot(before);
    const [aDoc, aUi] = splitSnapshot(after);
    const docChanged = stable(bDoc) !== stable(aDoc);
    const stateChanged = stable(bUi) !== stable(aUi);
    const ud = diffUi(uiB, uiA);
    const quiet = !docChanged && !stateChanged && !ud.dialogOpened && !ud.popupOpened && !ud.toast && !ud.platform.length && !ud.pressedChanged.length && !ud.outsideChanged;
    // Intact : ni document, ni interface (hors menus ouverts, refermes ici), ni boite, ni erreur.
    if (!docChanged && !stateChanged && !ud.dialogOpened && !ud.outsideChanged && !ud.pressedChanged.length && !errs.length && !dialog && !pre) {
      if (ud.popupOpened) {
        await press(b, 'Escape');
        await sleep(100);
        await press(b, 'Escape');
        await sleep(100);
      }
      const after2 = await uiSig(b, cfg);
      clean = after2.popups.length === 0 && after2.dialogs.length === 0;
    }
    const shotData = quiet || errs.length ? (await b.send('Page.captureScreenshot', { format: 'jpeg', quality: 45 }).catch(() => null))?.data : null;
    return { before, after, uiB, uiA, ud, res, errs, docChanged, stateChanged, dialog, info, shotData };
  }

  return {
    async test(cmd) {
      const exp = expectationsFor(cfg.app, cmd);
      const disabledOk = expectDisabled(cfg, cmd);
      const preset = cfg.presetFor(cmd) ?? cmd.presets[0] ?? cfg.defaultPreset;
      const row = { id: cmd.id, tab: cmd.tab, path: cmd.path, label: cmd.label, type: cmd.type, context: preset };
      if (cmd.presets.length === 0 && cmd.tabHidden) {
        return { ...row, verdict: 'INACCESSIBLE', detail: `onglet contextuel « ${cmd.contextual ?? cmd.tab} » jamais affiche dans les contextes essayes`, context: undefined };
      }
      const tried = [];
      let best = null;
      const contexts = [preset, ...cfg.retry.filter((p) => p !== preset)];
      for (const p of contexts.slice(0, 5)) {
        tried.push(p);
        let a;
        try {
          a = await attempt(cmd, p, { reuse: tried.length === 1 });
        } catch (e) {
          a = { before: null, after: null, uiB: null, uiA: null, ud: { dialogOpened: false, popupOpened: false, toast: null, pressedChanged: [], outsideChanged: false, regions: [], platform: [] }, res: { reached: true, disabled: false }, errs: [`pilote: ${e.message}`], docChanged: false, stateChanged: false, dialog: null, info: {} };
        }
        let cls = classify({
          untestable: a.res.untestable, stateChanged: a.stateChanged,
          disabled: a.res.disabled, reached: a.res.reached, errors: a.errs, docChanged: a.docChanged, ui: a.ud,
          expectDisabled: disabledOk, noHandler: cmd.noHandler,
          alreadyActive: (cmd.type === 'color' && !cmd.id.includes('#')) || cmd.pressed === true && (cmd.type !== 'toggle' && cmd.type !== 'checkbox' || Boolean(cfg.radio?.test(cmd.control))),
        });
        // Entree conditionnelle sans objet dans le document de test (aucune connexion de donnees, aucune reference circulaire...).
        if (cfg.noOpIds?.test(cmd.id) && (cls.verdict === 'AUCUN_EFFET' || cls.verdict === 'INACCESSIBLE' || cls.verdict === 'DESACTIVEE')) cls = { verdict: 'SANS_OBJET', detail: 'rien a faire dans le document de test (entree conditionnelle)', retry: false };
        // Reglage d'un stylo (style, epaisseur, couleur) : la valeur affichee dans le champ change, sans toucher au document avant l'application d'une bordure.
        if (cfg.penIds?.test(cmd.id) && cls.verdict === 'AUCUN_EFFET') cls = { verdict: 'EFFET_UI', detail: 'reglage du stylo (valeur du champ, appliquee par le menu Bordures)', retry: false };
        if (!best) best = { a, cls, p };
        if (!cls.retry) { best = { a, cls, p }; break; }
        if (cmd.type !== 'toggle' && cmd.type !== 'menu-item' && cmd.type !== 'button' && cmd.type !== 'split' && cmd.type !== 'gallery-item' && cmd.type !== 'color-pick' && cmd.type !== 'combo-option' && cmd.type !== 'font-option' && cmd.type !== 'number' && cmd.type !== 'checkbox') break;
        if (disabledOk && a.res.disabled) break;
      }
      const { a, cls, p } = best;
      Object.assign(row, { verdict: cls.verdict, detail: cls.detail, context: p });
      if (cls.verdict === 'AUCUN_EFFET' && tried.length > 1) row.detail += ` (essaye : ${tried.join(', ')})`;
      if (a.res.why) row.detail = `${row.detail} ${a.res.why}`.trim();
      if (a.dialog) {
        row.dialog = a.dialog.title;
        row.dialogEffect = a.docChanged;
        if (a.dialog.validated && !a.dialog.closed) row.detail += ` | la boite « ${a.dialog.title} » reste ouverte apres ${a.dialog.button}`;
        if (a.dialog.note) row.detail += ` | ${a.dialog.note}`;
        if (a.dialog.platform && cls.verdict === 'EFFET_UI') row.detail += ' | selecteur de fichier';
      }
      if (a.docChanged) row.diff = diffPaths(a.before, a.after, 4);
      else if (cls.verdict === 'EFFET_UI' && !a.ud.dialogOpened && !a.ud.popupOpened) row.diff = [...a.ud.pressedChanged.map((k) => `pressed:${k}`), ...a.ud.regions].slice(0, 4);
      if (exp && a.docChanged) {
        row.checked = true;
        const msg = exp.check(a.before, a.after, cmd);
        if (msg) row.expectation = msg;
      } else if (exp && cls.verdict === 'EFFET_UI' && !a.docChanged) {
        row.expectation = 'format attendu dans le modele, aucun changement du document';
      }
      // Bascule : deux executions doivent revenir a l'etat initial.
      if ((cmd.type === 'toggle' || cmd.type === 'checkbox') && cls.verdict.startsWith('EFFET') && !a.dialog && !(cfg.radio?.test(cmd.control))) {
        clean = false;
        await resetDoc(b, cfg, fixtureB64);
        if (p) await b.ev(`window.__FO__.select(${j(p)})`);
        await sleep(120);
        const info = {};
        await showTab(b, cmd, info); await sleep(120);
        const s0 = await snap(b); const u0 = await uiSig(b, cfg);
        await perform(b, cmd, all, info, true); await sleep(500);
        const again = await perform(b, cmd, all, info); await sleep(300);
        const s2 = await snap(b); const u2 = await uiSig(b, cfg);
        if (!again.reached) row.detail += ' | ruban masque apres la 1re execution : retour non verifie';
        const sameDoc = diffSemantic(s0, s2, 3).filter((x) => !x.includes('selection')).length === 0;
        const samePressed = diffUi(u0, u2).pressedChanged.length === 0;
        row.toggleBack = again.reached ? sameDoc && samePressed : undefined;
        if (row.toggleBack === false) row.detail += ` | deux executions ne reviennent pas a l'etat initial (${diffSemantic(s0, s2, 2).join(' ; ') || 'etat de bascule'})`;
      }
      // Annulation : Echap ne doit rien casser.
      if (a.dialog && cmd.type !== 'custom') {
        clean = false;
        await resetDoc(b, cfg, fixtureB64);
        if (p) await b.ev(`window.__FO__.select(${j(p)})`);
        await sleep(120);
        const s0 = await snap(b);
        const info = {};
        await perform(b, cmd, all, info); await sleep(300);
        await press(b, 'Escape'); await sleep(300);
        const dialogsLeft = await b.ev('window.__c.dialogs().length');
        const s1 = await snap(b);
        const errs2 = await errors(b);
        row.cancelOk = dialogsLeft === 0 && diffPaths(s0, s1, 3).filter((x) => !x.includes('selection')).length === 0 && errs2.length === 0;
        if (!row.cancelOk) row.detail += ` | Echap : ${dialogsLeft ? 'la boite reste ouverte' : errs2.length ? errs2[0] : 'le document a change'}`;
      }
      if (['ERREUR', 'AUCUN_EFFET', 'INACCESSIBLE'].includes(row.verdict) || row.expectation || row.toggleBack === false || row.cancelOk === false) {
        row.capture = save(`${cfg.app}-${cmd.id}`, a.shotData);
      }
      return row;
    },
  };
}

export function lookup(entries) {
  return new Map(entries.map((e) => [e.id, e]));
}

export { MODULES };
