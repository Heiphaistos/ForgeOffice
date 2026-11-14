// Entrees du menu contextuel pour un lien hypertexte : modifier, ouvrir, copier, supprimer.
import type { Hyperlink } from '@forgeoffice/pptx';
import type { MenuItem } from '@forgeoffice/ui';
import type { Editor } from './editor.ts';
import { setLink } from './insert.ts';
import { openExternal } from './safe-open.ts';
import { S3 } from './strings-text.ts';

/** Adresse lisible d'un lien (page web, ou « diapositive N »). */
export function linkTarget(deck: Editor['deck'], link: Hyperlink): string {
  if (link.url) return link.url;
  const index = link.slideId === undefined ? -1 : deck.slides.findIndex((s) => s.id === link.slideId);
  return index >= 0 ? `#${index + 1}` : '';
}

export function linkMenuItems(ed: Editor, link: Hyperlink | undefined, edit: () => void): MenuItem[] {
  if (!link) return [];
  const target = linkTarget(ed.deck, link);
  const web = !!link.url && /^https?:/i.test(link.url);
  return [
    { id: 'ls', kind: 'separator' },
    { id: 'ledit', label: S3.linkMenu.edit, icon: 'link', onClick: edit },
    { id: 'lopen', label: S3.linkMenu.open, icon: 'link', disabled: !web, onClick: () => { if (link.url) openExternal(link.url); } },
    { id: 'lcopy', label: S3.linkMenu.copy, icon: 'copy', disabled: !target, onClick: () => void navigator.clipboard?.writeText(target).then(() => ed.notify(S3.linkMenu.copied, 'info')).catch(() => undefined) },
    { id: 'lremove', label: S3.linkMenu.remove, icon: 'delete', onClick: () => setLink(ed, null) },
  ];
}
