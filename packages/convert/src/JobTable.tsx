// Liste des fichiers du lot : nom, type, taille, format de sortie, etat, actions (ouvrir, enregistrer, retirer).
import { useState } from 'react';
import { MODULES, moduleForFile, type NativeBridge } from '@forgeoffice/core';
import { Button, Icon, ProgressBar, type IconName } from '@forgeoffice/ui';
import { categoryOf, formatLabel, targetsFor, type Category } from './formats.ts';
import { checkOutputName } from './naming.ts';
import { formatSize, type Job } from './queue.ts';
import { Thumb } from './Thumb.tsx';
import { S } from './strings.ts';

const CATEGORY_ICONS: Readonly<Record<Category, IconName>> = {
  texte: 'document_text', tableur: 'table', presentation: 'slide_multiple', image: 'image', pdf: 'document_pdf',
  donnees: 'braces', soustitres: 'video_clip', archive: 'folder_zip', audio: 'speaker_2', autre: 'document',
};

export interface JobTableProps {
  jobs: readonly Job[];
  native: boolean;
  /** Pont natif (miniatures du disque) ; null dans le navigateur. */
  bridge: NativeBridge | null;
  running: boolean;
  onTarget(id: string, target: string): void;
  onOpen(job: Job): void;
  onSave(job: Job): void;
  onRemove(id: string): void;
  onRetry(id: string): void;
  /** Nom de sortie (radical) ; null = nom automatique. */
  onOutName(id: string, stem: string | null): void;
  onMove(id: string, delta: -1 | 1): void;
  /** Glisser-deposer : place `id` avant (ou apres) `target`. */
  onReorder(id: string, target: string, after: boolean): void;
}

/** Marque d'un glisser interne a la liste (distinct du depot de fichiers). */
export const ROW_DRAG = 'application/x-forgeoffice-row';

function OutNameField({ job, onCommit }: { job: Job; onCommit(stem: string | null): void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const target = job.target ?? '';
  const shown = draft ?? job.outName ?? '';
  const check = draft !== null && draft.trim() !== '' ? checkOutputName(draft, target) : null;
  const error = check && !check.ok ? S.nameErrors[check.reason] : undefined;
  const commit = (): void => {
    if (draft === null) return;
    if (draft.trim() === '') onCommit(null);
    else if (check?.ok) onCommit(check.stem);
    else return;
    setDraft(null);
  };
  return (
    <span className="cv-outname">
      <input
        className={`cv-input${error ? ' is-invalid' : ''}`} value={shown} maxLength={140} placeholder={S.outNamePlaceholder}
        aria-label={`${S.outName} : ${job.name}`} aria-invalid={error ? true : undefined} title={error ?? S.outNameTip}
        disabled={job.status === 'working'}
        onChange={(e) => setDraft(e.target.value)} onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          else if (e.key === 'Escape') setDraft(null);
        }}
      />
      <span className="cv-outname__ext">.{target}</span>
    </span>
  );
}

function State({ job }: { job: Job }) {
  switch (job.status) {
    case 'working':
      return <div className="cv-state"><ProgressBar label={S.status.working} /><span>{S.status.working}</span></div>;
    case 'done':
      return (
        <div className="cv-state is-done" title={job.outputs.map((o) => o.savedPath ?? o.name).join('\n')}>
          <Icon name="checkmark" size={16} />
          <span>{job.outputs.length === 1 && job.outputs[0] ? `${job.outputs[0].name} · ${formatSize(job.outputs[0].bytes.length)}` : `${S.status.done} (${job.outputs.length})`}</span>
        </div>
      );
    case 'error':
      return <div className="cv-state is-error" title={job.error ?? ''}><Icon name="error_circle" size={16} /><span>{job.error ?? S.status.error}</span></div>;
    case 'unsupported':
      return <div className="cv-state is-muted"><span>{S.status.unsupported}</span></div>;
    default:
      return <div className="cv-state is-muted"><span>{S.status.waiting}</span></div>;
  }
}

