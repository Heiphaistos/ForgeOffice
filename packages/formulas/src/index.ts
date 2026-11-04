// API publique du moteur de formules ForgeOffice.
import './functions/all.ts';

export * from './values.ts';
export * from './refs.ts';
export { STRINGS } from './strings.ts';
export {
  FormulaEngine,
  type CellChange,
  type ChangeListener,
  type EngineOptions,
  type TableInput,
} from './engine/workbook.ts';
export {
  removeSheetInFormula,
  renameSheetInFormula,
  shiftFormula,
  translateFormula,
  type StructuralShift,
} from './engine/adjust.ts';
export { evaluateFormula, type StandaloneOptions } from './standalone.ts';
export { MAX_FORMULA_LENGTH, parseFormula, stripEquals } from './parse/parser.ts';
export { FormulaParseError, tokenize, type Token } from './parse/lexer.ts';
export type { Node, RefNode, TableNode } from './parse/ast.ts';
export { printFormula } from './parse/printer.ts';
export { fromFileFormula, fromLocalized, toFileFormula, toLocalized } from './parse/localize.ts';
export { frenchFunctionNames, functionNameFromFr, functionNameToFr } from './parse/names-fr.ts';
export { errorToFr, syntaxFor, type FormulaLocale } from './parse/syntax.ts';
export {
  formatGeneral,
  formatValue,
  formatValueDetailed,
  numberToText,
  type FormatOptions,
  type FormatResult,
} from './format/render.ts';
export { parseInput, parseNumberText, type InputOptions, type ParsedInput } from './format/input.ts';
export { compileFormat, isDateFormat } from './format/numfmt.ts';
export { formatCodeFromLocale, formatCodeToLocale } from './format/codes.ts';
export { builtinFormat, localeData, type NumberLocale } from './format/locale.ts';
export { dateToSerial, jsDateToSerial, serialToDate, type DateSystem } from './format/dates.ts';
export { getFunction, listFunctions, type Category, type FnDef } from './functions/registry.ts';
