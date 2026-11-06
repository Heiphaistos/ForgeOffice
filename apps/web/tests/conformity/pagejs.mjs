// Fonctions injectees dans la page testee : localisation des controles du ruban par data-cmd / data-cmd-item.
export const PAGE_JS = `(() => {
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1 && !e.closest('.fo-ribbon__measure'); };
  const box = (e) => { e.scrollIntoView({ block: 'nearest', inline: 'nearest' }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height }; };
  const dis = (e) => Boolean(e.disabled || e.getAttribute('aria-disabled') === 'true' || e.closest('[aria-disabled=true]') || e.classList.contains('is-disabled'));
  const out = (e) => (e ? { ...box(e), disabled: dis(e), tag: e.tagName.toLowerCase(), text: (e.textContent || '').trim().slice(0, 40) } : null);
  const all = (sel) => [...document.querySelectorAll(sel)].filter(vis);
  const lastMenuItem = (id) => { const l = all('.fo-menu [data-cmd-item]').filter((e) => e.getAttribute('data-cmd-item') === id); return l[l.length - 1] || null; };
  window.__c = {
    tabs: () => all('.fo-ribbon [role=tab]').map((t) => ({ label: t.textContent.trim(), selected: t.getAttribute('aria-selected') === 'true' })),
    tab: (label) => out(all('.fo-ribbon [role=tab]').find((t) => t.textContent.trim() === label)),
    root: (cmd) => { const l = all('[data-cmd]').filter((e) => e.getAttribute('data-cmd') === cmd); return l[0] || null; },
    // Zone du controle : bouton principal, fleche, ou conteneur.
    control: (cmd, part) => {
      const r = window.__c.root(cmd);
      if (!r) return null;
      let el = r;
      if (part === 'arrow') el = r.querySelector('.fo-rb-split__arrow, .fo-colorpick__arrow, .fo-combo__arrow, button[aria-haspopup]') || r;
      else if (part === 'main') el = r.matches('button') ? r : (r.querySelector('.fo-rb-split__main, .fo-colorpick__main') || r.querySelector('button') || r);
      else if (part === 'more') el = r.querySelector('.fo-gal__nav button[aria-expanded], button[aria-haspopup=listbox]') || r;
      else if (part === 'input') el = r.querySelector('input:not([type=checkbox])') || r;
      else if (part === 'check') el = r.querySelector('input[type=checkbox]') || r;
      else if (part === 'up') el = r.querySelector('.fo-number__spin button') || r;
      return out(el);
    },
    // Controle de rendu libre : premier bouton, puis un element du panneau ouvert (le deuxieme, pour eviter un intitule).
    customButton: (cmd, last) => { const r = window.__c.root(cmd); const l = r ? [...r.querySelectorAll('button, [role=button]')].filter(vis) : []; return out(r && ((last ? l[l.length - 1] : l[0]) || (r.matches('button') ? r : null))); },
    popupItem: () => { const l = all('.fo-popover button, .fo-popover [role=option], .fo-menu [role=menuitem], .fo-gal__popup button, [role=listbox] [role=option], [role=menu] button'); return out(l[1] || l[0]); },
    collapsedGroup: (label) => out(all('.fo-rb-group--collapsed').find((g) => g.getAttribute('aria-label') === label)?.querySelector('button')),
    menuItem: (id) => out(lastMenuItem(id)),
    galleryTile: (cmd, id) => { const r = window.__c.root(cmd); const l = r ? [...r.querySelectorAll('[data-cmd-item]')].filter((e) => e.getAttribute('data-cmd-item') === id && vis(e)) : []; return out(l[0]); },
    popupTile: (id) => out(all('.fo-gal__popup [data-cmd-item], .fo-popover [data-cmd-item]').find((e) => e.getAttribute('data-cmd-item') === id)),
    swatch: (label) => out(all('.fo-swatch').find((e) => e.getAttribute('aria-label') === label)),
    paletteRow: () => out(all('.fo-palette__row')[0]),
    option: (text) => { const l = all('[role=option]').filter((e) => e.textContent.trim() === text); return out(l[0] || all('[role=option]').find((e) => e.textContent.trim().startsWith(text))); },
    dialogs: () => all('[role=dialog]:not(.fo-bs)').map((d) => ({ title: (d.querySelector('.fo-dialog__title, h2, h1') || d).textContent.trim().slice(0, 60) })),
    backstage: () => Boolean(document.querySelector('.fo-bs')),
  };
  window.__fillSeq = 0;
})();`;

/** Remplit les champs vides de la boite de dialogue ouverte : renvoie les champs a saisir (marques data-cdp-f). */
export const DIALOG_FIELDS = `(() => {
  const d = [...document.querySelectorAll('[role=dialog]:not(.fo-bs)')].pop();
  if (!d) return null;
  const fields = [];
  let n = 0;
  const label = (e) => (e.getAttribute('aria-label') || e.closest('label')?.textContent || e.labels?.[0]?.textContent || e.getAttribute('placeholder') || e.name || '').trim().slice(0, 60);
  for (const e of d.querySelectorAll('input, textarea')) {
    const r = e.getBoundingClientRect();
    if (r.width < 2 || e.disabled || e.readOnly) continue;
    if (['checkbox', 'radio', 'range', 'color', 'button', 'submit', 'hidden'].includes(e.type)) continue;
    if (e.type === 'file') { fields.push({ i: -1, file: true, label: label(e) }); continue; }
    if (e.value !== '') continue;
    e.setAttribute('data-cdp-f', String(n)); fields.push({ i: n, type: e.type, label: label(e) }); n++;
  }
  const foot = d.querySelector('.fo-dialog__footer');
  const btns = foot ? [...foot.querySelectorAll('button')].map((b) => ({ text: b.textContent.trim(), disabled: b.disabled, primary: b.classList.contains('fo-btn--primary') })) : [];
  return { title: (d.querySelector('.fo-dialog__title, h2, h1') || d).textContent.trim().slice(0, 60), fields, btns };
})()`;

export const DIALOG_PRIMARY = `(() => {
  const d = [...document.querySelectorAll('[role=dialog]:not(.fo-bs)')].pop();
  if (!d) return null;
  const foot = d.querySelector('.fo-dialog__footer') || d;
  const l = [...foot.querySelectorAll('button')].filter((b) => !b.disabled && b.getBoundingClientRect().width > 1);
  const cancel = /^(annuler|fermer|non)$/i;
  const pick = l.find((b) => b.classList.contains('fo-btn--primary')) || l.find((b) => !cancel.test(b.textContent.trim()) && !b.classList.contains('fo-dialog__close'));
  if (!pick) return null;
  const r = pick.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2, text: pick.textContent.trim() };
})()`;

export const TEXT_FOR = (label) => {
  if (/url|adresse|lien|http|web/i.test(label)) return 'https://exemple.fr';
  if (/courriel|mail/i.test(label)) return 'essai@exemple.fr';
  if (/remplacer|replace/i.test(label)) return 'Salut';
  if (/rechercher|find|chercher/i.test(label)) return 'Bonjour';
  if (/nombre|largeur|hauteur|taille|lignes|colonnes|marge|pt|cm|%/i.test(label)) return '2';
  return 'Essai';
};
