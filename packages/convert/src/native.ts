// Appels au moteur natif forge-convert par la coquille (apps/desktop/src-tauri/src/convert_cmds.rs).
// Les documents circulent en trame binaire [u32 LE longueur][en-tete JSON][octets] (miroir de frame.rs).
// Code sans DOM, teste avec un pont simule.
import type { NativeBridge } from '@forgeoffice/core';
import { S } from './strings.ts';

/** Capacite d'une operation (forge-convert `Capacite`). */
export interface Capability {
  operation: string;
  disponible: boolean;
  outil: string | null;
  raison: string | null;
}

export interface Capabilities {
  version: string;
  outils: Record<string, string | null>;
  operations: Capability[];
}

/** Resultat d'une operation (forge-convert `Output`, balise `type`). */
export type NativeOutput =
  | { type: 'fichiers'; fichiers: string[]; caviardage?: Record<string, number>; compression?: { images_reencodees: number; octets_gagnes_images: number } }
  | { type: 'infos'; titre: string | null; auteur: string | null; sujet: string | null; mots_cles: string | null; createur: string | null; producteur: string | null; pages: number }
  | { type: 'champs'; champs: { nom: string; type: string; valeur: string | null; options: string[]; lecture_seule: boolean }[] }
  | { type: 'annotations'; contenus: string[] }
  | { type: 'texte'; texte: string; pages: { page: number; texte: string }[] }
  | { type: 'comparaison'; ajouts: number; suppressions: number; identiques: boolean; html: string }
  | { type: 'image'; data_url: string }
  | { type: 'capacites' };

export interface NamedBytes {
  name: string;
  bytes: Uint8Array;
}

export interface BytesResult {
  output: NativeOutput;
  files: NamedBytes[];
}

/** Operation forge-convert (JSON tel que serde l'attend : `op` + champs). Chemins = marqueurs en memoire. */
export type NativeOperation = { op: string } & Record<string, unknown>;

/** Marqueurs reconnus par `convert_run_bytes` : fichiers d'entree et dossier de sortie temporaire. */
export const input = (i: number): string => `@${i}`;
export const OUTPUT_DIR = '@sortie';
export const outputTarget = (name: string): { dossier: string; nom: string; ecraser: boolean } => ({ dossier: OUTPUT_DIR, nom: name, ecraser: true });

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function encodeFrame(header: unknown, bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const json = encoder.encode(JSON.stringify(header));
  const out = new Uint8Array(4 + json.length + bytes.length);
  new DataView(out.buffer).setUint32(0, json.length, true);
  out.set(json, 4);
  out.set(bytes, 4 + json.length);
  return out;
}

export function decodeFrame(data: Uint8Array): { header: unknown; bytes: Uint8Array } {
  if (data.length < 4) throw new Error(S.errors.frame);
  const length = new DataView(data.buffer, data.byteOffset, 4).getUint32(0, true);
  if (4 + length > data.length) throw new Error(S.errors.frame);
  return { header: JSON.parse(decoder.decode(data.subarray(4, 4 + length))) as unknown, bytes: data.subarray(4 + length) };
}

function toBytes(value: unknown): Uint8Array {
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  if (Array.isArray(value)) return Uint8Array.from(value as number[]);
  throw new Error(S.errors.frame);
}

/** Tauri accepte un corps binaire brut a la place d'arguments nommes. */
function rawArgs(frame: Uint8Array<ArrayBuffer>): Record<string, unknown> {
  return frame as unknown as Record<string, unknown>;
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** Execute une operation sur des documents en memoire (`@0`, `@1`... = `inputs`, sortie = `outputTarget(nom)`). */
export async function runBytes(native: NativeBridge, operation: NativeOperation, inputs: readonly NamedBytes[]): Promise<BytesResult> {
  const head = { operation, entrees: inputs.map((f) => ({ nom: f.name, taille: f.bytes.length })) };
  const reply = toBytes(await native.invoke<unknown>('convert_run_bytes', rawArgs(encodeFrame(head, concat(inputs.map((f) => f.bytes))))));
  const { header, bytes } = decodeFrame(reply);
  const h = header as { resultat?: NativeOutput; fichiers?: { nom: string; taille: number }[] };
  if (!h.resultat || !Array.isArray(h.fichiers)) throw new Error(S.errors.frame);
  const files: NamedBytes[] = [];
  let at = 0;
  for (const f of h.fichiers) {
    if (typeof f.nom !== 'string' || !Number.isInteger(f.taille) || at + f.taille > bytes.length) throw new Error(S.errors.frame);
    files.push({ name: f.nom, bytes: bytes.slice(at, at + f.taille) });
    at += f.taille;
  }
  return { output: h.resultat, files };
}

/** Operation sur des chemins autorises par la coquille (fichiers ouverts, dossier choisi). */
export function runPaths(native: NativeBridge, operation: NativeOperation): Promise<NativeOutput> {
  return native.invoke<NativeOutput>('convert_run', { operation });
}

export function capabilities(native: NativeBridge): Promise<Capabilities> {
  return native.invoke<Capabilities>('convert_capacites');
}

export function pickFolder(native: NativeBridge): Promise<string | null> {
  return native.invoke<string | null>('convert_pick_folder');
}

/** Enregistre un resultat dans un dossier choisi par `pickFolder` ; renvoie le chemin ecrit. */
export function saveInto(native: NativeBridge, folder: string, file: NamedBytes, overwrite = false): Promise<string> {
  return native.invoke<string>('convert_save_into', rawArgs(encodeFrame({ dossier: folder, nom: file.name, ecraser: overwrite }, file.bytes)));
}

/** Disponibilite d'une operation ; message francais si indisponible. null = pas de coquille. */
export function availability(caps: Capabilities | null, operation: string): { ok: boolean; reason: string } {
  if (!caps) return { ok: false, reason: S.needDesktop };
  const c = caps.operations.find((o) => o.operation === operation);
  if (!c) return { ok: false, reason: S.needDesktop };
  return { ok: c.disponible, reason: c.raison ?? '' };
}
