// Parcours 7 : edition tactile (vrais evenements Input.dispatchTouchEvent) : appui long, defilement, selection, poignees,
// pincement, balayage, IME, barre d'outils au-dessus du clavier. Rejouer : `node flows.mjs 7`.
import { touchKit } from './touchkit.mjs';

export function flowsTouch({ b, ok, url, sleep }) {
  const k = touchKit(b);
  const P = 7;
  const addr = () => b.ev(`document.querySelector('.xl-namebox input')?.value`);
  const pct = () => b.ev(`document.querySelector('.fo-sb__pct')?.textContent`);
  const frame = () => b.ev(`(() => { const f = document.querySelector('.fo-ov__frame'); if (!f) return null; const r = f.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; })()`);

  async function p7() {
    // Accueil : appui long sur un recent = menu contextuel (tablette paysage, deux volets)
    await b.viewport(1180, 820, true);
    await b.goto(url('hub'), 600);
    await b.ev(`localStorage.setItem('fo-recent', JSON.stringify([{ name: 'Budget.xlsx', path: 'C:/Docs/Budget.xlsx', app: 'excel', openedAt: Date.now() }]))`);
    await b.goto(url('hub'), 900);
    ok(P, 'accueil tablette : deux volets (nouveaux documents et liste des recents)', await b.ev(`getComputedStyle(document.querySelector('.hub-home')).display === 'grid'`));
    const row = await k.where('.fo-files__row');
    await k.longPress(row.x, row.y, 800);
    ok(P, 'accueil : appui long sur un document recent ouvre le menu contextuel', await b.ev(`document.querySelectorAll('.fo-menu__item').length >= 2`));
    ok(P, 'menu contextuel : lignes de 44 px', await b.ev(`[...document.querySelectorAll('.fo-menu__item')].every((e) => e.getBoundingClientRect().height >= 43.5)`));

    // Texte : IME, double toucher, barre de mise en forme, pincement
    await k.mount('word', url, 390, 844, 1500);
    const doc = await k.where('.fo-doc');
    await k.tap(doc.x - 100, doc.y);
    ok(P, 'texte : la barre de mise en forme apparait au-dessus du clavier', await b.ev(`!!document.querySelector('.fo-kbbar')`));
    await k.compose(['c', 'ca', 'caf'], 'café');
    await b.send('Input.imeSetComposition', { text: 'é', selectionStart: 1, selectionEnd: 1 });
    await b.send('Input.insertText', { text: 'é' });
    ok(P, 'texte : saisie IME (composition) avec accents conservee', (await b.ev(`document.querySelector('.fo-doc').textContent`)) === 'caféé', await b.ev(`document.querySelector('.fo-doc').textContent`));
    await b.key('a', { ctrl: true, commands: ['selectAll'] });
    await k.tapEl('.fo-kbbar [aria-label="Gras"]');
    ok(P, 'texte : bouton Gras de la barre flottante applique la mise en forme', await b.ev(`!!document.querySelector('.fo-doc [data-rp="bold"]')`));
    const z0 = Number.parseInt(await pct(), 10);
    await k.pinch(200, 400, 80, 200);
    ok(P, 'texte : pincement a deux doigts change le zoom sans zoomer la page', Number.parseInt(await pct(), 10) > z0 && (await b.ev(`visualViewport.scale`)) === 1, `${z0} -> ${await pct()}`);

    // Tableur : defilement a un doigt, appui long + glisser, poignees, double toucher, bascule de mode, pincement
    await k.mount('excel', url, 390, 844, 1800);
    const g = await k.where('.xl-grid');
    await k.tap(g.x, g.y);
    const a0 = await addr();
    await k.drag(g.x, g.y + 150, g.x, g.y - 100, { steps: 12 });
    await k.tap(g.x, g.y);
    ok(P, 'tableur : un doigt fait defiler la grille', (await addr()) !== a0, `${a0} -> ${await addr()}`);
    ok(P, 'tableur : poignees de selection de 44 px', await b.ev(`[...document.querySelectorAll('.xl-thandle')].length === 3 && [...document.querySelectorAll('.xl-thandle')].every((h) => h.getBoundingClientRect().width >= 44)`));
    await k.doubleTap(g.x - 80, g.y - 100);
    if (!(await b.ev(`!!document.querySelector('.xl-celledit')`))) await k.doubleTap(g.x - 80, g.y - 100); // intervalle des deux touchers dependant de la charge du banc : un 2e essai
    ok(P, 'tableur : double toucher ouvre l edition de la cellule', await b.ev(`!!document.querySelector('.xl-celledit')`));
    ok(P, 'tableur : barre de signes de formule au-dessus du clavier', await b.ev(`!!document.querySelector('.fo-kbbar [aria-label="Insérer ("]')`));
    await b.key('Escape');
    await k.tapEl('.xl-modebtn');
    ok(P, 'tableur : bouton de bascule en mode selection', (await b.ev(`document.querySelector('.xl-modebtn').getAttribute('aria-pressed')`)) === 'true');
    await k.tapEl('.xl-modebtn');
    const z1 = Number.parseInt(await pct(), 10);
    await k.pinch(200, 450, 80, 200);
    ok(P, 'tableur : pincement sur la grille change le zoom', Number.parseInt(await pct(), 10) > z1, `${z1} -> ${await pct()}`);

    // Presentation : poignees de 44 px, deplacement, barre d'objets, diaporama (balayage, pincement)
    // Le premier toucher entre parfois (~1 fois sur 4) en edition de texte avec son menu contextuel par-dessus la poignee : jusqu'a 3 essais.
    let se;
    for (let essai = 0; essai < 3; essai++) {
      await k.mount('powerpoint', url, 390, 844, 2000);
      const pg = await k.where('.fo-canvas__page');
      await k.tap(pg.x, pg.y - pg.h * 0.22);
      await sleep(500);
      se = await b.ev(`(() => { const h = document.querySelector('.fo-ov__h.is-se'); if (!h) return { x: 0, y: 0, hit: 'aucune poignee' }; const r = h.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, hit: document.elementFromPoint(r.x + r.width / 2 + 18, r.y + r.height / 2 + 18)?.className }; })()`);
      if (String(se.hit).includes('fo-ov__h')) break;
    }
    ok(P, 'presentation : la poignee se saisit a 18 px de son centre (zone de 44 px)', String(se.hit).includes('fo-ov__h'), se.hit);
    // Mesure relative a la diapositive : lacher le champ de texte masque la barre du clavier, la zone se redimensionne et le zoom « ajuster » change en cours de geste.
    const rel = () => b.ev(`(() => { const f = document.querySelector('.fo-ov__frame')?.getBoundingClientRect(); const pgr = document.querySelector('.fo-canvas__page')?.getBoundingClientRect(); return f && pgr ? [f.width / pgr.width, f.height / pgr.height] : null; })()`);
    const f0 = await rel();
    const zoom0 = await pct();
    const bar0 = await b.ev(`!!document.querySelector('.fo-kbbar')`);
    let mid = null;
    await k.drag(se.x + 16, se.y + 16, se.x + 56, se.y + 46, { steps: 8, onMid: async () => { mid = [await pct(), await b.ev(`!!document.querySelector('.fo-kbbar')`)]; } });
    const f1 = await rel();
    ok(P, 'presentation : poignee au doigt = ni saut de zoom ni barre clavier qui disparait en plein geste', mid && mid[0] === zoom0 && mid[1] === bar0, `${zoom0}/${bar0} -> ${mid}`);
    ok(P, 'presentation : redimensionnement par la poignee au doigt', f1 && f0 && f1[0] > f0[0] && f1[1] > f0[1], `${f0} -> ${f1}`);
    ok(P, 'presentation : barre d objets flottante (dupliquer, supprimer)', await b.ev(`!!document.querySelector('.fo-objbar [aria-label="Supprimer"]')`));
    await k.tapEl('.fo-objbar [aria-label="Supprimer"]');
    ok(P, 'presentation : suppression par la barre d objets', (await frame()) === null);
    await k.tapEl('text=Présenter');
    await sleep(1200);
    const st = await k.where('.pp-show__stage');
    await k.drag(st.x + 100, st.y, st.x - 100, st.y, { steps: 6, stepMs: 10 });
    ok(P, 'diaporama : balayage a gauche = diapositive suivante', await b.ev(`!!document.querySelector('.pp-show__end')`));
    await k.drag(st.x - 100, st.y, st.x + 100, st.y, { steps: 6, stepMs: 10 });
    ok(P, 'diaporama : balayage a droite = diapositive precedente', await b.ev(`!document.querySelector('.pp-show__end')`));
    await k.pinch(st.x, st.y, 200, 60);
    ok(P, 'diaporama : pincement vers l interieur quitte le diaporama', await b.ev(`!document.querySelector('.pp-show')`));

    // Le toucher emule par CDP n'accorde pas l'activation utilisateur : le navigateur journalise le refus du plein ecran (le code l'attrape) ; on l'ecarte du controle de console.
    for (let i = b.consoleLog.length - 1; i >= 0; i--) if (b.consoleLog[i].includes('requestFullscreen')) b.consoleLog.splice(i, 1);

    // Publication : regles masquees sur telephone
    await k.mount('publisher', url, 390, 844, 2500);
    ok(P, 'publication : regles masquees sur telephone', await b.ev(`document.querySelectorAll('.pub-ruler').length === 0`));

    // Bloc-notes : IME dans l'editeur de code, barre de raccourcis
    await k.mount('notes', url, 390, 844, 2000);
    await k.tapEl('.cm-content');
    await k.compose(['b', 'bo'], 'bonjour é');
    await k.tapEl('.fo-kbbar [aria-label="Insérer ("]');
    await k.tapEl('.fo-kbbar [aria-label="Tabulation"]');
    ok(P, 'bloc-notes : IME, parenthese et tabulation depuis la barre de raccourcis', (await b.ev(`document.querySelector('.cm-content').innerText`)).endsWith('bonjour é(\t'), await b.ev(`JSON.stringify(document.querySelector('.cm-content').innerText)`));

    // Convertisseur : bouton de selection a la place du depot
    await k.mount('convert', url, 390, 844, 1500);
    ok(P, 'convertisseur : pas de depot sur mobile, « Touchez pour choisir des fichiers »', (await b.ev(`document.querySelector('.cv-empty__title')?.textContent`)) === 'Touchez pour choisir des fichiers');

    await b.viewport(1440, 900);
  }

  return { 7: p7 };
}
