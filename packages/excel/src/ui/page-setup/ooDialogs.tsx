// Profil OnlyOffice : « Marges » et « Paramètres de l'en-tête/pied de page » du Tableur (captures docs/captures/onlyoffice-ref/10.0/dlg-marges-tableur.png
// et dlg-hf-tableur.png), branchés sur la même copie de travail que la boîte Mise en page ; les autres onglets gardent la boîte d'origine.
import { useState } from 'react';
import { Checkbox, Dialog, NumberField } from '@forgeoffice/ui';
import type { HeaderFooter, PageSetup } from '@forgeoffice/xlsx';
import { HF_PRESETS, hfPlain } from '../../logic/pagesetup.ts';
import type { DialogEnv } from '../registry.ts';
import { rememberMargins } from './last-margins.ts';
import { ZoneEditor, keyOf, type Which } from './header-footer.tsx';
import { PS } from '../../strings/index.ts';

const IN = 2.54;
const cmOf = (inches: number): number => Math.round(inches * IN * 100) / 100;
const inchesOf = (cm: number): number => Math.round((cm / IN) * 1000) / 1000;
const SAMPLE = { page: 1, pages: 3, now: new Date(2026, 10, 5, 9, 30), file: 'Classeur1.xlsx', path: '', sheet: 'Feuil1' };

function useWorkingCopy(x: DialogEnv) {
  const [d, setD] = useState<PageSetup>(() => ({ ...x.sheet.pageSetup, margins: { ...x.sheet.pageSetup.margins } }));
  const apply = (): void => {
    if (JSON.stringify(x.sheet.pageSetup.margins) !== JSON.stringify(d.margins)) rememberMargins(d.margins);
    x.store.commit((doc) => { doc.sheet(x.si).pageSetup = d; });
    x.close();
  };
  const actions = [{ label: 'OK', primary: true, onClick: apply }, { label: 'Annuler', onClick: x.close }];
  return { d, setD, apply, actions };
}

export function OoMarginsDialog({ x }: { x: DialogEnv }) {
  const { d, setD, apply, actions } = useWorkingCopy(x);
  const m = d.margins;
  const field = (key: 'top' | 'bottom' | 'left' | 'right', label: string) => (
    <label>{label}<NumberField value={cmOf(m[key])} min={0} max={50} step={0.05} unit="cm" width={86} label={label} onChange={(v) => setD({ ...d, margins: { ...m, [key]: inchesOf(v) } })} /></label>
  );
  const flag = (key: 'horizontalCentered' | 'verticalCentered', v: boolean): void => setD((cur) => { const next = { ...cur }; if (v) next[key] = true; else delete next[key]; return next; });
  return (
    <Dialog open title="Marges" onClose={x.close} onConfirm={apply} width={256} actions={actions}>
      <div className="fo-oo-dlgtabs__grid">{field('top', 'Haut')}{field('bottom', 'Bas')}{field('left', 'Gauche')}{field('right', 'Droite')}</div>
      <fieldset className="fo-oo-stack">
        <legend>Centrer sur la page</legend>
        <Checkbox checked={!!d.verticalCentered} onChange={(v) => flag('verticalCentered', v)} label="Verticalement" />
        <Checkbox checked={!!d.horizontalCentered} onChange={(v) => flag('horizontalCentered', v)} label="Horizontalement" />
      </fieldset>
    </Dialog>
  );
}

export function OoHeaderFooterDialog({ x }: { x: DialogEnv }) {
  const { d, setD, apply, actions } = useWorkingCopy(x);
  const hf: HeaderFooter = d.headerFooter ?? {};
  const [which, setWhich] = useState<Which>('odd');
  const put = (patch: Partial<HeaderFooter>): void => {
    const next = { ...hf, ...patch };
    for (const k of Object.keys(next) as (keyof HeaderFooter)[]) if (next[k] === undefined || next[k] === '') delete next[k];
    setD((cur) => { const out = { ...cur }; if (Object.keys(next).length) out.headerFooter = next; else delete out.headerFooter; return out; });
  };
  const variants: Which[] = hf.differentOddEven || hf.differentFirst ? [...(hf.differentFirst ? (['first'] as const) : []), ...(hf.differentOddEven ? (['odd', 'even'] as const) : (['odd'] as const))] : ['odd'];
  const current = variants.includes(which) ? which : variants[0]!;
  const names: Record<Which, string> = { odd: variants.length === 1 ? 'Toutes les pages' : 'Pages impaires', even: 'Pages paires', first: 'Première page' };
  const section = (kind: 'Header' | 'Footer') => {
    const raw = hf[keyOf(kind, current)] ?? '';
    const preset = HF_PRESETS.find((p) => p.raw === raw);
    return (
      <div className="fo-oo-hf">
        <h4>{kind === 'Header' ? 'En-tête' : 'Pied de page'}</h4>
        <select className="fo-word-select" aria-label="Préréglages" value={preset ? preset.id : 'custom'} onChange={(e) => { const p = HF_PRESETS.find((k) => k.id === e.target.value); if (p) put({ [keyOf(kind, current)]: p.raw }); }}>
          <option value="custom">Préréglages</option>
          {HF_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.raw ? hfPlain(p.raw, SAMPLE) : p.label}</option>)}
        </select>
        <ZoneEditor value={raw} onChange={(r) => put({ [keyOf(kind, current)]: r })} />
      </div>
    );
  };
  return (
    <Dialog open title="Paramètres de l’en-tête/pied de page" onClose={x.close} onConfirm={apply} width={640} actions={actions}>
      <div className="fo-oo-hfopts">
        <Checkbox checked={!!hf.differentFirst} onChange={(v) => put({ differentFirst: v || undefined })} label={PS.differentFirst} />
        <Checkbox checked={hf.scaleWithDoc !== false} onChange={(v) => put({ scaleWithDoc: v ? undefined : false })} label="Mettre à l’échelle du document" />
        <Checkbox checked={!!hf.differentOddEven} onChange={(v) => put({ differentOddEven: v || undefined })} label={PS.differentOddEven} />
        <Checkbox checked={hf.alignWithMargins !== false} onChange={(v) => put({ alignWithMargins: v ? undefined : false })} label="Aligner sur les marges de page" />
      </div>
      <div className="fo-oo-hftabs" role="tablist">
        {variants.map((v) => <button key={v} type="button" role="tab" aria-selected={current === v} onClick={() => setWhich(v)}>{names[v]}</button>)}
      </div>
      {section('Header')}
      {section('Footer')}
    </Dialog>
  );
}
