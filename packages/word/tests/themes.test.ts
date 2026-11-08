// Themes : chaque preset est complet (12 couleurs valides, 2 polices) et applicable ; identifiants uniques.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createBlankDocument } from '@forgeoffice/docx';
import { applyTheme, THEME_PRESETS } from '../src/features/design.ts';
import { T } from '../src/strings.ts';

test('presets complets et uniques', () => {
  assert.ok(THEME_PRESETS.length >= 14);
  assert.equal(new Set(THEME_PRESETS.map((p) => p.id)).size, THEME_PRESETS.length);
  for (const p of THEME_PRESETS) {
    assert.equal(Object.keys(p.colors).length, 12, p.id);
    for (const hex of Object.values(p.colors)) assert.match(hex, /^[0-9A-F]{6}$/, p.id);
    assert.ok(p.majorFont && p.minorFont, p.id);
    assert.ok((T.themes as Record<string, string>)[p.id], `nom francais de ${p.id}`);
  }
});

test('appliquer un theme change couleurs et polices du document', () => {
  const ocean = THEME_PRESETS.find((p) => p.id === 'ocean')!;
  const doc = applyTheme(createBlankDocument(), { colors: ocean.colors, majorFont: ocean.majorFont, minorFont: ocean.minorFont }, 'Océan');
  assert.equal(doc.theme.colors.accent1, '1D6FA3');
  assert.equal(doc.theme.majorFont, 'Segoe UI Semibold');
});
