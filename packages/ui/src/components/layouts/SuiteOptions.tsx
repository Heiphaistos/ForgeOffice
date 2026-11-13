// Outils > Options (dispositions LibreOffice / OpenOffice) : arbre de pages a gauche comme la vraie suite ; seules les pages qui correspondent a un reglage de ForgeOffice sont actives.
import { useState } from 'react';
import type { AppId, Settings } from '@forgeoffice/core';
import { applyTheme, isThemeChoice, THEME_SETTING, type ThemeChoice } from '../../theme.ts';
import { S } from '../../strings.ts';
import { Dialog, type SuiteDialogKind } from '../Dialog.tsx';
import { DisplayOptions } from '../DisplayOptions.tsx';

interface Node { id: string; label: string; on?: boolean; children?: readonly Node[] }

const tree = (product: string): readonly Node[] => {
  const O = S.suiteOptions;
  return [
    { id: 'root', label: product, on: true, children: [
      { id: 'identity', label: O.identity }, { id: 'general', label: O.general }, { id: 'display', label: O.display, on: true }, { id: 'print', label: O.print }, { id: 'paths', label: O.paths }, { id: 'fonts', label: O.fonts },
      { id: 'security', label: O.security }, { id: 'appearance', label: O.appearance, on: true }, { id: 'access', label: O.access }, { id: 'advanced', label: O.advanced }, { id: 'update', label: O.update },
    ] },
    { id: 'load', label: O.load }, { id: 'lang', label: O.lang }, { id: 'writer', label: `${product} Writer` }, { id: 'web', label: `${product} Writer/Web` }, { id: 'base', label: `${product} Base` }, { id: 'charts', label: O.charts }, { id: 'net', label: O.net }, { id: 'locale', label: O.locale },
  ];
};

export function SuiteOptions({ settings, app, kind, onClose }: { settings: Settings | null | undefined; app?: AppId | null; kind: SuiteDialogKind; onClose: () => void }) {
  const O = S.suiteOptions;
  const product = kind === 'libreoffice' ? 'LibreOffice' : 'OpenOffice';
  const [page, setPage] = useState('display');
  const [theme, setTheme] = useState<ThemeChoice>(() => { const v = settings?.get<unknown>(THEME_SETTING, 'system'); return isThemeChoice(v) ? v : 'system'; });
  const pick = (t: ThemeChoice): void => { setTheme(t); settings?.set(THEME_SETTING, t); applyTheme(t); };
  const nodes = tree(product);
  const label = [...nodes, ...(nodes[0]?.children ?? [])].find((n) => n.id === page)?.label ?? '';
  const row = (n: Node, depth: number) => (
    <li key={n.id} role="treeitem" aria-selected={page === n.id} aria-disabled={!n.on || undefined}>
      <button type="button" className={`fo-sopt__node${page === n.id ? ' is-on' : ''}`} style={{ paddingLeft: 6 + depth * 18 }} disabled={!n.on} title={n.on ? undefined : O.na} onClick={() => setPage(n.id)}>
        {n.children ? '− ' : !n.on && depth === 0 ? '+ ' : ''}{n.label}
      </button>
      {n.children && <ul role="group">{n.children.map((k) => row(k, depth + 1))}</ul>}
    </li>
  );
  return (
    <Dialog open title={`${O.title} - ${product} - ${label}`} onClose={onClose} width={kind === 'libreoffice' ? 860 : 700} actions={[{ label: S.dialog.ok, primary: true, onClick: onClose }, { label: S.dialog.cancel, onClick: onClose }]}>
      <div className="fo-sopt">
        <ul role="tree" className="fo-sopt__tree" aria-label={O.title}>{nodes.map((n) => row(n, 0))}</ul>
        <div className="fo-sopt__page">
          {page === 'display' && settings && <DisplayOptions settings={settings} app={app ?? undefined} />}
          {page === 'appearance' && (
            <fieldset className="fo-sopt__theme">
              <legend>{O.theme}</legend>
              {(['system', 'light', 'dark', 'contrast'] as const).map((t) => (
                <label key={t} className="fo-sdlg__radio"><input type="radio" name="fo-sopt-theme" checked={theme === t} onChange={() => pick(t)} />{O.themes[t]}</label>
              ))}
              <p className="fo-sdlg__hint">{O.applied}</p>
            </fieldset>
          )}
        </div>
      </div>
    </Dialog>
  );
}
