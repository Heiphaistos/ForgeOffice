// Onglets Publipostage, Revision et Affichage.
import type { RibbonTab } from '@forgeoffice/ui';
import { hasFields, mergeDeck } from '../../merge.ts';
import { COMPOSITE_FIELDS } from '../../mergeblocks.ts';
import { unmatchedImages } from '../../mergeimages.ts';
import { S } from '../../strings.ts';
import type { Editor, UiState } from '../editor.ts';
import { exportPdf } from '../export.ts';
import { afterFonts } from '../measure.ts';
import { currentImageBank, linkImageField, loadImageZip } from '../imagebank.ts';
import { insertMergeField } from '../ops.ts';
import type { TabContext } from './common.tsx';

/** Publication fusionnee (une copie des pages par enregistrement) ouverte comme nouvelle publication. */
export function finishMerge(ctx: TabContext, toPdf: boolean): void {
  const { ed, app } = ctx;
  const source = ed.pub.merge;
  if (!source || !source.records.length) {
    ed.setUi({ dialog: 'merge' });
    return;
  }
  if (!hasFields(ed.deck)) {
    ed.notify(S.dialogs.mergeNoFields, 'warning');
    return;
  }
  const bank = currentImageBank();
  const linked = Object.keys(ed.pub.imageFields).length > 0;
  if (linked) {
    const lost = unmatchedImages(ed.deck, ed.pub.imageFields, source.fields, source.records, bank);
    if (lost.length) ed.notify(S.imageMerge.missing(lost.length, lost[0] as string), 'warning');
  }
  const doc = { deck: mergeDeck(ed.deck, source, undefined, linked ? { fields: ed.pub.imageFields, bank } : undefined), pub: { ...ed.pub, chains: [], wraps: {}, dropCaps: {}, merge: null } };
  if (toPdf) void afterFonts(ed, () => exportPdf(ed, false, doc, ' - fusion'));
  else app.newFrom(doc);
}

export function mailingsTab(ctx: TabContext): RibbonTab {
  const { ed } = ctx;
  const source = ed.pub.merge;
  const count = source?.records.length ?? 0;
  const preview = ed.ui.mergePreview;
  const step = (d: number): void => ed.setUi({ mergePreview: Math.max(0, Math.min(count - 1, (preview ?? 0) + d)) });
  return {
    id: 'mailings',
    label: S.tabs.mailings,
    keytip: 'M',
    groups: [
      {
        id: 'start', label: S.groups.start, icon: 'mail', controls: [
          { kind: 'button', id: 'recipients', label: S.cmd.mergeStart, icon: 'people', size: 'large', onClick: () => ed.setUi({ dialog: 'merge' }) },
        ],
      },
      {
        id: 'fields', label: S.groups.fields, icon: 'mail_template', controls: [
          {
            kind: 'menu', id: 'insertField', label: S.cmd.mergeInsert, icon: 'mail_template', size: 'large', disabled: !source,
            items: [
              ...(source?.fields ?? []).map((f) => ({ id: f, label: f, onClick: () => insertMergeField(ed, f) })),
              { id: 'sep', kind: 'separator' as const },
              ...COMPOSITE_FIELDS.map((f) => ({ id: f, label: f, onClick: () => insertMergeField(ed, f) })),
            ],
          },
          {
            kind: 'menu', id: 'imageField', label: S.cmd.imageField, icon: 'image', size: 'large', disabled: !source,
            items: [
              ...(source?.fields ?? []).map((f) => ({ id: f, label: f, onClick: () => linkImageField(ed, f) })),
              { id: 'sep', kind: 'separator' as const },
              { id: 'none', label: S.cmd.imageFieldNone, onClick: () => linkImageField(ed, null) },
            ],
          },
          { kind: 'button', id: 'imageZip', label: S.cmd.imageZip, icon: 'folder_zip', disabled: !source, onClick: () => void loadImageZip(ed) },
        ],
      },
      {
        id: 'preview', label: S.groups.preview, icon: 'eye', controls: [
          { kind: 'toggle', id: 'preview', label: S.cmd.mergePreview, icon: 'eye', size: 'large', pressed: preview !== null, disabled: !count, onToggle: (p) => ed.setUi({ mergePreview: p ? 0 : null }) },
          { kind: 'button', id: 'check', label: S.cmd.mergeCheck, icon: 'warning', disabled: !source, onClick: () => ed.setUi({ dialog: 'mergeCheck' }) },
          { kind: 'button', id: 'prev', label: S.cmd.mergePrev, icon: 'chevron_left', iconOnly: true, disabled: preview === null || preview <= 0, onClick: () => step(-1) },
          { kind: 'button', id: 'next', label: S.cmd.mergeNext, icon: 'chevron_right', iconOnly: true, disabled: preview === null || preview >= count - 1, onClick: () => step(1) },
        ],
      },
      {
        id: 'finish', label: S.groups.finish, icon: 'mail_multiple', controls: [
          {
            kind: 'split', id: 'finish', label: S.cmd.mergeFinish, icon: 'mail_multiple', size: 'large', disabled: !count, onClick: () => finishMerge(ctx, false),
            items: [
              { id: 'new', label: S.cmd.mergeToNew, onClick: () => finishMerge(ctx, false) },
              { id: 'catalog', label: S.cmd.mergeCatalog, onClick: () => ed.setUi({ dialog: 'catalog' }) },
              { id: 'pdf', label: S.cmd.mergeToPdf, onClick: () => finishMerge(ctx, true) },
            ],
          },
        ],
      },
    ],
  };
}

