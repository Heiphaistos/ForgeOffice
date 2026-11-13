// Commande de la suite imitee -> commandes ForgeOffice equivalentes (references « [onglet.]groupe.controle[#element] » du ruban ; la premiere trouvee gagne).
// Une commande absente d'ici peut encore etre liee par son libelle (bind.ts) ; sinon elle reste grisee avec une info-bulle honnete.
const BASE: Readonly<Record<string, readonly string[]>> = {
  // Presse-papiers / edition
  Cut: ['clipboard.cut'], Copy: ['clipboard.copy'], Paste: ['clipboard.paste'], PasteUnformatted: ['clipboard.paste#text', 'clipboard.paste#values'], PasteSpecial: ['clipboard.paste#special', 'clipboard.clipboard:launcher'],
  FormatPaintbrush: ['clipboard.painter'], ResetAttributes: ['font.clear'], SelectAll: ['editing.select#all', 'editing.select'], SearchDialog: ['editing.replace', 'editing.find'], DeleteRows: ['rowscols.delrow', 'cells.delete'], DeleteColumns: ['rowscols.delcol', 'cells.delete'],
  // Caracteres
  Bold: ['font.bold'], Italic: ['font.italic'], UnderlineSingle: ['font.underline#single', 'font.underline'], Underline: ['font.underline'], UnderlineDouble: ['font.underline#double'], Strikeout: ['font.strike'], SuperScript: ['font.sup'], SubScript: ['font.sub'],
  Shadowed: ['font.effects#shadow', 'font.shadow'], OutlineFont: ['font.effects#outline'], SmallCaps: ['font.effects#smallcaps'], Grow: ['font.grow'], Shrink: ['font.shrink'],
  ChangeCaseToUpper: ['font.case#upper'], ChangeCaseToLower: ['font.case#lower'], ChangeCaseToSentenceCase: ['font.case#sentence'], ChangeCaseToTitleCase: ['font.case#title'], ChangeCaseToToggleCase: ['font.case#toggle'],
  CharFontName: ['font.fontname', 'font.font'], FontHeight: ['font.fontsize', 'font.size'], FontColor: ['font.fontcolor', 'font.color'], Color: ['font.fontcolor', 'font.color'], BackColor: ['font.highlight', 'font.fill'], CharBackColor: ['font.highlight', 'font.fill'], BackgroundColor: ['font.fill', 'font.highlight'],
  FontDialog: ['font.font:launcher'], ParagraphDialog: ['paragraph.paragraph:launcher'], StyleApply: ['styles.styles'],
  // Paragraphe
  StartPara: ['paragraph.align-left', 'paragraph.alignLeft'], EndPara: ['paragraph.align-right', 'paragraph.alignRight'], SetOutline: ['paragraph.multilevel'], SetBorderStyle: ['font.borders'], NumberFormatDecimal: ['number.numfmt'], NumberFormatDate: ['number.numfmt'], FillColor: ['drawing.fill'], XLineColor: ['drawing.outline'], FillShadow: ['drawing.effects'], ObjectAlign: ['drawing.arrange'], ObjectPosition: ['drawing.arrange'], BasicShapes: ['illustrations.shapes', 'drawing.shapes', 'illus.shapes'], InsertDraw: ['illustrations.shapes'],
  CommonAlignLeft: ['paragraph.align-left', 'paragraph.alignLeft', 'align.left'], CommonAlignHorizontalCenter: ['paragraph.align-center', 'paragraph.alignCenter', 'align.center'], CommonAlignRight: ['paragraph.align-right', 'paragraph.alignRight', 'align.right'], CommonAlignJustified: ['paragraph.align-justify', 'paragraph.justify'],
  LeftPara: ['paragraph.align-left', 'paragraph.alignLeft', 'align.left'], CenterPara: ['paragraph.align-center', 'paragraph.alignCenter', 'align.center'], RightPara: ['paragraph.align-right', 'paragraph.alignRight', 'align.right'], JustifyPara: ['paragraph.align-justify', 'paragraph.justify'],
  CommonAlignTop: ['align.top'], CommonAlignVerticalCenter: ['align.middle'], CommonAlignBottom: ['align.bottom'], AlignTop: ['align.top'], AlignVCenter: ['align.middle'], AlignBottom: ['align.bottom'], AlignLeft: ['align.left'], AlignHorizontalCenter: ['align.center'], AlignRight: ['align.right'],
  DefaultBullet: ['paragraph.bullets'], DefaultNumbering: ['paragraph.numbering'], RemoveBullets: ['paragraph.bullets#none'], IncrementIndent: ['paragraph.indent', 'align.indInc'], DecrementIndent: ['paragraph.outdent', 'align.indDec'], IncrementLevel: ['paragraph.indent'], DecrementLevel: ['paragraph.outdent'],
  SpacePara1: ['paragraph.spacing#ls1'], SpacePara115: ['paragraph.spacing#ls1.15'], SpacePara15: ['paragraph.spacing#ls1.5'], SpacePara2: ['paragraph.spacing#ls2'], ParaspaceIncrease: ['paragraph.spacing#before'], ParaspaceDecrease: ['paragraph.spacing#after'],
  ControlCodes: ['paragraph.marks'], LineSpacing: ['paragraph.spacing', 'paragraph.lineSpacing'], Sort: ['paragraph.sort'], WrapText: ['align.wrap'], ToggleMergeCells: ['align.merge'], NumberFormatCurrency: ['number.currency'], NumberFormatPercent: ['number.percent'], NumberFormatThousands: ['number.comma'], NumberFormatIncDecimals: ['number.decInc'], NumberFormatDecDecimals: ['number.decDec'],
  AddBorder: ['font.borders'], Borders: ['font.borders', 'paragraph.borders'], FrameLineColor: ['borderpen.pencolor'], FormatCellDialog: ['number.number:launcher'],
  // Insertion
  InsertTable: ['tables.table'], InsertGraphic: ['illustrations.picture', 'illus.image', 'images.picture'], InsertObjectChart: ['illustrations.chart', 'charts.recommended'], InsertSymbol: ['symbols.symbol#more', 'symbols.symbol'], HyperlinkDialog: ['links.link'], InsertBookmark: ['links.bookmark'], InsertReferenceField: ['captions.crossref'], InsertAnnotation: ['comments.comment'],
  InsertPagebreak: ['pages.break'], InsertBreak: ['pagesetup.breaks'], InsertColumnBreak: ['pagesetup.breaks#column'], InsertFootnote: ['notes.footnote'], InsertEndnote: ['notes.endnote'], InsertField: ['text.field'], InsertFieldCtrl: ['text.field'], DrawText: ['text.textbox'], InsertCaptionDialog: ['captions.caption'], InsertMultiIndex: ['toc.toc'], InsertIndexesEntry: ['index.mark'],
  InsertPageHeader: ['hf.header'], InsertPageFooter: ['hf.footer'], PageNumberWizard: ['hf.pagenum'], InsertDateField: ['text.date'], InsertObjectStarMath: ['symbols.equation'], InsertAVMedia: ['media.video', 'media.audio'], InsertSlide: ['slides.newSlide', 'slides.slidesGroup'], InsertSection: ['pagesetup.columns'], InsertSparkline: ['spark.spline'],
  // Affichage
  Zoom: ['zoom.zoomdlg', 'zoom.zoom', 'zoom.zoomMenu'], ZoomPage: ['zoom.onepage', 'zoom.fit'], ZoomPageWidth: ['zoom.multipage', 'zoom.fit'], ZoomOptimal: ['zoom.fit'], Zoom50Percent: ['zoom.zoom#z50'], Zoom75Percent: ['zoom.zoom#z75'], Zoom100Percent: ['zoom.z100', 'zoom.zoom#z100'], Zoom150Percent: ['zoom.zoom#z150'], Zoom200Percent: ['zoom.zoom#z200'],
  Ruler: ['show.ruler'], GridVisible: ['show.grid', 'opts.gv'], PrintLayout: ['views.view-print', 'views.normal'], BrowseView: ['views.view-web'], DraftView: ['views.view-draft'], OutlineMode: ['views.view-outline', 'views.outline'], DiaMode: ['views.normal'], SlideSorterMode: ['views.sorter'], NotesMode: ['views.notesPage'], MasterSlideMode: ['masters.master'], HandoutMode: ['views.notesPage'],
  ShowFormulas: ['audit.show'], Navigator: ['show.nav'], FreezeCell: ['window.freeze'], ViewFormulaBar: ['show.fbar'], ColumnRowHeaders: ['show.heads'], PageBreakMode: ['views.break'], NormalViewMode: ['views.normal'], NewWindow: ['window.new'], ViewGridlines: ['show.grid'], ShowGrid: ['show.grid'],
  // Divers
  EditHyperlink: ['links.link'], GotoPage: ['editing.select#goto'], AcceptTrackedChanges: ['tracking.revpane'], ViewTrackChanges: ['tracking.markup'], ShowAnnotations: ['comments.showc'], OutlineBullet: ['paragraph.multilevel#define'], EditFootnote: ['notes.notes:launcher'], FootnoteDialog: ['notes.notes:launcher'], InsertFootnoteDialog: ['notes.notes:launcher'], HorizontalLine: ['shapes#line'], Line: ['shapes#line'], ArrowShapes: ['illustrations.shapes'], StarShapes: ['illustrations.shapes'], CalloutShapes: ['illustrations.shapes'], SymbolShapes: ['illustrations.shapes'], FlowChartShapes: ['illustrations.shapes'], ConnectorToolbox: ['illustrations.shapes'], InsertFrame: ['text.textbox'], InsertAuthoritiesEntry: ['citations.citation'], AuthoritiesEntryDialog: ['citations.citation'], IndexEntryDialog: ['index.mark'],
  // Revision
  TrackChanges: ['tracking.track'], AcceptAllTrackedChanges: ['changes.accept#all'], RejectAllTrackedChanges: ['changes.reject#all'], AcceptTrackedChange: ['changes.accept#one'], RejectTrackedChange: ['changes.reject#one'], NextTrackedChange: ['changes.nextch'], PreviousTrackedChange: ['changes.prevch'], CompareDocuments: ['compare.compare'], ShowTrackedChanges: ['tracking.markup'], ProtectTraceChangeMode: ['protect.restrict'],
  // Outils
  SpellingAndGrammarDialog: ['proofing.spelling', 'proofing.spell'], SpellOnline: ['proofing.spelling'], WordCountDialog: ['proofing.wordcount'], AccessibilityCheck: ['proofing.a11y'], SetLanguageAllTextMenu: ['language.lang'], SetLanguageSelectionMenu: ['language.lang'], Hyphenate: ['pagesetup.hyphen'], LineNumberingDialog: ['pagesetup.linenumbers#opts'], MailMergeWizard: ['start.recipients'], UpdateAll: ['captions.updatefields', 'toc.updatetoc'], UpdateFields: ['captions.updatefields'], UpdateAllIndexes: ['toc.updatetoc'], ProtectMenu: ['protect.restrict'],
  // Mise en page
  PageDialog: ['pagesetup.pagesetup:launcher', 'page.page:launcher'], FormatColumns: ['pagesetup.columns'], Watermark: ['background.watermark'], ThemeDialog: ['docformat.themes'], PageStyle: ['pagesetup.size'], Orientation: ['pagesetup.orientation', 'page.orient'], PageMargins: ['pagesetup.margins', 'page.margins'], PrintArea: ['page.area'],
  // Tableaux (Writer et Calc)
  InsertRowsBefore: ['rowscols.above', 'cells.insert'], InsertRowsAfter: ['rowscols.below', 'cells.insert'], InsertColumnsBefore: ['rowscols.left', 'cells.insert'], InsertColumnsAfter: ['rowscols.right', 'cells.insert'], DeleteTable: ['table.delete'], EntireRow: ['tableSel.select#sr'], EntireColumn: ['tableSel.select#sk'], EntireCell: ['tableSel.select#sc'], SelectTable: ['tableSel.select#st'],
  MergeCells: ['merge.merge'], SplitCell: ['merge.split'], SplitTable: ['tableOps.splittable'], TableSort: ['data.sort'], SortDialog: ['sort.sort', 'data.sort'], ConvertTableToText: ['tableOps.totext'], TableDialog: ['tableSel.props'], HeadingRowsRepeat: ['data.repeat'], DistributeRows: ['cellSize.eqrows'], DistributeColumns: ['cellSize.eqcols'], SetOptimalRowHeight: ['cellSize.autofit#fc'], SetOptimalColumnWidth: ['cellSize.autofit#fc'], AutoFormat: ['styles.tstyle'],
  // Styles
  Heading1ParaStyle: ['styles.styles#Heading1'], Heading2ParaStyle: ['styles.styles#Heading2'], Heading3ParaStyle: ['styles.styles#Heading3'], TitleParaStyle: ['styles.styles#Title'], SubtitleParaStyle: ['styles.styles#Subtitle'], TextBodyParaStyle: ['styles.styles#Normal'], QuoteParaStyle: ['styles.styles#Quote'], EmphasisCharStyle: ['styles.styles#Emphasis'], StrongEmphasisCharStyle: ['styles.styles#Strong'], DefaultCharStyle: ['styles.styles#clear'], DesignerDialog: ['styles.styles#pane', 'styles.styles:launcher'], StyleNewByExample: ['styles.styles#create'], ViewSidebarStyles: ['styles.styles#pane'],
  // Objets
  WrapOff: ['arrange.wrap#inline'], WrapOn: ['arrange.wrap#square'], WrapIdeal: ['arrange.wrap#tight'], WrapThrough: ['arrange.wrap#front'], WrapThroughTransparencyToggle: ['arrange.wrap#behind'], TextWrap: ['arrange.wrap'], RotateLeft: ['arrange.rotateleft'], RotateRight: ['arrange.rotate'], FlipHorizontal: ['arrange.fliph'], FlipVertical: ['arrange.flipv'],
  BringToFront: ['arrange.front'], SendToBack: ['arrange.back'], ObjectForwardOne: ['arrange.front'], ObjectBackOne: ['arrange.back'], ObjectTitleDescription: ['styles.alt'], FormatLine: ['style.outline'], FormatArea: ['style.fill'], TransformDialog: ['size.w'], FormatGroup: ['arrange.group'],
  // Calc : donnees, feuille, formules
  AutoSum: ['editing.autosum'], DataSort: ['sort.sort'], SortAscending: ['sort.asc'], SortDescending: ['sort.desc'], DataFilterAutoFilter: ['sort.filter', 'filters.filter'], DataFilterStandardFilter: ['sort.adv'], DataFilterRemoveFilter: ['sort.clear'], DataFilterSpecialFilter: ['sort.adv'], Consolidate: ['tools.consolidate'], Validation: ['tools.val'], DataSubTotals: ['outline.sub'], Group: ['outline.group'], Ungroup: ['outline.ungroup'], ShowDetail: ['outline.show'], HideDetail: ['outline.hide'],
  InsertFunction: ['lib.insfn'], FunctionDialog: ['lib.insfn'], DefineName: ['names.def'], AddName: ['names.def'], DeleteContents: ['editing.clear'], DeleteCell: ['cells.delete'], InsertCell: ['cells.insert'], InsertRows: ['cells.insert'], InsertColumns: ['cells.insert'], FormatCellStyle: ['styles.cellStyles'], ConditionalFormatMenu: ['styles.cf'], CalculateHard: ['calc.now'], Calculate: ['calc.now'], AutomaticCalculation: ['calc.opts'], DataPilotMenu: ['tables.pivot'], DataPilotTable: ['tables.pivot'], ProtectSheet: ['protect.ps'], InsertNote: ['notes.note'], DeleteNote: ['notes.delnote'], ShowAllNotes: ['notes.allnotes'], DefinePrintArea: ['page.area'], InsertPageBreak: ['page.breaks'], TextToColumns: ['tools.ttc'], RefreshAll: ['queries.refresh'], Scenarios: ['forecast.whatif'], DuplicateRemove: ['tools.dup'],
  // Impress / Draw
  PresentationCurrent: ['start.fromCurrent'], Presentation: ['start.fromStart'], PresentationDialog: ['setup.showSetup'], HideSlide: ['setup.hide'], SlideSetup: ['customize.size'], PageSetup: ['customize.size'], ThemeGallery: ['themes.themeGallery'], DrawingSlideTransition: ['gallery.transitions'], SlideTransitionDialog: ['gallery.transitions'], CustomAnimation: ['advanced.pane'], CustomShowDialog: ['start.customShow'], RehearseTimings: ['timing.rehearse'], ShowRuler: ['show.ruler'], SnapLines: ['show.guides'], GridUse: ['show.snap'], EditMaster: ['masters.master'], InsertPageNumberField: ['text.number'], HeaderAndFooter: ['text.hf'], InsertTextBox: ['text.textbox'], Presenter: ['start.presenter'],
};

