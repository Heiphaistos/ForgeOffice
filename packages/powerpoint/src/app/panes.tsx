// Volets lateraux : Format, Animation, Commentaires, Concepteur, Selection, Accessibilite.
import { useMemo, useState } from 'react';
import { Button, Checkbox, ColorPalette, Icon, NumberField, TaskPane, TextField, useContextMenu, type MenuItem } from '@forgeoffice/ui';
import { animationName, slideTitle, type Animation, type Shape, type Slide } from '@forgeoffice/pptx';
import { PageView } from '../canvas/PageView.tsx';
import { locate, reorder } from '../canvas/ops.ts';
import { designIdeas } from './designer.ts';
import { editSlide } from './deck-ops.ts';
import type { Editor, SidePane } from './editor.ts';
import { applyBody, colorFromHex, currentBody, hexOf, setFill, setLine } from './format.ts';
import { editAnimations } from './ribbon/motion.tsx';
import { slidePageProps } from './slide-render.ts';
import { themeSwatches } from './themes.ts';
import { S } from '../strings.ts';
import { S3 } from './strings-text.ts';
import { SmartArtPane } from './smartart-pane.tsx';
import { ChartFormatSection } from './format-pane/ChartFormatSection.tsx';
import { EffectsSection } from './format-pane/EffectsSection.tsx';
import { FillSection } from './format-pane/FillSection.tsx';
import { LineSection } from './format-pane/LineSection.tsx';
import { Section } from './format-pane/PaneSection.tsx';
import { TextOptionsSection } from './format-pane/TextOptionsSection.tsx';
import './panes.css';

const cm = (pt: number): number => Math.round((pt / 72) * 254) / 100;
const pt = (v: number): number => (v / 2.54) * 72;

