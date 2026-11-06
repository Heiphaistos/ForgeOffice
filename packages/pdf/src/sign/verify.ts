// Verification des signatures numeriques d'un PDF : integrite (/ByteRange + empreinte), signature cryptographique du signataire,
// couverture du fichier, validite du certificat a la date de signature. La CHAINE de certification n'est jamais verifiee
// (pas de magasin de confiance) : elle reste toujours un avertissement.
import { PDFArray, PDFDict, PDFHexString, PDFName, PDFNumber, PDFSignature, PDFString, PDFRef } from '@cantoo/pdf-lib';
import { loadForRead } from '../forms.ts';
import { concat } from './der.ts';
import { digest, parseSignedData, signerCert, verifyCryptoSignature, type CertInfo } from './cms.ts';

/** Avertissements (codes ; les textes sont dans strings.ts). */
export type SignWarning = 'chain' | 'selfSigned' | 'expired' | 'notYetValid' | 'afterSigning' | 'unsupported' | 'noCert' | 'badRange';

export interface SignatureReport {
  field: string;
  signer: string;
  issuer: string;
  signedAt: Date | null;
  reason: string;
  location: string;
  /** Le contenu couvert par /ByteRange correspond a l'empreinte signee. */
  integrity: 'ok' | 'modified' | 'unknown';
  /** La signature du signataire est valide pour ces attributs (null = algorithme non gere). */
  signature: 'ok' | 'invalid' | 'unknown';
  /** Les plages couvrent tout le fichier (rien n'a ete ajoute apres la signature). */
  coversAll: boolean;
  cert: CertInfo | null;
  warnings: SignWarning[];
}

const N = (s: string): PDFName => PDFName.of(s);
const str = (d: PDFDict, k: string): string => {
  const v = d.lookup(N(k));
  return v instanceof PDFString || v instanceof PDFHexString ? v.decodeText() : '';
};

function dateOf(raw: string): Date | null {
  const m = raw.match(/^D:(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
  return m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6]))) : null;
}

/** Signatures du fichier, verifiees sur les octets tels qu'enregistres. */
export async function verifySignatures(bytes: Uint8Array): Promise<SignatureReport[]> {
  const doc = await loadForRead(bytes);
  const names = new Map<string, string>();
  try {
    for (const f of doc.getForm().getFields()) {
      if (!(f instanceof PDFSignature)) continue;
      const v = f.acroField.dict.get(N('V'));
      if (v instanceof PDFRef) names.set(v.toString(), f.getName());
    }
  } catch {
    names.clear(); // formulaire illisible (fichier endommage) : les signatures restent verifiees, sans nom de champ
  }
  const reports: SignatureReport[] = [];
  for (const [ref, obj] of doc.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFDict) || !obj.has(N('ByteRange')) || !obj.has(N('Contents'))) continue;
    const range = obj.lookup(N('ByteRange'));
    const contents = obj.lookup(N('Contents'));
    const warnings: SignWarning[] = [];
    const report: SignatureReport = {
      field: names.get(ref.toString()) ?? `Signature ${reports.length + 1}`, signer: '', issuer: '', signedAt: dateOf(str(obj, 'M')), reason: str(obj, 'Reason'), location: str(obj, 'Location'),
      integrity: 'unknown', signature: 'unknown', coversAll: false, cert: null, warnings,
    };
    reports.push(report);
    report.signer = str(obj, 'Name');
    const nums = range instanceof PDFArray ? Array.from({ length: range.size() }, (_, i) => (range.lookup(i) as PDFNumber | undefined)?.asNumber() ?? NaN) : [];
    const [a = 0, b = 0, c = 0, d = 0] = nums;
    const valid = nums.length === 4 && nums.every((x) => Number.isInteger(x) && x >= 0) && a === 0 && b <= c && c + d <= bytes.length;
    if (!valid || !(contents instanceof PDFHexString)) {
      warnings.push('badRange');
      report.integrity = 'modified';
      continue;
    }
    report.coversAll = c + d === bytes.length;
    if (!report.coversAll) warnings.push('afterSigning');
    const signed = concat(bytes.subarray(a, a + b), bytes.subarray(c, c + d));
    try {
      const p = parseSignedData(contents.asBytes());
      if (p.hash && p.messageDigest) {
        const actual = await digest(p.hash, signed);
        report.integrity = actual.length === p.messageDigest.length && actual.every((x, i) => x === p.messageDigest?.[i]) ? 'ok' : 'modified';
      }
      if (p.signingTime) report.signedAt = p.signingTime;
      const found = signerCert(p);
      if (!found) {
        warnings.push('noCert');
      } else {
        report.cert = found.info;
        report.signer = found.info.commonName;
        report.issuer = found.info.issuer;
        const ok = await verifyCryptoSignature(p, found.info, signed);
        report.signature = ok === null ? 'unknown' : ok ? 'ok' : 'invalid';
        if (ok === null) warnings.push('unsupported');
        const at = report.signedAt ?? new Date();
        if (at < found.info.notBefore) warnings.push('notYetValid');
        else if (at > found.info.notAfter) warnings.push('expired');
        if (found.info.selfSigned) warnings.push('selfSigned');
      }
      warnings.push('chain');
    } catch {
      report.integrity = 'unknown';
      warnings.push('unsupported');
    }
  }
  return reports;
}
