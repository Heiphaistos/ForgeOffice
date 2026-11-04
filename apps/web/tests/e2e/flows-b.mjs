// Parcours 4 (presse-papiers entre modules), 5 (console, thème sombre, fenêtre étroite) et 7 (enregistrer / rouvrir).
// Reçoit les aides de flows.mjs ; renvoie { numéro: fonction }.
export function flowsB({ b, ok, url, text, state, waitApp, nav, xlGoto, xlCell, xlType, dropOnHub, APPS, sleep }) {
  const COPY = { ctrl: true, commands: ['copy'] };
  const PASTE = { ctrl: true, commands: ['paste'] };
  const clipboard = () => b.ev('navigator.clipboard.readText()');
  const cm = () => b.ev(`document.querySelector('.cm-content')?.innerText ?? ''`);

  // ================================================================= 4. Presse-papiers
  async function p4() {
    const P = 4;
    await b.viewport(1440, 900);
    await dropOnHub('chiffres.xlsx');
    await waitApp('excel', 10000, true);
    await xlGoto('A1:C4');
    await b.key('c', COPY);
    await sleep(300);
    const tsv = await clipboard().catch(() => '');
    ok(P, 'Tableur : Ctrl+C met la plage en texte tabulé dans le presse-papiers', tsv.includes('Pommes\t10\t1,5'), JSON.stringify(tsv.slice(0, 60)));

    await nav('word');
    await b.click('.ProseMirror');
    await b.key('v', PASTE);
    await sleep(600);
    const tables = await b.ev(`document.querySelectorAll('.ProseMirror table').length`);
    const cells = await b.ev(`[...document.querySelectorAll('.ProseMirror td, .ProseMirror th')].map((c) => c.textContent.trim())`);
    ok(P, 'Tableur → Texte : la plage collée devient un tableau', tables === 1 && cells.includes('Pommes') && cells.includes('Figues') && cells.length >= 12, `${tables} tableau, ${cells.length} cellules`);

    await nav('notes');
    await b.click('.cm-content');
    await b.key('v', PASTE);
    await sleep(500);
    const note = await cm();
    ok(P, 'Tableur → Bloc-notes : texte tabulé', note.includes('Pommes\t10\t1,5') && note.includes('Figues\t5\t4'), JSON.stringify(note.slice(0, 70)));

    await dropOnHub('rapport.docx');
    await waitApp('word', 10000, true);
    await b.ev(`(() => { const t = document.querySelector('.ProseMirror table'); const r = document.createRange(); r.selectNode(t); const s = getSelection(); s.removeAllRanges(); s.addRange(r); })()`);
    await b.key('c', COPY);
    await sleep(300);
    await nav('excel');
    await xlGoto('A1');
    await b.key('v', PASTE);
    await sleep(600);
    const got = [await xlCell('A1'), await xlCell('B1'), await xlCell('A2'), await xlCell('B3')];
    ok(P, 'Texte → Tableur : un tableau collé remplit les cellules', got.join('|') === 'Mois|Total|Janvier|20', got.join('|'));
  }

  // ================================================================= 5. Console, thème sombre, fenêtre étroite
  async function p5() {
    const P = 5;
    for (const [w, h] of [[1440, 900], [700, 800]]) {
      await b.viewport(w, h);
      for (const app of APPS) {
        await b.goto(url('hub'), 100);
        b.consoleLog.length = 0;
        await b.goto(url(app), 1800);
        const log = [...b.consoleLog];
        ok(P, `${app} chargé seul à ${w}px : aucune erreur ni avertissement console`, log.length === 0, log.join(' || ').slice(0, 400));
      }
    }
    await b.viewport(1440, 900);
    await b.goto(url('hub'));
    await b.clickText('.hub-rail__item', 'Options');
    await b.clickText('label', 'Noir');
    await sleep(300);
    ok(P, 'Accueil > Options > Noir applique le thème sombre', (await state()).theme === 'dark');
    // Fond reel au sommet de la fenetre (barre de titre) : luminance < 0,3
    const dark = () => b.ev(`(() => {
      let n = document.elementFromPoint(window.innerWidth / 2, 10); let bg = 'rgba(0, 0, 0, 0)';
      while (n && /rgba\\(0, 0, 0, 0\\)|transparent/.test(bg)) { bg = getComputedStyle(n).backgroundColor; n = n.parentElement; }
      const [r, g, bl] = bg.match(/[0-9.]+/g).map(Number); return { lum: (0.2126 * r + 0.7152 * g + 0.0722 * bl) / 255, bg };
    })()`);
    const h0 = await dark();
    ok(P, 'Accueil : fond réellement sombre', h0.lum < 0.3, h0.bg);
    for (const app of APPS.filter((a) => a !== 'hub')) {
      await b.goto(url(app), 1200);
      const s = await state();
      const d = await dark();
      ok(P, `${app} : thème sombre conservé (rechargement) et appliqué`, s.theme === 'dark' && d.lum < 0.3, `${s.theme} ${d.bg}`);
    }
    await b.goto(url('hub'));
    await b.clickText('.hub-rail__item', 'Options');
    await b.clickText('label', 'Blanc');
    await b.viewport(1440, 900);
  }

  // ================================================================= 7. Enregistrer / rouvrir
  /** Ctrl+S puis recupere le fichier telecharge (null s'il n'arrive pas). */
  async function save() {
    await b.downloads();
    await b.key('s', { ctrl: true });
    for (let i = 0; i < 30; i++) {
      await sleep(250);
      const d = await b.downloads();
      if (d.length) return d[d.length - 1];
    }
    return null;
  }

  async function p7() {
    const P = 7;
    await b.viewport(1440, 900);

    // Texte
    await b.goto(url('word'));
    await b.click('.ProseMirror');
    await b.type('ENREG-WORD-7 accentué éàù');
    const wBefore = await b.ev(`document.querySelector('.ProseMirror').innerText`);
    let f = await save();
    ok(P, 'Texte : Ctrl+S télécharge le document', f && f.bytes.length > 1000, f?.name);
    if (f) {
      await dropOnHub(f.name, f.bytes);
      await waitApp('word', 10000, true);
      const after = await b.ev(`document.querySelector('.ProseMirror').innerText`);
      ok(P, 'Texte : contenu identique après réouverture', after.trim() === wBefore.trim(), JSON.stringify(after.slice(0, 60)));
    }

    // Tableur
    await b.goto(url('excel'));
    await xlType('A1', 'Alpha');
    await xlType('B1', '42');
    await xlType('A2', '=B1*2');
    await xlGoto('A1:B2');
    await b.key('c', COPY);
    const xBefore = await clipboard();
    f = await save();
    ok(P, 'Tableur : Ctrl+S télécharge le classeur', f && f.name.endsWith('.xlsx') && f.bytes.length > 1000, f?.name);
    if (f) {
      await dropOnHub(f.name, f.bytes);
      await waitApp('excel', 10000, true);
      await xlGoto('A1:B2');
      await b.key('c', COPY);
      const xAfter = await clipboard();
      ok(P, 'Tableur : valeurs identiques après réouverture', xAfter === xBefore && xAfter.includes('84'), JSON.stringify(xAfter));
      ok(P, 'Tableur : la formule est conservée', (await xlCell('A2')) === '=B1*2');
    }

    // Presentation : ajout d'une diapositive, puis comparaison du nombre de vignettes et du texte
    await dropOnHub('expose.pptx');
    await waitApp('powerpoint', 10000, true);
    const thumbs = () => b.ev(`document.querySelectorAll('.pp-thumb, [data-slide-index], .pp-slidepane [role=option]').length`);
    const t0 = await thumbs();
    await b.clickText('button', 'Nouvelle diapositive').catch(() => b.clickText('button', 'Nouvelle diapo'));
    await sleep(600);
    const t1 = await thumbs();
    f = await save();
    ok(P, 'Présentation : diapositive ajoutée puis Ctrl+S télécharge un .pptx', t1 === t0 + 1 && f && f.name.endsWith('.pptx'), `${t0} → ${t1} ${f?.name}`);
    if (f) {
      await dropOnHub(f.name, f.bytes);
      await waitApp('powerpoint', 10000, true);
      ok(P, 'Présentation : même nombre de diapositives et même texte après réouverture', (await thumbs()) === t1 && (await text()).includes('Diapo FOE2E titre'), `${await thumbs()}`);
    }

    // Publication
    await dropOnHub('affiche.fopub');
    await waitApp('publisher', 10000, true);
    await b.ev(`(() => { const e = [...document.querySelectorAll('[contenteditable], .pub-frame, [data-shape]')].find((x) => x.textContent.includes('Publication FOE2E')); e?.setAttribute('data-e2e', 'frame'); })()`);
    await b.click('[data-e2e=frame]');
    await b.click('[data-e2e=frame]');
    await b.key('End', { ctrl: true });
    await b.type(' MODIF');
    const pBefore = (await text()).includes('Publication FOE2E MODIF');
    f = await save();
    ok(P, 'Publication : modification puis Ctrl+S télécharge un .fopub', pBefore && f && f.name.endsWith('.fopub'), `${pBefore} ${f?.name}`);
    if (f) {
      await dropOnHub(f.name, f.bytes);
      await waitApp('publisher', 10000, true);
      ok(P, 'Publication : contenu identique après réouverture', (await text()).includes('Publication FOE2E MODIF'));
    }

    // Bloc-notes
    await b.goto(url('notes'));
    await b.click('.cm-content');
    await b.type('Note ENREG-NOTES-7\nligne deux accentuée é');
    const nBefore = await cm();
    f = await save();
    ok(P, 'Bloc-notes : Ctrl+S télécharge le fichier', f && f.bytes.length > 10, f?.name);
    if (f) {
      await dropOnHub(f.name, f.bytes);
      await waitApp('notes', 10000, true);
      const nAfter = await cm();
      ok(P, 'Bloc-notes : contenu identique après réouverture', nAfter.includes('Note ENREG-NOTES-7') && nAfter.includes('ligne deux accentuée é') && nBefore.trim() === nAfter.trim(), JSON.stringify(nAfter.slice(0, 60)));
    }
  }

  return { 4: p4, 5: p5, 7: p7 };
}
