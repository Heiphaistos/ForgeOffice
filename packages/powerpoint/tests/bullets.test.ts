import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ParagraphProps } from '@forgeoffice/pptx';
import { applyBulletForm, bulletForm } from '../src/app/bullet-model.ts';

const hex = (): string => '#336699';
const toColor = (h: string): NonNullable<ParagraphProps['bulletColor']> => ({ type: 'rgb', value: h.slice(1).toUpperCase() });

test('formulaire depuis une numerotation personnalisee', () => {
  const f = bulletForm({ bullet: { type: 'auto', scheme: 'romanUcPeriod', startAt: 4 }, bulletSize: { type: 'pct', value: 80 }, bulletColor: { type: 'rgb', value: '336699' } }, hex);
  assert.deepEqual([f.kind, f.scheme, f.startAt, f.size, f.color], ['auto', 'romanUcPeriod', 4, 80, '#336699']);
});

test('puce symbole : police, couleur, taille et retrait suspendu poses', () => {
  const f = { ...bulletForm({}, hex), kind: 'char' as const, char: '★', font: 'Segoe UI Symbol', color: '#FF0000', size: 120 };
  const p = applyBulletForm({ level: 1 }, f, toColor);
  assert.deepEqual(p.bullet, { type: 'char', char: '★' });
  assert.equal(p.bulletFont, 'Segoe UI Symbol');
  assert.deepEqual(p.bulletColor, { type: 'rgb', value: 'FF0000' });
  assert.deepEqual(p.bulletSize, { type: 'pct', value: 120 });
  assert.equal(p.marginLeft, 45);
  assert.equal(p.indent, -22.5);
});

test('numerotation commencant a 5, puis retour a aucune puce', () => {
  const f = { ...bulletForm({}, hex), kind: 'auto' as const, scheme: 'alphaLcParenR', startAt: 5 };
  const p = applyBulletForm({ bulletFont: 'Arial' }, f, toColor);
  assert.deepEqual(p.bullet, { type: 'auto', scheme: 'alphaLcParenR', startAt: 5 });
  assert.equal(p.bulletFont, undefined);
  const none = applyBulletForm(p, { ...f, kind: 'none' }, toColor);
  assert.deepEqual(none.bullet, { type: 'none' });
});

test('puce image : media conserve, sans image choisie la puce reste inchangee', () => {
  const f = { ...bulletForm({}, hex), kind: 'image' as const, mediaId: 'media7' };
  const p = applyBulletForm({ level: 0 }, f, toColor);
  assert.deepEqual(p.bullet, { type: 'image', mediaId: 'media7' });
  assert.equal(p.marginLeft, 22.5);
  assert.deepEqual(applyBulletForm({ bullet: { type: 'char', char: '•' } }, { ...f, mediaId: undefined }, toColor).bullet, { type: 'char', char: '•' });
  assert.equal(bulletForm({ bullet: { type: 'image', mediaId: 'm1' } }, hex).mediaId, 'm1');
});
