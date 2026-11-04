// Backstage (onglet Fichier) : volet gauche aux couleurs de l'application, pages fournies par le module, briques de mise en page.
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

export function Backstage({ open, appName, pages, activePage, onPageChange, onClose }: BackstageProps) {
  const navRef = useRef<HTMLElement>(null);
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

  if (!open) return null;
  const page = pages.find((p) => p.id === activePage && p.render) ?? pages.find((p) => p.render);

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
        <span>{p.label}</span>
      </button>
    </div>
  );

  return (
    <div className="fo-bs" role="dialog" aria-modal="true" aria-label={`${S.backstage.label} - ${appName}`}>
      <nav ref={navRef} className="fo-bs__nav" aria-label={S.backstage.label}>
        <button type="button" className="fo-bs__back" aria-label={S.backstage.back} title={S.backstage.back} onClick={onClose}>
          <Icon name="arrow_left" size={20} />
        </button>
        <div className="fo-bs__nav-top">{pages.filter((p) => p.position !== 'bottom').map(navButton)}</div>
        <div className="fo-bs__nav-bottom">{pages.filter((p) => p.position === 'bottom').map(navButton)}</div>
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
