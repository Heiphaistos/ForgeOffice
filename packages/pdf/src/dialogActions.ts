// Application des resultats des boites de dialogue du module PDF (filigrane, numerotation, proprietes, protection, signature...)
// et ouverture de ces boites. Separe de PdfApp.tsx pour rester sous la limite de taille.
import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { Services } from '@forgeoffice/core';
import { input, outputTarget, pdfOps, runBytes, type NamedBytes } from '@forgeoffice/convert';
import type { DialogResult, DialogState } from './dialogs.tsx';
import { fitInto, newId, type Rect, type Tool } from './model.ts';
import type { ToolOptions } from './PageView.tsx';
import { compressStructure, type Compressed } from './compress.ts';
import { signPdf } from './sign/pdfsign.ts';
import { readDocInfo, writeAccess } from './docinfo.ts';
import { safeUrl } from './links.ts';
import type { PdfRibbonActions } from './ribbon.tsx';
import type { useDoc } from './useDoc.ts';
import { S } from './strings.ts';

export const errorText = (err: unknown): string => (err instanceof Error ? err.message : String(err));
export const stem = (name: string): string => name.replace(/\.pdf$/i, '');

export async function zip(files: readonly NamedBytes[]): Promise<Uint8Array> {
  const { default: JSZip } = await import('jszip');
  const z = new JSZip();
  for (const f of files) z.file(f.name, f.bytes);
  return z.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

export interface ActionCtx {
  d: ReturnType<typeof useDoc>;
  services: Services;
  pageCount: number;
  current: number;
  firstSize: { w: number; h: number };
  pagesSel(): number[];
  setDialog(s: DialogState | null): void;
  setOpts: Dispatch<SetStateAction<ToolOptions>>;
  setTool(t: Tool): void;
  /** Champ de signature cliquable en attente de la signature dessinee. */
  signTarget: MutableRefObject<{ page: number; rect: Rect } | null>;
  nativeOp(label: string, op: Record<string, unknown>): Promise<boolean>;
  saveBytes(bytes: Uint8Array, name: string, ext: string): Promise<void>;
}

export function useDialogActions(c: ActionCtx) {
  const { d, services, pageCount } = c;
  const native = d.native;

  const onDialog = useCallback(<K extends keyof DialogResult>(kind: K, value: DialogResult[K]) => {
    c.setDialog(null);
    const total = pageCount;
    const pagesOf = (text: string): number[] | undefined => (text.trim() ? pdfOps.parsePageRange(text, total) : undefined);
    const run = (label: string, fn: (b: Uint8Array) => Promise<Uint8Array>) => void d.mutate(label, fn).then((ok) => ok && services.notify(S.done.applied(label), 'success'));
    try {
      switch (kind) {
        case 'watermark': {
          const v = value as DialogResult['watermark'];
          run(S.watermark, (b) => pdfOps.watermark(b, { text: v.text, size: v.size, opacity: v.opacity / 100, angle: v.angle, color: { r: 0.5, g: 0.5, b: 0.5 }, pages: pagesOf(v.pages) }));
          break;
        }
        case 'numbering': {
          const v = value as DialogResult['numbering'];
          run(S.numbering, (b) => pdfOps.stampPages(b, { template: v.template, position: v.position, size: v.size, start: v.start, digits: v.digits, margin: v.margin, color: { r: 0, g: 0, b: 0 }, pages: pagesOf(v.pages) }));
          break;
        }
        case 'headerFooter': {
          const v = value as DialogResult['headerFooter'];
          run(S.headerFooter, async (b) => {
            let out = b;
            const o = { size: v.size, start: 1, digits: 0, margin: 20, color: { r: 0.25, g: 0.25, b: 0.25 } };
            if (v.header.trim()) out = await pdfOps.stampPages(out, { ...o, template: v.header, position: 'haut_centre' });
            if (v.footer.trim()) out = await pdfOps.stampPages(out, { ...o, template: v.footer, position: 'bas_centre' });
            return out;
          });
          break;
        }
        case 'metadata':
          { const v = value as DialogResult['metadata']; run(S.metadata, async (b) => writeAccess(await pdfOps.writeMetadata(b, v), v)); }
          break;
        case 'protect': {
          const v = value as DialogResult['protect'];
          const notify = (ok: boolean) => ok && services.notify(S.done.applied(S.protect), 'success');
          if (native) {
            void c.nativeOp(S.protect, { actions: [{ action: 'chiffrer', utilisateur: v.user, proprietaire: v.owner, autorisations: { imprimer: v.print, copier: v.copy, modifier: v.edit, annoter: v.annot, remplir_formulaires: v.forms } }] }).then(notify);
          } else {
            // Navigateur : AES-256 par pdf-lib ; le document passe en lecture seule avec son mot de passe d'affichage.
            d.setLocked(v.user);
            void d.mutate(S.protect, (b) => pdfOps.encrypt(b, v)).then((ok) => {
              if (!ok) d.setLocked(null);
              notify(ok);
            });
          }
          break;
        }
        case 'password': {
          const ask = d.askPassword;
          if (ask) void d.load(ask.file, value as string);
          break;
        }
        case 'compress':
          if (native) void c.nativeOp(S.compress, { actions: [{ action: 'compresser', niveau: (value as DialogResult['compress']).level }] });
          else {
            // Navigateur : reecriture de la structure seulement.
            let info: Compressed | null = null;
            void d.mutate(S.compress, async (bytes) => {
              info = await compressStructure(bytes);
              return info.bytes;
            }).then((ok) => ok && info && services.notify(S.done.compressed(info.before, info.after), 'success'));
          }
          break;
        case 'ocr': {
          const v = value as DialogResult['ocr'];
          void d.mutate(S.ocr, async (b) => {
            if (!native) throw new Error(S.errors.needNative);
            const out = (await runBytes(native, { op: 'ocr', entree: input(0), langue: v.lang, forcer: v.force, sortie: outputTarget('ocr.pdf') }, [{ name: 'document.pdf', bytes: b }])).files[0];
            if (!out) throw new Error(S.errors.needNative);
            return out.bytes;
          });
          break;
        }
        case 'split': {
          const v = value as DialogResult['split'];
          const groups = v.mode === 'each' ? pdfOps.chunks(total, 1) : v.mode === 'every' ? pdfOps.chunks(total, v.n) : v.ranges.split('|').map((r) => pdfOps.parsePageRange(r, total));
          void (async () => {
            const cur = await d.flush();
            if (!cur || !d.info) return;
            const parts = await pdfOps.split(cur.bytes, groups);
            const name = stem(d.info.name);
            await c.saveBytes(await zip(parts.map((bytes, i) => ({ name: `${name}-${i + 1}.pdf`, bytes }))), `${name}-decoupe.zip`, 'zip');
            services.notify(S.done.exported(parts.length), 'success');
          })().catch((err: unknown) => services.notify(errorText(err), 'error'));
          break;
        }
        case 'extract': {
          const pages = pdfOps.parsePageRange(value as string, total);
          void (async () => {
            const cur = await d.flush();
            if (!cur || !d.info) return;
            await c.saveBytes(await pdfOps.extract(cur.bytes, pages), `${stem(d.info.name)}-extrait.pdf`, 'pdf');
          })().catch((err: unknown) => services.notify(errorText(err), 'error'));
          break;
        }
        case 'signature': {
          const v = value as DialogResult['signature'];
          const target = c.signTarget.current;
          c.signTarget.current = null;
          if (target) {
            // Champ de signature du formulaire : l'image est posee dans le cadre du champ.
            const rect = fitInto(target.rect, v.ratio, c.firstSize.w, c.firstSize.h);
            d.addItem({ id: newId(), page: target.page, author: '', at: Date.now(), kind: 'signature', rect, png: v.png });
          } else {
            c.setOpts((o) => ({ ...o, signature: v }));
            c.setTool('signature');
          }
          break;
        }
        case 'digitalSign': {
          const v = value as DialogResult['digitalSign'];
          const placement = v.visible ? { page: c.current, rect: { x: 0.52, y: 0.9, w: 0.42, h: 0.07 } } : {};
          run(S.sign.digital, (b) => signPdf(b, { pfx: v.pfx, password: v.password, reason: v.reason || undefined, location: v.location || undefined, ...placement }));
          break;
        }
        case 'link': {
          const url = safeUrl(value as string);
          if (url) window.open(url, '_blank', 'noopener,noreferrer');
          break;
        }
      }
    } catch (err) {
      services.notify(errorText(err), 'error');
    }
  }, [pageCount, d, services, native, c]);

  const openDialog = useCallback(async (kind: Parameters<PdfRibbonActions['dialog']>[0]) => {
    if (kind === 'metadata') {
      const cur = await d.flush();
      if (!cur) return;
      try {
        c.setDialog({ kind, meta: await pdfOps.readMetadata(cur.bytes), info: await readDocInfo(cur.bytes) });
      } catch (err) {
        services.notify(errorText(err), 'error');
      }
      return;
    }
    if (kind === 'split') c.setDialog({ kind, pages: pageCount });
    else if (kind === 'extract') c.setDialog({ kind, pages: pageCount, initial: c.pagesSel().map((p) => p + 1).join(', ') });
    else if (kind === 'digitalSign') c.setDialog({ kind, alreadySigned: d.signatures.length > 0 });
    else c.setDialog({ kind } as DialogState);
  }, [d, pageCount, services, c]);

  return { onDialog, openDialog };
}
