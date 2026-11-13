// Formulaires des panneaux « Parametres » du profil OnlyOffice (image, forme, cellule, diapositive...) : chaque formulaire est decrit par
// une liste de champs (sections, libelles, unites d'apres l'application reelle) ; un champ est branche sur une commande du ruban retrouvee
// par identifiant (« onglet:id » ou « id »), et reste grise tant que la suite n'a pas la fonction.
import { useState, type ReactNode } from 'react';
import type { RibbonControl as AnyControl, RibbonTab, MenuItem, SeparatorControl, RowControl } from '../../ribbon-types.ts';

type RibbonControl = Exclude<AnyControl, SeparatorControl | RowControl>;
import type { IconName } from '../../icons/generated.ts';
import { Icon } from '../../icons/Icon.tsx';
import { Checkbox, NumberField } from '../Controls.tsx';
import { Menu } from '../Menu.tsx';
import { RibbonControlView } from '../ribbon/RibbonControls.tsx';
import type { ControlContext } from '../ribbon/RibbonControls.tsx';

const NA = 'Pas encore disponible dans ForgeOffice';

/** Un champ de formulaire. `b` = commande du ruban a brancher (absente ou introuvable : champ grise). */
export type OoField =
  | { k: 'h'; t: string }
  | { k: 'rule' }
  | { k: 'num'; t: string; b?: string; unit?: string; step?: number; min?: number; max?: number }
  | { k: 'text'; t: string; v?: string }
  | { k: 'btn'; t: string; b?: string; menu?: boolean }
  | { k: 'select'; t?: string; b?: string; v?: string }
  | { k: 'check'; t: string; b?: string }
  | { k: 'color'; t?: string; b?: string }
  | { k: 'icons'; t?: string; items: readonly { i: IconName; t: string; b?: string }[] }
  | { k: 'slider'; t?: string; b?: string }
  | { k: 'link'; t: string; b?: string }
  | { k: 'pair'; f: readonly OoField[] }
  | { k: 'custom'; b: string };

export interface OoFormSpec {
  /** Texte du titre du panneau (« Parametres de l'image »). */
  title: string;
  fields: readonly OoField[];
}

function flat(controls: readonly AnyControl[]): RibbonControl[] {
  return controls.flatMap((c) => (c.kind === 'row' ? flat(c.controls) : c.kind === 'separator' ? [] : [c]));
}

/** Commande par « onglet:id » (cherchee dans cet onglet) ou « id » (dans tous les onglets). */
export function resolve(tabs: readonly RibbonTab[], bind?: string): RibbonControl | undefined {
  if (!bind) return undefined;
  // « commande>entree » : une entree du menu d'une commande (ex. borders>all), vue comme un bouton.
  if (bind.includes('>')) {
    const [ctl = '', item = ''] = bind.split('>');
    const m = resolve(tabs, ctl);
    const it = m && (m.kind === 'menu' || m.kind === 'split') ? m.items.find((i) => i.id === item) : undefined;
    return it?.onClick ? { kind: 'button', id: `${ctl}>${item}`, label: it.label ?? item, onClick: it.onClick } : undefined;
  }
  const [tabId, id] = bind.includes(':') ? bind.split(':') : [undefined, bind];
  for (const t of tabs) {
    if (tabId && t.id !== tabId) continue;
    for (const g of t.groups) for (const c of flat(g.controls)) if (c.id === id) return c;
  }
  return undefined;
}

/** Libelle de la fonction manquante, en infobulle. */
const title = (c: RibbonControl | undefined): string | undefined => (c ? undefined : NA);

function Btn({ c, label, icon, menu }: { c?: RibbonControl; label?: string; icon?: IconName; menu?: boolean }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const items: readonly MenuItem[] | undefined = c && (c.kind === 'menu' || c.kind === 'split') ? c.items : undefined;
  const dis = !c || c.disabled === true;
  const run = (e: React.MouseEvent<HTMLButtonElement>): void => {
    if (!c) return;
    if (c.kind === 'button' || c.kind === 'split') { if (c.kind === 'split' && menu && items) setAnchor(e.currentTarget); else c.onClick(); }
    else if (c.kind === 'toggle') c.onToggle(!c.pressed);
    else if (c.kind === 'menu') setAnchor(e.currentTarget);
  };
  return (
    <>
      <button type="button" className={`fo-oo-ctl${icon && !label ? ' fo-oo-ctl--icon' : ''}`} disabled={dis} title={title(c) ?? label} aria-label={label ?? c?.label} aria-pressed={c?.kind === 'toggle' ? c.pressed : undefined} onClick={run}>
        {icon && <Icon name={icon} size={16} />}
        {label && <span>{label}</span>}
        {menu && <Icon name="chevron_down" size={12} />}
      </button>
      {anchor && items && <Menu items={items} anchor={anchor} placement="below" onClose={() => setAnchor(null)} label={label ?? c?.label ?? ''} />}
    </>
  );
}

