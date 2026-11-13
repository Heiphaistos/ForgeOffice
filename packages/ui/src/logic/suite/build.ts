// Menus et barres d'outils de la suite imitee, branches sur les commandes ForgeOffice.
import type { IconName } from '../../icons/generated.ts';
import type { MenuItem } from '../../ribbon-types.ts';
import type { Binder } from './bind.ts';
import type { Cmd } from './catalog.ts';
import type { SuiteBarItem, SuiteData, SuiteItem } from './types.ts';

export const NO_EQUIV = "Pas d'équivalent dans ForgeOffice";

/** Commandes de l'application hote (Fichier, Fenetre, Aide...) : identifiant de la suite -> action. */
export type HostCommands = Readonly<Record<string, () => void>>;

export interface SuiteMenu {
  id: string;
  label: string;
  mnemonic?: string;
  items: MenuItem[];
}

export interface SuiteBarEntry {
  key: string;
  sep?: boolean;
  uno: string;
  label: string;
  cmd: Cmd | null;
}

const tip = (label: string): string => `${label} — ${NO_EQUIV}`;

function toItems(list: readonly SuiteItem[], binder: Binder, path: string, product: string): MenuItem[] {
  const out: MenuItem[] = [];
  list.forEach((it, n) => {
    const id = `${path}/${n}`;
    if (it.sep) { out.push({ id, kind: 'separator' }); return; }
    if (!it.l) return;
    const l = it.l.replace('%PRODUCTNAME', product);
    if (it.i) {
      out.push({ id, label: l, mnemonic: it.k, icon: BAR_ICONS[it.u ?? ''], items: toItems(it.i, binder, id, product) });
      return;
    }
    const cmd = binder.find(it.u ?? '', l);
    const base: MenuItem = { id, label: l, mnemonic: it.k, shortcut: it.s, icon: BAR_ICONS[it.u ?? ''] };
    if (!cmd) { out.push({ ...base, disabled: true, tooltip: tip(l) }); return; }
    // Controle a elements (galerie, menu) sans action propre : ses elements deviennent le sous-menu.
    // Sauf entree a points de suspension (la vraie suite n'y montre pas de fleche) : elle ouvre le dernier element « ... » du menu.
    const dots = /(\.\.\.|…)$/;
    const more = dots.test(l) ? [...(cmd.items ?? [])].reverse().find((x) => x.onClick && dots.test(x.label ?? '')) : undefined;
    if (more?.onClick && cmd.control && cmd.control.kind !== 'split') { out.push({ ...base, icon: cmd.icon ?? base.icon, disabled: cmd.disabled || more.disabled, onClick: more.onClick }); return; }
    if (cmd.items && cmd.control && cmd.control.kind !== 'split') { out.push({ ...base, icon: cmd.icon ?? base.icon, items: cmd.items, disabled: cmd.disabled }); return; }
    out.push({ ...base, icon: cmd.icon ?? base.icon, checked: cmd.checked, disabled: cmd.disabled, onClick: cmd.run });
  });
  while (out.length > 0 && out[out.length - 1]?.kind === 'separator') out.pop();
  return out;
}

export function buildSuiteMenus(data: SuiteData, binder: Binder, product = 'LibreOffice'): SuiteMenu[] {
  return data.menu.filter((m) => m.l).map((m, n) => ({ id: `suite${n}:${m.u ?? n}`, label: m.l ?? '', mnemonic: m.k, items: toItems(m.i ?? [], binder, `m${n}`, product) }));
}

export function buildSuiteBars(data: SuiteData, binder: Binder): SuiteBarEntry[][] {
  return [...data.bars, ...(data.foot ? [data.foot] : []), ...(data.side ? [data.side] : [])].map((bar, b) => bar.map((it: SuiteBarItem, n): SuiteBarEntry => {
    const uno = it.u ?? '';
    return { key: `b${b}.${n}`, sep: Boolean(it.sep), uno, label: it.l ?? uno, cmd: it.sep ? null : binder.find(uno, it.l ?? '') };
  }));
}

