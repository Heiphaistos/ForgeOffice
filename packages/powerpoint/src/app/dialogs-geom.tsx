// Boite « Taille et position » : largeur, hauteur, ratio verrouille, rotation, position (valeurs en cm).
import { useState } from 'react';
import { Checkbox, Dialog, NumberField, TextField } from '@forgeoffice/ui';
import { S } from '../strings.ts';
import { S3 } from './strings-text.ts';
import type { Editor } from './editor.ts';
import { renameSelectedShape } from './master-ops.ts';
import { geomForm, geomPatch, scaleOf, withHeight, withScale, withWidth, type GeomForm } from './geom-dialog-model.ts';

export function SizePositionDialog({ ed, onClose }: { ed: Editor; onClose: () => void }) {
  const raw = ed.selectedShapes[0];
  const xfrm = raw ? (raw.xfrm ?? ed.ctx.resolve(raw).xfrm) : undefined;
  const [initial] = useState<GeomForm>(() => geomForm(xfrm ?? { x: 0, y: 0, width: 0, height: 0 }, !!raw?.locks?.noChangeAspect || raw?.kind === 'picture'));
  const [form, setForm] = useState<GeomForm>(initial);
  const patch = <K extends keyof GeomForm>(key: K, value: GeomForm[K]): void => setForm((f) => ({ ...f, [key]: value }));
  const ok = (): void => {
    const changes = geomPatch(form, initial);
    const lockChanged = form.lockRatio !== initial.lockRatio;
    if (Object.keys(changes).length || lockChanged) {
      ed.editSelected((s) => {
        const base = s.xfrm ?? ed.ctx.resolve(s).xfrm;
        if (base) s.xfrm = { ...base, ...changes };
        if (lockChanged) s.locks = { ...(s.locks ?? {}), noChangeAspect: form.lockRatio };
      }, 'size-dialog');
    }
    onClose();
  };
  const G = S3.geom;
  return (
    <Dialog open title={G.title} onClose={onClose} onConfirm={ok} width={440} actions={[{ label: S.common.ok, primary: true, onClick: ok }, { label: S.common.cancel, onClick: onClose }]}>
      <div className="pp-stack" data-testid="geom-dialog">
        <fieldset className="pp-group">
          <legend>{G.size}</legend>
          <div className="pp-form">
            <label>{S.context.height}</label>
            <NumberField value={form.height} min={0.03} max={142} step={0.1} unit="cm" width={110} onChange={(v) => setForm((f) => withHeight(f, initial, v))} label={S.context.height} />
            <label>{S.context.width}</label>
            <NumberField value={form.width} min={0.03} max={142} step={0.1} unit="cm" width={110} onChange={(v) => setForm((f) => withWidth(f, initial, v))} label={S.context.width} />
            <label>{G.scaleHeight}</label>
            <NumberField value={scaleOf(form, initial, 'height')} min={1} max={10000} step={5} unit="%" width={110} onChange={(v) => setForm((f) => withScale(f, initial, 'height', v))} label={G.scaleHeight} />
            <label>{G.scaleWidth}</label>
            <NumberField value={scaleOf(form, initial, 'width')} min={1} max={10000} step={5} unit="%" width={110} onChange={(v) => setForm((f) => withScale(f, initial, 'width', v))} label={G.scaleWidth} />
            <label>{S.panes.rotation}</label>
            <NumberField value={form.rotation} min={0} max={360} step={1} unit="°" width={110} onChange={(v) => patch('rotation', v)} label={S.panes.rotation} />
          </div>
          <Checkbox checked={form.lockRatio} label={G.lockRatio} onChange={(c) => patch('lockRatio', c)} />
        </fieldset>
        <fieldset className="pp-group">
          <legend>{G.position}</legend>
          <div className="pp-form">
            <label>{S.panes.horizontal}</label>
            <NumberField value={form.x} min={-142} max={142} step={0.1} unit="cm" width={110} onChange={(v) => patch('x', v)} label={S.panes.horizontal} />
            <label>{S.panes.vertical}</label>
            <NumberField value={form.y} min={-142} max={142} step={0.1} unit="cm" width={110} onChange={(v) => patch('y', v)} label={S.panes.vertical} />
          </div>
        </fieldset>
      </div>
    </Dialog>
  );
}

/** Nom de l'objet selectionne (espaces reserves des masques, objets du volet Selection). */
export function ShapeNameDialog({ ed, onClose }: { ed: Editor; onClose: () => void }) {
  const [name, setName] = useState(ed.selectedShapes[0]?.name ?? '');
  const ok = (): void => {
    renameSelectedShape(ed, name);
    onClose();
  };
  return (
    <Dialog open title={S3.master.shapeNameTitle} onClose={onClose} onConfirm={ok} width={380} actions={[{ label: S.common.rename, primary: true, onClick: ok }, { label: S.common.cancel, onClick: onClose }]}>
      <TextField label={S3.master.shapeName} value={name} onChange={(e) => setName(e.target.value)} autoFocus data-testid="shape-name" />
    </Dialog>
  );
}
