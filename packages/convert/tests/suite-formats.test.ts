// Conversions par les paquets de la suite : formats de sortie macro/modele et OpenDocument ajoutes au Convertisseur.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convertFile, DEFAULT_OPTIONS } from '../src/engines.ts';
import { planEngine, targetsFor } from '../src/formats.ts';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);
const run = (name: string, bytes: Uint8Array, target: string) => {
  const engine = planEngine(name.split('.').pop() ?? '', target, false);
  assert.ok(engine, `${name} -> ${target} doit etre planifie`);
  return convertFile({ name, bytes }, target, engine, `sortie.${target}`, null, DEFAULT_OPTIONS);
};
const isZip = (b: Uint8Array): boolean => b[0] === 0x50 && b[1] === 0x4b;
const zipText = async (b: Uint8Array, entry: string): Promise<string> => {
  const { default: JSZip } = await import('jszip');
  return (await JSZip.loadAsync(b)).file(entry)?.async('string') ?? '';
};

test('texte : docm, dotx, dotm en sortie, ott/dot/xhtml/text en entree', async () => {
  for (const t of ['docm', 'dotx', 'dotm']) {
    const [out] = await run('note.txt', enc('Bonjour'), t);
    assert.ok(out && isZip(out.bytes), t);
    assert.match(await zipText(out.bytes, '[Content_Types].xml'), t === 'docm' ? /macroEnabled/ : t === 'dotx' ? /template/ : /macroEnabled/, t);
  }
  assert.ok(targetsFor('ott', false).includes('docx'));
  assert.ok(targetsFor('xhtml', false).includes('md'));
  assert.ok(targetsFor('text', false).includes('odt'));
  assert.ok(targetsFor('dot', false).includes('docx'));
});

test('tableur : xlsm, xltx, xltm en sortie', async () => {
  for (const t of ['xlsm', 'xltx', 'xltm']) {
    const [out] = await run('t.csv', enc('a;b\n1;2\n'), t);
    assert.ok(out && isZip(out.bytes), t);
    assert.match(await zipText(out.bytes, '[Content_Types].xml'), t === 'xltx' ? /template/ : /macroEnabled/, t);
  }
});

test('presentation : pptx vers odp, pptm, ppsm, potm ; pps/pot en entree', async () => {
  const pptx = await import('@forgeoffice/pptx');
  const deck = pptx.createBlankDeck();
  const src = await pptx.writePptx(deck);
  const [odp] = await run('d.pptx', src, 'odp');
  assert.match(await zipText(odp!.bytes, 'mimetype'), /opendocument\.presentation/);
  for (const t of ['pptm', 'ppsm', 'potm']) {
    const [out] = await run('d.pptx', src, t);
    assert.match(await zipText(out!.bytes, '[Content_Types].xml'), /macroEnabled/, t);
  }
  assert.ok(targetsFor('pps', false).includes('pptx'));
  assert.ok(targetsFor('pot', false).includes('odp'));
});

test('fichiers chiffres (Word, Excel, PowerPoint) : mot de passe requis, refuse, puis accepte', async () => {
  const { readFileSync } = await import('node:fs');
  const { passwordReason } = await import('../src/password.ts');
  const fixture = (n: string): Uint8Array => new Uint8Array(readFileSync(new URL(`../../opc/tests/fixtures/${n}`, import.meta.url)));
  for (const [file, target] of [['word-agile.docx', 'odt'], ['excel-agile.xlsx', 'ods'], ['powerpoint-agile.pptx', 'odp']] as const) {
    const bytes = fixture(file);
    const engine = planEngine(file.split('.').pop() ?? '', target, false);
    assert.ok(engine, file);
    const go = (pw?: string) => convertFile({ name: file, bytes }, target, engine, `s.${target}`, null, DEFAULT_OPTIONS, pw);
    await assert.rejects(go(), (e: unknown) => passwordReason(e) === 'required', `${file} sans mot de passe`);
    await assert.rejects(go('faux'), (e: unknown) => passwordReason(e) === 'wrong', `${file} mauvais mot de passe`);
    const [out] = await go('Forge2026!');
    assert.ok(out && out.bytes[0] === 0x50, `${file} deverrouille`);
  }
  assert.equal(passwordReason(new Error('autre')), null);
});
