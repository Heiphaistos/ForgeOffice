// Backstage (onglet Fichier) : volet gauche aux couleurs de l'application, pages fournies par le module, briques de mise en page.
import { useRevealAction } from '../logic/ooReveal.ts';
import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from '../icons/Icon.tsx';
import type { IconName } from '../icons/generated.ts';
import { S } from '../strings.ts';
import './Backstage.css';

export interface BackstagePage {
  id: string;
  label: string;
  icon?: IconName;
  /** Contenu de la page. Absent = simple action (`onSelect`), comme « Enregistrer » ou « Fermer ». */
  render?: () => ReactNode;
  onSelect?: () => void;
  /** En bas du volet (Compte, Options). */
  position?: 'top' | 'bottom';
  separatorBefore?: boolean;
  disabled?: boolean;
}

export interface BackstageProps {
  open: boolean;
  /** Nom de l'application (lu par les lecteurs d'ecran). */
  appName: string;
  pages: readonly BackstagePage[];
  activePage: string;
  onPageChange: (id: string) => void;
  /** Retour au document (fleche, Echap). */
  onClose: () => void;
}

/** Identifiants conventionnels des pages Office (les modules peuvent en ajouter). */
export const BACKSTAGE_PAGES = {
  home: { id: 'home', label: S.backstage.home, icon: 'home' },
  new: { id: 'new', label: S.backstage.new, icon: 'document_add' },
  open: { id: 'open', label: S.backstage.open, icon: 'folder_open' },
  info: { id: 'info', label: S.backstage.info, icon: 'info', separatorBefore: true },
  save: { id: 'save', label: S.backstage.save, icon: 'save' },
  saveAs: { id: 'saveAs', label: S.backstage.saveAs, icon: 'save_copy' },
  print: { id: 'print', label: S.backstage.print, icon: 'print' },
  share: { id: 'share', label: S.backstage.share, icon: 'share' },
  export: { id: 'export', label: S.backstage.export, icon: 'arrow_export_ltr' },
  close: { id: 'close', label: S.backstage.close, icon: 'dismiss' },
  account: { id: 'account', label: S.backstage.account, icon: 'person', position: 'bottom' },
  options: { id: 'options', label: S.backstage.options, icon: 'settings', position: 'bottom' },
} as const satisfies Record<string, Omit<BackstagePage, 'render' | 'onSelect'>>;

/** Libelles de la vue Fichier d'OnlyOffice Desktop Editors (profil OnlyOffice). */
const OO_FILE_LABELS: Readonly<Record<string, string>> = {
  new: 'Nouveau document', open: 'Ouvrir', info: 'Info', save: 'Enregistrer', saveAs: 'Enregistrer sous', print: 'Imprimer', export: 'Exporter',
  close: 'Fermer', options: 'Paramètres avancés', account: 'Compte', share: 'Partager',
};

/** Libelle OnlyOffice d'une entree du Fichier ; certaines changent selon le module (Nouveau classeur / Nouvelle presentation, Infos). */
function ooLabel(id: string, fallback: string): string {
  const app = document.documentElement.dataset.app;
  if (id === 'new') return app === 'excel' ? 'Nouveau classeur' : app === 'powerpoint' ? 'Nouvelle présentation' : OO_FILE_LABELS.new ?? fallback;
  if (id === 'info' && (app === 'excel' || app === 'powerpoint')) return 'Infos';
  if (id === 'export' && app === 'excel') return 'Exporter dans le format PDF';
  return OO_FILE_LABELS[id] ?? fallback;
}

const OO_EXTRA_PAGES: readonly BackstagePage[] = [
  {
    id: 'oo-help', label: 'Aide', icon: 'info', position: 'bottom',
    render: () => (
      <>
        <BackstageHeading>Aide</BackstageHeading>
        <p>Touches utiles : Ctrl+S enregistrer, Ctrl+Z annuler, Ctrl+F rechercher, Alt+Q rechercher une commande, F10 info-touches, Ctrl+F1 replier le ruban.</p>
        <p>Le menu Fichier, Paramètres avancés, regroupe les réglages ; le thème de l'interface se choisit dans Affichage ou dans le menu Disposition de l'interface.</p>
      </>
    ),
  },
  {
    id: 'oo-about', label: 'À propos', icon: 'info', position: 'bottom',
    render: () => (
      <>
        <BackstageHeading>À propos</BackstageHeading>
        <p><strong>ForgeOffice</strong> {document.documentElement.dataset.foVersion ?? ''}</p>
        <p>{S.layouts.aboutText}</p>
      </>
    ),
  },
];

