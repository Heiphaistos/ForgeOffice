// Recupere les polices libres embarquees (SIL OFL 1.1) dans packages/ui/fonts/ : Carlito, Liberation, Selawik.
//   node scripts/fetch-fonts.mjs
// Sans dependance. Chaque archive et chaque fichier est verifie par SHA-256 : un ecart interrompt tout.
// Idempotent : si les fichiers presents ont deja la bonne empreinte, rien n'est telecharge.
// Les .ttf sont commites : la compilation ne depend pas du reseau.
// Empreintes Liberation 2.1.5 et Carlito 1.104 : reprises de ForgeOffice-etude/scripts/prepare-fonts.sh.
// Empreintes Selawik 1.01 et fichiers de licence : calculees au premier telechargement, qui fait foi.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync, inflateRawSync } from 'node:zlib';

const OUT = join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), 'packages', 'ui', 'fonts');
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

const LIBERATION_URL = 'https://github.com/liberationfonts/liberation-fonts/files/7261482/liberation-fonts-ttf-2.1.5.tar.gz';
const LIBERATION_TAR_SHA256 = '7191c669bf38899f73a2094ed00f7b800553364f90e2637010a69c0e268f25d0';
const CARLITO_BASE = 'https://github.com/googlefonts/carlito/raw/3a810cab78ebd6e2e4eed42af9e8453c4f9b850a'; // Carlito 1.104 (commit)
const SELAWIK_URL = 'https://github.com/microsoft/Selawik/releases/download/1.01/Selawik_Release.zip';
const SELAWIK_ZIP_SHA256 = '3f62c51e05e3b5a1e6241cf92a371f0be2ea1183aa87b30718bbd40832a8d423';
const SELAWIK_LICENSE_URL = 'https://raw.githubusercontent.com/microsoft/Selawik/b65ff9ce7c4673e75ec5c622924a6b6f61f2f876/LICENSE.txt';

// nom installe -> empreinte
const LIBERATION = {
  'LiberationSans-Regular.ttf': '76d04c18ea243f426b7de1f3ad208e927008f961dc5945e5aad352d0dfde8ee8',
  'LiberationSans-Italic.ttf': 'e5bae5c4cde31f22142753855f4f8fb86da6ff39955ed3c0a11248b0d16948b0',
  'LiberationSans-Bold.ttf': '788abee4c806d660e8aee46689dd8540cd4bb98da03dcc9d171ce3efd99a9173',
  'LiberationSans-BoldItalic.ttf': '698da70fc191cc5f33ad4d6d3fe830fe4624b898ea2e3169955928b7c491f1ee',
  'LiberationSerif-Regular.ttf': '058ea80864aef09a23f45cbec2bb5400bc3dfbdea01c3f10538a21fcb497fb74',
  'LiberationSerif-Italic.ttf': '0e3dea9f8d613e006ccfa62201f33e265d19167bd0907725c3e145368b04fc2e',
  'LiberationSerif-Bold.ttf': 'd754ba427cfe0bca54ae052384baa8f842da5bd6550ad4da024ac441e7a7d5ce',
  'LiberationSerif-BoldItalic.ttf': 'f17db8af71e24d2066b587546021d4f0b296be389512b658dec3c09affeb11a7',
  'LiberationMono-Regular.ttf': 'f2b83c763e8afd21709333370bed4774337fae82267937e2b5aea7e2fbd922c1',
  'LiberationMono-Italic.ttf': '605c01c711b44480a7508d349dfbf3264e81fa43d69e61cfa7d10b86e764c4d1',
  'LiberationMono-Bold.ttf': 'bd62a0672d0b9b6710b01df434c80ad54fa5f0835207eb7b17b7a761463067bb',
  'LiberationMono-BoldItalic.ttf': '79451f3c09fe25116098853b7a2ca6e2436220ccc11af022979adbcf195be130',
};
const CARLITO = {
  'Carlito-Regular.ttf': 'f6418f708baede9789daef5d458c0f53d2a888af9820e8062934e504fedc6595',
  'Carlito-Italic.ttf': '0b019225e58d702bfedcbd35c21696769f8ee115cb6343f84c2f240312450d1c',
  'Carlito-Bold.ttf': 'bb5d20f79b82599ec72983597437373a80f2d2085fa91fc144fd74e876a594db',
  'Carlito-BoldItalic.ttf': 'b32928186c119599e03ca6a1ffc680fdcb7fac95772f4b95d989cf6cd3861517',
};
// nom dans le zip -> [nom installe, empreinte]
const SELAWIK = {
  'selawk.ttf': ['Selawik-Regular.ttf', 'e9d98518d8ac2817782a9a382430463a2e0793ea68350b695bb727d9a830ee1c'],
  'selawkb.ttf': ['Selawik-Bold.ttf', 'f0db5e174a90e0956ad7d2844bdca1d5e6da92ec65b2c04e57ba9b180668c904'],
  'selawkl.ttf': ['Selawik-Light.ttf', '8e19d073091a1e869b5b0d48b925e605c0a4c6ece7df7b22a364fb065314c4c5'],
  'selawksb.ttf': ['Selawik-Semibold.ttf', '0a9e9d0549a10f24bef9b3a29e06fe6e0b5c21e7a784c503b048a307841a7783'],
  'selawksl.ttf': ['Selawik-Semilight.ttf', '8620960344f12093482cded984a1aafa5a57d24cbf7e9299da125ccf0e9d4102'],
};
// fichier de licence installe -> empreinte
const LICENSES = {
  'OFL-Liberation.txt': '93fed46019c38bbe566b479d22148e2e8a1e85ada614accb0211c37b2c61c19b',
  'OFL-Carlito.txt': '58402f82a7c332a700294988fe7554fbb0a63a8d27ccc1ee3bbc640311990a00',
  'OFL-Selawik.txt': '77b7c2506d4efb22e09c8ccf10159f4956eab3ef7c007fef95de136bcf45300c',
};

