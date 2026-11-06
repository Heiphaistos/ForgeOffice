// Attentes du module Texte : fonctions (avant, apres, commande) -> null si conforme, sinon message.
// La selection de test est le premier mot (« Bonjour ») du paragraphe de texte courant.
const para = (snap) => snap?.body?.find((b) => b.type === 'paragraph' && b.inlines?.some((i) => i.type === 'text' && i.text.toLowerCase().startsWith('bonjour')));
const word = (snap) => para(snap)?.inlines.find((i) => i.type === 'text' && i.text.toLowerCase().startsWith('bonjour'));
const need = (cond, msg) => (cond ? null : msg);
const run = (check) => (_a, after, cmd) => {
  const w = word(after);
  return w ? check(w, para(after), cmd) : 'mot de test introuvable apres la commande';
};
const prop = (name, expected, label) => run((w) => need(expected === undefined ? Boolean(w.props?.[name]) : w.props?.[name] === expected, `${label} absent des proprietes du mot (${JSON.stringify(w.props)})`));
const alignment = (value) => run((_w, p) => need(p.props?.alignment === value, `alignement ${value} absent (${p.props?.alignment ?? 'defaut'})`));

export const WORD_EXPECT = {
  'home.font.bold': prop('bold', true, 'gras'),
  'home.font.italic': prop('italic', true, 'italique'),
  'home.font.underline': prop('underline', undefined, 'souligne'),
  'home.font.strike': prop('strike', true, 'barre'),
  'home.font.sub': prop('vertAlign', 'subscript', 'indice'),
  'home.font.sup': prop('vertAlign', 'superscript', 'exposant'),
  'home.font.fontname#': run((w, _p, cmd) => need(w.props?.font === cmd.value, `police ${cmd.value} absente (${w.props?.font})`)),
  'home.font.fontsize#': run((w, _p, cmd) => need(w.props?.size === Number(cmd.value), `taille ${cmd.value} absente (${w.props?.size})`)),
  'home.font.fontcolor#color:Rouge': run((w, _p, cmd) => need(w.props?.color?.rgb === cmd.value.replace('#', '').toUpperCase(), `couleur ${cmd.value} absente (${JSON.stringify(w.props?.color)})`)),
  'home.font.highlight#color:Rouge': run((w) => need(Boolean(w.props?.highlight) && w.props.highlight !== 'none', 'surlignage absent')),
  'home.font.case#upper': run((w) => need(w.text.startsWith('BONJOUR'), `casse MAJUSCULES non appliquee (${w.text.slice(0, 10)})`)),
  'home.font.case#lower': run((w) => need(w.text.startsWith('bonjour'), `casse minuscules non appliquee (${w.text.slice(0, 10)})`)),
  'home.paragraph.align-center': alignment('center'),
  'home.paragraph.align-right': alignment('right'),
  'home.paragraph.align-justify': alignment('justify'),
  'home.paragraph.bullets': run((_w, p) => need(Boolean(p.props?.numbering), 'puces absentes du paragraphe')),
  'home.paragraph.numbering': run((_w, p) => need(Boolean(p.props?.numbering), 'numerotation absente du paragraphe')),
  'home.paragraph.indent': run((_w, p) => need((p.props?.indentLeft ?? 0) > 0, 'retrait gauche non augmente')),
  'home.styles.styles#Heading1': run((_w, p) => need(p.styleId === 'Heading1', `style Titre 1 absent (${p.styleId})`)),
};
