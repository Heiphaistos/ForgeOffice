// Attentes du Tableur : la plage de test est A1:D5 ; la cellule de controle est A2 (« Pommes », sans style).
const cell = (snap, r, c) => snap?.sheets?.[snap.activeSheet ?? 0]?.cells?.find((x) => x[0] === r && x[1] === c);
const style = (snap) => cell(snap, 1, 0)?.[6] ?? null;
const need = (cond, msg) => (cond ? null : msg);
const st = (check) => (_a, after, cmd) => check(style(after) ?? {}, after, cmd);

export const EXCEL_EXPECT = {
  // Comme Excel : la bascule se decide sur la cellule active (A1, en-tete deja en gras) puis s'applique a toute la plage.
  'home.font.bold': (before, after) => {
    const wasBold = cell(before, 0, 0)?.[6]?.font?.bold === true;
    const isBold = style(after)?.font?.bold === true;
    return need(isBold === !wasBold, `gras : attendu ${!wasBold}, obtenu ${isBold}`);
  },
  'home.font.italic': st((s) => need(s.font?.italic === true, 'italique absent')),
  'home.font.underline': st((s) => need(Boolean(s.font?.underline), 'souligne absent')),
  'home.font.fontname#': st((s, _a, cmd) => need(s.font?.name === cmd.value, `police ${cmd.value} absente (${s.font?.name})`)),
  'home.font.fontsize#': st((s, _a, cmd) => need(s.font?.size === Number(cmd.value), `taille ${cmd.value} absente (${s.font?.size})`)),
  'home.font.fontcolor#color:Rouge': st((s) => need(Boolean(s.font?.color), 'couleur de police absente')),
  'home.font.fill#color:Rouge': st((s) => need(s.fill?.fg || s.fill?.bg || s.fill?.type === 'pattern', 'remplissage absent')),
  'home.align.center': st((s) => need(s.align?.horizontal === 'center', `alignement centre absent (${s.align?.horizontal})`)),
  'home.align.right': st((s) => need(s.align?.horizontal === 'right', 'alignement droite absent')),
  'home.align.left': st((s) => need(s.align?.horizontal === 'left', 'alignement gauche absent')),
  'home.align.wrap': st((s) => need(s.align?.wrapText === true, 'renvoi a la ligne absent')),
  'home.align.merge': (_a, after) => need((after.sheets?.[0]?.merges?.length ?? 0) > 1, 'fusion absente'),
  'home.number.numfmt#percent': st((s) => need(/%/.test(s.fmt ?? ''), `format pourcentage absent (${s.fmt})`)),
  'home.number.numfmt#currency': st((s) => need(/[€$£]/.test(s.fmt ?? ''), `format monetaire absent (${s.fmt})`)),
  'home.number.numfmt#shortDate': st((s) => need(/[dmy]/i.test(s.fmt ?? ''), `format date absent (${s.fmt})`)),
};