function FormatPane({ ed }: { ed: Editor }) {
  const raw = ed.selectedShapes[0];
  const shape = raw ? ed.ctx.resolve(raw) : undefined;
  const swatches = themeSwatches(ed.ctx.theme.colors);
  const body = currentBody(ed);
  if (!raw || !shape) {
    return (
      <Section title={S.panes.background}>
        <p className="pp-muted">{S.panes.backgroundHint}</p>
        <ColorPalette value={null} emptyMode="none" themeColors={swatches} onPick={(c) => ed.slide && ed.commit(editSlide(ed.deck, ed.slide.id, (s) => { s.background = c ? { type: 'fill', fill: { type: 'solid', color: colorFromHex(ed, c) } } : undefined; if (!c) delete s.background; }))} />
      </Section>
    );
  }
  const x = shape.xfrm;
  const setX = (key: 'x' | 'y' | 'width' | 'height' | 'rotation', v: number): void =>
    ed.editSelected((s) => {
      const base = s.xfrm ?? ed.ctx.resolve(s).xfrm;
      if (base) s.xfrm = { ...base, [key]: key === 'rotation' ? v : pt(v) };
    }, `xfrm-${key}`);
  const fill = shape.kind === 'shape' ? shape.fill : undefined;
  const line = 'line' in shape ? shape.line : undefined;
  return (
    <>
      {shape.kind === 'chart' && <ChartFormatSection ed={ed} chart={shape.chart} />}
      {(shape.kind === 'shape' || shape.kind === 'group' || shape.kind === 'table') && <FillSection ed={ed} fill={fill} />}
      {'line' in shape && <LineSection ed={ed} line={line} />}
      {(shape.kind === 'shape' || shape.kind === 'picture' || shape.kind === 'connector' || shape.kind === 'group') && <EffectsSection ed={ed} effects={shape.effects} />}
      {(shape.kind === 'shape' || shape.kind === 'table') && <TextOptionsSection ed={ed} />}
      <Section title={S.panes.sizePosition}>
        <Button onClick={() => ed.setUi({ dialog: 'sizePosition' })}>{S3.geom.menu}</Button>
        <div className="pp-form">
          <label>{S.context.height}</label>
          <NumberField value={x ? cm(x.height) : 0} min={0} max={142} step={0.1} unit="cm" width={100} onChange={(v) => setX('height', v)} label={S.context.height} />
          <label>{S.context.width}</label>
          <NumberField value={x ? cm(x.width) : 0} min={0} max={142} step={0.1} unit="cm" width={100} onChange={(v) => setX('width', v)} label={S.context.width} />
          <label>{S.panes.rotation}</label>
          <NumberField value={x?.rotation ?? 0} min={-360} max={360} step={1} unit="°" width={100} onChange={(v) => setX('rotation', ((v % 360) + 360) % 360)} label={S.panes.rotation} />
          <label>{S.panes.horizontal}</label>
          <NumberField value={x ? cm(x.x) : 0} min={-142} max={142} step={0.1} unit="cm" width={100} onChange={(v) => setX('x', v)} label={S.panes.horizontal} />
          <label>{S.panes.vertical}</label>
          <NumberField value={x ? cm(x.y) : 0} min={-142} max={142} step={0.1} unit="cm" width={100} onChange={(v) => setX('y', v)} label={S.panes.vertical} />
        </div>
      </Section>
      {shape.kind === 'shape' && (
        <Section title={S.panes.textBox}>
          <div className="pp-pane__radios">
            <label><input type="radio" checked={!body.autofit || body.autofit.type === 'none'} onChange={() => applyBody(ed, { autofit: { type: 'none' } })} /> {S.panes.noAutofit}</label>
            <label><input type="radio" checked={body.autofit?.type === 'normal'} onChange={() => applyBody(ed, { autofit: { type: 'normal' } })} /> {S.panes.shrinkOnOverflow}</label>
            <label><input type="radio" checked={body.autofit?.type === 'shape'} onChange={() => applyBody(ed, { autofit: { type: 'shape' } })} /> {S.panes.resizeShape}</label>
          </div>
          <Checkbox checked={body.wrap !== false} label={S.panes.wrap} onChange={(v) => applyBody(ed, { wrap: v })} />
          <div className="pp-form">
            {(['left', 'right', 'top', 'bottom'] as const).map((side) => (
              <span key={side} style={{ display: 'contents' }}>
                <label>{S.dialogs.cropSides[side]}</label>
                <NumberField value={cm(body.insets?.[side] ?? (side === 'left' || side === 'right' ? 7.2 : 3.6))} min={0} max={20} step={0.05} unit="cm" width={100} onChange={(v) => applyBody(ed, { insets: { ...(body.insets ?? {}), [side]: pt(v) } })} label={side} />
              </span>
            ))}
          </div>
        </Section>
      )}
      <Section title={S.context.altText} open={false}>
        <AltText ed={ed} shape={raw} />
      </Section>
    </>
  );
}

function AltText({ ed, shape }: { ed: Editor; shape: Shape }) {
  const [value, setValue] = useState(shape.description ?? '');
  return (
    <div className="pp-stack">
      <textarea className="pp-textarea" rows={3} value={value} placeholder={S.panes.altPlaceholder} onChange={(e) => setValue(e.target.value)} aria-label={S.context.altText} />
      <div className="pp-form__row">
        <Button appearance="primary" onClick={() => ed.editShapes((shapes) => { const f = locate(shapes, shape.id); if (f) f.shape.description = value.trim() || undefined; }, 'alt')}>{S.common.apply}</Button>
        <Checkbox checked={shape.title === 'decorative'} label={S.panes.decorative} onChange={(v) => ed.editShapes((shapes) => { const f = locate(shapes, shape.id); if (f) f.shape.title = v ? 'decorative' : undefined; }, 'alt')} />
      </div>
    </div>
  );
}

const CLASS_COLOR: Readonly<Record<string, string>> = { entr: '#3A9A3A', emph: '#D9A400', exit: '#D13438', path: '#6B6B6B' };

