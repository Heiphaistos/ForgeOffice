// Description des panneaux « Parametres » du rail droit OnlyOffice, d'apres l'application reelle 10.0 (sections, libelles, unites ; textes FR de sa localisation).
// `b` = commande de NOTRE ruban a brancher (« onglet:id », « id » ou « commande>entree-de-menu ») ; sans `b` ou introuvable, le champ reste grise.
import type { OoField, OoFormSpec } from '../components/layouts/OnlyOfficeForms.tsx';

const rule: OoField = { k: 'rule' };
const sec = (t: string): OoField => ({ k: 'h', t });

/** Largeur x hauteur avec le verrou de proportions (grise : chez nous la taille garde ses proportions ou non selon la commande). */
const sizeRow = (w: string, h: string): OoField[] => [
  { k: 'pair', f: [{ k: 'num', t: 'Largeur', b: w, unit: 'cm', step: 0.1 }, { k: 'num', t: 'Hauteur', b: h, unit: 'cm', step: 0.1 }] },
];

const rotation = (t: string, p: string, ids: { l?: string; r?: string; angle?: string; fh?: string; fv?: string }): OoField[] => [
  sec('Rotation'),
  { k: 'pair', f: [
    { k: 'icons', t: 'Faire pivoter', items: [{ i: 'rotate_left', t: 'Faire pivoter à gauche de 90°', b: ids.l && `${p}:${ids.l}` }, { i: 'rotate_right', t: 'Faire pivoter à droite de 90°', b: ids.r && `${p}:${ids.r}` }] },
    { k: 'icons', t, items: [{ i: 'flip_horizontal', t: 'Retourner horizontalement', b: ids.fh && `${p}:${ids.fh}` }, { i: 'flip_vertical', t: 'Retourner verticalement', b: ids.fv && `${p}:${ids.fv}` }] },
  ] },
  { k: 'num', t: 'Angle', b: ids.angle && `${p}:${ids.angle}`, unit: '°', step: 5 },
];

const fillAndLine = (p: string, b: { fill?: string; line?: string; weight?: string }): OoField[] => [
  sec('Remplissage'),
  { k: 'select', v: 'Remplissage coloré', b: b.fill && `${p}:${b.fill}` },
  { k: 'color', b: b.fill && `${p}:${b.fill}` },
  sec('Opacité'),
  { k: 'slider', t: 'Opacité' },
  rule,
  sec('Ligne'),
  { k: 'select', t: 'Taille', v: '0,5 pt', b: b.weight && `${p}:${b.weight}` },
  { k: 'select', t: 'Couleur', v: 'Couleur du contour', b: b.line && `${p}:${b.line}` },
  { k: 'select', t: 'Type', v: 'Continu' },
  sec('Opacité'),
  { k: 'slider', t: 'Opacité du contour' },
  rule,
];

const advanced = (b?: string): OoField => ({ k: 'link', t: 'Afficher les paramètres avancés', b });

// ------------------------------------------------------------------------------------------------ Texte
const wordImage: OoFormSpec = {
  title: "Paramètres de l'image",
  fields: [
    sec('Taille'),
    ...sizeRow('picture:w', 'picture:h'),
    { k: 'btn', t: 'Taille actuelle' },
    { k: 'btn', t: 'Ajuster aux marges' },
    { k: 'btn', t: 'Rogner' },
    { k: 'btn', t: 'Réinitialiser le rognage', b: 'picture:reset' },
    rule,
    sec('Opacité'),
    { k: 'slider', t: 'Opacité' },
    rule,
    ...rotation('Retournement', 'picture', { l: 'rotateleft', r: 'rotate', angle: 'angle', fh: 'fliph', fv: 'flipv' }),
    rule,
    sec("Style d'habillage"),
    { k: 'select', b: 'picture:wrap', v: 'Aligné sur le texte' },
    rule,
    { k: 'btn', t: "Remplacer l'image", menu: true },
    { k: 'btn', t: "Modifier l'objet" },
    rule,
    { k: 'btn', t: 'Convertir en forme' },
    rule,
    advanced('picture:alt'),
  ],
};

// ------------------------------------------------------------------------------------------------ Tableur
const excelCell: OoFormSpec = {
  title: 'Paramètres de la cellule',
  fields: [
    sec('Remplissage'),
    { k: 'select', v: 'Aucun remplissage' },
    { k: 'color', b: 'home:fill' },
    rule,
    sec('Style des bordures'),
    { k: 'pair', f: [{ k: 'select', v: 'Aucune' }, { k: 'color', t: 'Couleur' }] },
    { k: 'text', t: 'Sélectionnez les bordures à modifier en appliquant le style choisi ci-dessus' },
    { k: 'icons', items: [
      { i: 'border_all', t: 'Toutes les bordures', b: 'borders>all' }, { i: 'border_none', t: 'Aucune bordure', b: 'borders>none' }, { i: 'border_inside', t: 'Bordures intérieures', b: 'borders>inside' },
      { i: 'border_outside', t: 'Bordures extérieures', b: 'borders>outside' }, { i: 'border_outside_thick', t: 'Bordure diagonale ascendante' }, { i: 'border_top_bottom', t: 'Bordure diagonale descendante' },
    ] },
    { k: 'icons', items: [
      { i: 'border_left', t: 'Bordure gauche', b: 'borders>left' }, { i: 'border_inside', t: 'Bordures verticales intérieures' }, { i: 'border_right', t: 'Bordure droite', b: 'borders>right' },
      { i: 'border_top', t: 'Bordure haute', b: 'borders>top' }, { i: 'border_top_bottom', t: 'Bordures horizontales intérieures' }, { i: 'border_bottom', t: 'Bordure basse', b: 'borders>bottom' },
    ] },
    rule,
    sec('Retrait'),
    { k: 'num', t: '', b: 'home:ooindent', step: 1 },
    sec('Orientation du texte'),
    { k: 'num', t: 'Angle', b: 'home:ooangle', unit: '°' },
    sec('Contrôle de texte'),
    { k: 'check', t: 'Habillage du texte', b: 'home:wrap' },
    { k: 'check', t: 'Réduire pour ajuster', b: 'home:ooshrink' },
    rule,
    { k: 'btn', t: 'Mise en forme conditionnelle', b: 'home:cf', menu: true },
  ],
};

