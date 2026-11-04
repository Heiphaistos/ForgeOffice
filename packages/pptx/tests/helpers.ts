// Outils partages des tests du paquet pptx.
import { readFileSync } from 'node:fs';
import type { AutoShape, Shape } from '../src/index.ts';

export const fixture = (name: string): Uint8Array => new Uint8Array(readFileSync(new URL(`./fixtures/${name}`, import.meta.url)));

/** PNG 1 x 1 valide. */
export const PNG = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'));

/** Forme de type « shape » (echoue sinon). */
export function autoShape(shape: Shape | undefined): AutoShape {
  if (!shape || shape.kind !== 'shape') throw new Error(`forme attendue, recu ${shape?.kind ?? 'rien'}`);
  return shape;
}

export const near = (a: number | undefined, b: number, epsilon = 0.01): boolean => a !== undefined && Math.abs(a - b) <= epsilon;