function AnimationPane({ ed, onPlay }: { ed: Editor; onPlay: () => void }) {
  const slide = ed.slide;
  const list = slide?.animations ?? [];
  let click = 0;
  const context = useContextMenu();
  const patchAt = (i: number, patch: Partial<Animation>): void => {
    if (slide) ed.commit(editSlide(ed.deck, slide.id, (s) => { const a = s.animations[i]; if (a) s.animations[i] = { ...a, ...patch }; delete s.timing; }), 'animation');
  };
  const itemMenu = (i: number, a: Animation): MenuItem[] => [
    ...(['onClick', 'withPrevious', 'afterPrevious'] as const).map((t) => ({ id: t, label: S.animations[t], checked: a.trigger === t, onClick: () => patchAt(i, { trigger: t }) })),
    { id: 's', kind: 'separator' },
    { id: 'opts', label: S3.effect.itemMenu, onClick: () => { ed.setSelection({ ids: [a.shapeId] }); ed.setUi({ dialog: 'effect' }); } },
    { id: 'del', label: S.common.delete, icon: 'delete', onClick: () => slide && ed.commit(editSlide(ed.deck, slide.id, (s) => { s.animations.splice(i, 1); delete s.timing; }), 'animation') },
  ];
  return (
    <div className="pp-stack">
      {context.menu}
      <div className="pp-form__row">
        <Button icon="play" onClick={onPlay} disabled={!list.length}>{S.panes.playAll}</Button>
      </div>
      <ol className="pp-anims">
        {list.map((a, i) => {
          if (a.trigger === 'onClick') click++;
          const shape = slide?.shapes.find((s) => s.id === a.shapeId);
          const selected = ed.selection.ids.includes(a.shapeId);
          return (
            <li key={i} className={selected ? 'is-selected' : ''} data-testid="anim-item" onClick={() => ed.setSelection({ ids: [a.shapeId] })} onContextMenu={(e) => context.open(e, itemMenu(i, a))}>
              <span className="pp-anims__n">{a.trigger === 'onClick' ? click : ''}</span>
              <Icon name={a.trigger === 'afterPrevious' ? 'clock' : a.trigger === 'withPrevious' ? 'arrow_sync' : 'arrow_right'} size={12} />
              <span className="pp-anims__bar" style={{ background: CLASS_COLOR[a.class] }} />
              <span className="pp-anims__name">{shape?.name ?? `#${a.shapeId}`}</span>
              <span className="pp-muted">{S.animations.names[`${a.class}:${a.presetId}` as keyof typeof S.animations.names] ?? animationName(a.class, a.presetId)}</span>
              <button
                type="button"
                className="pp-icon-btn"
                aria-label={S.common.delete}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!slide) return;
                  ed.commit(editSlide(ed.deck, slide.id, (s) => { s.animations.splice(i, 1); delete s.timing; }), 'animation');
                }}
              >
                <Icon name="delete" size={14} />
              </button>
            </li>
          );
        })}
      </ol>
      {!list.length && <p className="pp-muted">{S.panes.noAnimations}</p>}
      {list.length > 0 && (
        <div className="pp-form__row">
          <Button icon="arrow_up" onClick={() => editAnimations(ed, (l, t) => moveAll(l, t, -1), 'animOrder')}>{S.animations.earlier}</Button>
          <Button icon="arrow_down" onClick={() => editAnimations(ed, (l, t) => moveAll(l, t, 1), 'animOrder')}>{S.animations.later}</Button>
        </div>
      )}
    </div>
  );
}

