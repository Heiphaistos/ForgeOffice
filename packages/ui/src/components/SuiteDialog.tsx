// Pieces des boites de dialogue des dispositions LibreOffice / OpenOffice : onglets (liste a gauche / onglets en haut) et pied de boite
// (LibreOffice : « Aide » a gauche puis Reinitialiser, OK, Annuler a droite ; OpenOffice : OK, Annuler, Aide, Retablir).
import type { ReactNode } from 'react';
import type { DialogAction, DialogTab, SuiteDialogKind } from './Dialog.tsx';
import { S } from '../strings.ts';

export function SuiteTabs({ tabs, tab, setTab, kind, children }: { tabs: readonly DialogTab[]; tab: string; setTab: (id: string) => void; kind: SuiteDialogKind; children?: ReactNode }) {
  const current = tabs.find((t) => t.id === tab && !t.disabled) ?? tabs.find((t) => !t.disabled);
  return (
    <div className={`fo-sdlg fo-sdlg--${kind}`}>
      <div className="fo-sdlg__tabs" role="tablist" aria-orientation={kind === 'libreoffice' ? 'vertical' : 'horizontal'}>
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={t.id === current?.id} aria-disabled={t.disabled || undefined} disabled={t.disabled} title={t.disabled ? t.hint ?? S.suiteDialog.unavailable : undefined}
            className={`fo-sdlg__tab${t.id === current?.id ? ' is-on' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="fo-sdlg__page" role="tabpanel" aria-label={current?.label}>{current?.content}{children}</div>
    </div>
  );
}

export function SuiteFooter({ kind, list, start, onReset, onHelp }: { kind: SuiteDialogKind; list: readonly DialogAction[]; start?: ReactNode; onReset?: () => void; onHelp?: () => void }) {
  const D = S.suiteDialog;
  const help = <button key="help" type="button" className="fo-sbtn" disabled={!onHelp} onClick={onHelp} title={onHelp ? undefined : D.helpOff}>{D.help}</button>;
  const reset = onReset ? <button key="reset" type="button" className="fo-sbtn" onClick={onReset}>{kind === 'libreoffice' ? D.reset : D.restore}</button> : null;
  const buttons = list.map((a) => (
    <button key={a.label} type="button" className={`fo-sbtn${a.primary ? ' is-primary' : ''}`} disabled={a.disabled} onClick={a.onClick}>{a.label}</button>
  ));
  return (
    <div className="fo-dialog__footer fo-sfoot">
      {kind === 'libreoffice' ? (
        <>{help}<div className="fo-dialog__footer-start">{start}</div>{reset}{buttons}</>
      ) : (
        <><div className="fo-dialog__footer-start">{start}</div>{buttons}{help}{reset}</>
      )}
    </div>
  );
}
