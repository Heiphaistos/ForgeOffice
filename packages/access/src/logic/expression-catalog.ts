// Catalogue du Generateur d'expressions : champs, fonctions du moteur, operateurs, constantes ; insertion et controle
// de la syntaxe (sans DOM, teste). Seules les fonctions reellement prises en charge par forge-base (expr.rs) sont proposees.

export interface CatalogItem {
  label: string;
  /** Texte insere. */
  insert: string;
  /** Nombre de caracteres dont reculer le curseur apres insertion (pour se placer entre les parentheses). */
  caretBack?: number;
  hint?: string;
}

export interface CatalogCategory {
  id: string;
  label: string;
  items: CatalogItem[];
}

export interface FieldSource {
  name: string;
  fields: readonly string[];
}

const fn = (name: string, args: string, hint: string): CatalogItem => ({ label: `${name}(${args})`, insert: `${name}()`, caretBack: 1, hint });
const op = (label: string, insert: string, hint: string): CatalogItem => ({ label, insert: ` ${insert} `, hint });

const FUNCTIONS: readonly CatalogCategory[] = [
  { id: 'fn-text', label: 'Fonctions : Texte', items: [
    fn('Gauche', 'texte; n', 'Premiers caractères'), fn('Droite', 'texte; n', 'Derniers caractères'), fn('ExtracChaîne', 'texte; début; longueur', 'Extrait une partie'),
    fn('NbCar', 'texte', 'Nombre de caractères'), fn('Majuscule', 'texte', 'Convertit en majuscules'), fn('Minuscule', 'texte', 'Convertit en minuscules'),
    fn('SupprEspace', 'texte', 'Retire les espaces aux extrémités'), fn('DansChaîne', 'début; texte; recherche', 'Position d’un texte'), fn('Remplacer', 'texte; cherché; remplacement', 'Remplace un texte'),
  ] },
  { id: 'fn-math', label: 'Fonctions : Mathématiques', items: [
    fn('Abs', 'nombre', 'Valeur absolue'), fn('Arrondi', 'nombre; décimales', 'Arrondit'), fn('Ent', 'nombre', 'Partie entière (vers le bas)'),
    fn('Tronque', 'nombre', 'Retire la partie décimale'), fn('Signe', 'nombre', '-1, 0 ou 1'), fn('Racine', 'nombre', 'Racine carrée'),
  ] },
  { id: 'fn-date', label: 'Fonctions : Date et heure', items: [
    fn('Maintenant', '', 'Date et heure actuelles'), fn('Année', 'date', 'Année d’une date'), fn('Mois', 'date', 'Mois d’une date'), fn('Jour', 'date', 'Jour du mois'),
    fn('JourSem', 'date', 'Jour de la semaine (1 = dimanche)'), fn('AjDate', 'intervalle; nombre; date', 'Ajoute un intervalle à une date'),
    fn('DiffDate', 'intervalle; date1; date2', 'Écart entre deux dates'), fn('SérialDate', 'année; mois; jour', 'Construit une date'),
  ] },
  { id: 'fn-conv', label: 'Fonctions : Conversion', items: [
    fn('CNum', 'valeur', 'Convertit en nombre'), fn('CEntLong', 'valeur', 'Convertit en entier'), fn('CChaîne', 'valeur', 'Convertit en texte'),
    fn('CDate', 'valeur', 'Convertit en date'), fn('Format', 'valeur; format', 'Met en forme (nombre, date)'),
  ] },
  { id: 'fn-logic', label: 'Fonctions : Logique', items: [
    fn('VraiFaux', 'condition; si vrai; si faux', 'Choisit selon une condition'), fn('Nz', 'valeur; si nul', 'Remplace Null'), fn('EstNull', 'valeur', 'Vrai si Null'),
    fn('EstNumérique', 'valeur', 'Vrai si numérique'), fn('EstDate', 'valeur', 'Vrai si date'), fn('Choisir', 'index; choix1; choix2', 'Choisit par position'),
  ] },
  { id: 'fn-agg', label: 'Fonctions : Agrégats', items: [
    fn('Somme', 'champ', 'Total'), fn('Moyenne', 'champ', 'Moyenne'), fn('Compte', 'champ', 'Nombre de valeurs'), fn('Premier', 'champ', 'Première valeur'), fn('Dernier', 'champ', 'Dernière valeur'),
  ] },
];

