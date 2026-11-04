// Modeles de documents (Fichier > Nouveau) et page de garde : documents complets du modele docx.
import { createBlankDocument, type Block, type Paragraph, type RunProps, type WordDocument } from '@forgeoffice/docx';
import { T } from '../strings.ts';

const para = (text: string, styleId?: string, props: Paragraph['props'] = {}, run: RunProps = {}): Paragraph => ({
  type: 'paragraph', styleId, props, inlines: text ? [{ type: 'text', text, props: run }] : [],
});

export interface Template {
  id: string;
  label: string;
  description: string;
  build: () => WordDocument;
}

/** Un paragraphe par ligne pour les textes de modele sur plusieurs lignes. */
function splitLines(body: Block[]): Block[] {
  return body.flatMap((b): Block[] => {
    const run = b.type === 'paragraph' && b.inlines.length === 1 ? b.inlines[0] : undefined;
    if (b.type !== 'paragraph' || run?.type !== 'text' || !run.text.includes('\n')) return [b];
    return run.text.split('\n').map((text) => ({ ...b, inlines: [{ ...run, text }] }));
  });
}

function withBody(body: Block[], title?: string): WordDocument {
  const doc = createBlankDocument();
  doc.body = splitLines(body);
  if (title) doc.properties = { ...doc.properties, title };
  return doc;
}

const today = (): string => new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

export const TEMPLATES: readonly Template[] = [
  { id: 'blank', label: T.templates.blank, description: T.templates.blankDesc, build: () => createBlankDocument() },
  {
    id: 'letter', label: T.templates.letter, description: T.templates.letterDesc,
    build: () => withBody([
      para(T.templates.letterSender, 'NoSpacing', {}, { bold: true }),
      para(T.templates.letterAddress, 'NoSpacing'),
      para(''),
      para(T.templates.letterRecipient, 'NoSpacing', { alignment: 'right' }),
      para(''),
      para(T.templates.letterPlace(today()), undefined, { alignment: 'right' }),
      para(T.templates.letterObject, undefined, {}, { bold: true }),
      para(T.templates.letterGreeting),
      para(T.templates.letterBody, undefined, { alignment: 'justify', indentFirstLine: 28.35 }),
      para(T.templates.letterClosing, undefined, { alignment: 'justify', indentFirstLine: 28.35 }),
      para(''),
      para(T.templates.letterSignature, undefined, { alignment: 'right' }),
    ], T.templates.letter),
  },
  {
    id: 'cv', label: T.templates.cv, description: T.templates.cvDesc,
    build: () => withBody([
      para(T.templates.cvName, 'Title'),
      para(T.templates.cvContact, 'Subtitle'),
      para(T.templates.cvProfile, 'Heading1'),
      para(T.templates.cvProfileText),
      para(T.templates.cvExperience, 'Heading1'),
      para(T.templates.cvJob, 'Heading2'),
      para(T.templates.cvJobText),
      para(T.templates.cvEducation, 'Heading1'),
      para(T.templates.cvDegree, 'Heading2'),
      para(T.templates.cvSkills, 'Heading1'),
      para(T.templates.cvSkillsText),
    ], T.templates.cv),
  },
  {
    id: 'report', label: T.templates.report, description: T.templates.reportDesc,
    build: () => withBody([
      ...coverPage(T.templates.reportTitle, T.templates.reportSubtitle, ''),
      { type: 'toc', instruction: 'TOC \\o "1-3" \\h \\z \\u', blocks: [para(T.toc.title, 'TOCHeading'), para(T.templates.tocHint, 'TOC1')] },
      para(T.templates.reportIntro, 'Heading1', { pageBreakBefore: true }),
      para(T.templates.lorem, undefined, { alignment: 'justify' }),
      para(T.templates.reportPart, 'Heading1'),
      para(T.templates.reportSub, 'Heading2'),
      para(T.templates.lorem, undefined, { alignment: 'justify' }),
      para(T.templates.reportEnd, 'Heading1'),
      para(T.templates.lorem, undefined, { alignment: 'justify' }),
    ], T.templates.reportTitle),
  },
  {
    id: 'minutes', label: T.templates.minutes, description: T.templates.minutesDesc,
    build: () => withBody([
      para(T.templates.minutesTitle, 'Title'),
      para(T.templates.minutesDate(today()), 'Subtitle'),
      para(T.templates.minutesPresent, 'Heading2'),
      para(T.templates.minutesPresentText),
      para(T.templates.minutesAgenda, 'Heading2'),
      para(T.templates.minutesAgendaText),
      para(T.templates.minutesDecisions, 'Heading2'),
      para(T.templates.minutesDecisionsText),
      para(T.templates.minutesActions, 'Heading2'),
      para(T.templates.minutesActionsText),
    ], T.templates.minutesTitle),
  },
];

/** Page de garde : titre, sous-titre, auteur et date, puis saut de page. */
export function coverPage(title: string, subtitle: string, author: string): Paragraph[] {
  return [
    para('', undefined, { spacingBefore: 180 }),
    para(title, 'Title', { alignment: 'center' }),
    para(subtitle, 'Subtitle', { alignment: 'center' }),
    para('', undefined, { spacingBefore: 220 }),
    para([author, today()].filter(Boolean).join(' — '), undefined, { alignment: 'center' }),
    { type: 'paragraph', props: {}, inlines: [{ type: 'break', kind: 'page' }] },
  ];
}