export function JobTable({ jobs, native, bridge, running, onTarget, onOpen, onSave, onRemove, onRetry, onOutName, onMove, onReorder }: JobTableProps) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<{ id: string; after: boolean } | null>(null);
  const end = (): void => {
    setDragId(null);
    setOver(null);
  };
  return (
    <table className="cv-table">
      <thead>
        <tr>
          <th className="cv-col-name">{S.cols.name}</th>
          <th className="cv-col-size">{S.cols.size}</th>
          <th className="cv-col-target">{S.cols.target}</th>
          <th className="cv-col-outname">{S.outName}</th>
          <th className="cv-col-state">{S.cols.state}</th>
          <th className="cv-col-actions" aria-label={S.cols.actions} />
        </tr>
      </thead>
      <tbody>
        {jobs.map((job, index) => {
          const targets = targetsFor(job.ext, native);
          const first = job.outputs[0];
          const app = first ? moduleForFile(first.name) : null;
          return (
            <tr
              key={job.id}
              className={[job.status === 'working' ? 'is-working' : '', dragId === job.id ? 'is-dragged' : '', over?.id === job.id ? (over.after ? 'drop-after' : 'drop-before') : ''].filter(Boolean).join(' ') || undefined}
              onDragOver={(e) => {
                if (!dragId || !e.dataTransfer.types.includes(ROW_DRAG)) return;
                e.preventDefault();
                e.stopPropagation();
                const r = e.currentTarget.getBoundingClientRect();
                const after = e.clientY > r.top + r.height / 2;
                if (over?.id !== job.id || over.after !== after) setOver({ id: job.id, after });
              }}
              onDrop={(e) => {
                if (!dragId || !e.dataTransfer.types.includes(ROW_DRAG)) return;
                e.preventDefault();
                e.stopPropagation();
                if (dragId !== job.id) onReorder(dragId, job.id, over?.after ?? false);
                end();
              }}
            >
              <td className="cv-col-name">
                <span className="cv-name" title={job.relativePath}>
                  {jobs.length > 1 && !running && (
                    <span
                      className="cv-grip" draggable title={S.dragRow} aria-hidden="true"
                      onDragStart={(e) => {
                        e.dataTransfer.setData(ROW_DRAG, job.id);
                        e.dataTransfer.effectAllowed = 'move';
                        const row = e.currentTarget.closest('tr');
                        if (row) e.dataTransfer.setDragImage(row, 16, 16);
                        setDragId(job.id);
                      }}
                      onDragEnd={end}
                    >
                      <Icon name="grid_dots" size={16} />
                    </span>
                  )}
                  <Thumb job={job} native={bridge} fallback={<Icon name={CATEGORY_ICONS[categoryOf(job.ext)]} size={24} />} />
                  <span className="cv-name__text">
                    <span className="cv-name__file">{job.name}</span>
                    {job.relativePath !== job.name && <span className="cv-name__path">{job.relativePath}</span>}
                  </span>
                </span>
              </td>
              <td className="cv-col-size">{formatSize(job.size)}</td>
              <td className="cv-col-target">
                {targets.length > 0 ? (
                  <select
                    className="cv-select"
                    value={job.target ?? ''}
                    disabled={running || job.status === 'working'}
                    aria-label={`${S.cols.target} : ${job.name}`}
                    onChange={(e) => onTarget(job.id, e.target.value)}
                  >
                    {targets.map((t) => <option key={t} value={t}>{formatLabel(t)}</option>)}
                  </select>
                ) : (
                  <span className="cv-muted">{native ? S.noTarget : S.needDesktop}</span>
                )}
              </td>
              <td className="cv-col-outname">{targets.length > 0 && job.target ? <OutNameField job={job} onCommit={(stem) => onOutName(job.id, stem)} /> : null}</td>
              <td className="cv-col-state"><State job={job} /></td>
              <td className="cv-col-actions">
                {jobs.length > 1 && (
                  <span className="cv-move">
                    <Button size="small" appearance="transparent" icon="arrow_up" aria-label={S.moveUp} title={S.moveUp} disabled={running || index === 0} onClick={() => onMove(job.id, -1)} />
                    <Button size="small" appearance="transparent" icon="arrow_down" aria-label={S.moveDown} title={S.moveDown} disabled={running || index === jobs.length - 1} onClick={() => onMove(job.id, 1)} />
                  </span>
                )}
                {job.status === 'done' && app && (
                  <Button size="small" appearance="subtle" icon="open" title={S.openIn(MODULES[app].name)} onClick={() => onOpen(job)}>{S.open}</Button>
                )}
                {job.status === 'done' && <Button size="small" appearance="subtle" icon="save" onClick={() => onSave(job)}>{S.save}</Button>}
                {job.status === 'error' && <Button size="small" appearance="subtle" icon="arrow_sync" onClick={() => onRetry(job.id)}>{S.retry}</Button>}
                <Button size="small" appearance="transparent" icon="dismiss" aria-label={S.remove} title={S.remove} disabled={job.status === 'working'} onClick={() => onRemove(job.id)} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