const OPERATORS: CatalogCategory = {
  id: 'ops', label: 'Opérateurs', items: [
    op('+  Addition', '+', 'Additionne'), op('-  Soustraction', '-', 'Soustrait'), op('*  Multiplication', '*', 'Multiplie'), op('/  Division', '/', 'Divise'), op('Mod  Reste', 'Mod', 'Reste de la division'),
    op('&  Concaténation', '&', 'Assemble des textes'),
    op('=  Égal', '=', ''), op('<>  Différent', '<>', ''), op('<  Inférieur', '<', ''), op('>  Supérieur', '>', ''), op('<=  Inférieur ou égal', '<=', ''), op('>=  Supérieur ou égal', '>=', ''),
    op('Et', 'Et', 'Les deux conditions'), op('Ou', 'Ou', 'L’une des conditions'), op('Pas', 'Pas', 'Inverse la condition'),
    { label: 'Comme', insert: ' Comme "*"', caretBack: 1, hint: 'Motif avec * et ?' }, { label: 'Entre … Et …', insert: ' Entre  Et ', caretBack: 4, hint: 'Intervalle inclusif' },
    { label: 'Est Null', insert: ' Est Null', hint: 'Valeur absente' }, { label: 'Est Pas Null', insert: ' Est Pas Null', hint: 'Valeur présente' },
  ],
};

const CONSTANTS: CatalogCategory = {
  id: 'const', label: 'Constantes', items: [
    { label: 'Vrai', insert: 'Vrai' }, { label: 'Faux', insert: 'Faux' }, { label: 'Null', insert: 'Null' }, { label: 'Texte vide ("")', insert: '""' },
  ],
};

/** Catalogue complet : un groupe de champs par table, puis fonctions, operateurs, constantes. */
export function catalog(sources: readonly FieldSource[]): CatalogCategory[] {
  const fields = sources.map((s): CatalogCategory => ({ id: `t-${s.name}`, label: `Champs : ${s.name}`, items: s.fields.map((f) => ({ label: f, insert: `[${f}]` })) }));
  return [...fields, ...FUNCTIONS, OPERATORS, CONSTANTS];
}

/** Insere `item` a la position `caret` ; renvoie le nouveau texte et la nouvelle position du curseur. */
export function insertAt(text: string, caret: number, item: CatalogItem): { text: string; caret: number } {
  const at = Math.max(0, Math.min(text.length, caret));
  const next = text.slice(0, at) + item.insert + text.slice(at);
  return { text: next, caret: at + item.insert.length - (item.caretBack ?? 0) };
}

/** Message d'erreur francais si guillemets, crochets, dieses ou parentheses sont mal appaires ; null si correct. */
export function checkExpression(text: string): string | null {
  let depth = 0;
  let quote = false;
  let bracket = false;
  let hash = false;
  for (const ch of text) {
    if (quote) {
      if (ch === '"') quote = false;
    } else if (bracket) {
      if (ch === ']') bracket = false;
    } else if (hash) {
      if (ch === '#') hash = false;
    } else if (ch === '"') quote = true;
    else if (ch === '[') bracket = true;
    else if (ch === '#') hash = true;
    else if (ch === '(') depth++;
    else if (ch === ')' && --depth < 0) return 'Parenthèse fermante sans parenthèse ouvrante.';
  }
  if (quote) return 'Guillemet de fermeture manquant.';
  if (bracket) return 'Crochet de fermeture manquant.';
  if (hash) return 'Dièse de fermeture manquant (date).';
  return depth > 0 ? `${depth} parenthèse(s) à fermer.` : null;
}