export function reviewTab({ ed }: TabContext, issueCount: number): RibbonTab {
  return {
    id: 'review',
    label: S.tabs.review,
    keytip: 'R',
    groups: [
      {
        id: 'proofing', label: S.groups.proofing, icon: 'text_proofing_tools',
        controls: [
          {
            kind: 'toggle', id: 'spelling', label: S.cmd.spelling, icon: 'text_proofing_tools', size: 'large', pressed: ed.ui.spell,
            tooltip: { title: S.cmd.spelling, description: S.review.spellingHelp },
            onToggle: (on) => {
              ed.services.settings.set('publisher.spell', on);
              ed.setUi({ spell: on });
              ed.notify(on ? S.review.spellingOn : S.review.spellingOff, 'info');
            },
          },
        ],
      },
      { id: 'checker', label: S.groups.checker, icon: 'checkmark_circle', controls: [{ kind: 'toggle', id: 'checker', label: S.cmd.checker, icon: 'checkmark_circle', size: 'large', pressed: ed.ui.checker, tooltip: { title: S.cmd.checker, description: S.checker.count(issueCount) }, onToggle: (p) => ed.setUi({ checker: p }) }] },
      {
        id: 'language', label: S.groups.language, icon: 'translate',
        controls: [
          {
            kind: 'menu', id: 'language', label: S.cmd.thesaurus, icon: 'translate', size: 'large',
            items: S.review.languages.map(([code, label]) => ({
              id: code, label, checked: ed.ui.lang === code,
              onClick: () => {
                ed.services.settings.set('publisher.lang', code);
                ed.setUi({ lang: code });
              },
            })),
          },
        ],
      },
    ],
  };
}

export function viewTab(ed: Editor): RibbonTab {
  const { ui } = ed;
  const toggle = (key: 'boundaries' | 'guides' | 'rulers' | 'pagesPane' | 'baselines' | 'snapGuides' | 'snapObjects', label: string) => ({
    kind: 'checkbox' as const, id: key, label, checked: ui[key],
    onChange: (v: boolean) => {
      const patch: Partial<UiState> = {};
      patch[key] = v;
      ed.setUi(patch);
    },
  });
  return {
    id: 'view',
    label: S.tabs.view,
    keytip: 'W',
    groups: [
      {
        id: 'views', label: S.groups.views, icon: 'document', controls: [
          { kind: 'toggle', id: 'normal', label: S.cmd.normal, icon: 'document', size: 'large', pressed: ui.view === 'normal', onToggle: () => ed.setUi({ view: 'normal' }) },
          { kind: 'toggle', id: 'master', label: S.cmd.masterView, icon: 'slide_layout', size: 'large', pressed: ui.view === 'master', onToggle: (p) => ed.setUi({ view: p ? 'master' : 'normal' }) },
        ],
      },
      {
        id: 'layoutView', label: S.groups.layoutView, icon: 'document_one_page', controls: [
          { kind: 'toggle', id: 'single', label: S.cmd.singlePage, icon: 'document_one_page', size: 'large', pressed: !ui.twoPage, onToggle: () => ed.setUi({ twoPage: false }) },
          { kind: 'toggle', id: 'two', label: S.cmd.twoPage, icon: 'book_open', size: 'large', pressed: ui.twoPage, disabled: !ed.pub.facing, onToggle: () => ed.setUi({ twoPage: true }) },
        ],
      },
      {
        id: 'show', label: S.groups.show, icon: 'eye', controls: [
          toggle('boundaries', S.cmd.boundaries), toggle('guides', S.cmd.guides), toggle('rulers', S.cmd.rulers),
          toggle('pagesPane', S.cmd.pageNav), toggle('baselines', S.cmd.baselines), toggle('snapGuides', S.cmd.snapGuides), toggle('snapObjects', S.cmd.snapObjects),
        ],
      },
      {
        id: 'zoom', label: S.groups.zoom, icon: 'zoom_in', controls: [
          { kind: 'button', id: 'z100', label: S.cmd.zoom100, icon: 'zoom_in', size: 'large', onClick: () => ed.setUi({ zoom: 100, fit: null }) },
          { kind: 'button', id: 'whole', label: S.cmd.wholePage, icon: 'page_fit', onClick: () => ed.setUi({ fit: 'page' }) },
          { kind: 'button', id: 'width', label: S.cmd.pageWidth, icon: 'arrow_autofit_width', onClick: () => ed.setUi({ fit: 'width' }) },
        ],
      },
    ],
  };
}
