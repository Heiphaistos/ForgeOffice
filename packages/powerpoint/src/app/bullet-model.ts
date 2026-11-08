// Modele pur de la boite « Puces et numéros » : type, symbole, numérotation, couleur, taille, « commencer par ».
import type { Bullet, ParagraphProps } from '@forgeoffice/pptx';

export type BulletKind = 'none' | 'char' | 'auto' | 'image';

export interface BulletForm {
  kind: BulletKind;
  char: string;
  /** Police du symbole (Arial, Wingdings...). */
  font: string;
  scheme: string;
  startAt: number;
  /** Couleur #RRGGBB, ou null pour suivre le texte. */
  color: string | null;
  /** Taille en % du texte. */
  size: number;
  /** Media de la puce image (kind = image). */
  mediaId?: string;
}

export const SYMBOLS: ReadonlyArray<{ char: string; font: string }> = [
  { char: '•', font: 'Arial' }, { char: 'o', font: 'Courier New' }, { char: '§', font: 'Wingdings' }, { char: 'v', font: 'Wingdings' },
  { char: 'Ø', font: 'Wingdings' }, { char: 'ü', font: 'Wingdings' }, { char: '–', font: 'Arial' }, { char: '►', font: 'Arial' },
  { char: '★', font: 'Segoe UI Symbol' }, { char: '✓', font: 'Segoe UI Symbol' }, { char: '■', font: 'Arial' }, { char: '◆', font: 'Segoe UI Symbol' },
];

export const NUMBER_SCHEMES = ['arabicPeriod', 'arabicParenR', 'romanUcPeriod', 'alphaUcPeriod', 'alphaLcParenR', 'alphaLcPeriod', 'romanLcPeriod'] as const;

export function bulletForm(p: ParagraphProps, colorHex: (c: NonNullable<ParagraphProps['bulletColor']>) => string | null): BulletForm {
  const b = p.bullet;
  const size = p.bulletSize?.type === 'pct' ? p.bulletSize.value : 100;
  const color = p.bulletColor && p.bulletColor !== 'text' ? colorHex(p.bulletColor) : null;
  return {
    kind: b?.type === 'char' ? 'char' : b?.type === 'auto' ? 'auto' : b?.type === 'image' ? 'image' : 'none',
    mediaId: b?.type === 'image' ? b.mediaId : undefined,
    char: b?.type === 'char' ? b.char : '•',
    font: p.bulletFont && p.bulletFont !== 'text' ? p.bulletFont : 'Arial',
    scheme: b?.type === 'auto' ? b.scheme : 'arabicPeriod',
    startAt: b?.type === 'auto' ? (b.startAt ?? 1) : 1,
    color,
    size,
  };
}

function toBullet(f: BulletForm): Bullet {
  if (f.kind === 'char') return { type: 'char', char: f.char || '•' };
  if (f.kind === 'image' && f.mediaId) return { type: 'image', mediaId: f.mediaId };
  if (f.kind === 'auto') return f.startAt > 1 ? { type: 'auto', scheme: f.scheme, startAt: f.startAt } : { type: 'auto', scheme: f.scheme };
  return { type: 'none' };
}

/** Transformation des proprietes d'un paragraphe : le retrait suspendu par defaut est pose quand une puce apparait. */
export function applyBulletForm(props: ParagraphProps, f: BulletForm, toColor: (hex: string) => NonNullable<ParagraphProps['bulletColor']>): ParagraphProps {
  const out: ParagraphProps = { ...props, bullet: toBullet(f) };
  if (f.kind === 'none' || (f.kind === 'image' && !f.mediaId)) return f.kind === 'image' ? props : out;
  if (f.kind === 'char') out.bulletFont = f.font;
  else delete out.bulletFont;
  if (f.color) out.bulletColor = toColor(f.color);
  else delete out.bulletColor;
  if (f.size !== 100) out.bulletSize = { type: 'pct', value: f.size };
  else delete out.bulletSize;
  if (out.marginLeft === undefined) {
    out.marginLeft = 22.5 + (props.level ?? 0) * 22.5;
    out.indent = -22.5;
  }
  return out;
}
