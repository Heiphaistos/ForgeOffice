// Configuration par module du banc de conformite : document de test, zone de document (exclue de la detection d'effet d'interface),
// selection a preparer selon la commande, commandes dont la desactivation est normale, attentes de mise en forme.
import { expectationsFor } from './expectations.mjs';

/** Commandes dont la desactivation a vide est normale (historique vide, presse-papiers vide...). */
const COMMON_DISABLED = /^(annuler|rétablir|retablir|undo|redo|coller|collage spécial|reproduire)/i;

/** Pre-etapes de Presentation : etat a creer avant la commande (transition/animation/commentaire presents, effet a retirer, forme groupee). */
const FADE = 'transitions.gallery.transitions#fade';
const ANIM = 'animations.advanced.add#entr:10';
const PPT_PRE = {
  'transitions.gallery.options': FADE, 'transitions.timing.duration': FADE, 'transitions.timing.applyAll': FADE, 'transitions.timing.afterValue': 'transitions.timing.after',
  'animations.preview.preview': ANIM, 'animations.animation.options': 'animations.advanced.add#entr:2', 'animations.timing.start': ANIM, 'animations.timing.duration': ANIM, 'animations.timing.delay': ANIM,
  'animations.timing.earlier': ['select:formes', ANIM, 'select:ellipse'], 'animations.timing.later': ['select:formes', ANIM, 'select:forme'], 'animations.advanced.trigger': ANIM,
  ...Object.fromEntries(['seq', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'].map((k) => [`animations.advanced.trigger#${k}`, ANIM])),
  ...Object.fromEntries(['Au clic', 'Avec la précédente', 'Après la précédente'].map((k) => [`animations.timing.start#${k}`, ANIM])),
  'home.drawing.arrange#ungroup': 'home.drawing.arrange#group', 'shapeFormat.arrange.arrangeMenu#ungroup': 'shapeFormat.arrange.arrangeMenu#group',
  'view.zoom.fit': 'view.zoom.zoomMenu#200',
  ...Object.fromEntries(['home.drawing', 'shapeFormat.styles', 'pictureFormat.styles'].flatMap((g) => [
    [`${g}.effects#reflection/none`, `${g}.effects#reflection/tight`], [`${g}.effects#glow/none`, `${g}.effects#glow/accent15`], [`${g}.effects#soft/0`, `${g}.effects#soft/1`],
  ])),
};

export const MODULES = {
  word: {
    radio: /^(align-|view-|onepage|multipage|pagewidth|zoom)/,
    expectDisabledIds: /^mailings\.(fields|preview|finish)\./,
    pre: { 'tableLayout.merge.split': 'tableLayout.merge.merge', 'picture.arrange.position': 'picture.arrange.wrap#square', 'picture.arrange.position#left': 'picture.arrange.wrap#square', 'picture.arrange.position#center': 'picture.arrange.wrap#square', 'picture.arrange.position#right': 'picture.arrange.wrap#square', 'home.font.clear': 'home.font.bold', 'home.styles.styles#clear': 'home.font.bold' },
    app: 'word', fixture: 'word.docx', marker: 'Bonjour le monde', zones: ['.fo-word-canvas'], defaultPreset: 'mot',
    retry: ['paragraphe', 'tout', 'liste', 'titre', 'tableau', 'cellule', 'image'],
    presetFor: (c) => (/^tableLayout\.merge\./.test(c.id) ? 'cellules' : /^review\.changes\./.test(c.id) ? 'suivi' : /^(tableDesign|tableLayout)$/.test(c.tab) ? 'tableau' : c.tab === 'picture' ? 'image' : c.tab === 'outline' ? 'plan' : null),
  },
  excel: {
    radio: /^(top|middle|bottom|left|center|right|bold|italic|underline|wrap|fit|gp|hp|break|layout|total|filter|grid)$/,
    pre: {
      'home.editing.sortfilter#clear': [], 'home.editing.sortfilter#re': [], 'data.sort.clear': [], 'data.sort.re': [], 'formulas.audit.rm': 'formulas.audit.prec', 'formulas.audit.rm#all': 'formulas.audit.prec', 'formulas.audit.rm#prec': 'formulas.audit.prec', 'formulas.audit.rm#dep': 'formulas.audit.dep', 'layout.page.area#add': 'layout.page.area#set',
      'home.styles.cf#clr': 'home.styles.cf#top/above', 'home.styles.cf#clr/cs': 'home.styles.cf#top/above', 'home.styles.cf#clr/ch': 'home.styles.cf#top/above',
    },
    noOpIds: /^(data\.queries\.refresh|formulas\.audit\.errors#circ\/none|formulas\.lib\.recent#none)$/,
    app: 'excel', fixture: 'excel.xlsx', marker: 'Pomme', zones: ['.xl-canvas', '.xl-overlay'], defaultPreset: 'plage', retry: ['cellule', 'colonne', 'tableau'],
    presetFor: (c) => (/^(home\.editing\.sortfilter#(clear|re)|data\.sort\.(clear|re))$/.test(c.id) ? 'filtre' : /^formulas\.audit\.rm(#all|#prec)?$/.test(c.id) ? 'formule' : c.id === 'formulas.audit.rm#dep' ? 'cellule' : null),
  },
  powerpoint: {
    app: 'powerpoint', radio: /^(outline|sorter|notesPage|reading|normal|gray|onClick|after|select|colorMode|alignLeft|alignCenter|alignRight|justify)$/, pre: PPT_PRE, fixture: 'powerpoint.pptx', marker: 'Bienvenue', zones: ['.pp-stage', '.pp-side'], defaultPreset: 'forme', retry: ['texte', 'diapositive', 'tableau', 'image', 'plusieurs', 'graphique', 'edition', 'formes'],
    presetFor: (c) => (c.id === 'master.edit.deleteLayout' ? 'masquelibre' : /^master\./.test(c.id) ? 'masque' : c.id === 'pictureFormat.arrange.arrangeMenu#ungroup' ? 'groupeimage' : /^pictureFormat\.arrange\.arrangeMenu#group$/.test(c.id) ? 'formeimage' : /arrange(Menu)?#(group|ungroup)$/.test(c.id) ? 'formes' : /^review\.comments\.(delete|prev|next)$/.test(c.id) ? 'commentaire' : /^insert\.symbols\./.test(c.id) ? 'edition' : null),
  },
  publisher: {
    app: 'publisher', radio: /^(normal|single|two|al-l|al-ctr|al-r|al-just|bullets|numbers|firstRow|bandRow|firstCol)$/, pre: { 'design.layout.guides#clear': 'design.layout.guides#addH', 'view.zoom.whole': 'view.zoom.z100' }, expectDisabledIds: /^(mailings\.(fields|preview|finish)\.|(pictureFormat|shapeFormat|table)\.arrange\.group#g|table\.merge\.merge)/, fixture: 'publisher.fopub', marker: 'Zone essai', zones: ['.pub-slot'], defaultPreset: 'forme', retry: ['texte', 'page', 'image', 'tableau', 'deuxformes', 'chaine', 'chaine2'],
    presetFor: (c) => (/^home\.arrange\.group#g$/.test(c.id) ? 'deuxformes' : c.id === 'textFormat.linking.prev' ? 'chaine2' : /^home\.(font|paragraph)\./.test(c.id) ? 'texte' : /^table\./.test(c.id) ? 'tableau' : /^textFormat\.linking\./.test(c.id) ? 'chaine' : null),
  },
  notes: {
    app: 'notes', pre: { 'view.zoom.zoomReset': 'view.zoom.zoomIn' }, expectDisabledIds: /^(home\.hist\.reopenClosed|tools\.file\.reveal)$/, clearStorage: true, fixture: 'notes.md', marker: 'Bloc-notes de conformité', zones: ['.cm-editor'], defaultPreset: 'mot', retry: ['ligne', 'tout', 'curseur'],
    presetFor: () => null,
  },
  pdf: {
    app: 'pdf', radio: /^(tool-select|tool-hand|mode-continuous|mode-single)$/, expectDisabledIds: /^(comment\.comments\.clear-items|protect\.redact\.apply-redact|protect\.password\.unprotect|tools\.optimize\.(compress|pdfa|ocr)|tools\.export\.exp-word)$/, fixture: 'pdf.pdf', marker: 'pdf.pdf', zones: ['.pdf-pages'], defaultPreset: 'page', retry: ['texte', 'tout', 'derniere'],
    presetFor: () => null,
  },
  convert: {
    app: 'convert', expectDisabledIds: /^(home\.run\.stop|home\.options\.fidelity|pdf\.(transform\.pdf-compress|protect\.pdf-protect|archive\.pdf-(pdfa|ocr)))$/, fixture: 'convert.md', marker: 'convert.md', zones: ['.cv-main'], defaultPreset: 'fichiers', retry: ['termine'], dropTarget: '.cv',
    presetFor: () => null,
  },
  access: {
    app: 'access', radio: /^(por|land)$/, pre: { 'home.sort.adv#clr': 'home.sort.selection#eq', 'home.sort.nosort': 'home.sort.asc', 'home.find.goto#first': 'home.find.goto#next', 'home.find.goto#previous': 'home.find.goto#next' }, expectDisabledIds: /^(home\.(clip\.cut|find\.goto#new|sort\.tgl|records\.(new|save|spell|del)|find\.replace)|create\.(tpl\.parts|tables\.(table|tdesign))|external\.import\.|tools\.tools\.compact|fields\.)/, fixture: null, marker: 'démonstration', enter: '.acc-nonative__actions .fo-btn--primary', zones: ['.acc-view'], defaultPreset: 'table', retry: ['requete', 'formulaire', 'etat'], presetFor: () => null, readOnly: true,
  },
};

export function expectDisabled(cfg, c) {
  return COMMON_DISABLED.test(c.label) || (cfg.expectDisabledIds?.test(c.id) ?? false);
}

export { expectationsFor };
