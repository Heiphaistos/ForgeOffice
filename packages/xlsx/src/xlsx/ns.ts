// Espaces de noms, types de relations et types de contenu SpreadsheetML.

export const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
export const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
export const NS_MC = 'http://schemas.openxmlformats.org/markup-compatibility/2006';
export const NS_X14AC = 'http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac';
export const NS_X14 = 'http://schemas.microsoft.com/office/spreadsheetml/2009/9/main';
export const NS_XM = 'http://schemas.microsoft.com/office/excel/2006/main';
export const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
export const NS_XDR = 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing';
export const NS_C = 'http://schemas.openxmlformats.org/drawingml/2006/chart';
export const NS_TC = 'http://schemas.microsoft.com/office/spreadsheetml/2018/threadedcomments';

const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

export const REL_OFFICE_DOCUMENT = `${REL}/officeDocument`;
export const REL_WORKSHEET = `${REL}/worksheet`;
export const REL_CHARTSHEET = `${REL}/chartsheet`;
export const REL_STYLES = `${REL}/styles`;
export const REL_THEME = `${REL}/theme`;
export const REL_SHARED_STRINGS = `${REL}/sharedStrings`;
export const REL_CORE = 'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties';
export const REL_EXTENDED = `${REL}/extended-properties`;
export const REL_CUSTOM = `${REL}/custom-properties`;
export const REL_HYPERLINK = `${REL}/hyperlink`;
export const REL_COMMENTS = `${REL}/comments`;
export const REL_VML = `${REL}/vmlDrawing`;
export const REL_DRAWING = `${REL}/drawing`;
export const REL_IMAGE = `${REL}/image`;
export const REL_CHART = `${REL}/chart`;
export const REL_TABLE = `${REL}/table`;
export const REL_VBA = 'http://schemas.microsoft.com/office/2006/relationships/vbaProject';
export const REL_THREADED = 'http://schemas.microsoft.com/office/2017/10/relationships/threadedComment';
export const REL_PERSON = 'http://schemas.microsoft.com/office/2017/10/relationships/person';

const CT = 'application/vnd.openxmlformats-officedocument';

export const CT_WORKBOOK = `${CT}.spreadsheetml.sheet.main+xml`;
export const CT_WORKBOOK_MACRO = 'application/vnd.ms-excel.sheet.macroEnabled.main+xml';
export const CT_TEMPLATE = `${CT}.spreadsheetml.template.main+xml`;
export const CT_TEMPLATE_MACRO = 'application/vnd.ms-excel.template.macroEnabled.main+xml';
export const CT_WORKSHEET = `${CT}.spreadsheetml.worksheet+xml`;
export const CT_CHARTSHEET = `${CT}.spreadsheetml.chartsheet+xml`;
export const CT_STYLES = `${CT}.spreadsheetml.styles+xml`;
export const CT_THEME = `${CT}.theme+xml`;
export const CT_SST = `${CT}.spreadsheetml.sharedStrings+xml`;
export const CT_CORE = 'application/vnd.openxmlformats-package.core-properties+xml';
export const CT_EXTENDED = `${CT}.extended-properties+xml`;
export const CT_CUSTOM = `${CT}.custom-properties+xml`;
export const CT_COMMENTS = `${CT}.spreadsheetml.comments+xml`;
export const CT_VML = `${CT}.vmlDrawing`;
export const CT_DRAWING = `${CT}.drawing+xml`;
export const CT_CHART = `${CT}.drawingml.chart+xml`;
export const CT_TABLE = `${CT}.spreadsheetml.table+xml`;
export const CT_VBA = 'application/vnd.ms-office.vbaProject';
export const CT_THREADED = 'application/vnd.ms-excel.threadedcomments+xml';
export const CT_PERSON = 'application/vnd.ms-excel.person+xml';

/** Extension Excel 2010 des graphiques sparkline dans « extLst » d'une feuille. */
export const EXT_SPARKLINES = '{05C60535-1F16-4fd2-B633-F4F36F0B64E0}';
/** Extension Excel 2010 des mises en forme conditionnelles (barres de donnees etendues). */
export const EXT_CONDITIONAL = '{78C0D931-6437-407d-A8EE-F0AAD7539E65}';
/** Lien entre une regle classique et sa version etendue. */
export const EXT_CF_ID = '{B025F937-C7B1-47D3-B67F-A62EFF666E3E}';
