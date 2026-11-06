// Ouvre un fichier dans le module qui le prend en charge (depot sur l'accueil) et capture l'ecran.
import { readFileSync } from 'node:fs';
import { launch, sleep } from './harness.mjs';
const [file, app, shot, wait = '2500'] = process.argv.slice(2);
const b = await launch({ port: 9631 });
try {
  await b.viewport(1440, 900);
  await b.goto('http://127.0.0.1:5371/?app=hub');
  await b.drop('.hub', file.split(/[\/]/).pop(), readFileSync(file));
  await b.waitFor(`document.documentElement.dataset.app === ${JSON.stringify(app)}`, 20000);
  await b.waitFor(`!/^(Texte|Tableur|Présentation|Publication|Bloc-notes|PDF|Convertisseur|Base de données) - ForgeOffice$/.test(document.title)`, 20000); await sleep(Number(wait));
  await b.shot(shot);
  console.log(b.consoleLog.slice(0, 8));
} finally { await b.close(); }
