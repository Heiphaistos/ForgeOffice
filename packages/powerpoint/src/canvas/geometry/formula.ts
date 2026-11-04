// Evaluateur des formules de guides OOXML (ECMA-376 20.1.9.11) : angles en 60000e de degre.

export type Vars = Map<string, number>;

/** Formule precompilee : operateur + arguments (nombres ou noms de guides). */
export interface Formula {
  op: string;
  args: string[];
}

export interface Guide {
  name: string;
  formula: Formula;
}

const ANGLE = 60000;
const DEG = Math.PI / 180;
const toRad = (a: number): number => (a / ANGLE) * DEG;
const toAngle = (rad: number): number => (rad / DEG) * ANGLE;

/** Constantes d'angle integrees. */
const ANGLES: Readonly<Record<string, number>> = {
  cd2: 10800000, cd4: 5400000, cd8: 2700000,
  '3cd4': 16200000, '3cd8': 8100000, '5cd8': 13500000, '7cd8': 18900000,
};

const DIVIDED = /^(wd|hd|ssd)(\d+)$/;

export function compileFormula(text: string): Formula {
  const [op = 'val', ...args] = text.trim().split(/\s+/);
  return { op, args };
}

/** Variables integrees d'une forme de largeur w et de hauteur h. */
export function builtinVars(w: number, h: number): Vars {
  const ss = Math.min(w, h);
  return new Map<string, number>([
    ['w', w], ['h', h], ['l', 0], ['t', 0], ['r', w], ['b', h],
    ['hc', w / 2], ['vc', h / 2], ['ss', ss], ['ls', Math.max(w, h)],
    ...Object.entries(ANGLES),
  ]);
}

/** Valeur d'un argument : nombre litteral, guide, ou division integree (wd2, hd10, ssd32...). */
export function valueOf(token: string | number, vars: Vars): number {
  if (typeof token === 'number') return Number.isFinite(token) ? token : 0;
  const known = vars.get(token);
  if (known !== undefined) return known;
  const n = Number(token);
  if (token.trim() !== '' && Number.isFinite(n)) return n;
  const m = token.match(DIVIDED);
  if (m) {
    const base = m[1] === 'wd' ? vars.get('w') : m[1] === 'hd' ? vars.get('h') : vars.get('ss');
    return (base ?? 0) / Number(m[2]);
  }
  return 0;
}

const div = (a: number, b: number): number => (b === 0 ? 0 : a / b);

export function evalFormula(f: Formula, vars: Vars): number {
  const [x = 0, y = 0, z = 0] = f.args.map((a) => valueOf(a, vars));
  let r: number;
  switch (f.op) {
    case '*/': r = div(x * y, z); break;
    case '+-': r = x + y - z; break;
    case '+/': r = div(x + y, z); break;
    case '?:': r = x > 0 ? y : z; break;
    case 'abs': r = Math.abs(x); break;
    case 'at2': r = toAngle(Math.atan2(y, x)); break;
    case 'cat2': r = x * Math.cos(Math.atan2(z, y)); break;
    case 'cos': r = x * Math.cos(toRad(y)); break;
    case 'max': r = Math.max(x, y); break;
    case 'min': r = Math.min(x, y); break;
    case 'mod': r = Math.sqrt(x * x + y * y + z * z); break;
    case 'pin': r = y < x ? x : y > z ? z : y; break;
    case 'sat2': r = x * Math.sin(Math.atan2(z, y)); break;
    case 'sin': r = x * Math.sin(toRad(y)); break;
    case 'sqrt': r = Math.sqrt(Math.max(0, x)); break;
    case 'tan': r = x * Math.tan(toRad(y)); break;
    case 'val': r = x; break;
    default: r = 0;
  }
  return Number.isFinite(r) ? r : 0;
}

/** Evalue une formule texte (« *\/ w adj 100000 ») dans le contexte donne. */
export function evaluateFormula(text: string, vars: Vars): number {
  return evalFormula(compileFormula(text), vars);
}

/** Calcule les guides dans l'ordre ; `override` remplace la formule des guides nommes (valeurs d'ajustement). */
export function evalGuides(guides: readonly Guide[], vars: Vars, override?: Readonly<Record<string, number>>): void {
  for (const g of guides) {
    const forced = override && Object.hasOwn(override, g.name) ? override[g.name] : undefined;
    vars.set(g.name, typeof forced === 'number' && Number.isFinite(forced) ? forced : evalFormula(g.formula, vars));
  }
}
