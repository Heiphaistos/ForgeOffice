// Aiguillage des boites de dialogue du module Texte.
import type { Ctl, DialogId } from '../app/types.ts';
import type { Env } from '../app/actions.ts';
import { BookmarkDialog, CrossRefDialog, DateDialog, EquationDialog, FieldDialog, FindDialog, FontDialog, LinkDialog, ParagraphDialog, SymbolDialog } from './text.tsx';
import {
  AltDialog, CaptionDialog, CitationDialog, GotoDialog, IndexDialog, InkDialog, PageBorderDialog, PageSetupDialog, PasteSpecialDialog, SortDialog,
  SpellingDialog, StatsDialog, StyleDialog, TableDialog, WatermarkDialog,
} from './page.tsx';

export interface WordDialogsProps {
  id: DialogId | null;
  c: Ctl;
  env: Env;
  onClose: () => void;
}

export function WordDialogs({ id, c, env, onClose }: WordDialogsProps) {
  const p = { c, onClose };
  switch (id) {
    case 'font': return <FontDialog {...p} />;
    case 'paragraph': return <ParagraphDialog {...p} />;
    case 'find': return <FindDialog {...p} />;
    case 'link': return <LinkDialog {...p} />;
    case 'bookmark': return <BookmarkDialog {...p} />;
    case 'crossref': return <CrossRefDialog {...p} />;
    case 'symbol': return <SymbolDialog {...p} />;
    case 'equation': return <EquationDialog {...p} />;
    case 'date': return <DateDialog {...p} />;
    case 'field': return <FieldDialog {...p} />;
    case 'table': return <TableDialog {...p} />;
    case 'watermark': return <WatermarkDialog {...p} />;
    case 'pageSetup': return <PageSetupDialog {...p} />;
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
    default: return null;
  }
}
