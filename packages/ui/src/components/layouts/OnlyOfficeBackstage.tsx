// Pages « Infos » et « Parametres avances » de la vue Fichier du profil OnlyOffice, communes aux modules : memes sections et libelles que l'application
// reelle (docs/captures/onlyoffice-ref/10.0/fichier-*.png). Chaque module fournit ses sections ; ce qui n'existe pas chez nous reste grise avec son infobulle.
import type { ReactNode } from 'react';
import type { Settings } from '@forgeoffice/core';
import { getOoTheme, setOoTheme, OO_THEMES } from '../../layoutHooks.ts';
import { S } from '../../strings.ts';
import { BackstageHeading } from '../Backstage.tsx';
import { Button, TextField } from '../Controls.tsx';
import { usePersistentState } from '../../hooks.ts';

const NA = 'Pas encore disponible dans ForgeOffice';

export { isOnlyOffice } from '../../logic/ooMode.ts';

export function OoBsSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="fo-oo-bs__sec"><h2>{title}</h2>{children}</section>;
}

export function OoBsOpt({ label, checked, onChange }: { label: string; checked: boolean; onChange?: (v: boolean) => void }) {
  return (
    <label className="fo-oo-bs__opt" title={onChange ? undefined : NA}>
      <input type="checkbox" checked={checked} disabled={!onChange} onChange={(e) => onChange?.(e.target.checked)} />{label}
    </label>
  );
}

export function OoBsLine({ label, children }: { label: string; children: ReactNode }) {
  return <div className="fo-oo-bs__line"><span>{label}</span><span>{children}</span></div>;
}

// ------------------------------------------------------------------------------------------------ Infos

export interface OoInfoProps {
  /** « Infos sur le document » / « ... la présentation » / « ... le classeur ». */
  heading: string;
  /** Libelle du titre dans les proprietes (« Titre du document », « Titre du classeur », « Titre »). */
  titleLabel: string;
  /** « Sujet » (Texte, Tableur) ou « Objet » (Presentation). */
  subjectLabel?: string;
  common: readonly (readonly [string, ReactNode])[];
  /** Section « Statistiques » (Texte seulement). */
  stats?: readonly (readonly [string, ReactNode])[];
  props: { creator?: string; title?: string; keywords?: string; subject?: string; description?: string };
  set: (key: 'creator' | 'title' | 'keywords' | 'subject' | 'description', value: string) => void;
}

export function OoInfoView({ heading, titleLabel, subjectLabel = 'Sujet', common, stats, props, set }: OoInfoProps) {
  const L = (k: string, v: ReactNode) => <OoBsLine key={k} label={k}>{v}</OoBsLine>;
  return (
    <div className="fo-oo-bs">
      <BackstageHeading>{heading}</BackstageHeading>
      <OoBsSection title="Communs">{common.map(([k, v]) => L(k, v))}</OoBsSection>
      {stats && <OoBsSection title="Statistiques">{stats.map(([k, v]) => L(k, v))}</OoBsSection>}
      <OoBsSection title="Propriétés">
        <div className="fo-oo-bs__fields">
          <TextField label="Auteur" placeholder="Ajouter un auteur" value={props.creator ?? ''} onChange={(e) => set('creator', e.target.value)} />
          <TextField label={titleLabel} placeholder="Ajouter du texte" value={props.title ?? ''} onChange={(e) => set('title', e.target.value)} />
          <TextField label="Tags" placeholder="Ajouter du texte" value={props.keywords ?? ''} onChange={(e) => set('keywords', e.target.value)} />
          <TextField label={subjectLabel} placeholder="Ajouter du texte" value={props.subject ?? ''} onChange={(e) => set('subject', e.target.value)} />
          <TextField label="Commentaires" placeholder="Ajouter du texte" value={props.description ?? ''} onChange={(e) => set('description', e.target.value)} />
        </div>
      </OoBsSection>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ Parametres avances

/** Un reglage : case, liste (grisee sans `set`), bouton (grise sans `run`) ou valeur. */
export type OoAdvItem =
  | { k: 'opt'; t: string; on?: boolean; set?: (v: boolean) => void }
  | { k: 'sel'; t: string; v: string; opts?: readonly string[]; set?: (v: string) => void }
  | { k: 'btn'; t: string; run?: () => void }
  | { k: 'num'; t: string; v: string }
  | { k: 'note'; t: string };

export interface OoAdvSection {
  t: string;
  items: readonly OoAdvItem[];
  /** Section « Apparence » : la liste du theme d'interface (8 themes reels) est branchee en tete. */
  theme?: boolean;
}

function Item({ i }: { i: OoAdvItem }) {
  switch (i.k) {
    case 'opt': return <OoBsOpt label={i.t} checked={i.on ?? false} onChange={i.set} />;
    case 'sel': return (
      <label className="fo-oo-bs__line">
        <span>{i.t}</span>
        <select value={i.v} disabled={!i.set} title={i.set ? undefined : NA} aria-label={i.t} onChange={(e) => i.set?.(e.target.value)}>
          {(i.opts ?? [i.v]).map((o) => <option key={o}>{o}</option>)}
        </select>
      </label>
    );
    case 'btn': return <div className="fo-oo-bs__line"><Button disabled={!i.run} title={i.run ? undefined : NA} onClick={i.run}>{i.t}</Button></div>;
    case 'num': return <label className="fo-oo-bs__line"><span>{i.t}</span><input className="fo-oo-bs__num" value={i.v} disabled title={NA} readOnly /></label>;
    case 'note': return <p className="fo-oo-bs__note">{i.t}</p>;
  }
}

/** « Parametres avances » : sections d'OnlyOffice, puis nos options propres sous « Options de ForgeOffice ». Appliquer ferme la vue (reglages immediats). */
export function OoAdvancedView({ settings, sections, extra, close }: { settings: Settings; sections: readonly OoAdvSection[]; extra: ReactNode; close: () => void }) {
  const theme = getOoTheme(settings);
  const [userName, setUserName] = usePersistentState<string>(settings, 'user.name', '');
  return (
    <div className="fo-oo-bs">
      <BackstageHeading>Paramètres avancés</BackstageHeading>
      {sections.map((s) => (
        <OoBsSection key={s.t} title={s.t}>
          {s.theme && (
            <label className="fo-oo-bs__line">
              <span>Thème d'interface</span>
              <select value={theme} aria-label="Thème d'interface" onChange={(e) => setOoTheme(settings, e.target.value as (typeof OO_THEMES)[number])}>
                {OO_THEMES.map((t) => <option key={t} value={t}>{S.layouts.oo.theme[t]}</option>)}
              </select>
            </label>
          )}
          {s.items.map((i, n) => <Item key={n} i={i} />)}
        </OoBsSection>
      ))}
      <OoBsSection title="Options de ForgeOffice">
        <label className="fo-oo-bs__line">
          <span>Nom d'utilisateur (avatar)</span>
          <TextField value={userName} aria-label="Nom d'utilisateur" onChange={(e) => { setUserName(e.target.value); window.dispatchEvent(new Event('fo-user-name')); }} />
        </label>
        {extra}
      </OoBsSection>
      <div className="fo-oo-bs__apply"><Button appearance="primary" onClick={close}>Appliquer</Button></div>
    </div>
  );
}
