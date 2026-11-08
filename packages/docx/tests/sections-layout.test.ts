// Sections : alignement vertical de la page et type de debut (nouvelle page, continu, paire, impaire), aller-retour .docx.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBlankDocument, readDocx, writeDocx, type SectionBreakType } from '../src/index.ts';
import { para } from './helpers.ts';

test('section : vAlign et type de debut conserves', async () => {
  for (const [verticalAlign, breakType] of [['center', 'oddPage'], ['bottom', 'evenPage'], ['both', 'continuous']] as const) {
    const doc = createBlankDocument();
    const first = createBlankDocument().finalSection;
    doc.body = [{ ...para('un'), sectionBreak: { ...first } }, para('deux')];
    doc.finalSection = { ...first, verticalAlign, breakType: breakType as SectionBreakType };
    const { document } = await readDocx(await writeDocx(doc));
    assert.equal(document.finalSection.verticalAlign, verticalAlign);
    assert.equal(document.finalSection.breakType, breakType);
  }
});