const excelShape: OoFormSpec = {
  title: 'Paramètres de la forme',
  fields: [
    ...fillAndLine('shapeFormat', { fill: 'fill', line: 'line', weight: 'weight' }),
    ...rotation('Retourner', 'shapeFormat', { l: 'rotL', r: 'rotR' }),
    rule,
    { k: 'btn', t: 'Modifier la forme' },
    { k: 'btn', t: 'Modifier la forme automatique', menu: true },
    rule,
    { k: 'check', t: 'Ajouter une ombre' },
    rule,
    advanced(),
  ],
};

const chartForm = (p: string, change?: string, del?: string): OoFormSpec => ({
  title: 'Paramètres du graphique',
  fields: [
    sec('Taille'),
    ...sizeRow(`${p}:w`, `${p}:h`),
    rule,
    sec('Style'),
    { k: 'select', v: 'Style du graphique' },
    { k: 'btn', t: 'Modifier le type', b: change && `${p}:${change}`, menu: true },
    { k: 'btn', t: 'Sélectionner des données', b: `${p}:edit` },
    { k: 'btn', t: 'Supprimer le graphique', b: del && `${p}:${del}` },
    rule,
    sec('Rotation 3D'),
    { k: 'num', t: 'Rotation X', unit: '°' },
    { k: 'num', t: 'Rotation Y', unit: '°' },
    { k: 'num', t: 'Perspective', unit: '°' },
    rule,
    advanced(),
  ],
});

const excelPivot: OoFormSpec = {
  title: 'Paramètres du tableau croisé dynamique',
  fields: [{ k: 'custom', b: 'pivotAnalyze:ooform' }, advanced()],
};

// ------------------------------------------------------------------------------------------------ Presentation
const slideForm: OoFormSpec = {
  title: 'Paramètres de la diapositive',
  fields: [
    sec('Arrière-plan'),
    { k: 'select', v: 'Remplissage coloré', b: 'design:bg' },
    { k: 'color' },
    sec('Opacité'),
    { k: 'slider', t: 'Opacité' },
    { k: 'check', t: "Afficher des graphismes d'arrière-plan" },
    { k: 'btn', t: "Réinitialiser l'arrière-plan" },
    { k: 'btn', t: 'Appliquer à toutes les diapositives' },
    rule,
    { k: 'check', t: 'Afficher le numéro de diapositive', b: 'insert:number' },
    { k: 'check', t: "Afficher la date et l'heure", b: 'insert:date' },
  ],
};

const pptShape: OoFormSpec = {
  title: 'Paramètres de la forme',
  fields: [
    ...fillAndLine('shapeFormat', { fill: 'fill', line: 'outline', weight: 'outline' }),
    ...rotation('Retournement', 'shapeFormat', {}),
    rule,
    { k: 'btn', t: 'Modifier les points' },
    { k: 'btn', t: 'Modifier la forme automatique', b: 'shapeFormat:edit', menu: true },
    rule,
    { k: 'check', t: 'Ajouter une ombre' },
    rule,
    advanced(),
  ],
};

const pptImage: OoFormSpec = {
  title: "Paramètres de l'image",
  fields: [
    sec('Taille'),
    ...sizeRow('pictureFormat:w', 'pictureFormat:h'),
    { k: 'btn', t: 'Taille réelle' },
    { k: 'btn', t: 'Ajuster à la diapositive' },
    { k: 'btn', t: 'Rogner', b: 'pictureFormat:crop', menu: true },
    { k: 'btn', t: 'Réinitialiser le rognage' },
    rule,
    sec('Opacité'),
    { k: 'slider', t: 'Opacité' },
    rule,
    ...rotation('Retournement', 'pictureFormat', {}),
    rule,
    { k: 'btn', t: "Remplacer l'image", b: 'pictureFormat:change' },
    { k: 'btn', t: "Modifier l'objet" },
    rule,
    { k: 'btn', t: 'Convertir en forme' },
    rule,
    advanced('pictureFormat:alt'),
  ],
};

/** Formulaires par module (`data-app`) et type d'objet du rail droit. `settings` = panneau ouvert sans objet (cellule, diapositive). */
export const OO_FORMS: Record<string, Partial<Record<string, OoFormSpec>>> = {
  word: { image: wordImage },
  excel: { settings: excelCell, shape: excelShape, chart: chartForm('chartDesign', 'kind', 'delete'), pivot: excelPivot },
  powerpoint: { settings: slideForm, shape: pptShape, image: pptImage, chart: chartForm('chartDesign', 'changeType') },
};
