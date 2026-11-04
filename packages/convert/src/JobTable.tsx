// Liste des fichiers du lot : nom, type, taille, format de sortie, etat, actions (ouvrir, enregistrer, retirer).
import { MODULES, moduleForFile } from '@forgeoffice/core';
import { Button, Icon, ProgressBar, type IconName } from '@forgeoffice/ui';
import { categoryOf, formatLabel, targetsFor, type Category } from './formats.ts';
import { formatSize, type Job } from './queue.ts';
import { S } from './strings.ts';

const CATEGORY_ICONS: Readonly<Record<Category, IconName>> = {
  texte: 'document_text', tableur: 'table', presentation: 'slide_multiple', image: 'image', pdf: 'document_pdf',
  donnees: 'braces', soustitres: 'video_clip', archive: 'folder_zip', audio: 'speaker_2', autre: 'document',
};

export interface JobTableProps {
  jobs: readonly Job[];
  native: boolean;
  running: boolean;
  onTarget(id: string, target: string): void;
  onOpen(job: Job): void;
  onSave(job: Job): void;
  onRemove(id: string): void;
  onRetry(id: string): void;
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

export function JobTable({ jobs, native, running, onTarget, onOpen, onSave, onRemove, onRetry }: JobTableProps) {
  return (
    <table className="cv-table">
      <thead>
        <tr>
          <th className="cv-col-name">{S.cols.name}</th>
          <th className="cv-col-size">{S.cols.size}</th>
          <th className="cv-col-target">{S.cols.target}</th>
          <th className="cv-col-state">{S.cols.state}</th>
          <th className="cv-col-actions" aria-label={S.cols.actions} />
        </tr>
      </thead>
      <tbody>
        {jobs.map((job) => {
          const targets = targetsFor(job.ext, native);
          const first = job.outputs[0];
          const app = first ? moduleForFile(first.name) : null;
          return (
            <tr key={job.id} className={job.status === 'working' ? 'is-working' : undefined}>
              <td className="cv-col-name">
                <span className="cv-name" title={job.relativePath}>
                  <Icon name={CATEGORY_ICONS[categoryOf(job.ext)]} size={20} />
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
              <td className="cv-col-state"><State job={job} /></td>
              <td className="cv-col-actions">
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