/** Vue Fichier d'OnlyOffice : ordre, groupes et sous-entrees des Desktop Editors (nos pages en plus sont gardees, avant « Fermer »). */
interface OoNavItem { id: string; label: string; icon?: IconName; sub?: boolean; target?: string; disabled?: boolean; sep?: boolean; title?: string }
function ooNav(pages: readonly BackstagePage[]): { top: OoNavItem[]; bottom: OoNavItem[] } {
  const has = (id: string): boolean => pages.some((p) => p.id === id);
  const item = (id: string): OoNavItem[] => {
    const p = pages.find((x) => x.id === id);
    return p ? [{ id, label: ooLabel(id, p.label), icon: p.icon, disabled: p.disabled }] : [];
  };
  const known = new Set(['new', 'open', 'save', 'saveAs', 'print', 'info', 'close', 'options', 'oo-help', 'oo-about', 'oo-protect', 'home', 'export', 'share', 'account']);
  const NA = 'Pas encore disponible dans ForgeOffice';
  const rest = pages.filter((p) => !known.has(p.id) && p.position !== 'bottom').flatMap((p) => item(p.id));
  const top: OoNavItem[] = [
    ...item('new'), ...(has('new') ? [{ id: 'oo-template', label: "Créer à partir d'un modèle", sub: true, target: 'new' }] : []),
    ...item('open'), ...(has('open') ? [{ id: 'oo-recent', label: 'Ouvrir récent', sub: true, target: 'open' }] : []),
    ...item('save').map((i) => ({ ...i, sep: true })), ...item('saveAs').map((i) => ({ ...i, icon: undefined, sub: true })), ...item('print'), ...(has('info') ? [{ id: 'oo-protect', label: 'Protéger', icon: 'shield_lock' as IconName, target: 'info' }] : []), ...item('export'), ...item('share'),
    ...item('info').map((i) => ({ ...i, sep: true })), { id: 'oo-reveal', label: "Ouvrir l'emplacement du fichier", icon: 'folder_open' as IconName },
    ...rest, ...item('home'), ...item('close').map((i) => ({ ...i, sep: true })),
  ];
  const bottom: OoNavItem[] = [
    ...item('options'), ...item('account'), ...item('oo-help'),
    { id: 'oo-feature', label: 'Proposer une fonctionnalité', icon: 'info' as IconName, disabled: true, title: NA }, ...item('oo-about'),
  ];
  return { top, bottom };
}