function moveAll<T extends { shapeId: number }>(list: T[], targets: Set<number>, delta: -1 | 1): T[] {
  const out = [...list];
  const idx = out.map((a, i) => (targets.has(a.shapeId) ? i : -1)).filter((i) => i >= 0);
  for (const i of delta < 0 ? idx : idx.reverse()) {
    const j = i + delta;
    if (j < 0 || j >= out.length || targets.has((out[j] as T).shapeId)) continue;
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

function CommentsPane({ ed }: { ed: Editor }) {
  const [reply, setReply] = useState<Record<number, string>>({});
  const slide = ed.slide;
  const author = ed.services.settings.get('powerpoint.author', S.review.defaultAuthor);
  if (!slide) return null;
  const edit = (fn: (c: Slide['comments']) => void): void => ed.commit(editSlide(ed.deck, slide.id, (s) => fn(s.comments)), 'comments');
  return (
    <div className="pp-stack">
      {slide.comments.length === 0 && <p className="pp-muted">{S.panes.noComments}</p>}
      {slide.comments.map((c, i) => (
        <div key={i} className={`pp-comment${c.resolved ? ' is-resolved' : ''}`}>
          <div className="pp-comment__head">
            <span className="pp-comment__avatar">{c.initials ?? c.author.slice(0, 2).toUpperCase()}</span>
            <strong>{c.author}</strong>
            <span className="pp-muted">{c.date ? new Date(c.date).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : ''}</span>
          </div>
          <p>{c.text}</p>
          {(c.replies ?? []).map((r, j) => (
            <p key={j} className="pp-comment__reply"><strong>{r.author}</strong> : {r.text}</p>
          ))}
          <div className="pp-form__row">
            <TextField value={reply[i] ?? ''} placeholder={S.panes.reply} onChange={(e) => setReply({ ...reply, [i]: e.target.value })} aria-label={S.panes.reply} />
            <Button disabled={!reply[i]?.trim()} onClick={() => { edit((list) => { const t = list[i]; if (t) t.replies = [...(t.replies ?? []), { author, text: (reply[i] ?? '').trim(), date: new Date().toISOString() }]; }); setReply({ ...reply, [i]: '' }); }}>{S.panes.send}</Button>
          </div>
          <div className="pp-form__row">
            <Button appearance="subtle" icon="checkmark" onClick={() => edit((list) => { const t = list[i]; if (t) t.resolved = !t.resolved || undefined; })}>{c.resolved ? S.panes.reopen : S.panes.resolve}</Button>
            <Button appearance="subtle" icon="delete" onClick={() => edit((list) => { list.splice(i, 1); })}>{S.common.delete}</Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function DesignerPane({ ed }: { ed: Editor }) {
  const slide = ed.slide;
  const ideas = useMemo(() => (slide ? designIdeas(ed.deck, slide, (s) => ed.ctx.resolve(s).xfrm) : []), [ed.deck, slide, ed.ctx]);
  if (!slide) return null;
  const width = 260;
  return (
    <div className="pp-stack">
      <p className="pp-muted">{S.panes.designerHint}</p>
      {ideas.map((idea) => (
        <button
          key={idea.id}
          type="button"
          className="pp-idea"
          title={S.panes.ideaNames[idea.id as keyof typeof S.panes.ideaNames] ?? idea.id}
          onClick={() => ed.commit(editSlide(ed.deck, slide.id, (s) => { s.shapes = structuredClone(idea.slide.shapes); }), 'designer')}
        >
          <div style={{ width, height: (ed.deck.size.height * width) / ed.deck.size.width, overflow: 'hidden' }}>
            <PageView {...slidePageProps(ed.deck, idea.slide, ed.slideIndex, `d${idea.id}`)} scale={width / ed.deck.size.width} />
          </div>
        </button>
      ))}
    </div>
  );
}

function SelectionPane({ ed }: { ed: Editor }) {
  const [editing, setEditing] = useState<number | null>(null);
  const shapes = [...ed.pageShapes].reverse();
  const rename = (id: number, name: string): void => ed.editShapes((list) => { const f = locate(list, id); if (f && name.trim()) f.shape.name = name.trim(); }, 'rename');
  return (
    <div className="pp-stack">
      <div className="pp-form__row">
        <Button onClick={() => ed.editShapes((list) => list.forEach((s) => { delete s.hidden; }), 'visibility')}>{S.panes.showAll}</Button>
        <Button onClick={() => ed.editShapes((list) => list.forEach((s) => { s.hidden = true; }), 'visibility')}>{S.panes.hideAll}</Button>
        <Button icon="arrow_up" aria-label={S.arrange.forward} disabled={!ed.selection.ids.length} onClick={() => ed.editShapes((list) => reorder(list, ed.selection.ids, 'forward'), 'order')} />
        <Button icon="arrow_down" aria-label={S.arrange.backward} disabled={!ed.selection.ids.length} onClick={() => ed.editShapes((list) => reorder(list, ed.selection.ids, 'backward'), 'order')} />
      </div>
      <ul className="pp-sel">
        {shapes.map((s) => (
          <li key={s.id} className={ed.selection.ids.includes(s.id) ? 'is-selected' : ''} onClick={(e) => ed.setSelection({ ids: e.ctrlKey ? [...ed.selection.ids, s.id] : [s.id] })} onDoubleClick={() => setEditing(s.id)}>
            {editing === s.id ? (
              <input
                autoFocus
                defaultValue={s.name}
                onBlur={(e) => { rename(s.id, e.target.value); setEditing(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditing(null); }}
                aria-label={S.common.rename}
              />
            ) : (
              <span>{s.name || `#${s.id}`}</span>
            )}
            <button type="button" className="pp-icon-btn" aria-label={s.hidden ? S.panes.show : S.panes.hide} onClick={(e) => { e.stopPropagation(); ed.editShapes((list) => { const f = locate(list, s.id); if (f) { if (f.shape.hidden) delete f.shape.hidden; else f.shape.hidden = true; } }, 'visibility'); }}>
              <Icon name={s.hidden ? 'eye_off' : 'eye'} size={14} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AccessibilityPane({ ed }: { ed: Editor }) {
  const issues = useMemo(() => {
    const out: Array<{ slideId: number; index: number; shapeId?: number; text: string }> = [];
    const titles = new Map<string, number>();
    ed.deck.slides.forEach((slide, index) => {
      const title = slideTitle(slide);
      if (!title) out.push({ slideId: slide.id, index, text: S.panes.missingTitle(index + 1) });
      else if (titles.has(title)) out.push({ slideId: slide.id, index, text: S.panes.duplicateTitle(index + 1, title) });
      titles.set(title, index);
      for (const shape of slide.shapes) {
        if ((shape.kind === 'picture' || shape.kind === 'chart' || shape.kind === 'media' || shape.kind === 'group') && !shape.description && shape.title !== 'decorative') out.push({ slideId: slide.id, index, shapeId: shape.id, text: S.panes.missingAlt(index + 1, shape.name) });
      }
    });
    return out;
  }, [ed.deck]);
  return (
    <div className="pp-stack">
      {issues.length === 0 ? <p className="pp-muted">{S.panes.noIssues}</p> : <p className="pp-muted">{S.panes.issuesCount(issues.length)}</p>}
      <ul className="pp-sel">
        {issues.map((issue, i) => (
          <li key={i} onClick={() => { ed.goto(issue.slideId); if (issue.shapeId !== undefined) window.setTimeout(() => ed.setSelection({ ids: [issue.shapeId as number] }), 0); }}>
            <Icon name="warning" size={14} color="var(--fo-warning)" />
            <span>{issue.text}</span>
          </li>
        ))}
      </ul>
      {ed.selectedShapes[0] && (
        <Section title={S.context.altText}>
          <AltText key={ed.selectedShapes[0].id} ed={ed} shape={ed.selectedShapes[0]} />
        </Section>
      )}
    </div>
  );
}

const TITLES: Readonly<Record<Exclude<SidePane, null>, string>> = {
  format: S.panes.formatTitle,
  animation: S.animations.pane,
  comments: S.review.comments,
  designer: S.design.designer,
  selection: S.arrange.selectionPane,
  accessibility: S.review.accessibility,
  smartart: 'Volet Texte',
};

export function SidePanes({ ed, onPlayAnimations }: { ed: Editor; onPlayAnimations: () => void }) {
  const pane = ed.ui.pane;
  if (!pane) return null;
  return (
    <TaskPane title={TITLES[pane]} width={ed.ui.paneWidth} onWidthChange={(paneWidth) => ed.setUi({ paneWidth })} onClose={() => ed.setUi({ pane: null })}>
      <div className="pp-pane">
        {pane === 'format' && <FormatPane ed={ed} />}
        {pane === 'animation' && <AnimationPane ed={ed} onPlay={onPlayAnimations} />}
        {pane === 'comments' && <CommentsPane ed={ed} />}
        {pane === 'designer' && <DesignerPane ed={ed} />}
        {pane === 'selection' && <SelectionPane ed={ed} />}
        {pane === 'accessibility' && <AccessibilityPane ed={ed} />}
        {pane === 'smartart' && <SmartArtPane ed={ed} />}
      </div>
    </TaskPane>
  );
}
