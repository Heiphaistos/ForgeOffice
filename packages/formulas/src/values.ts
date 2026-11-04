// Valeurs manipulees par le moteur de formules : nombre, texte, booleen, erreur, vide, matrice 2D.

export type ErrorCode =
  | '#NULL!'
  | '#DIV/0!'
  | '#VALUE!'
  | '#REF!'
  | '#NAME?'
  | '#NUM!'
  | '#N/A'
  | '#GETTING_DATA'
  | '#SPILL!'
  | '#CONNECT!'
  | '#BLOCKED!'
  | '#UNKNOWN!'
  | '#FIELD!'
  | '#CALC!'
  | '#BUSY!';

/** Numero renvoye par TYPE.ERREUR / ERROR.TYPE. */
export const ERROR_TYPE_NUMBER: Readonly<Record<ErrorCode, number>> = {
  '#NULL!': 1,
  '#DIV/0!': 2,
  '#VALUE!': 3,
  '#REF!': 4,
  '#NAME?': 5,
  '#NUM!': 6,
  '#N/A': 7,
  '#GETTING_DATA': 8,
  '#SPILL!': 9,
  '#CONNECT!': 10,
  '#BLOCKED!': 11,
  '#UNKNOWN!': 12,
  '#FIELD!': 13,
  '#CALC!': 14,
  '#BUSY!': 15,
};

export const ERROR_CODES = Object.keys(ERROR_TYPE_NUMBER) as ErrorCode[];

export class FormulaError {
  readonly code: ErrorCode;
  /** Precision facultative (ex. cause d'un #EPARS!), jamais affichee dans la cellule. */
  readonly detail: string | undefined;
  constructor(code: ErrorCode, detail?: string) {
    this.code = code;
    this.detail = detail;
  }
  toString(): string {
    return this.code;
  }
}

const singletons = new Map<ErrorCode, FormulaError>();
/** Erreur partagee (une instance par code). */
export function err(code: ErrorCode): FormulaError {
  let e = singletons.get(code);
  if (!e) {
    e = new FormulaError(code);
    singletons.set(code, e);
  }
  return e;
}

export const ERR = {
  NULL: err('#NULL!'),
  DIV0: err('#DIV/0!'),
  VALUE: err('#VALUE!'),
  REF: err('#REF!'),
  NAME: err('#NAME?'),
  NUM: err('#NUM!'),
  NA: err('#N/A'),
  SPILL: err('#SPILL!'),
  CALC: err('#CALC!'),
  FIELD: err('#FIELD!'),
  BLOCKED: err('#BLOCKED!'),
  CONNECT: err('#CONNECT!'),
  BUSY: err('#BUSY!'),
  UNKNOWN: err('#UNKNOWN!'),
  GETTING_DATA: err('#GETTING_DATA'),
} as const;

export function isErrorCode(s: string): s is ErrorCode {
  return Object.prototype.hasOwnProperty.call(ERROR_TYPE_NUMBER, s);
}

/** Valeur scalaire : `null` represente une cellule vide. */
export type Scalar = number | string | boolean | FormulaError | null;

/** Matrice 2D (stockage a plat, ligne par ligne). */
export class Matrix {
  readonly rows: number;
  readonly cols: number;
  readonly data: Scalar[];
  constructor(rows: number, cols: number, data: Scalar[]) {
    this.rows = rows;
    this.cols = cols;
    this.data = data;
  }
  static filled(rows: number, cols: number, v: Scalar): Matrix {
    return new Matrix(rows, cols, new Array<Scalar>(rows * cols).fill(v));
  }
  static from2D(rows: readonly (readonly Scalar[])[]): Matrix {
    const r = rows.length;
    let c = 0;
    for (const row of rows) c = Math.max(c, row.length);
    const data: Scalar[] = [];
    for (const row of rows) {
      for (let j = 0; j < c; j++) data.push(j < row.length ? (row[j] ?? null) : ERR.NA);
    }
    return new Matrix(r, c, data);
  }
  static column(values: readonly Scalar[]): Matrix {
    return new Matrix(values.length, 1, values.slice());
  }
  static row(values: readonly Scalar[]): Matrix {
    return new Matrix(1, values.length, values.slice());
  }
  get(r: number, c: number): Scalar {
    return this.data[r * this.cols + c] ?? null;
  }
  /** Lecture avec diffusion d'une ligne ou colonne unique (regles Excel), #N/A hors limites. */
  getBroadcast(r: number, c: number): Scalar {
    const rr = this.rows === 1 ? 0 : r;
    const cc = this.cols === 1 ? 0 : c;
    if (rr >= this.rows || cc >= this.cols) return ERR.NA;
    return this.data[rr * this.cols + cc] ?? null;
  }
  map(fn: (v: Scalar, r: number, c: number) => Scalar): Matrix {
    const out = new Array<Scalar>(this.data.length);
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const i = r * this.cols + c;
        out[i] = fn(this.data[i] ?? null, r, c);
      }
    }
    return new Matrix(this.rows, this.cols, out);
  }
  to2D(): Scalar[][] {
    const out: Scalar[][] = [];
    for (let r = 0; r < this.rows; r++) out.push(this.data.slice(r * this.cols, (r + 1) * this.cols));
    return out;
  }
  rowAt(r: number): Scalar[] {
    return this.data.slice(r * this.cols, (r + 1) * this.cols);
  }
  colAt(c: number): Scalar[] {
    const out: Scalar[] = [];
    for (let r = 0; r < this.rows; r++) out.push(this.data[r * this.cols + c] ?? null);
    return out;
  }
  transpose(): Matrix {
    const out = new Array<Scalar>(this.data.length);
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) out[c * this.rows + r] = this.data[r * this.cols + c] ?? null;
    }
    return new Matrix(this.cols, this.rows, out);
  }
}

export type Value = Scalar | Matrix;

export function isError(v: unknown): v is FormulaError {
  return v instanceof FormulaError;
}

export function isMatrix(v: unknown): v is Matrix {
  return v instanceof Matrix;
}

/** Valeur de type Excel au sens de TYPE() : 1 nombre, 2 texte, 4 booleen, 16 erreur, 64 matrice. */
export function excelType(v: Value): number {
  if (v instanceof Matrix) return 64;
  if (v === null || typeof v === 'number') return 1;
  if (typeof v === 'string') return 2;
  if (typeof v === 'boolean') return 4;
  return 16;
}