export function Backstage({ open, appName, pages, activePage, onPageChange, onClose }: BackstageProps) {
  const reveal = useRevealAction();
  const navRef = useRef<HTMLElement>(null);
  // Fenetre etroite : la barre des pages defile en largeur ; la molette (verticale) doit la faire defiler (sinon Imprimer reste hors d'atteinte).
  useEffect(() => {
    const nav = navRef.current;
    if (!open || !nav) return;
    const onWheel = (e: WheelEvent): void => {
      if (e.deltaX !== 0 || e.deltaY === 0 || nav.scrollWidth <= nav.clientWidth || nav.scrollHeight > nav.clientHeight + 1) return;
      nav.scrollLeft += e.deltaY;
      e.preventDefault();
    };
    nav.addEventListener('wheel', onWheel, { passive: false });
    return () => nav.removeEventListener('wheel', onWheel);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    navRef.current?.querySelector<HTMLElement>('[aria-current="page"], button')?.focus();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !document.querySelector('.fo-dialog, .fo-menu, .fo-popover')) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Profil OnlyOffice : l'onglet Fichier reste surligne (html[data-file-open]) et un clic sur un autre onglet du ruban ferme la vue Fichier.
  useEffect(() => {
    if (!open) return;
    document.documentElement.dataset.fileOpen = '1';
    const onDown = (e: PointerEvent): void => {
      const t = (e.target as Element | null)?.closest('.fo-ribbon__tab');
      if (t && !t.classList.contains('fo-ribbon__tab--file') && document.documentElement.dataset.layout === 'onlyoffice') onClose();
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => {
      delete document.documentElement.dataset.fileOpen;
      document.removeEventListener('pointerdown', onDown, true);
    };
  }, [open, onClose]);

  if (!open) return null;
  const oo = document.documentElement.dataset.layout === 'onlyoffice';
  // Profil OnlyOffice : « Aide » et « A propos » en bas du menu, comme les Desktop Editors.
  const all: readonly BackstagePage[] = oo ? [...pages, ...OO_EXTRA_PAGES] : pages;
  const page = all.find((p) => p.id === activePage && p.render) ?? all.find((p) => p.render);

  const navButton = (p: BackstagePage): ReactNode => (
    <div key={p.id}>
      {p.separatorBefore && <div className="fo-bs__sep" role="separator" />}
      <button
        type="button"
        className={`fo-bs__nav-item${p.id === page?.id ? ' is-active' : ''}`}
        aria-current={p.id === page?.id ? 'page' : undefined}
        disabled={p.disabled}
        onClick={() => {
          if (p.render) onPageChange(p.id);
          p.onSelect?.();
        }}
      >
        {p.icon && <Icon name={p.icon} size={20} filled={p.id === page?.id} />}
        <span>{oo ? ooLabel(p.id, p.label) : p.label}</span>
      </button>
    </div>
  );

  const ooButton = (i: OoNavItem): ReactNode => {
    const p = all.find((x) => x.id === i.id);
    const active = i.id === page?.id;
    return (
      <div key={i.id}>
        {i.sep && <div className="fo-bs__sep" role="separator" />}
        <button
          type="button"
          className={`fo-bs__nav-item${active ? ' is-active' : ''}${i.sub ? ' fo-bs__nav-item--sub' : ''}`}
          aria-current={active ? 'page' : undefined}
          disabled={i.disabled || (i.id === 'oo-reveal' && !reveal)}
          title={i.title}
          onClick={() => {
            if (i.id === 'oo-reveal') { reveal?.(); onClose(); return; }
            if (i.target) onPageChange(i.target);
            else if (p?.render) onPageChange(p.id);
            p?.onSelect?.();
          }}
        >
          {i.icon && <Icon name={i.icon} size={20} filled={active} />}
          <span>{i.label}</span>
        </button>
      </div>
    );
  };
  const nav = oo ? ooNav(all) : null;

  return (
    <div className="fo-bs" role="dialog" aria-modal="true" aria-label={`${S.backstage.label} - ${appName}`}>
      <nav ref={navRef} className="fo-bs__nav" aria-label={S.backstage.label}>
        <button type="button" className="fo-bs__back" aria-label={S.backstage.back} title={S.backstage.back} onClick={onClose}>
          <Icon name="arrow_left" size={20} />
          {oo && <span className="fo-bs__back-label">Retour</span>}
        </button>
        <div className="fo-bs__nav-top">{nav ? nav.top.map(ooButton) : all.filter((p) => p.position !== 'bottom').map(navButton)}</div>
        <div className="fo-bs__nav-bottom">{nav ? nav.bottom.map(ooButton) : all.filter((p) => p.position === 'bottom').map(navButton)}</div>
      </nav>
      <main className="fo-bs__content fo-scroll">{page?.render?.()}</main>
    </div>
  );
}

/** Titre de page du Backstage (« Bonjour », « Nouveau », « Informations »...). */
export function BackstageHeading({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="fo-bs__heading">
      <h1>{children}</h1>
      {actions && <div className="fo-bs__heading-actions">{actions}</div>}
    </div>
  );
}

export function BackstageSection({ title, children, actions }: { title?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="fo-bs__section">
      {(title ?? actions) && (
        <div className="fo-bs__section-head">
          {title && <h2>{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

/** Vignette « Nouveau » : apercu de page + libelle. */
export function BackstageTile({ label, preview, onClick, description }: { label: string; preview: ReactNode; onClick: () => void; description?: string }) {
  return (
    <button type="button" className="fo-bs__tile" onClick={onClick} title={description ?? label}>
      <span className="fo-bs__tile-preview">{preview}</span>
      <span className="fo-bs__tile-label">{label}</span>
    </button>
  );
}

/** Grand bouton d'action avec texte explicatif (page Informations : Proteger, Inspecter...). */
export function BackstageAction({ icon, title, description, onClick, children }: { icon: IconName; title: string; description?: string; onClick?: () => void; children?: ReactNode }) {
  return (
    <div className="fo-bs__action">
      <button type="button" className="fo-bs__action-btn" onClick={onClick} disabled={!onClick}>
        <Icon name={icon} size={32} />
        <span>{title}</span>
      </button>
      <div className="fo-bs__action-text">
        <strong>{title}</strong>
        {description && <p>{description}</p>}
        {children}
      </div>
    </div>
  );
}
