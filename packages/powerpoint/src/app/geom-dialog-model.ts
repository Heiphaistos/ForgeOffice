// Modele pur de la boite « Taille et position » : valeurs en cm, ratio verrouille, patch minimal.
import type { Transform } from '@forgeoffice/pptx';
import { cmToPt, ptToCm } from './text-dialog-model.ts';

export interface GeomForm {
  width: number;
  height: number;
  lockRatio: boolean;
  rotation: number;
  x: number;
  y: number;
}

export function geomForm(xfrm: Pick<Transform, 'x' | 'y' | 'width' | 'height' | 'rotation'>, lockRatio: boolean): GeomForm {
  return { width: ptToCm(xfrm.width), height: ptToCm(xfrm.height), lockRatio, rotation: xfrm.rotation ?? 0, x: ptToCm(xfrm.x), y: ptToCm(xfrm.y) };
}

const round2 = (v: number): number => Math.round(v * 100) / 100;

/** Change la largeur ; avec le ratio verrouille la hauteur suit la proportion de depart. */
export function withWidth(form: GeomForm, initial: GeomForm, width: number): GeomForm {
  const ratio = initial.height / (initial.width || 1);
  return { ...form, width, height: form.lockRatio ? round2(width * ratio) : form.height };
}

export function withHeight(form: GeomForm, initial: GeomForm, height: number): GeomForm {
  const ratio = initial.width / (initial.height || 1);
  return { ...form, height, width: form.lockRatio ? round2(height * ratio) : form.width };
}

export const normalizeRotation = (deg: number): number => ((Math.round(deg * 10) / 10 % 360) + 360) % 360;

/** Champs de la transformation modifies (en points) ; vide si rien n'a change. */
export function geomPatch(form: GeomForm, initial: GeomForm): Partial<Pick<Transform, 'x' | 'y' | 'width' | 'height' | 'rotation'>> {
  const patch: Partial<Pick<Transform, 'x' | 'y' | 'width' | 'height' | 'rotation'>> = {};
  if (form.width !== initial.width) patch.width = Math.max(1, cmToPt(form.width));
  if (form.height !== initial.height) patch.height = Math.max(1, cmToPt(form.height));
  if (form.x !== initial.x) patch.x = cmToPt(form.x);
  if (form.y !== initial.y) patch.y = cmToPt(form.y);
  if (form.rotation !== initial.rotation) patch.rotation = normalizeRotation(form.rotation);
  return patch;
}

/** Echelle (%) de la largeur ou de la hauteur par rapport a la boite a l'ouverture de la boite. */
export function scaleOf(form: GeomForm, initial: GeomForm, axis: 'width' | 'height'): number {
  return initial[axis] ? Math.round((form[axis] / initial[axis]) * 1000) / 10 : 100;
}

/** Fixe l'echelle d'un axe (le rapport verrouille entraine l'autre axe). */
export function withScale(form: GeomForm, initial: GeomForm, axis: 'width' | 'height', pct: number): GeomForm {
  const value = round2((initial[axis] * pct) / 100);
  return axis === 'width' ? withWidth(form, initial, value) : withHeight(form, initial, value);
}
