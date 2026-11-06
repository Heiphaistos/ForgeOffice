// Briques du ruban : apercus de formes, de dispositions, de themes ; contexte partage des onglets.
import { memo } from 'react';
import type { Deck, Layout } from '@forgeoffice/pptx';
import { deckPageBackground, deckPageContext } from '../../canvas/context.ts';
import { buildGeometry, LINE_PRESETS } from '../../canvas/geometry/index.ts';
import { PageView } from '../../canvas/PageView.tsx';
import type { DeckFormat } from '@forgeoffice/pptx';
import type { DialogId, Editor, SidePane } from '../editor.ts';

/** Actions de l'application utilisees par les onglets. */
export interface AppActions {
  save: () => void;
  saveAs: (format?: DeckFormat) => void;
  backstage: (page: string) => void;
  startShow: (fromCurrent: boolean, presenter?: boolean, mode?: 'twoWindows' | 'rehearse') => void;
  cut: () => void;
  copy: () => void;
  paste: (mode?: 'keep' | 'text' | 'picture') => void;
  copyFormat: () => void;
  dialog: (id: Exclude<DialogId, null>) => void;
  pane: (pane: SidePane) => void;
  previewTransition: () => void;
  previewAnimations: () => void;
  /** Active un outil d'insertion de forme. */
  drawShape: (preset: string) => void;
  painterActive: boolean;
}

export interface TabContext {
  ed: Editor;
  app: AppActions;
}

/** Vignette d'une forme predefinie (galerie Formes). */
export const ShapeIcon = memo(function ShapeIcon({ preset, size = 20 }: { preset: string; size?: number }) {
  const line = LINE_PRESETS.has(preset);
  const w = size;
  const h = line ? size * 0.7 : size * 0.8;
  const geo = buildGeometry({ type: 'preset', preset }, w - 2, h - 2);
  return (
    <svg width={size} height={size} viewBox={`-1 ${-(size - h) / 2 - 1} ${size} ${size}`} aria-hidden>
      {geo.paths.map((p, i) => (
        <path key={i} d={p.d} fill={p.fill === 'none' || line ? 'none' : 'currentColor'} fillOpacity={0.12} stroke={p.stroke ? 'currentColor' : 'none'} strokeWidth={1} markerEnd={undefined} />
      ))}
    </svg>
  );
});

/** Apercu d'une disposition (galerie Nouvelle diapositive / Disposition). */
export const LayoutThumb = memo(function LayoutThumb({ deck, layout, width = 112 }: { deck: Deck; layout: Layout; width?: number }) {
  const master = deck.masters.find((m) => m.layouts.includes(layout));
  const ctx = deckPageContext(deck, layout);
  const scale = width / deck.size.width;
  const masterShapes = master && layout.showMasterShapes !== false ? master.shapes.filter((s) => !s.placeholder) : [];
  return (
    <div style={{ width, height: deck.size.height * scale, overflow: 'hidden', outline: '1px solid var(--fo-border)', background: '#fff' }}>
      <PageView
        width={deck.size.width}
        height={deck.size.height}
        background={deckPageBackground(deck, layout)}
        ctx={ctx}
        shapes={layout.shapes.filter((s) => !s.placeholder || !['dt', 'ftr', 'sldNum'].includes(s.placeholder.type))}
        underlay={master ? [{ shapes: masterShapes, ctx: deckPageContext(deck, master) }] : []}
        uid={`lt${layout.id}`}
        scale={scale}
      />
    </div>
  );
});

/** Apercu d'une presentation complete (premiere diapositive), pour les themes et variantes. */
export const DeckThumb = memo(function DeckThumb({ deck, width = 96, title }: { deck: Deck; width?: number; title?: string }) {
  const master = deck.masters[0];
  const layout = master?.layouts.find((l) => l.type === 'title') ?? master?.layouts[0];
  if (!master || !layout) return null;
  const scale = width / deck.size.width;
  const ctx = deckPageContext(deck, layout);
  return (
    <div style={{ width, height: deck.size.height * scale, overflow: 'hidden', outline: '1px solid var(--fo-border)' }}>
      <PageView
        width={deck.size.width}
        height={deck.size.height}
        background={deckPageBackground(deck, layout)}
        ctx={ctx}
        shapes={layout.shapes
          .filter((s) => s.placeholder?.type === 'ctrTitle' || s.placeholder?.type === 'title')
          .map((s) => (title && s.kind === 'shape' && s.text ? { ...s, text: { ...s.text, paragraphs: [{ props: s.text.paragraphs[0]?.props ?? {}, runs: [{ type: 'text' as const, text: title, props: s.text.paragraphs[0]?.runs[0]?.props ?? {} }] }] } } : s))}
        underlay={[{ shapes: master.shapes.filter((s) => !s.placeholder), ctx: deckPageContext(deck, master) }]}
        uid={`dt${width}`}
        scale={scale}
      />
    </div>
  );
});

/** Pastille de couleur (galeries de couleurs). */
export function Swatches({ colors, size = 10 }: { colors: readonly string[]; size?: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: 1 }}>
      {colors.map((c, i) => (
        <span key={i} style={{ width: size, height: size * 1.6, background: c, display: 'inline-block' }} />
      ))}
    </span>
  );
}