function Num({ f, c }: { f: Extract<OoField, { k: 'num' }>; c?: RibbonControl }) {
  const n = c?.kind === 'number' ? c : undefined;
  return (
    <label className="fo-oo-pform__lab" title={title(n)}>
      <span>{f.t}</span>
      <NumberField value={n?.value ?? 0} step={f.step ?? n?.step ?? 1} min={f.min ?? n?.min} max={f.max ?? n?.max} unit={f.unit ?? n?.unit} label={f.t} width={86} disabled={!n || n.disabled === true} onChange={(v) => n?.onChange(v)} />
    </label>
  );
}

function Field({ f, tabs, ctx, advanced }: { f: OoField; tabs: readonly RibbonTab[]; ctx: ControlContext; advanced?: () => void }): ReactNode {
  switch (f.k) {
    case 'h': return <h3 className="fo-oo-form__title">{f.t}</h3>;
    case 'rule': return <hr className="fo-oo-pform__rule" />;
    case 'num': return <Num f={f} c={resolve(tabs, f.b)} />;
    case 'text': return <label className="fo-oo-pform__lab"><span>{f.t}</span>{f.v !== undefined && <span className="fo-oo-pform__val">{f.v}</span>}</label>;
    case 'btn': return <Btn c={resolve(tabs, f.b)} label={f.t} menu={f.menu} />;
    case 'select': {
      const c = resolve(tabs, f.b);
      const lab = f.t ? <span>{f.t}</span> : null;
      if (c && (c.kind === 'combo' || c.kind === 'font')) return <label className="fo-oo-pform__lab">{lab}<RibbonControlView control={c} mode="small" ctx={ctx} /></label>;
      const cur = c && (c.kind === 'menu' || c.kind === 'split') ? c.items.find((i) => i.checked)?.label : undefined;
      return <label className="fo-oo-pform__lab">{lab}<Btn c={c} label={cur ?? f.v ?? c?.label ?? ''} menu /></label>;
    }
    case 'check': {
      const c = resolve(tabs, f.b);
      const on = c?.kind === 'checkbox' ? c.checked : c?.kind === 'toggle' ? c.pressed : false;
      return <span title={title(c)}><Checkbox label={f.t} checked={on} disabled={!c || c.disabled === true} onChange={(v) => (c?.kind === 'checkbox' ? c.onChange(v) : c?.kind === 'toggle' ? c.onToggle(v) : c?.kind === 'button' && c.onClick())} /></span>;
    }
    case 'color': {
      const c = resolve(tabs, f.b);
      return <div className="fo-oo-pform__shade" title={title(c)}>{c ? <RibbonControlView control={c} mode="icon" ctx={ctx} /> : <span className="fo-oo-pform__chip" aria-hidden />}{f.t && <span>{f.t}</span>}</div>;
    }
    case 'icons':
      return (
        <div className="fo-oo-pform__icons">
          {f.t && <span>{f.t}</span>}
          <div className="fo-oo-pform__pair">{f.items.map((it) => <Btn key={it.t} c={resolve(tabs, it.b)} label={undefined} icon={it.i} />)}</div>
        </div>
      );
    case 'slider': {
      const c = resolve(tabs, f.b);
      return <div className="fo-oo-pform__slider" title={title(c)}><span>0</span><input type="range" min={0} max={100} disabled={!c} aria-label={f.t} /><span>100</span><NumberField value={100} unit="%" width={64} disabled label="Opacité" onChange={() => undefined} /></div>;
    }
    case 'link': {
      const c = resolve(tabs, f.b);
      const go = c && (c.kind === 'button' || c.kind === 'split') ? c.onClick : advanced;
      return <button type="button" className="fo-oo-pform__link" disabled={!go} title={go ? undefined : NA} onClick={go}>{f.t}</button>;
    }
    case 'pair': return <div className="fo-oo-pform__pair">{f.f.map((g, i) => <Field key={i} f={g} tabs={tabs} ctx={ctx} advanced={advanced} />)}</div>;
    case 'custom': {
      const c = resolve(tabs, f.b);
      return c?.kind === 'custom' ? <>{c.render()}</> : null;
    }
  }
}

/** Formulaire complet d'un panneau. */
export function OoForm({ spec, tabs, ctx, advanced }: { spec: OoFormSpec; tabs: readonly RibbonTab[]; ctx: ControlContext; advanced?: () => void }) {
  return <div className="fo-oo-pform">{spec.fields.map((f, i) => <Field key={i} f={f} tabs={tabs} ctx={ctx} advanced={advanced} />)}</div>;
}
