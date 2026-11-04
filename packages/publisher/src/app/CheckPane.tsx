// Volet « Verificateur de conception » : texte debordant, images en basse resolution, objets hors page, polices absentes.
import { useMemo, useState } from 'react';
import { Icon, TaskPane } from '@forgeoffice/ui';
import { checkDesign, type Issue } from '../check.ts';
import { shapeKey } from '../model.ts';
import { S } from '../strings.ts';
import type { Editor } from './editor.ts';
import { fontAvailable } from './measure.ts';

export function useIssues(ed: Editor): Issue[] {
  return useMemo(() => {
    const chained = new Set(ed.pub.chains.flatMap((c) => c.boxes.slice(1).map((b) => shapeKey(b.page, b.shape))));
    return checkDesign(ed.deck, { overflow: ed.overflow, fontAvailable, bleed: ed.pub.bleed, chained });
  }, [ed.deck, ed.overflow, ed.pub.bleed, ed.pub.chains]);
}

export function CheckPane({ ed, issues, onClose }: { ed: Editor; issues: Issue[]; onClose: () => void }) {
  const [width, setWidth] = useState(300);
  const detail = (i: Issue): string | undefined => (i.kind === 'lowres' && i.detail ? S.checker.detail.lowres(i.detail) : i.kind === 'font' && i.detail ? S.checker.detail.font(i.detail) : undefined);
  return (
    <TaskPane title={S.checker.pane} onClose={onClose} width={width} onWidthChange={setWidth}>
      <div className="pub-check">
        <p className="pub-check__count">{issues.length ? S.checker.count(issues.length) : S.checker.ok}</p>
        <ul className="pub-check__list">
          {issues.map((i, n) => (
            <li key={n}>
              <button
                type="button"
                className="pub-check__item"
                title={S.checker.goto}
                onClick={() => {
                  ed.goto(i.pageIndex);
                  ed.setSelection({ ids: [i.shapeId] });
                }}
              >
                <Icon name={i.kind === 'overflow' ? 'textbox_more' : i.kind === 'lowres' ? 'image' : i.kind === 'font' ? 'text_font' : i.kind === 'emptyBox' ? 'textbox' : 'warning'} size={16} />
                <span>
                  <strong>{S.checker.issues[i.kind]}</strong>
                  <small>{S.pages.page(i.pageIndex + 1)} · {i.shapeName}{detail(i) ? ` · ${detail(i)}` : ''}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </TaskPane>
  );
}
