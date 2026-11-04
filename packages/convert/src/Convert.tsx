// Convertisseur par lots facon Office 2024 : depot de fichiers ou de dossiers, format de sortie par fichier ou
// pour tout le lot, file d'attente avec progression, resultats (ouvrir dans le bon module, enregistrer, ZIP),
// outils PDF par lots. Conversions TypeScript partout ; moteur natif forge-convert dans la coquille de bureau.
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { MODULES, type ModuleProps } from '@forgeoffice/core';
import {
  Backstage, BackstageHeading, BACKSTAGE_PAGES, Button, Icon, Ribbon, StatusBar, TaskPane, TitleBar, collectCommands, usePersistentState,
  type BackstagePage,
  useDeviceMode,
} from '@forgeoffice/ui';
import { DEFAULT_OPTIONS, convertFile, imagesToOnePdf, type ConvertOptions } from './engines.ts';
import { pickFiles, fromDataTransfer, fromFileList } from './files.ts';
import { ALL_TARGETS, categoryOf, commonTargets, desktopOnlyTargets, formatLabel, planEngine } from './formats.ts';
import { JobTable } from './JobTable.tsx';
import { capabilities, pickFolder, saveInto, type Capabilities, type NamedBytes } from './native.ts';
import { DEFAULT_PARAMS, TOOL_LABELS, runPdfTool, type PdfTool, type ToolParams } from './pdf-batch.ts';
import {
  MAX_JOBS, addFiles, engineOf, nextWaiting, pushHistory, refreshTargets, resultName, setAllTargets, setTarget, summarize, update,
  type HistoryEntry, type IncomingFile, type Job, type JobOutput,
} from './queue.ts';
import { convertTabs } from './ribbon.ts';
import { ToolDialog } from './ToolDialog.tsx';
import { S } from './strings.ts';
import './Convert.css';

const info = MODULES.convert;

const errorText = (err: unknown): string => (err instanceof Error ? err.message : String(err));

