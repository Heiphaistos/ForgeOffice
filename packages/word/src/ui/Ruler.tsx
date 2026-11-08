// Regle horizontale : marges, retraits (premiere ligne, suspendu, gauche, droit) deplacables, taquets de tabulation.
import { useRef, type PointerEvent as RPointerEvent } from 'react';
import type { ParagraphProps, Section, TabStop } from '@forgeoffice/docx';
import { T } from '../strings.ts';
import { px } from './PageView.tsx';

export interface RulerProps {
  section: Section;
  para: ParagraphProps;
  zoom: number;
  onChange: (patch: Partial<ParagraphProps>) => void;
  /** Clic droit sur la regle (menu Mise en page, Tabulations...). */
  onContext?: (e: { clientX: number; clientY: number; preventDefault: () => void }) => void;
}

type Handle = 'first' | 'hanging' | 'left' | 'right';

const CM = 72 / 2.54;
const snap = (pt: number): number => Math.round(pt / (CM / 4)) * (CM / 4);

export function Ruler({ section, para, zoom, onChange, onContext }: RulerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const z = zoom / 100;
  const pageW = px(section.pageWidth);
  const left = section.margins.left;
  const textW = section.pageWidth - section.margins.left - section.margins.right;
  const indL = para.indentLeft ?? 0;
  const first = para.indentFirstLine ?? 0;
  const indR = para.indentRight ?? 0;
  const tabs = (para.tabs ?? []).filter((t) => t.align !== 'clear');
  const toPt = (clientX: number): number => {
    const r = ref.current?.getBoundingClientRect();
    return r ? (clientX - r.left) / z * 0.75 - left : 0;
  };

  const drag = (h: Handle) => (e: RPointerEvent<HTMLElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent): void => {
      const at = snap(toPt(ev.clientX));
      if (h === 'first') onChange({ indentFirstLine: at - indL || undefined });
      else if (h === 'hanging') onChange({ indentLeft: at || undefined, indentFirstLine: indL + first - at || undefined });
      else if (h === 'left') onChange({ indentLeft: at || undefined });
      else onChange({ indentRight: textW - at || undefined });
    };
    const up = (): void => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  };

  const addTab = (e: RPointerEvent<HTMLDivElement>): void => {
    const at = snap(toPt(e.clientX));
    if (at <= 0 || at >= textW) return;
    const next: TabStop[] = [...tabs.filter((t) => Math.abs(t.position - at) > 2), { position: at, align: 'left' as const }].sort((a, b) => a.position - b.position);
    onChange({ tabs: next });
  };

  const ticks = [];
  for (let q = -Math.floor(left / (CM / 4)); q * (CM / 4) < section.pageWidth - left; q++) {
    const x = px(left + q * (CM / 4));
    if (x < 0) continue;
    const cm = q / 4;
    ticks.push(q % 4 === 0
      ? <span key={q} className="fo-ruler__num" style={{ left: x }}>{q === 0 ? '' : Math.abs(cm)}</span>
      : <span key={q} className={`fo-ruler__tick${q % 2 === 0 ? ' is-half' : ''}`} style={{ left: x }} />);
  }
  const at = (pt: number): number => px(left + pt);
  return (
    <div className="fo-ruler" role="toolbar" aria-label={T.cmd.ruler} style={{ width: pageW * z }} onContextMenu={(e) => onContext?.(e)}>
      <div ref={ref} className="fo-ruler__track" style={{ width: pageW, zoom: z }} onPointerDown={addTab}>
        <div className="fo-ruler__margin" style={{ left: 0, width: px(left) }} />
        <div className="fo-ruler__margin" style={{ right: 0, width: px(section.margins.right) }} />
        {ticks}
        {tabs.map((t) => (
          <span key={t.position} className={`fo-ruler__tab is-${t.align}`} style={{ left: at(t.position) }} title={T.cmd.options}
            onPointerDown={(e) => e.stopPropagation()} onDoubleClick={() => onChange({ tabs: tabs.filter((x) => x !== t) })} />
        ))}
        <span className="fo-ruler__h fo-ruler__h--first" style={{ left: at(indL + first) }} title={T.dialogs.firstLine} onPointerDown={drag('first')} />
        <span className="fo-ruler__h fo-ruler__h--hanging" style={{ left: at(indL) }} title={T.dialogs.left} onPointerDown={drag('hanging')} />
        <span className="fo-ruler__h fo-ruler__h--left" style={{ left: at(indL) }} title={T.cmd.indentLeft} onPointerDown={drag('left')} />
        <span className="fo-ruler__h fo-ruler__h--right" style={{ left: at(textW - indR) }} title={T.cmd.indentRight} onPointerDown={drag('right')} />
      </div>
    </div>
  );
}
