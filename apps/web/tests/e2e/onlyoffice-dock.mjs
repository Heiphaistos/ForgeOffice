// Disposition OnlyOffice : barres laterales (rail gauche, rail droit + panneau Parametres) et panneau contextuel automatique.
// Usage : node onlyoffice-dock.mjs <port vite> <port cdp>
import { launch, sleep } from './harness.mjs';

const [vite = '5190', cdp = '9702'] = process.argv.slice(2);
const b = await launch({ port: Number(cdp) });
let bad = 0;
const ok = (n, c, i = '') => { if (!c) bad++; console.log(`${c ? 'OK  ' : 'FAIL'} ${n}${i ? ` : ${i}` : ''}`); };
try {
  await b.viewport(1440, 900);
  await b.goto(`http://127.0.0.1:${vite}/`, 600);
  await b.ev(`localStorage.setItem('fo-setting:ui.layout', '"onlyoffice"')`);
  for (const app of ['word', 'excel', 'powerpoint', 'publisher']) {
    await b.goto(`http://127.0.0.1:${vite}/?app=${app}`, 2500);
    ok(`${app} : rail gauche`, await b.ev(`document.querySelectorAll('.fo-oo-rail--left .fo-oo-rail__btn').length >= 1`));
    // Le panneau ouvert est memorise (reglage commun a la suite) : ne cliquer que s'il est ferme.
    await b.ev(`if (!document.querySelector('.fo-oo-panel')) document.querySelector('.fo-oo-rail--right .fo-oo-rail__btn')?.click()`);
    await sleep(500);
    ok(`${app} : panneau Parametres avec commandes`, await b.ev(`document.querySelectorAll('.fo-oo-panel .fo-rb-btn, .fo-oo-panel button').length > 3`));
    const w = await b.ev(`(() => { const d = document.querySelector('.fo-ribbon ~ *'); return d ? Math.round(d.getBoundingClientRect().right) : 0; })()`);
    ok(`${app} : barre d'etat entiere (non rognee)`, await b.ev(`(() => { const s = document.querySelector('.fo-sb'); if (!s) return true; const r = s.getBoundingClientRect(); const rail = document.querySelector('.fo-oo-rail--right').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1 && s.scrollWidth <= s.clientWidth + 1 && !(r.bottom > rail.top && rail.bottom > r.top && r.right > rail.left); })()`));
    ok(`${app} : le contenu laisse la place au panneau`, w > 0 && w <= 1440 - 40 - 232 + 2, String(w));
  }
  // Structure OnlyOffice : onglets dans l'ordre, entete coloree par application, barre d'outils de 66 px, rangee « fenetre », barre d'etat de 25 px.
  const WANT = { word: ['Fichier', 'Accueil', 'Insertion', 'Dessiner', 'Mise en page', 'Références', 'Collaboration', 'Protection', 'Affichage', 'Modules complémentaires', 'Outils IA'], excel: ['Fichier', 'Accueil', 'Insertion', 'Dessiner', 'Mise en page', 'Formule', 'Données', 'Collaboration', 'Protection', 'Affichage', 'Modules complémentaires', 'Outils IA'], powerpoint: ['Fichier', 'Accueil', 'Insertion', 'Dessiner', 'Conception', 'Transitions', 'Animation', 'Collaboration', 'Protection', 'Affichage', 'Modules complémentaires', 'Outils IA'] };
  const HDR = { word: 'rgb(68, 105, 149)', excel: 'rgb(58, 128, 86)', powerpoint: 'rgb(183, 91, 68)', pdf: 'rgb(170, 82, 82)' };
  for (const [app, want] of Object.entries(WANT)) {
    await b.goto(`http://127.0.0.1:${vite}/?app=${app}`, 2000);
    const tabs = await b.ev(`[...document.querySelectorAll('.fo-ribbon__tabs .fo-ribbon__tab')].map((t) => t.textContent.trim())`);
    ok(`${app} : onglets dans l'ordre OnlyOffice`, JSON.stringify(tabs) === JSON.stringify(want), tabs.join(' | '));
  }
  await b.ev(`localStorage.setItem('fo-setting:ui.onlyoffice.theme', '"classic-light"')`);
  for (const [app, color] of Object.entries(HDR)) {
    await b.goto(`http://127.0.0.1:${vite}/?app=${app}`, 1500);
    const m = await b.ev(`(() => { const h = document.querySelector('header.fo-tb'); const t = document.querySelector('.fo-ribbon__tabrow'); const p = document.querySelector('.fo-ribbon__panel'); const sb = document.querySelector('.fo-sb'); return { bg: getComputedStyle(h).backgroundColor, tabs: getComputedStyle(t).backgroundColor, th: Math.round(h.getBoundingClientRect().height), tabh: Math.round(t.getBoundingClientRect().height), panel: p ? Math.round(p.getBoundingClientRect().height) : 0, native: Boolean(document.querySelector('.fo-oo-native')), sb: sb ? Math.round(sb.getBoundingClientRect().height) : 0 }; })()`);
    ok(`${app} : entete et onglets de la couleur OnlyOffice`, m.bg === color && m.tabs === color, `${m.bg} / ${m.tabs}`);
    ok(`${app} : hauteurs Classique clair (rangee fenetre, titre 28, onglets 28, barre 66, etat 25)`, m.th === 28 && m.tabh === 28 && m.panel >= 66 && m.panel <= 67 && m.native && (m.sb === 25 || m.sb === 0), JSON.stringify(m));
  }
  await b.goto(`http://127.0.0.1:${vite}/?app=word`, 2500);
  await b.click('text=Insertion'); await sleep(400);
  await b.click('text=Tableau'); await sleep(500);
  await b.ev(`document.querySelector('.fo-popover')?.querySelectorAll('div,button')[8]?.click()`);
  await sleep(800);
  const active = await b.ev(`document.querySelector('.fo-oo-rail--right .is-active')?.title ?? ''`);
  ok('word : le panneau du tableau s\'ouvre a la creation', active === 'Paramètres du tableau', active);
  // Rail droit permanent : 7 types d'objets, grises tant qu'aucun objet n'est selectionne ; le tableau s'active apres sa creation.
  const rail = await b.ev(`[...document.querySelectorAll('.fo-oo-rail--right .fo-oo-rail__btn')].map((x) => (x.disabled ? '0' : '1')).join('')`);
  ok('word : rail droit = 7 types d objets : paragraphe et tableau actifs, les autres grises', rail.length >= 7 && rail[1] === '1' && rail.slice(2, 7) === '00000', rail);
  // Fichier : onglet surligne, un clic sur un autre onglet ferme la vue.
  await b.goto(`http://127.0.0.1:${vite}/?app=word`, 2000);
  await b.click('text=Fichier'); await sleep(500);
  ok('word : vue Fichier ouverte, onglet Fichier surligne', await b.ev(`document.documentElement.dataset.fileOpen === '1' && Boolean(document.querySelector('.fo-bs'))`));
  await b.click('.fo-ribbon__tab:not(.fo-ribbon__tab--file)'); await sleep(500);
  ok('word : cliquer un onglet du ruban ferme la vue Fichier', await b.ev(`!document.querySelector('.fo-bs') && !document.documentElement.dataset.fileOpen`));
  await b.click('.fo-oo-native__home'); await sleep(500);
  ok('word : bouton Accueil de la rangee fenetre ouvre la vue Fichier sur Accueil', await b.ev(`Boolean(document.querySelector('.fo-bs')) && /Accueil/.test(document.querySelector('.fo-bs__nav-item.is-active')?.textContent ?? '')`));
  await b.key('Escape'); await sleep(300);
  ok('word : menu Edition / Lecture present', await b.ev(`document.querySelectorAll('.fo-oo-mode__btn').length === 1`));
  // PDF : bascules miniatures et signets au rail gauche.
  await b.goto(`http://127.0.0.1:${vite}/?app=pdf`, 2000);
  ok('pdf : rail gauche avec miniatures, signets, annonces', await b.ev(`['Miniatures', 'Signets', 'Annonces'].every((t) => [...document.querySelectorAll('.fo-oo-rail--left .fo-oo-rail__btn')].some((x) => x.title.startsWith(t)))`));
  // Themes modernes (variables relevees dans OnlyOffice 10.0) : Clair (barre 84 px arrondie, etat 32 px) et Sombre (entete #222, barre #404040).
  for (const [theme, want] of [['white', { hdr: 'rgb(243, 243, 243)', panel: 'rgb(255, 255, 255)', h: 84, r: '8px', sb: 32 }], ['dark', { hdr: 'rgb(34, 34, 34)', panel: 'rgb(64, 64, 64)', h: 84, r: '8px', sb: 32 }]]) {
    await b.ev(`localStorage.setItem('fo-setting:ui.onlyoffice.theme', '"${theme}"')`);
    await b.goto(`http://127.0.0.1:${vite}/?app=word`, 2000);
    const lt = await b.ev(`(() => { const p = document.querySelector('.fo-ribbon__panel'); const sb = document.querySelector('.fo-sb'); return { hdr: getComputedStyle(document.querySelector('header.fo-tb')).backgroundColor, panel: getComputedStyle(p).backgroundColor, h: Math.round(p.getBoundingClientRect().height), r: getComputedStyle(p).borderRadius, sb: Math.round(sb.getBoundingClientRect().height), theme: document.documentElement.dataset.ooTheme }; })()`);
    ok(`word : theme ${theme}`, lt.hdr === want.hdr && lt.panel === want.panel && lt.h === want.h && lt.r === want.r && lt.sb === want.sb && lt.theme === theme, JSON.stringify(lt));
  }
  await b.ev(`localStorage.removeItem('fo-setting:ui.onlyoffice.theme')`);
  console.log(b.consoleLog.slice(0, 5).join('\n') || 'console propre');
} finally {
  await b.close();
}
process.exit(bad ? 1 : 0);
