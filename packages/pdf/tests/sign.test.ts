// Signature numerique PKCS#7 detachee : creation avec un .pfx (RSA AES/3DES, ECDSA), verification d'integrite, controle croise OpenSSL.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PDFDocument, PDFHexString, PDFName, PDFDict, StandardFonts, degrees } from '@cantoo/pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { parsePkcs12 } from '../src/sign/pkcs12.ts';
import { signPdf } from '../src/sign/pdfsign.ts';
import { verifySignatures } from '../src/sign/verify.ts';
import { parseCert } from '../src/sign/cms.ts';
import { readFields } from '../src/forms.ts';

const fixture = (name: string): Uint8Array => readFileSync(new URL(`./fixtures/${name}.p12`, import.meta.url));

async function sample(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < 2; i++) doc.addPage([600, 800]).drawText(`Contrat page ${i + 1}`, { x: 60, y: 700, size: 20, font });
  return doc.save();
}

test('PKCS#12 : AES (PBES2), 3DES (PBE SHA1) et ECDSA lus, mauvais mot de passe refuse', async () => {
  for (const name of ['rsa-aes', 'rsa-3des', 'ec-aes']) {
    const p = await parsePkcs12(fixture(name), 'forge');
    assert.ok(p.key.length > 100 && p.certs.length === 1, name);
    assert.match(parseCert(p.certs[0] as Uint8Array).commonName, /^(Elodie Test|EC Test)$/);
    await assert.rejects(parsePkcs12(fixture(name), 'faux'), /incorrect/);
  }
  const c = parseCert((await parsePkcs12(fixture('rsa-aes'), 'forge')).certs[0] as Uint8Array);
  assert.ok(c.selfSigned && c.notAfter > new Date() && c.subject.includes('O=ForgeOffice'));
});

for (const name of ['rsa-aes', 'rsa-3des', 'ec-aes']) {
  test(`signature ${name} : creee, verifiee, alteration detectee`, async () => {
    const signed = await signPdf(await sample(), { pfx: fixture(name), password: 'forge', reason: 'Approbation', location: 'Lyon', now: new Date(Date.UTC(2026, 10, 5, 12, 0, 0)) });
    // le fichier reste un PDF lisible (pdf-lib et pdf.js)
    assert.equal((await PDFDocument.load(signed)).getPageCount(), 2);
    const task = getDocument({ data: signed.slice(), useWorkerFetch: false, verbosity: 0 });
    assert.equal((await task.promise).numPages, 2);
    await task.destroy();

    const [r, ...rest] = await verifySignatures(signed);
    assert.equal(rest.length, 0);
    assert.ok(r);
    assert.equal(r.integrity, 'ok');
    assert.equal(r.signature, 'ok');
    assert.equal(r.coversAll, true);
    assert.match(r.signer, /Elodie Test|EC Test/);
    assert.equal(r.reason, 'Approbation');
    assert.equal(r.location, 'Lyon');
    assert.equal(r.field, 'Signature1');
    assert.equal(r.signedAt?.toISOString(), '2026-11-05T12:00:00.000Z');
    assert.ok(r.warnings.includes('chain') && r.warnings.includes('selfSigned'), `avertissements : ${r.warnings.join(',')}`);

    // un octet change dans la zone couverte : l'integrite tombe
    const tampered = signed.slice();
    tampered[7] = (tampered[7] ?? 0) ^ 1; // version de l'en-tete
    assert.equal((await verifySignatures(tampered))[0]?.integrity, 'modified');

    // octets ajoutes apres la signature : integrite intacte mais signalee
    const extended = new Uint8Array(signed.length + 32);
    extended.set(signed);
    extended.set(new TextEncoder().encode('\n%%ajout apres signat'), signed.length);
    const after = (await verifySignatures(extended))[0];
    assert.equal(after?.integrity, 'ok');
    assert.equal(after?.coversAll, false);
    assert.ok(after?.warnings.includes('afterSigning'));
  });
}

test('signature visible sur une page pivotee + controle croise OpenSSL (cms -verify)', async (t) => {
  const base = await PDFDocument.load(await sample());
  base.getPage(0).setRotation(degrees(90));
  const signed = await signPdf(await base.save(), { pfx: fixture('rsa-aes'), password: 'forge', page: 0, rect: { x: 0.1, y: 0.1, w: 0.4, h: 0.1 } });
  const doc = await PDFDocument.load(signed);
  const fields = doc.getForm().getFields();
  assert.equal(fields.length, 1);
  const widget = fields[0]?.acroField.getWidgets()[0];
  assert.ok(widget?.dict.lookup(PDFName.of('AP'), PDFDict).has(PDFName.of('N')), 'apparence visible');
  assert.equal((await verifySignatures(signed))[0]?.integrity, 'ok');

  if (spawnSync('openssl', ['version']).status !== 0) {
    t.skip('openssl absent');
    return;
  }
  // octets signes + CMS tels que OpenSSL les lit
  const obj = [...(doc.context.enumerateIndirectObjects())].map(([, o]) => o).find((o): o is PDFDict => o instanceof PDFDict && o.has(PDFName.of('ByteRange')));
  assert.ok(obj);
  const cms = (obj.lookup(PDFName.of('Contents')) as PDFHexString).asBytes();
  const br = (obj.lookup(PDFName.of('ByteRange')) as unknown as { asArray(): { asNumber(): number }[] }).asArray().map((x) => x.asNumber());
  const content = Buffer.concat([signed.subarray(br[0], (br[0] ?? 0) + (br[1] ?? 0)), signed.subarray(br[2], (br[2] ?? 0) + (br[3] ?? 0))]);
  const dir = mkdtempSync(join(tmpdir(), 'forgesign-'));
  try {
    writeFileSync(join(dir, 'sig.der'), cms);
    writeFileSync(join(dir, 'content.bin'), content);
    const ok = spawnSync('openssl', ['cms', '-verify', '-binary', '-inform', 'DER', '-in', join(dir, 'sig.der'), '-content', join(dir, 'content.bin'), '-noverify', '-out', join(dir, 'out.bin')], { encoding: 'utf8' });
    assert.equal(ok.status, 0, ok.stderr);
    assert.match(ok.stderr, /Verification successful/);
    // le meme CMS ne valide pas un contenu altere
    writeFileSync(join(dir, 'content.bin'), Buffer.concat([content, Buffer.from('x')]));
    const ko = spawnSync('openssl', ['cms', '-verify', '-binary', '-inform', 'DER', '-in', join(dir, 'sig.der'), '-content', join(dir, 'content.bin'), '-noverify', '-out', join(dir, 'out.bin')], { encoding: 'utf8' });
    assert.notEqual(ko.status, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('un document non signe n a aucun rapport ; mauvais mot de passe : aucune signature produite', async () => {
  assert.deepEqual(await verifySignatures(await sample()), []);
  await assert.rejects(signPdf(await sample(), { pfx: fixture('rsa-aes'), password: 'nope' }), /incorrect/);
});

test('champ de signature lu comme tel (signe) apres la signature', async () => {
  const signed = await signPdf(await sample(), { pfx: fixture('rsa-aes'), password: 'forge', page: 1, rect: { x: 0.1, y: 0.1, w: 0.3, h: 0.05 } });
  const fields = await readFields(signed);
  assert.equal(fields.length, 1);
  assert.deepEqual([fields[0]?.type, fields[0]?.signed, fields[0]?.widgets[0]?.page], ['signature', true, 1]);
  assert.ok(Math.abs((fields[0]?.widgets[0]?.rect.w ?? 0) - 0.3) < 0.005);
});
