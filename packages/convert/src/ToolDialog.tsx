// Parametres des outils PDF par lots (filigrane, numerotation, mot de passe, compression, OCR).
import { Checkbox, Dialog, NumberField, TextField } from '@forgeoffice/ui';
import { checkOutputName } from './naming.ts';
import { TOOL_LABELS, type CompressLevel, type OcrLang, type PdfTool, type ToolParams } from './pdf-batch.ts';
import { S } from './strings.ts';

export interface ToolDialogProps {
  tool: PdfTool | null;
  /** Noms des PDF dans l'ordre de la liste (fusion). */
  mergeOrder: readonly string[];
  params: ToolParams;
  onChange(p: ToolParams): void;
  onCancel(): void;
  onApply(tool: PdfTool): void;
}

export function ToolDialog({ tool, mergeOrder, params: p, onChange, onCancel, onApply }: ToolDialogProps) {
  const set = (patch: Partial<ToolParams>): void => onChange({ ...p, ...patch });
  const mergeCheck = checkOutputName(p.mergeName, 'pdf');
  const invalid = (tool === 'merge' && !mergeCheck.ok) || (tool === 'protect' && p.password.length === 0) || (tool === 'watermark' && p.text.trim().length === 0);
  return (
    <Dialog
      open={tool !== null}
      title={tool ? TOOL_LABELS[tool] : ''}
      onClose={onCancel}
      width={420}
      actions={[
        { label: S.dialogs.apply, primary: true, disabled: invalid, onClick: () => tool && onApply(tool) },
        { label: S.dialogs.cancel, onClick: onCancel },
      ]}
    >
      <div className="cv-form">
        {tool === 'merge' && (
          <>
            <TextField
              label={S.dialogs.mergeName} value={p.mergeName} maxLength={140} onChange={(e) => set({ mergeName: e.target.value })}
              error={mergeCheck.ok ? undefined : S.nameErrors[mergeCheck.reason]}
            />
            <span>{S.dialogs.mergeOrder}</span>
            <ol className="cv-order">{mergeOrder.map((n, i) => <li key={`${i}-${n}`}>{n}</li>)}</ol>
          </>
        )}
        {tool === 'watermark' && <TextField label={S.dialogs.watermarkText} value={p.text} maxLength={100} onChange={(e) => set({ text: e.target.value })} />}
        {tool === 'numbering' && (
          <>
            <TextField label={S.dialogs.prefix} value={p.prefix} maxLength={40} placeholder="DOSSIER-" onChange={(e) => set({ prefix: e.target.value })} />
            <NumberField label={S.dialogs.start} value={p.start} min={0} max={9_999_999} onChange={(start) => set({ start })} width={120} />
            <NumberField label={S.dialogs.digits} value={p.digits} min={0} max={12} onChange={(digits) => set({ digits })} width={120} />
          </>
        )}
        {tool === 'protect' && (
          <>
            <TextField label={S.dialogs.password} type="password" value={p.password} autoComplete="new-password" onChange={(e) => set({ password: e.target.value })} />
            <TextField label={S.dialogs.owner} type="password" value={p.owner} autoComplete="new-password" onChange={(e) => set({ owner: e.target.value })} />
          </>
        )}
        {tool === 'compress' && (
          <label className="cv-field">
            <span>{S.dialogs.level}</span>
            <select className="cv-select" value={p.level} onChange={(e) => set({ level: e.target.value as CompressLevel })}>
              {(Object.keys(S.levels) as CompressLevel[]).map((l) => <option key={l} value={l}>{S.levels[l]}</option>)}
            </select>
          </label>
        )}
        {tool === 'ocr' && (
          <>
            <label className="cv-field">
              <span>{S.dialogs.ocrLang}</span>
              <select className="cv-select" value={p.lang} onChange={(e) => set({ lang: e.target.value as OcrLang })}>
                {(Object.keys(S.langs) as OcrLang[]).map((l) => <option key={l} value={l}>{S.langs[l]}</option>)}
              </select>
            </label>
            <Checkbox label={S.dialogs.ocrForce} checked={p.force} onChange={(force) => set({ force })} />
          </>
        )}
        {tool === 'pdfa' && <p className="cv-muted">{S.dialogs.pdfaInfo}</p>}
      </div>
    </Dialog>
  );
}
