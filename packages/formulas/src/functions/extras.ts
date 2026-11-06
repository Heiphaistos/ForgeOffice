// Fonctions diverses : EUROCONVERT (taux officiels de conversion en euro) et BAHTTEXT (nombre en lettres thai).
import { toBool, toNumber, toText } from '../eval/coerce.ts';
import { ERR, FormulaError } from '../values.ts';
import { define } from './registry.ts';

// ---------- EUROCONVERT ----------

/** Taux fixes irrevocables (unites de monnaie nationale pour 1 euro) et decimales de la monnaie. */
const EURO_RATES: Record<string, [rate: number, decimals: number]> = {
  EUR: [1, 2],
  ATS: [13.7603, 2],
  BEF: [40.3399, 0],
  DEM: [1.95583, 2],
  ESP: [166.386, 0],
  FIM: [5.94573, 2],
  FRF: [6.55957, 2],
  GRD: [340.75, 0],
  IEP: [0.787564, 2],
  ITL: [1936.27, 0],
  LUF: [40.3399, 0],
  NLG: [2.20371, 2],
  PTE: [200.482, 0],
};

const roundTo = (x: number, decimals: number): number => {
  const f = 10 ** decimals;
  return Math.sign(x) * Math.round(Math.abs(x) * f + 1e-9) / f;
};

define('financial', 'EUROCONVERT', { min: 3, max: 5 }, ([n, from, to, full, tri], ctx) => {
  const x = toNumber(n, ctx);
  const a = toText(from, ctx);
  const b = toText(to, ctx);
  if (x instanceof FormulaError) return x;
  if (a instanceof FormulaError) return a;
  if (b instanceof FormulaError) return b;
  const src = EURO_RATES[a.toUpperCase()];
  const dst = EURO_RATES[b.toUpperCase()];
  if (!src || !dst) return ERR.VALUE;
  let precise = false;
  if (full !== undefined && full !== null) {
    const f = toBool(full, ctx);
    if (f instanceof FormulaError) return f;
    precise = f;
  }
  let digits: number | undefined;
  if (tri !== undefined && tri !== null) {
    const t = toNumber(tri, ctx);
    if (t instanceof FormulaError) return t;
    if (t < 3) return ERR.VALUE;
    digits = Math.trunc(t);
  }
  if (a.toUpperCase() === b.toUpperCase()) return x;
  let euro = x / src[0];
  if (digits !== undefined && a.toUpperCase() !== 'EUR' && b.toUpperCase() !== 'EUR') {
    euro = Number(euro.toPrecision(digits));
  }
  const out = euro * dst[0];
  return precise ? out : roundTo(out, dst[1]);
});

// ---------- BAHTTEXT ----------

const DIGITS = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
const PLACES = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน'];

/** Mots d'un groupe de six chiffres (0..999999) ; `higher` = un groupe plus fort existe (un final se lit « เอ็ด »). */
function chunkWords(n: number, higher: boolean): string {
  const ds = String(n).padStart(6, '0').split('').map(Number);
  let out = '';
  ds.forEach((d, i) => {
    const place = 5 - i;
    if (d === 0) return;
    if (place === 1) out += d === 1 ? 'สิบ' : d === 2 ? 'ยี่สิบ' : `${DIGITS[d]}สิบ`;
    else if (place === 0) out += d === 1 && (higher || n > 1) ? 'เอ็ด' : (DIGITS[d] ?? '');
    else out += `${DIGITS[d]}${PLACES[place]}`;
  });
  return out;
}

function thaiWords(n: number, higher = false): string {
  if (n >= 1e6) {
    const top = Math.floor(n / 1e6);
    const rest = n - top * 1e6;
    return thaiWords(top, higher) + 'ล้าน' + (rest > 0 ? chunkWords(rest, true) : '');
  }
  return n === 0 ? '' : chunkWords(n, higher);
}

define('text', 'BAHTTEXT', { min: 1, max: 1 }, ([v], ctx) => {
  const x = toNumber(v, ctx);
  if (x instanceof FormulaError) return x;
  if (!Number.isFinite(x) || Math.abs(x) >= 1e18) return ERR.VALUE;
  const cents = Math.round(Number((Math.abs(x) * 100).toPrecision(15)));
  const baht = Math.floor(cents / 100);
  const satang = cents - baht * 100;
  const sign = x < 0 ? 'ลบ' : '';
  if (baht === 0 && satang === 0) return `${sign}ศูนย์บาทถ้วน`;
  const bahtPart = baht > 0 ? `${thaiWords(baht)}บาท` : '';
  const satangPart = satang > 0 ? `${thaiWords(satang)}สตางค์` : 'ถ้วน';
  return `${sign}${bahtPart}${baht > 0 && satang === 0 ? 'ถ้วน' : satang > 0 ? satangPart : ''}`;
});
