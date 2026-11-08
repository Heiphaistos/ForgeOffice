// Protection par mot de passe : empreinte SHA-512 salee, verification, aller-retour .docx.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBlankDocument, hashPassword, readDocx, verifyPassword, writeDocx } from '../src/index.ts';

test('empreinte : deterministe pour un sel donne, differente sinon', async () => {
  const a = await hashPassword('secret', 'AAECAwQFBgcICQoLDA0ODw==', 50);
  const b = await hashPassword('secret', 'AAECAwQFBgcICQoLDA0ODw==', 50);
  assert.deepEqual(a, b);
  assert.notEqual((await hashPassword('autre', 'AAECAwQFBgcICQoLDA0ODw==', 50)).hash, a.hash);
  assert.notEqual((await hashPassword('secret', undefined, 50)).salt, a.salt);
  assert.equal(atob(a.hash).length, 64);
});

test('verification du mot de passe', async () => {
  const stored = await hashPassword('Forge2026', undefined, 100);
  assert.equal(await verifyPassword('Forge2026', stored), true);
  assert.equal(await verifyPassword('forge2026', stored), false);
});

test('aller-retour .docx : protection et empreinte conservees', async () => {
  const doc = createBlankDocument();
  const password = await hashPassword('mdp', undefined, 200);
  doc.settings.protection = { kind: 'readOnly', enforced: true, password };
  const { document } = await readDocx(await writeDocx(doc));
  assert.deepEqual(document.settings.protection, { kind: 'readOnly', enforced: true, password });
  assert.equal(await verifyPassword('mdp', document.settings.protection!.password!), true);
});

test('protection sans mot de passe', async () => {
  const doc = createBlankDocument();
  doc.settings.protection = { kind: 'trackedChanges', enforced: true };
  const { document } = await readDocx(await writeDocx(doc));
  assert.deepEqual(document.settings.protection, { kind: 'trackedChanges', enforced: true });
});