async function zip(files: readonly NamedBytes[]): Promise<Uint8Array> {
  const { default: JSZip } = await import('jszip');
  const z = new JSZip();
  const seen = new Set<string>();
  for (const f of files) {
    let name = f.name;
    for (let i = 2; seen.has(name.toLowerCase()); i++) name = `${i}-${f.name}`;
    seen.add(name.toLowerCase());
    z.file(name, f.bytes);
  }
  return z.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

export function Convert({ services, file }: ModuleProps) {
  const native = services.native;
  const [jobs, setJobs] = useState<Job[]>([]);
  const [options, setOptionsState] = useState<ConvertOptions>(DEFAULT_OPTIONS);
  const [allTarget, setAllTarget] = useState('pdf');
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [folder, setFolder] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [dragging, setDragging] = useState(false);
  // Tactile : pas de glisser-deposer, un grand bouton ouvre le selecteur de fichiers du systeme.
  const touch = useDeviceMode().form !== 'desktop';
  const [backstage, setBackstage] = useState<string | null>(null);
  const [tool, setTool] = useState<PdfTool | null>(null);
  const [params, setParams] = useState<ToolParams>(DEFAULT_PARAMS);
  const [history, setHistory] = usePersistentState<HistoryEntry[]>(services.settings, 'convert.history', []);
  const [historyOpen, setHistoryOpen] = usePersistentState<boolean>(services.settings, 'convert.historyOpen', false);
  const [paneWidth, setPaneWidth] = useState(300);
  const jobsRef = useRef(jobs);
  jobsRef.current = jobs;
  const stopRef = useRef(false);
  const dragDepth = useRef(0);
  const hasNative = native !== null;

  useEffect(() => {
    services.setTitle(`${info.name} - ForgeOffice`);
    if (!native) return;
    capabilities(native).then(setCaps, (err: unknown) => services.notify(errorText(err), 'warning'));
  }, [native, services]);

  const add = useCallback((files: readonly IncomingFile[]) => {
    const { jobs: next, rejected } = addFiles(jobsRef.current, files, hasNative);
    setJobs(next);
    for (const r of rejected.slice(0, 5)) services.notify(S.rejected(r.name, r.reason), 'warning');
  }, [hasNative, services]);

  // Fichier confie au demarrage (« Ouvrir avec » le Convertisseur).
  useEffect(() => {
    if (file) add([{ name: file.name, bytes: file.bytes, path: file.path }]);
  }, [file, add]);

  useEffect(() => setJobs((j) => refreshTargets(j, hasNative)), [hasNative]);

  const saveFile = useCallback(async (f: NamedBytes): Promise<string | undefined> => {
    if (native && folder) return saveInto(native, folder, f);
    await services.saveFile(f.bytes, f.name, [{ name: formatLabel(f.name.split('.').pop() ?? ''), extensions: [f.name.split('.').pop() ?? '*'] }], null);
    return undefined;
  }, [native, folder, services]);

  const convertAll = useCallback(async () => {
    if (!nextWaiting(jobsRef.current)) {
      services.notify(S.nothingToRun, 'info');
      return;
    }
    stopRef.current = false;
    setRunning(true);
    let ok = 0;
    let ko = 0;
    const done: HistoryEntry[] = [];
    for (let job = nextWaiting(jobsRef.current); job && !stopRef.current; job = nextWaiting(jobsRef.current)) {
      const current = job;
      const target = current.target ?? '';
      const engine = engineOf(current, hasNative);
      setJobs((list) => update(list, current.id, { status: 'working', error: null }));
      try {
        if (!engine) throw new Error(S.errors.unsupported(current.ext, target));
        const outName = resultName(jobsRef.current, current, target);
        const outputs = await convertFile({ name: current.name, bytes: current.bytes }, target, engine, outName, native, options);
        const saved: JobOutput[] = [];
        for (const o of outputs) saved.push({ ...o, savedPath: folder ? await saveFile(o) : undefined });
        setJobs((list) => update(list, current.id, { status: 'done', progress: 1, outputs: saved }));
        for (const o of saved) done.push({ input: current.name, output: o.name, size: o.bytes.length, at: Date.now() });
        ok++;
      } catch (err) {
        setJobs((list) => update(list, current.id, { status: 'error', error: errorText(err) }));
        ko++;
      }
      // Laisse React appliquer l'etat avant de chercher le suivant.
      await new Promise((r) => setTimeout(r, 0));
    }
    setRunning(false);
    setHistory(pushHistory(history, done));
    services.notify(S.finished(ok, ko), ko === 0 ? 'success' : 'warning');
  }, [hasNative, native, options, folder, saveFile, services, history, setHistory]);

  const saveJob = useCallback(async (job: Job) => {
    try {
      const only = job.outputs[0];
      if (job.outputs.length === 1 && only) await saveFile(only);
      else await services.saveFile(await zip(job.outputs), `${job.name.replace(/\.[^.]+$/, '')}.zip`, [{ name: 'ZIP', extensions: ['zip'] }], null);
    } catch (err) {
      services.notify(errorText(err), 'error');
    }
  }, [saveFile, services]);

  const openJob = useCallback((job: Job) => {
    const o = job.outputs[0];
    if (!o) return;
    services.openDocument({ name: o.name, path: o.savedPath ?? null, bytes: o.bytes }).catch((err: unknown) => services.notify(errorText(err), 'error'));
  }, [services]);

  const saveAll = useCallback(async () => {
    const all = jobsRef.current.flatMap((j) => j.outputs);
    if (all.length === 0) return;
    try {
      await services.saveFile(await zip(all), S.zipName, [{ name: 'ZIP', extensions: ['zip'] }], null);
    } catch (err) {
      services.notify(errorText(err), 'error');
    }
  }, [services]);

  /** Ajoute des resultats d'outils comme lignes terminees. */
  const addResults = useCallback((files: readonly NamedBytes[]) => {
    const { jobs: next } = addFiles(jobsRef.current, files.map((f) => ({ name: f.name, bytes: f.bytes })), hasNative);
    const ids = new Set(jobsRef.current.map((j) => j.id));
    setJobs(next.map((j) => (ids.has(j.id) ? j : { ...j, status: 'done', outputs: [{ name: j.name, bytes: j.bytes }] })));
  }, [hasNative]);

  const runTool = useCallback(async (t: PdfTool, p: ToolParams) => {
    setTool(null);
    const pdfs = jobsRef.current.filter((j) => j.ext === 'pdf').map((j) => ({ name: j.name, bytes: j.bytes }));
    setRunning(true);
    try {
      const out = await runPdfTool(t, pdfs, p, native);
      for (const o of out) if (folder) await saveFile(o);
      addResults(out);
      services.notify(S.pdfToolDone(TOOL_LABELS[t], out.length), 'success');
    } catch (err) {
      services.notify(errorText(err), 'error');
    } finally {
      setRunning(false);
    }
  }, [native, folder, saveFile, addResults, services]);

  const imagesToPdf = useCallback(async () => {
    const images = jobsRef.current.filter((j) => categoryOf(j.ext) === 'image').map((j) => ({ name: j.name, bytes: j.bytes }));
    setRunning(true);
    try {
      addResults([{ name: 'images.pdf', bytes: await imagesToOnePdf(images, options) }]);
    } catch (err) {
      services.notify(errorText(err), 'error');
    } finally {
      setRunning(false);
    }
  }, [options, addResults, services]);

  const browse = useCallback(async (folderMode: boolean) => {
    const list = await pickFiles(folderMode);
    if (list) add(await fromFileList(list));
  }, [add]);

  const summary = summarize(jobs);
  const allTargets = useMemo(() => commonTargets(jobs.map((j) => j.ext), hasNative), [jobs, hasNative]);
  const pdfCount = jobs.filter((j) => j.ext === 'pdf').length;
  const imageCount = jobs.filter((j) => categoryOf(j.ext) === 'image').length;

  const tabs = useMemo(() => convertTabs(
    {
      hasJobs: jobs.length > 0, hasWaiting: summary.waiting > 0, hasDone: summary.done > 0, running, allTargets,
      allTarget: allTargets.includes(allTarget) ? allTarget : (allTargets[0] ?? ''), options, native: hasNative, caps, folder, historyOpen, pdfCount, imageCount,
    },
    {
      addFiles: () => void browse(false),
      addFolder: () => void browse(true),
      clear: () => setJobs([]),
      clearDone: () => setJobs((j) => j.filter((x) => x.status !== 'done')),
      setAllTarget: (t) => {
        setAllTarget(t);
        setJobs((j) => setAllTargets(j, t, hasNative));
      },
      setOptions: (o) => setOptionsState((cur) => ({ ...cur, ...o })),
      convertAll: () => void convertAll(),
      stop: () => {
        stopRef.current = true;
      },
      saveAll: () => void saveAll(),
      pickFolder: () => {
        if (native) pickFolder(native).then((f) => f && setFolder(f), (err: unknown) => services.notify(errorText(err), 'error'));
      },
      pdfTool: (t) => (t === 'merge' || t === 'rotate' ? void runTool(t, params) : setTool(t)),
      imagesToPdf: () => void imagesToPdf(),
      toggleHistory: () => setHistoryOpen(!historyOpen),
    },
  ), [jobs.length, summary.waiting, summary.done, running, allTargets, allTarget, options, hasNative, caps, folder, historyOpen, pdfCount, imageCount,
    browse, convertAll, saveAll, native, services, runTool, params, imagesToPdf, setHistoryOpen]);
  const commands = useMemo(() => collectCommands(tabs), [tabs]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'F5' && !running) {
        e.preventDefault();
        void convertAll();
      } else if (e.ctrlKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        void browse(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [running, convertAll, browse]);

  const onDrop = async (e: DragEvent): Promise<void> => {
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    add(await fromDataTransfer(e.dataTransfer, MAX_JOBS));
  };

  const formatsPage = (): React.ReactNode => (
    <>
      <BackstageHeading>{S.formats}</BackstageHeading>
      <p className="cv-muted">{hasNative ? S.engineNative : S.engineWebTip}</p>
      <table className="cv-formats">
        <tbody>
          {(['texte', 'tableur', 'presentation', 'image', 'pdf', 'donnees', 'soustitres', 'archive', 'audio'] as const).map((cat) => {
            const sample = { texte: 'docx', tableur: 'xlsx', presentation: 'pptx', image: 'png', pdf: 'pdf', donnees: 'json', soustitres: 'srt', archive: 'zip', audio: 'mp3' }[cat];
            const here = ALL_TARGETS.filter((t) => planEngine(sample, t, hasNative) !== null);
            const later = hasNative ? [] : desktopOnlyTargets(sample);
            return (
              <tr key={cat}>
                <th>{S.categories[cat]}</th>
                <td>
                  {here.map((t) => t.toUpperCase()).join(' · ')}
                  {here.length > 0 && later.length > 0 && ' · '}
                  {later.length > 0 && <span className="cv-muted">{later.map((t) => t.toUpperCase()).join(' · ')} ({S.needDesktop})</span>}
                  {here.length + later.length === 0 && S.noTarget}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );

  const pages: BackstagePage[] = [
    { ...BACKSTAGE_PAGES.info, label: S.formats, render: formatsPage },
    { ...BACKSTAGE_PAGES.close, onSelect: () => services.close() },
  ];

  return (
    <div className="cv" onDragEnter={(e) => { e.preventDefault(); dragDepth.current++; setDragging(true); }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => { dragDepth.current--; if (dragDepth.current <= 0) setDragging(false); }}
      onDrop={(e) => void onDrop(e)}>
      <TitleBar app={info} commands={commands} windowControls={services.windowControls} settings={services.settings} />
      <Ribbon tabs={tabs} onFile={() => setBackstage('info')} settings={services.settings} />
      <div className="cv-body">
        <main className="cv-main">
          {jobs.length === 0 ? (
            <div role="button" tabIndex={0} className="cv-empty" onClick={() => void browse(false)}
              onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); void browse(false); } }}>
              <Icon name="convert_range" size={48} color="var(--fo-accent)" />
              <span className="cv-empty__title">{touch ? S.emptyTitleTouch : S.emptyTitle}</span>
              <span className="cv-muted">{touch ? S.emptyTextTouch : S.emptyText}</span>
              <span className="cv-empty__actions">
                <Button appearance="primary" icon="document_add" onClick={(e) => { e.stopPropagation(); void browse(false); }}>{S.add}</Button>
                {!touch && <Button icon="folder_add" onClick={(e) => { e.stopPropagation(); void browse(true); }}>{S.addFolder}</Button>}
              </span>
              {!hasNative && <span className="cv-muted cv-empty__hint"><Icon name="info" size={16} /> {S.engineWebTip}</span>}
            </div>
          ) : (
            <JobTable
              jobs={jobs} native={hasNative} running={running}
              onTarget={(id, t) => setJobs((j) => setTarget(j, id, t))}
              onOpen={openJob} onSave={(j) => void saveJob(j)}
              onRemove={(id) => setJobs((j) => j.filter((x) => x.id !== id))}
              onRetry={(id) => setJobs((j) => update(j, id, { status: 'waiting', error: null }))}
            />
          )}
          {dragging && <div className="cv-drop"><Icon name="arrow_download" size={40} /><span>{S.dropHere}</span></div>}
        </main>
        {historyOpen && (
          <TaskPane title={S.history} width={paneWidth} onWidthChange={setPaneWidth} onClose={() => setHistoryOpen(false)}
            actions={<Button size="small" appearance="subtle" icon="delete" disabled={history.length === 0} onClick={() => setHistory([])}>{S.historyClear}</Button>}>
            {history.length === 0 ? <p className="cv-muted">{S.historyEmpty}</p> : (
              <ul className="cv-history">
                {history.map((h, i) => (
                  <li key={`${h.at}-${i}`}>
                    <span className="cv-history__name">{h.input} <Icon name="arrow_right" size={12} /> {h.output}</span>
                    <span className="cv-muted">{new Date(h.at).toLocaleString('fr-FR')}</span>
                  </li>
                ))}
              </ul>
            )}
          </TaskPane>
        )}
      </div>
      <StatusBar
        left={[
          { id: 'count', label: S.count(summary.total) },
          { id: 'done', label: S.doneCount(summary.done) },
          ...(summary.errors > 0 ? [{ id: 'errors', label: S.errorCount(summary.errors), icon: 'error_circle' as const }] : []),
          { id: 'engine', label: hasNative ? S.engineNative : S.engineWeb, icon: hasNative ? 'checkmark' as const : 'info' as const, title: hasNative ? caps?.version : S.engineWebTip },
          ...(folder ? [{ id: 'folder', label: folder, icon: 'folder' as const, title: S.folderTip }] : []),
        ]}
      />
      <Backstage open={backstage !== null} appName={info.name} pages={pages} activePage={backstage ?? 'info'} onPageChange={setBackstage} onClose={() => setBackstage(null)} />
      <ToolDialog tool={tool} params={params} onChange={setParams} onCancel={() => setTool(null)} onApply={(t) => void runTool(t, params)} />
    </div>
  );
}