/** Icone de repli (commande sans equivalent ou de l'hote) : un picto du jeu d'icones propre a ForgeOffice. */
export const BAR_ICONS: Readonly<Record<string, IconName>> = {
  AddDirect: 'document_add', Open: 'folder_open', OpenFromWriter: 'folder_open', OpenFromCalc: 'folder_open', OpenFromImpress: 'folder_open', OpenFromDraw: 'folder_open', Save: 'save', SaveAs: 'save_copy', ExportDirectToPDF: 'document_pdf', ExportToPDF: 'document_pdf', Print: 'document_print', PrintPreview: 'document_search', DirectPrint: 'document_print',
  Cut: 'cut', Copy: 'copy', Paste: 'clipboard_paste', FormatPaintbrush: 'paint_brush', ClearFormat: 'text_clear_formatting', ResetAttributes: 'text_clear_formatting', Undo: 'arrow_undo', Redo: 'arrow_redo', SearchDialog: 'search', FindAndReplace: 'search', SpellingAndGrammarDialog: 'text_proofing_tools', SpellDialog: 'text_proofing_tools', ControlCodes: 'text_paragraph',
  InsertTable: 'table_add', InsertGraphic: 'image', InsertObjectChart: 'data_bar_vertical', DrawText: 'textbox', InsertPagebreak: 'document_page_break', InsertField: 'text_field', InsertSymbol: 'symbols', HyperlinkDialog: 'link', InsertFootnote: 'note', InsertEndnote: 'note', InsertBookmark: 'bookmark', InsertReferenceField: 'link_multiple', InsertAnnotation: 'comment_add', TrackChanges: 'document_edit', Line: 'line', BasicShapes: 'shapes', ShowDrawing: 'draw_shape', ShowDraw: 'draw_shape',
  Bold: 'text_bold', Italic: 'text_italic', Underline: 'text_underline', UnderlineSingle: 'text_underline', Strikeout: 'text_strikethrough', SuperScript: 'text_superscript', SubScript: 'text_subscript', FontColor: 'text_color', BackColor: 'highlight', CharBackColor: 'highlight',
  LeftPara: 'text_align_left', CenterPara: 'text_align_center', RightPara: 'text_align_right', JustifyPara: 'text_align_justify', DefaultBullet: 'text_bullet_list_ltr', DefaultNumbering: 'text_number_list_ltr', OutlineBullet: 'text_bullet_list_tree', IncrementIndent: 'text_indent_increase_ltr', DecrementIndent: 'text_indent_decrease_ltr', LineSpacing: 'text_line_spacing', ParaspaceIncrease: 'text_expand', ParaspaceDecrease: 'text_collapse',
  CloseDoc: 'dismiss', Quit: 'sign_out', SetDocumentProperties: 'info', Signature: 'signature', ExportTo: 'arrow_export_ltr', ExportAsMenu: 'arrow_export_ltr', SendToMenu: 'send', AutoPilotMenu: 'sparkle', TemplateMenu: 'document_copy', CompareDocuments: 'document_multiple', Reload: 'arrow_sync', SelectAll: 'select_all_on', SaveAll: 'save', SaveACopy: 'save_copy', RecentFileList: 'history', AddDirectMenu: 'document_add', ChangesMenu: 'document_edit', EditCommentsMenu: 'comment', EditHyperlink: 'link', Repeat: 'arrow_repeat_all', Delete: 'delete', Find: 'search',
  CharmapControl: 'symbols', TrackChangesBar: 'document_edit', StyleUpdateByExample: 'paint_brush_arrow_down', StyleNewByExample: 'paint_brush_arrow_down', ParaLeftToRight: 'text_direction_rotate_90_ltr', ParaRightToLeft: 'text_direction_rotate_90_ltr', SendMail: 'mail', EditDoc: 'edit', PrintDefault: 'print', ViewDataSourceBrowser: 'database', HelpIndex: 'question_circle', ExtendedHelp: 'question_circle',
  RowOperations: 'table_insert_row', ColumnOperations: 'table_insert_column', DataDataPilotRun: 'table_lightning', EditHeaderAndFooter: 'document_header_footer', FreezePanes: 'table_freeze_column_and_row', SplitWindow: 'split_horizontal', InsertDraw: 'draw_shape', MergeCells: 'table_cells_merge', SplitCell: 'table_cells_split', LineStyle: 'line', FrameLineColor: 'color_line', TextdirectionLeftToRight: 'text_direction_rotate_90_ltr', TextdirectionTopToBottom: 'text_direction_vertical', SpellOnline: 'text_proofing_tools', DesignerDialog: 'paint_brush', AlignBlock: 'text_align_justify', NumberFormatStandard: 'number_symbol', DisplayMode: 'eye', SlideMasterPage: 'slide_layout', PresentationCurrentSlide: 'slide_play', FontworkGalleryFloater: 'text_effects',
  XLineStyle: 'line', 'BasicShapes.rectangle': 'rectangle_landscape', 'BasicShapes.ellipse': 'oval', ArrowsToolbox: 'arrow_up_right', LineToolbox: 'line', Objects3DToolbox: 'cube', ToggleObjectRotateMode: 'rotate_right', DistributeSelection: 'align_center_horizontal', GraphicFilterToolbox: 'image_edit', ToggleObjectBezierMode: 'draw_shape', GlueEditMode: 'pin', ExtrusionToggle: 'cube', FormatLine: 'color_line', LineEndStyle: 'arrow_right', LineWidth: 'line', FormatArea: 'paint_bucket', FillStyle: 'paint_bucket', GridVisible: 'grid', GridUse: 'grid_dots', HelplinesMove: 'ruler', Text: 'textbox', AdvancedMode: 'options', ObjectAlign: 'align_left', ObjectPosition: 'position_forward', FillShadow: 'square_multiple', XLineColor: 'color_line', FillColor: 'color_fill', ZoomToolBox: 'zoom_in',
  ZoomMode: 'zoom_in', Zoom: 'zoom_in', SelectObject: 'cursor', FullScreen: 'full_screen_maximize', Gallery: 'image_multiple', Navigator: 'navigation',
  // Dessin (Impress / Draw) : pictos ForgeOffice les plus proches (la suite imitee a les siens, non reproduits).
  InsertPage: 'slide_add', AssignLayout: 'slide_layout', PresentationLayout: 'slide_layout', Presentation: 'slide_play', InsertAVMedia: 'play', Crop: 'image_edit', Rect: 'rectangle_landscape', Ellipse: 'oval', VerticalText: 'text_direction_vertical', LineArrowEnd: 'arrow_up_right', ConnectorToolbox: 'arrow_routing', SymbolShapes: 'emoji', ArrowShapes: 'arrow_right', FlowChartShapes: 'flow', CalloutShapes: 'text_quote', StarShapes: 'star', AnimationEffects: 'play',
};
export const FALLBACK_ICON: IconName = 'square';
