// Aiguillage des boites de dialogue du module Texte.
import { suiteDialogKind } from '@forgeoffice/ui';
import { CharacterSuiteDialog } from './suite-char.tsx';
import { ParagraphSuiteDialog } from './suite-para.tsx';
import { SpellSuiteDialog } from './suite-spell.tsx';
import { FindSuiteDialog, PageSuiteDialog, TableSuiteDialog } from './suite-page.tsx';
import type { Ctl, DialogId } from '../app/types.ts';
import type { Env } from '../app/actions.ts';
import { BookmarkDialog, CrossRefDialog, DateDialog, EquationDialog, FieldDialog, FindDialog, FontDialog, LinkDialog, ParagraphDialog, SymbolDialog } from './text.tsx';
import {
  AltDialog, CaptionDialog, CitationDialog, IndexDialog, InkDialog, PageBorderDialog, PageSetupDialog, PasteSpecialDialog, SortDialog,
  StatsDialog, StyleDialog, TableDialog, WatermarkDialog,
} from './page.tsx';

import { OoLinkDialog, OoParagraphDialog, OoTableDialog, isOnlyOffice } from './onlyoffice.tsx';
import { TablePropsDialog } from '../tables/PropsDialog.tsx';
import { OoPageDialog } from './onlyofficePage.tsx';
import { OoTablePropsDialog } from './onlyofficeTable.tsx';
import { TrackOptionsDialog } from '../review/TrackOptionsDialog.tsx';
import { ProtectDialog } from '../proofing/ProtectDialog.tsx';
import { ListDefineDialog } from '../format/ListDefineDialog.tsx';
import { NotesFormatDialog } from '../references/NotesFormatDialog.tsx';
import { ShapeTextDialog } from '../objects/ShapeTextDialog.tsx';
import { LineNumbersDialog } from '../format/LineNumbersDialog.tsx';
import { BordersDialog } from '../format/BordersDialog.tsx';
import { SpellingDialog } from '../proofing/SpellingDialog.tsx';
import { StyleEditDialog } from '../styles/StyleEditDialog.tsx';
import { TocDialog } from '../references/TocDialog.tsx';
import { GotoDialog } from '../navigation/GotoDialog.tsx';
import { TabsDialog } from '../format/TabsDialog.tsx';
import { ZoomDialog } from '../view/ZoomDialog.tsx';
import { OoSearchPanel } from './OoSearchPanel.tsx';
import { ConvertTextDialog } from '../tables/ConvertDialog.tsx';

export interface WordDialogsProps {
  id: DialogId | null;
  c: Ctl;
  env: Env;
  onClose: () => void;
}

export function WordDialogs({ id, c, env, onClose }: WordDialogsProps) {
  const p = { c, onClose };
  if (suiteDialogKind()) {
    // LibreOffice / OpenOffice : memes boites que la vraie suite (les autres tombent sur la version commune, habillee par le CSS)
    switch (id) {
      case 'font': return <CharacterSuiteDialog {...p} />;
      case 'paragraph': return <ParagraphSuiteDialog {...p} />;
      case 'pageSetup': return <PageSuiteDialog {...p} />;
      case 'table': return <TableSuiteDialog {...p} />;
      case 'find': return <FindSuiteDialog {...p} />;
      case 'spelling': return <SpellSuiteDialog {...p} />;
      default: break;
    }
  }
  switch (id) {
    case 'font': return <FontDialog {...p} />;
    case 'paragraph': return isOnlyOffice() ? <OoParagraphDialog {...p} /> : <ParagraphDialog {...p} />;
    // Panneau lateral sur ordinateur ; sur petit ecran (telephone) la boite modale d'origine, sans colonne qui recouvre le document.
    case 'find': return isOnlyOffice() && !window.matchMedia('(max-width: 700px)').matches ? <OoSearchPanel {...p} /> : <FindDialog {...p} />;
    case 'link': return isOnlyOffice() ? <OoLinkDialog {...p} /> : <LinkDialog {...p} />;
    case 'bookmark': return <BookmarkDialog {...p} />;
    case 'crossref': return <CrossRefDialog {...p} />;
    case 'symbol': return <SymbolDialog {...p} />;
    case 'equation': return <EquationDialog {...p} />;
    case 'date': return <DateDialog {...p} />;
    case 'field': return <FieldDialog {...p} />;
    case 'table': return isOnlyOffice() ? <OoTableDialog {...p} /> : <TableDialog {...p} />;
    case 'watermark': return <WatermarkDialog {...p} />;
    case 'pageSetup': return isOnlyOffice() ? <OoPageDialog {...p} /> : <PageSetupDialog {...p} />;
    case 'pageSetupAll': return <PageSetupDialog {...p} />;
    case 'stats': return <StatsDialog {...p} env={env} pageCount={c.pageCount} />;
    case 'caption': return <CaptionDialog {...p} />;
    case 'citation': return <CitationDialog {...p} />;
    case 'index': return <IndexDialog {...p} pageOfPos={env.pageOfPos} />;
    case 'style': return <StyleDialog {...p} />;
    case 'goto': return <GotoDialog {...p} pageCount={c.pageCount} />;
    case 'pasteSpecial': return <PasteSpecialDialog {...p} />;
    case 'alt': return <AltDialog {...p} />;
    case 'pageBorder': return <PageBorderDialog {...p} />;
    case 'sort': return <SortDialog {...p} />;
    case 'ink': return <InkDialog {...p} env={env} />;
    case 'spelling': return <SpellingDialog {...p} />;
    case 'trackOptions': return <TrackOptionsDialog {...p} />;
    case 'protect': return <ProtectDialog {...p} />;
    case 'listDefine': return <ListDefineDialog {...p} />;
    case 'notesFormat': return <NotesFormatDialog {...p} />;
    case 'shapeText': return <ShapeTextDialog {...p} />;
    case 'lineNumbers': return <LineNumbersDialog {...p} />;
    case 'borders': return <BordersDialog {...p} />;
    case 'styleEdit': return <StyleEditDialog {...p} />;
    case 'toc': return <TocDialog {...p} />;
    case 'zoom': return <ZoomDialog {...p} />;
    case 'tabs': return <TabsDialog {...p} />;
    case 'tableProps': return isOnlyOffice() ? <OoTablePropsDialog {...p} /> : <TablePropsDialog {...p} />;
    case 'textToTable': return <ConvertTextDialog {...p} />;
    default: return null;
  }
}
