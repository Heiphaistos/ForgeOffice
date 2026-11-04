// Mode Page / Creation des formulaires et etats : sections, controles deplacables et redimensionnables.
import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { S } from '../strings.ts';
import type { Controle, Maquette } from '../types.ts';

export interface CanvasSel {
  section: string;
  index: number;
}

interface Props {
  maquette: Maquette;
  sections: readonly string[];
  selected: CanvasSel | null;
  onSelect: (s: CanvasSel | null) => void;
  onChange: (m: Maquette) => void;
  /** Formulaire : l'etiquette d'un controle lie s'affiche a sa gauche. */
  labels: boolean;
  width: number;
}

const GRID = 4;
const LABEL_W = 144;

export function sectionHeight(m: Maquette, key: string): number {
  const s = m.sections[key];
  const bottom = Math.max(0, ...(s?.controles ?? []).map((c) => c.y + c.hauteur));
  return Math.max(s?.hauteur ?? 0, bottom + 12, key === 'detail' ? 60 : 28);
}

export function controlText(c: Controle): string {
  return c.texte ?? c.source ?? c.champ ?? c.nom ?? '';
}

export function updateControl(m: Maquette, sel: CanvasSel, patch: Partial<Controle> | null): Maquette {
  const s = m.sections[sel.section];
  if (!s) return m;
  const controles = patch === null ? s.controles.filter((_, i) => i !== sel.index) : s.controles.map((c, i) => (i === sel.index ? { ...c, ...patch } : c));
  return { ...m, sections: { ...m.sections, [sel.section]: { ...s, controles } } };
}

export function DesignCanvas({ maquette, sections, selected, onSelect, onChange, labels, width }: Props) {
  const drag = useRef<{ sel: CanvasSel; mode: 'move' | 'size'; px: number; py: number; c: Controle } | null>(null);

  const down = (e: ReactPointerEvent, sel: CanvasSel, c: Controle, mode: 'move' | 'size'): void => {
    e.stopPropagation();
    onSelect(sel);
    drag.current = { sel, mode, px: e.clientX, py: e.clientY, c };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const move = (e: ReactPointerEvent): void => {
    const d = drag.current;
    if (!d) return;
    const dx = Math.round((e.clientX - d.px) / GRID) * GRID;
    const dy = Math.round((e.clientY - d.py) / GRID) * GRID;
    const minX = labels && d.c.etiquette ? LABEL_W + 8 : 0;
    onChange(updateControl(maquette, d.sel, d.mode === 'move'
      ? { x: Math.max(minX, d.c.x + dx), y: Math.max(0, d.c.y + dy) }
      : { largeur: Math.max(24, d.c.largeur + dx), hauteur: Math.max(16, d.c.hauteur + dy) }));
  };
  const up = (): void => {
    drag.current = null;
  };

  return (
    <div className="acc-canvas" style={{ width }} onPointerDown={() => onSelect(null)}>
      {sections.map((key) => {
        const s = maquette.sections[key];
        return (
          <div key={key} className="acc-canvas__section">
            <div className="acc-canvas__bar">{S.forms.sections[key as keyof typeof S.forms.sections] ?? key}</div>
            <div className="acc-canvas__area" style={{ height: sectionHeight(maquette, key) }}>
              {(s?.controles ?? []).map((c, i) => {
                const on = selected?.section === key && selected.index === i;
                const sel = { section: key, index: i };
                return (
                  <div key={i}>
                    {labels && c.etiquette && c.type !== 'etiquette' && (
                      <div className="acc-ctl is-label" style={{ left: c.x - LABEL_W - 8, top: c.y, width: LABEL_W, height: Math.min(24, c.hauteur) }} onPointerDown={(e) => down(e, sel, c, 'move')} onPointerMove={move} onPointerUp={up}>
                        {c.etiquette}
                      </div>
                    )}
                    <div
                      className={`acc-ctl is-${c.type}${on ? ' is-selected' : ''}${c.style === 'titre' ? ' is-title' : ''}`}
                      style={{ left: c.x, top: c.y, width: c.largeur, height: c.hauteur }}
                      onPointerDown={(e) => down(e, sel, c, 'move')}
                      onPointerMove={move}
                      onPointerUp={up}
                    >
                      <span>{controlText(c)}</span>
                      {on && <span className="acc-ctl__grip" onPointerDown={(e) => down(e, sel, c, 'size')} onPointerMove={move} onPointerUp={up} />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
