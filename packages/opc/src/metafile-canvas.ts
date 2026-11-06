// Surface de dessin SVG des convertisseurs EMF / WMF : etat du contexte graphique (stylo, brosse, police, transformations),
// primitives et generation du SVG. Les coordonnees logiques sont converties vers le peripherique (pixels du metafichier).

export const u16 = (b: Uint8Array, o: number): number => (b[o] ?? 0) | ((b[o + 1] ?? 0) << 8);
export const u32 = (b: Uint8Array, o: number): number => (u16(b, o) | (u16(b, o + 2) << 16)) >>> 0;
export const i32 = (b: Uint8Array, o: number): number => u32(b, o) | 0;

/** Matrice 2D [a, b, c, d, e, f] : x' = a x + c y + e, y' = b x + d y + f. */
export type Xform = [number, number, number, number, number, number];

const IDENTITY: Xform = [1, 0, 0, 1, 0, 0];
const MAX_ELEMENTS = 50_000;
const round = (n: number): number => Math.round(n * 100) / 100;
const hex2 = (n: number): string => (n & 0xff).toString(16).padStart(2, '0');
const escapeXml = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** Compose : applique `first` puis `second`. */
const compose = (first: Xform, second: Xform): Xform => [
  first[0] * second[0] + first[1] * second[2], first[0] * second[1] + first[1] * second[3],
  first[2] * second[0] + first[3] * second[2], first[2] * second[1] + first[3] * second[3],
  first[4] * second[0] + first[5] * second[2] + second[4], first[4] * second[1] + first[5] * second[3] + second[5],
];

export interface Pen {
  color: string | null;
  width: number;
  dash: string | undefined;
}

export interface MetaFont {
  height: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  /** Degres, sens antihoraire. */
  angle: number;
  family: string;
}

export interface GdiState {
  pen: Pen;
  brush: string | null;
  font: MetaFont;
  textColor: number;
  bkColor: number;
  opaque: boolean;
  evenOdd: boolean;
  textAlign: number;
  mapMode: number;
  winOrg: [number, number];
  winExt: [number, number];
  vpOrg: [number, number];
  vpExt: [number, number];
  xform: Xform;
  cur: [number, number];
}

const defaultState = (): GdiState => ({
  pen: { color: '#000000', width: 1, dash: undefined }, brush: '#ffffff',
  font: { height: 16, bold: false, italic: false, underline: false, strike: false, angle: 0, family: 'Arial' },
  textColor: 0, bkColor: 0xffffff, opaque: false, evenOdd: true, textAlign: 0, mapMode: 1,
  winOrg: [0, 0], winExt: [1, 1], vpOrg: [0, 0], vpExt: [1, 1], xform: [...IDENTITY], cur: [0, 0],
});

const cloneState = (s: GdiState): GdiState => ({
  ...s, pen: { ...s.pen }, font: { ...s.font }, winOrg: [...s.winOrg], winExt: [...s.winExt], vpOrg: [...s.vpOrg], vpExt: [...s.vpExt], xform: [...s.xform], cur: [...s.cur],
});

function base64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(out);
}

export class MetafileCanvas {
  state: GdiState = defaultState();
  private readonly out: string[] = [];
  private readonly box: { x: number; y: number; w: number; h: number };
  private readonly pxPerMm: number;
  private path: string[] | undefined;
  private compound: string[] | undefined;
  private extentsSet = false;

  constructor(box: { x: number; y: number; w: number; h: number }, pxPerMm: number) {
    this.box = box;
    this.pxPerMm = pxPerMm;
  }

  snapshot(): GdiState { return cloneState(this.state); }
  restore(saved: GdiState): void {
    // Le trace en cours et la position courante survivent a un RestoreDC ; objets selectionnes et transformations reviennent.
    this.state = { ...saved, cur: this.state.cur };
  }

  setWindowExt(x: number, y: number): void { this.state.winExt = [x || 1, y || 1]; this.extentsSet = true; }
  setWindowOrg(x: number, y: number): void { this.state.winOrg = [x, y]; }
  setViewportExt(x: number, y: number): void { this.state.vpExt = [x || 1, y || 1]; this.extentsSet = true; }
  setViewportOrg(x: number, y: number): void { this.state.vpOrg = [x, y]; }
  setMapMode(mode: number): void { this.state.mapMode = mode; }
  setTransform(x: Xform): void { this.state.xform = x; }
  modifyTransform(x: Xform, mode: number): void {
    if (mode === 1) this.state.xform = [...IDENTITY];
    else if (mode === 2) this.state.xform = compose(x, this.state.xform);
    else if (mode === 3) this.state.xform = compose(this.state.xform, x);
    else if (mode === 4) this.state.xform = x;
  }