// Complements (2e passe, propositions par libelle verifiees une a une) : s'ajoutent aux references ci-dessus.
const EXTRA: Readonly<Record<string, readonly string[]>> = {
  // Texte
  QuoteCharStyle: ['styles.styles#Quote'], MultiplePagesPerRow: ['zoom.multipage'], SinglePagePerRow: ['zoom.onepage'], NumberingStart: ['paragraph.numbering#restart'], Sidebar: ['show.nav'], FieldDialog: ['text.field'], SetObjectToForeground: ['arrange.front'], SetObjectToBackground: ['arrange.back'],
  InsertNonBreakingSpace: ['symbols.symbol#sym-nbsp'], InsertNarrowNobreakSpace: ['symbols.symbol#sym-nnbsp'], InsertSoftHyphen: ['symbols.symbol#sym-softhy'], InsertHardHyphen: ['symbols.symbol#sym-hardhy'],
  InsertZWSP: ['symbols.symbol#sym-zwsp'], InsertWJ: ['symbols.symbol#sym-wj'], InsertLRM: ['symbols.symbol#sym-lrm'], InsertRLM: ['symbols.symbol#sym-rlm'], InsertLinebreak: ['symbols.symbol#sp-br'],
  CommonAlignStart: ['paragraph.align-left'], CommonAlignEnd: ['paragraph.align-right'], TitlePageDialog: ['pages.cover'], UpdateAllLinks: ['captions.updatefields'], UpdateSelectedField: ['captions.updatefields'],
  // Tableur
  PasteTransposed: ['clipboard.paste#transpose'], SelectData: ['data.selectData'], ViewRowColumnHeaders: ['opts.hv'], FreezePanesColumn: ['window.freeze#col'], MergeCells: ['align.merge#merge'], DrawText: ['shapes#textbox'],
  Heading1CellStyles: ['cellStyles#heading1'], Heading2CellStyles: ['cellStyles#heading2'], NeutralCellStyles: ['cellStyles#neutral'], WarningCellStyles: ['cellStyles#warning'], NoteCellStyles: ['cellStyles#note'],
  Insert: ['cells.insert#sheet'], Add: ['cells.insert#sheet'], Delete: ['editing.clear#cnt'], RenameTable: ['format#ren'], Hide: ['format#hs'], GoalSeekDialog: ['whatif#goal'], ClearArrowPrecedents: ['audit.rm#prec'], ClearArrowDependents: ['audit.rm#dep'],
  // Presentation / dessin / publication
  Zoom50Percent: ['zoomMenu#50'], Zoom75Percent: ['zoomMenu#75'], Zoom100Percent: ['zoomMenu#100'], Zoom150Percent: ['zoomMenu#150'], Zoom200Percent: ['zoomMenu#200'],
  FormatGroup: ['arrange#group', 'arrange.group#g'], FormatUngroup: ['arrange#ungroup', 'group#u'], DeleteColumns: ['rowsCols.delete#cols', 'rowsCols.delCol'],
  SelectAll: ['editing.selectAll'], Shadowed: ['effects#shadow'], FillShadow: ['effects#shadow'], DuplicatePage: ['page#dup'], StyleNewByExample: ['stylesMenu#new'], 'BasicShapes.rectangle': ['shapes#rect'], 'BasicShapes.ellipse': ['shapes#ellipse'],
};