const wanted = [
  ...Object.entries(LIBERATION), ...Object.entries(CARLITO),
  ...Object.values(SELAWIK), ...Object.entries(LICENSES),
];

function ok(name, hash) {
  const p = join(OUT, name);
  return existsSync(p) && sha256(readFileSync(p)) === hash;
}

async function download(url, expected) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status} pour ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (expected && sha256(buf) !== expected) throw new Error(`empreinte differente pour ${url} : ${sha256(buf)}`);
  return buf;
}

/** Fichiers d'une archive tar.gz : Map(nom de base -> octets). */
function untar(gz) {
  const tar = gunzipSync(gz);
  const files = new Map();
  for (let off = 0; off + 512 <= tar.length && tar[off] !== 0; ) {
    const name = tar.toString('latin1', off, off + 100).replace(/\0.*$/, '');
    const size = parseInt(tar.toString('latin1', off + 124, off + 136).replace(/\0.*$/, '').trim(), 8);
    if (tar[off + 156] === 0x30 || tar[off + 156] === 0) files.set(name.split('/').pop(), tar.subarray(off + 512, off + 512 + size));
    off += 512 + Math.ceil(size / 512) * 512;
  }
  return files;
}

/** Fichiers d'un zip (methodes 0 et 8) : Map(nom -> octets), lus par le repertoire central. */
function unzip(zip) {
  const eocd = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error('zip invalide');
  const files = new Map();
  let p = zip.readUInt32LE(eocd + 16);
  for (let i = 0, n = zip.readUInt16LE(eocd + 10); i < n; i++) {
    const method = zip.readUInt16LE(p + 10);
    const csize = zip.readUInt32LE(p + 20);
    const nameLen = zip.readUInt16LE(p + 28);
    const extraLen = zip.readUInt16LE(p + 30);
    const commentLen = zip.readUInt16LE(p + 32);
    const local = zip.readUInt32LE(p + 42);
    const name = zip.toString('utf8', p + 46, p + 46 + nameLen);
    const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    const data = zip.subarray(start, start + csize);
    if (method !== 0 && method !== 8) throw new Error(`methode zip ${method} non geree`);
    files.set(name, method === 8 ? inflateRawSync(data) : data);
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

function install(name, bytes, hash) {
  if (sha256(bytes) !== hash) throw new Error(`empreinte differente pour ${name} : ${sha256(bytes)}`);
  writeFileSync(join(OUT, name), bytes);
}

mkdirSync(OUT, { recursive: true });
if (wanted.every(([name, hash]) => ok(name, hash))) {
  console.log(`polices deja presentes et verifiees (${wanted.length} fichiers)`);
} else {
  const lib = untar(await download(LIBERATION_URL, LIBERATION_TAR_SHA256));
  for (const [name, hash] of Object.entries(LIBERATION)) install(name, lib.get(name) ?? Buffer.alloc(0), hash);
  install('OFL-Liberation.txt', lib.get('LICENSE') ?? Buffer.alloc(0), LICENSES['OFL-Liberation.txt']);

  for (const [name, hash] of Object.entries(CARLITO)) install(name, await download(`${CARLITO_BASE}/fonts/ttf/${name}`, hash), hash);
  install('OFL-Carlito.txt', await download(`${CARLITO_BASE}/OFL.txt`), LICENSES['OFL-Carlito.txt']);

  const sel = unzip(await download(SELAWIK_URL, SELAWIK_ZIP_SHA256));
  for (const [inZip, [name, hash]] of Object.entries(SELAWIK)) install(name, sel.get(inZip) ?? Buffer.alloc(0), hash);
  install('OFL-Selawik.txt', await download(SELAWIK_LICENSE_URL), LICENSES['OFL-Selawik.txt']);
  console.log(`${wanted.length} fichiers installes et verifies dans ${OUT}`);
}