  color(ref: number): string { return `#${hex2(ref)}${hex2(ref >>> 8)}${hex2(ref >>> 16)}`; }
  dash(style: number): string | undefined {
    return ({ 1: '6 3', 2: '1.5 2', 3: '6 2 1.5 2', 4: '6 2 1.5 2 1.5 2' } as Record<number, string>)[style];
  }

  /** Echelle (x, y) du plan logique vers le peripherique (modes fixes : unites physiques, axe y vers le haut). */
  private scale(): [number, number] {
    const mm = this.pxPerMm;
    const unit = ({ 2: 0.1, 3: 0.01, 4: 0.254, 5: 0.0254, 6: 25.4 / 1440 } as Record<number, number>)[this.state.mapMode];
    if (unit) return [unit * mm, -unit * mm];
    if (this.extentsSet && (this.state.mapMode === 7 || this.state.mapMode === 8)) return [this.state.vpExt[0] / this.state.winExt[0], this.state.vpExt[1] / this.state.winExt[1]];
    return [1, 1];
  }

  private P(x: number, y: number): [number, number] {
    const [a, b, c, d, e, f] = this.state.xform;
    const wx = a * x + c * y + e;
    const wy = b * x + d * y + f;
    const [sx, sy] = this.scale();
    return [round((wx - this.state.winOrg[0]) * sx + this.state.vpOrg[0]), round((wy - this.state.winOrg[1]) * sy + this.state.vpOrg[1])];
  }

  private lengthScale(): number {
    const [sx, sy] = this.scale();
    const [a, b, c, d] = this.state.xform;
    return Math.sqrt(Math.abs((a * d - b * c) * sx * sy)) || 1;
  }

  private style(fill: boolean, stroke: boolean): string {
    const pen = this.state.pen;
    const parts = [fill && this.state.brush ? `fill="${this.state.brush}"` : 'fill="none"'];
    if (fill && this.state.brush && !this.state.evenOdd) parts.push('fill-rule="nonzero"');
    else if (fill && this.state.brush) parts.push('fill-rule="evenodd"');
    if (stroke && pen.color) {
      parts.push(`stroke="${pen.color}"`, `stroke-width="${round(Math.max(1, pen.width * this.lengthScale()))}"`);
      if (pen.dash) parts.push(`stroke-dasharray="${pen.dash}"`);
    }
    return parts.join(' ');
  }

  private emit(element: string): void {
    if (this.out.length < MAX_ELEMENTS) this.out.push(element);
  }

  /** Ajoute un contour ou le dessine : `d` est la geometrie deja convertie au peripherique. */
  private draw(d: string, closed: boolean, fill: boolean): void {
    if (this.path) {
      this.path.push(d);
      return;
    }
    if (this.compound) {
      this.compound.push(d);
      return;
    }
    this.emit(`<path d="${d}" ${this.style(fill && closed, true)}/>`);
  }

  private pathData(points: Array<[number, number]>, close: boolean, move = true): string {
    return points.map(([x, y], i) => {
      const [px, py] = this.P(x, y);
      return `${i === 0 && move ? 'M' : 'L'}${px} ${py}`;
    }).join(' ') + (close ? ' Z' : '');
  }

