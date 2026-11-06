// Attentes de Presentation : la forme de test est le rectangle « Rectangle » (texte « Forme avec texte ») de la diapositive 2.
const rect = (snap) => snap?.slides?.flatMap((s) => s.shapes ?? []).find((s) => s.name?.startsWith('Rectangle'));
const runs = (snap) => rect(snap)?.text?.paragraphs?.flatMap((p) => p.runs ?? []) ?? [];
const paras = (snap) => rect(snap)?.text?.paragraphs ?? [];
const need = (cond, msg) => (cond ? null : msg);
const onRuns = (check) => (_a, after, cmd) => (runs(after).length ? check(runs(after), cmd) : 'texte de la forme introuvable');
const onParas = (check) => (_a, after) => (paras(after).length ? check(paras(after)) : 'texte de la forme introuvable');

export const POWERPOINT_EXPECT = {
  'home.font.bold': onRuns((r) => need(r.every((x) => x.props?.bold === true), 'gras absent des segments')),
  'home.font.italic': onRuns((r) => need(r.every((x) => x.props?.italic === true), 'italique absent')),
  'home.font.underline': onRuns((r) => need(r.every((x) => x.props?.underline && x.props.underline !== 'none'), 'souligne absent')),
  'home.font.strike': onRuns((r) => need(r.every((x) => x.props?.strike && x.props.strike !== 'noStrike'), 'barre absent')),
  'home.font.size#': onRuns((r, cmd) => need(r.every((x) => x.props?.size === Number(cmd.value)), `taille ${cmd.value} absente (${r[0]?.props?.size})`)),
  'home.font.font#': onRuns((r, cmd) => need(r.every((x) => x.props?.font === cmd.value), `police ${cmd.value} absente (${r[0]?.props?.font})`)),
  'home.font.color#color:Rouge': onRuns((r) => need(r.every((x) => Boolean(x.props?.color)), 'couleur de police absente')),
  'home.paragraph.alignCenter': onParas((p) => need(p.every((x) => x.props?.align === 'ctr'), `centrage absent (${p[0]?.props?.align})`)),
  'home.paragraph.alignRight': onParas((p) => need(p.every((x) => x.props?.align === 'r'), 'alignement droite absent')),
  'home.paragraph.alignLeft': onParas((p) => need(p.every((x) => x.props?.align === 'l'), 'alignement gauche absent')),
  'home.paragraph.justify': onParas((p) => need(p.every((x) => x.props?.align === 'just'), 'justification absente')),
  'home.paragraph.bullets': onParas((p) => need(p.every((x) => Boolean(x.props?.bullet)), 'puces absentes')),
  'home.drawing.fill#color:Rouge': (_a, after) => need(Boolean(rect(after)?.fill) && rect(after).fill.type === 'solid', 'remplissage uni absent de la forme'),
};
