// Menu contextuel de la règle : Mise en page, Paragraphe, Tabulations, effacement des taquets, masquer la règle.
import type { MenuItem } from '@forgeoffice/ui';
import type { Ctl } from '../app/types.ts';
import { T } from '../strings.ts';
import { X } from '../strings-extra.ts';
import { setParagraph } from '../editor/commands.ts';

export function rulerMenu(c: Ctl): MenuItem[] {
  const hasTabs = (c.sel.para.tabs ?? []).some((t) => t.align !== 'clear');
  return [
    { id: 'r-page', label: `${T.dialogs.pageSetup}…`, onClick: () => c.openDialog('pageSetup') },
    { id: 'r-para', label: `${T.dialogs.paragraph}…`, onClick: () => c.openDialog('paragraph') },
    { id: 'r-tabs', label: X.tabs.menu, onClick: () => c.openDialog('tabs') },
    { id: 'r-clear', label: X.ruler.clearTabs, disabled: !hasTabs, onClick: () => c.run(setParagraph({ props: (p) => ({ ...p, tabs: undefined }) })) },
    { id: 'r-sep', kind: 'separator' },
    { id: 'r-hide', label: X.ruler.hide, onClick: () => c.setUi({ ruler: false }) },
  ];
}