// Complements (3e passe, extraits des menus reels non branches puis verifies contre le catalogue de chaque module).
const MORE: Readonly<Record<string, readonly string[]>> = {
  // Tableur : affichage, remplissage, lignes/colonnes, feuilles, donnees
  'vnd.sun.star.findbar:FocusToFindbar': ['editing.find#find', 'editing.find'], ToggleSheetGrid: ['show.grid'], PagebreakMode: ['views.break'], FreezePanes: ['window.freeze#panes'], FreezePanesRow: ['window.freeze#row'], FillDown: ['fillm#d'], FillRight: ['fillm#r'], FillUp: ['fillm#u'], FillLeft: ['fillm#l'], FillSeries: ['fillm#s'],
  RowHeight: ['format#rh'], SetOptimalRowHeight: ['format#ar'], ColumnWidth: ['format#cw'], SetOptimalColumnWidth: ['format#ac'], HideRow: ['format#hr'], ShowRow: ['format#sr'], HideColumn: ['format#hc'], ShowColumn: ['format#sc'],
  InsertRowBreak: ['page.breaks#ins'], InsertColumnBreak: ['page.breaks#ins'], DeleteRowbreak: ['page.breaks#rem'], DeleteColumnbreak: ['page.breaks#rem'], Remove: ['cells.delete#sheet'], Show: ['format#ss'], InsertName: ['names.def'], CreateNames: ['names.fromsel'],
  PageFormatDialog: ['page.page:launcher'], PrintRangesMenu: ['page.area'], ClearArrows: ['audit.rm'], ShowErrors: ['audit.errors#check'], ClearAutoFilter: ['sort.clear'], DataFilterHideAutoFilter: ['sort.filter'], HandleDuplicateRecords: ['tools.dup'], DataAreaRefresh: ['queries.refresh'],
  DataDataPilotRun: ['tables.pivot'], InsertPivotTable: ['tables.pivot'], AutoOutline: ['outline.group#auto'], ClearOutline: ['outline.ungroup'], InsertCalcTable: ['tables.table'], DefaultCellStyles: ['cellStyles#normal'], GoodCellStyles: ['cellStyles#good'], BadCellStyles: ['cellStyles#bad'],
  Accent1CellStyles: ['cellStyles#accent1'], Accent2CellStyles: ['cellStyles#accent2'], Accent3CellStyles: ['cellStyles#accent3'], DesignerDialog: ['styles.cellStyles'],
  // Presentation et dessin : masques, repères, ordre, texte
  SlideMasterPage: ['masters.master'], MasterPage: ['views.master'], HelplinesVisible: ['show.guides'], HelplinesUse: ['show.snapGuides', 'show.snap'], SnapFrame: ['show.snapObjects'], OutputQualityGrayscale: ['color.gray'], ModifyPage: ['customize.size'], SlideChangeWindow: ['gallery.transitions'],
  BottomPaneImpress: ['show.notes'], InsertSlideField: ['text.number'], InsertDateFieldFix: ['text.date'], InsertDateFieldVar: ['text.date'], InsertTimeFieldFix: ['text.date'], InsertTimeFieldVar: ['text.date'],
  SpacePara1: ['paragraph.lineSpacing#1', 'paragraph.spacing#1'], SpacePara15: ['paragraph.lineSpacing#1.5', 'paragraph.spacing#1.5'], SpacePara2: ['paragraph.lineSpacing#2', 'paragraph.spacing#2'],
  OutlineRight: ['paragraph.indent'], OutlineLeft: ['paragraph.outdent'], StartPara: ['paragraph.al-l'], LeftPara: ['paragraph.al-l'], CenterPara: ['paragraph.al-ctr'], EndPara: ['paragraph.al-r'], RightPara: ['paragraph.al-r'], JustifyPara: ['paragraph.al-just'], DefaultNumbering: ['paragraph.numbers'],
  ...Object.fromEntries([20, 19, 0, 1, 32, 3, 12, 15, 14, 16, 18, 34, 28, 27, 29, 30].map((n) => [`AssignLayout?WhatLayout:long=${n}`, [`slidesGroup#lay-${n}`]])),
  Forward: ['arrange.front#f', 'arrange#forward'], Backward: ['arrange.back#b', 'arrange#backward'], InsertPage: ['pages.page'], Text: ['text.textbox', 'objects.textbox'],
};

// Complements (4e passe) : commandes ajoutees a ForgeOffice pour les dispositions LibreOffice / OpenOffice, ou liees a une commande existante d'un autre module.
const EVEN_MORE: Readonly<Record<string, readonly string[]>> = {
  Zoom50Percent: ['zoomPct#z50'], Zoom75Percent: ['zoomPct#z75'], Zoom150Percent: ['zoomPct#z150'], Zoom200Percent: ['zoomPct#z200'],
  ZoomPage: ['zoom.zsel'], ZoomPageWidth: ['zoom.zsel'], ZoomOptimal: ['zoom.zsel'],
  ResetAttributes: ['editing.clear#fmt'], ShowAnnotations: ['review.comments.pane'],
};

export const ALIASES: Readonly<Record<string, readonly string[]>> = (() => {
  const out: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(BASE)) out[k] = [...v];
  for (const [k, v] of Object.entries(EXTRA)) out[k] = [...(out[k] ?? []), ...v];
  for (const [k, v] of Object.entries(MORE)) out[k] = [...(out[k] ?? []), ...v];
  for (const [k, v] of Object.entries(EVEN_MORE)) out[k] = [...(out[k] ?? []), ...v];
  return out;
})();