  moveTo(x: number, y: number): void {
    this.state.cur = [x, y];
    if (this.path) { const [px, py] = this.P(x, y); this.path.push(`M${px} ${py}`); }
  }
  lineTo(x: number, y: number): void {
    const from = this.state.cur;
    this.state.cur = [x, y];
    if (this.path) { const [px, py] = this.P(x, y); this.path.push(`L${px} ${py}`); return; }
    this.draw(this.pathData([from, [x, y]], false), false, false);
  }
  poly(points: Array<[number, number]>, close: boolean, part = false): void {
    if (points.length < 2) return;
    const last = points[points.length - 1];
    if (last) this.state.cur = [...last];
    const d = this.pathData(points, close);
    if (part && !this.compound) this.compound = [];
    this.draw(d, close, true);
  }
  /** Fin d'un POLYPOLYGON : un seul trace pour tous les contours. */
  flushCompound(): void {
    const parts = this.compound;
    this.compound = undefined;
    if (parts?.length) this.draw(parts.join(' '), true, true);
  }
  polyTo(points: Array<[number, number]>): void {
    if (!points.length) return;
    const from = this.state.cur;
    const last = points[points.length - 1];
    if (last) this.state.cur = [...last];
    this.draw(this.pathData([from, ...points], false), false, false);
  }
  bezier(points: Array<[number, number]>, from: boolean): void {
    const start: Array<[number, number]> = from ? [this.state.cur] : points.slice(0, 1);
    const rest = from ? points : points.slice(1);
    let d = '';
    const first = start[0];
    if (!first) return;
    const [mx, my] = this.P(first[0], first[1]);
    d += `M${mx} ${my}`;
    for (let i = 0; i + 2 < rest.length; i += 3) {
      const [x1, y1] = this.P(...(rest[i] as [number, number]));
      const [x2, y2] = this.P(...(rest[i + 1] as [number, number]));
      const [x3, y3] = this.P(...(rest[i + 2] as [number, number]));
      d += ` C${x1} ${y1} ${x2} ${y2} ${x3} ${y3}`;
    }
    const last = rest[rest.length - 1];
    if (last) this.state.cur = [...last];
    if (this.path) this.path.push(from ? d.replace(/^M[^C]*/, '') : d);
    else this.emit(`<path d="${d}" ${this.style(false, true)}/>`);
  }
  rect(l: number, t: number, r: number, b: number, rx = 0, ry = 0): void {
    const [x1, y1] = this.P(l, t);
    const [x2, y2] = this.P(r, b);
    if (this.path) { this.path.push(`M${x1} ${y1} L${x2} ${y1} L${x2} ${y2} L${x1} ${y2} Z`); return; }
    const k = Math.abs(this.scale()[0] * this.state.xform[0]) || 1;
    const rounded = rx || ry ? ` rx="${round(rx * k)}" ry="${round(ry * k)}"` : '';
    this.emit(`<rect x="${Math.min(x1, x2)}" y="${Math.min(y1, y2)}" width="${Math.abs(x2 - x1)}" height="${Math.abs(y2 - y1)}"${rounded} ${this.style(true, true)}/>`);
  }
  ellipse(l: number, t: number, r: number, b: number): void {
    const [x1, y1] = this.P(l, t);
    const [x2, y2] = this.P(r, b);
    const [cx, cy, rx, ry] = [(x1 + x2) / 2, (y1 + y2) / 2, Math.abs(x2 - x1) / 2, Math.abs(y2 - y1) / 2];
    if (this.path) { this.path.push(`M${cx - rx} ${cy} A${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`); return; }
    this.emit(`<ellipse cx="${round(cx)}" cy="${round(cy)}" rx="${round(rx)}" ry="${round(ry)}" ${this.style(true, true)}/>`);
  }

  beginPath(): void { this.path = []; }
  endPath(): void { /* le trace reste disponible jusqu'au remplissage ou au contour */ }
  closeFigure(): void { this.path?.push('Z'); }
  paintPath(fill: boolean, stroke: boolean): void {
    const d = this.path?.join(' ');
    this.path = undefined;
    if (d) this.emit(`<path d="${d}" ${this.style(fill, stroke)}/>`);
  }

  text(x: number, y: number, value: string): void {
    if (!value.trim()) return;
    const f = this.state.font;
    const [px, py] = this.P(x, y);
    const size = round(f.height * this.lengthScale());
    const align = this.state.textAlign;
    const anchor = (align & 6) === 6 ? 'middle' : (align & 6) === 2 ? 'end' : 'start';
    const baseline = (align & 24) === 24 ? 0 : (align & 24) === 8 ? -size * 0.2 : size * 0.8;
    const rotate = f.angle ? ` transform="rotate(${-f.angle} ${px} ${py})"` : '';
    const decoration = [f.underline ? 'underline' : '', f.strike ? 'line-through' : ''].filter(Boolean).join(' ');
    this.emit(`<text x="${px}" y="${round(py + baseline)}" font-family="${escapeXml(f.family)}" font-size="${size}"${f.bold ? ' font-weight="bold"' : ''}${f.italic ? ' font-style="italic"' : ''}${decoration ? ` text-decoration="${decoration}"` : ''} text-anchor="${anchor}" fill="${this.color(this.state.textColor)}" xml:space="preserve"${rotate}>${escapeXml(value)}</text>`);
  }

  /** Image DIB (BITMAPINFO + bits) placee dans le rectangle destination (coordonnees logiques). */
  dib(info: Uint8Array, bits: Uint8Array, x: number, y: number, w: number, h: number): void {
    if (info.length < 12 || !bits.length || !w || !h) return;
    const file = new Uint8Array(14 + info.length + bits.length);
    file.set([0x42, 0x4d]);
    new DataView(file.buffer).setUint32(2, file.length, true);
    new DataView(file.buffer).setUint32(10, 14 + info.length, true);
    file.set(info, 14);
    file.set(bits, 14 + info.length);
    const [x1, y1] = this.P(x, y);
    const [x2, y2] = this.P(x + w, y + h);
    this.emit(`<image x="${Math.min(x1, x2)}" y="${Math.min(y1, y2)}" width="${Math.abs(x2 - x1)}" height="${Math.abs(y2 - y1)}" preserveAspectRatio="none" href="data:image/bmp;base64,${base64(file)}"/>`);
  }

  svg(): string | undefined {
    if (!this.out.length) return undefined;
    const { x, y, w, h } = this.box;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${round(x)} ${round(y)} ${round(w)} ${round(h)}" width="${round(w)}" height="${round(h)}">${this.out.join('')}</svg>`;
  }
}
