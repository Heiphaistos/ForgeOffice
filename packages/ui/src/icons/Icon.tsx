import type { CSSProperties } from 'react';
import { ICON_DATA, type IconName } from './generated.ts';

export interface IconProps {
  name: IconName;
  /** Taille affichee en pixels (16, 20, 24, 32...). Le dessin 20 ou 24 le plus proche est choisi. */
  size?: number;
  filled?: boolean;
  /** Libelle accessible ; sans libelle l'icone est decorative (aria-hidden). */
  label?: string;
  className?: string;
  style?: CSSProperties;
  color?: string;
}

/** Icone Fluent 2 (SVG en ligne, couleur = currentColor). */
export function Icon({ name, size = 20, filled = false, label, className, style, color }: IconProps) {
  const data = ICON_DATA[name];
  const want24 = size > 22;
  // ordre de preference : taille la plus proche dans le style demande, puis l'autre style
  const order = want24 ? (filled ? [3, 1, 2, 0] : [2, 0, 3, 1]) : filled ? [1, 3, 0, 2] : [0, 2, 1, 3];
  const index = order.find((i) => (data[i] ?? '') !== '') ?? 0;
  const box = index >= 2 ? 24 : 20;
  const paths = (data[index] ?? '').split('|');
  return (
    <svg
      className={className ? `fo-icon ${className}` : 'fo-icon'}
      width={size}
      height={size}
      viewBox={`0 0 ${box} ${box}`}
      fill={color ?? 'currentColor'}
      style={{ flexShrink: 0, display: 'block', ...style }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

export function isIconName(value: string): value is IconName {
  return Object.hasOwn(ICON_DATA, value);
}
