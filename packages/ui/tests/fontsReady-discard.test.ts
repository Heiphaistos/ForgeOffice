import { test } from 'node:test';
import assert from 'node:assert/strict';
import { remeasureWhenFontsReady, whenFontsReady, type FontSetLike } from '../src/logic/fontsReady.ts';
import { guardUnsaved } from '../src/logic/discard.ts';

/** Faux document.fonts : les polices n'arrivent qu'a l'appel de `finish()`. */
function fakeFonts() {
  let finish!: () => void;
  const gate = new Promise<void>((r) => { finish = r; });
  const listeners: (() => void)[] = [];
  const loaded: string[] = [];
  const set: FontSetLike = {
    load: (spec) => gate.then(() => { loaded.push(spec); return []; }),
    ready: gate,
    addEventListener: (_t, l) => { listeners.push(l); },
    removeEventListener: (_t, l) => { listeners.splice(listeners.indexOf(l), 1); },
  };
  return { set, finish, listeners, loaded };
}

test('whenFontsReady : attend le chargement des familles (normal et gras)', async () => {
  const f = fakeFonts();
  let done = false;
  const p = whenFontsReady(['Calibri'], 1000, f.set).then(() => { done = true; });
  await Promise.resolve();
  assert.equal(done, false);
  f.finish();
  await p;
  assert.deepEqual(f.loaded, ['12px "Calibri"', 'bold 12px "Calibri"']);
});

test('whenFontsReady : une police qui n\'arrive jamais ne bloque pas (delai)', async () => {
  const never: FontSetLike = { load: () => new Promise(() => undefined), ready: new Promise(() => undefined) };
  await whenFontsReady(['Calibri'], 20, never);
});

test('mesure faite avant le chargement refaite apres', async () => {
  const f = fakeFonts();
  let width = 70; // police de repli tant que Carlito n'est pas chargee
  const measured: number[] = [];
  const measure = (): void => { measured.push(width); };
  measure(); // mesure initiale, AVANT chargement
  const stop = remeasureWhenFontsReady(measure, () => ['Calibri'], { set: f.set });
  assert.deepEqual(measured, [70]);
  width = 62; // la police est arrivee
  f.finish();
  await new Promise((r) => setTimeout(r, 5));
  assert.deepEqual(measured, [70, 62]);
  // un nouveau chargement (police utilisee plus tard) relance aussi la mesure
  width = 61;
  f.listeners.forEach((l) => l());
  assert.deepEqual(measured, [70, 62, 61]);
  stop();
  assert.equal(f.listeners.length, 0);
  f.finish();
});

test('remeasure : arret avant la fin = aucune mesure', async () => {
  const f = fakeFonts();
  let n = 0;
  const stop = remeasureWhenFontsReady(() => { n++; }, [], { set: f.set });
  stop();
  f.finish();
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(n, 0);
});

test('guardUnsaved : intact = passe sans question', async () => {
  assert.equal(await guardUnsaved(false, () => Promise.reject(new Error('ne doit pas demander')), () => Promise.resolve(true)), true);
});

test('guardUnsaved : enregistrer / ne pas enregistrer / annuler', async () => {
  let saved = 0;
  const save = (ok: boolean) => () => { saved++; return Promise.resolve(ok); };
  assert.equal(await guardUnsaved(true, () => Promise.resolve('save'), save(true)), true);
  assert.equal(await guardUnsaved(true, () => Promise.resolve('save'), save(false)), false);
  assert.equal(saved, 2);
  assert.equal(await guardUnsaved(true, () => Promise.resolve('discard'), save(true)), true);
  assert.equal(saved, 2);
  assert.equal(await guardUnsaved(true, () => Promise.resolve('cancel'), save(true)), false);
  assert.equal(saved, 2);
});

test('pinchZoom : proportionnel a l\'ecart des doigts, borne', async () => {
  const { pinchZoom } = await import('../src/logic/zoom.ts');
  assert.equal(pinchZoom(100, 100, 150), 150);
  assert.equal(pinchZoom(100, 100, 50), 50);
  assert.equal(pinchZoom(100, 100, 100000), 500);
  assert.equal(pinchZoom(100, 100, 1), 10);
  assert.equal(pinchZoom(70, 0, 90), 70);
  assert.equal(pinchZoom(100, 100, 10, 70, 300), 70);
});

test('createFontsEpoch : change quand des polices finissent de charger, un seul ecouteur', async () => {
  const { createFontsEpoch } = await import('../src/logic/fontsReady.ts');
  const f = fakeFonts();
  const epoch = createFontsEpoch(f.set);
  let calls = 0;
  const off1 = epoch.subscribe(() => { calls++; });
  const off2 = epoch.subscribe(() => { calls++; });
  assert.equal(epoch.get(), 0);
  assert.equal(f.listeners.length, 1);
  f.listeners.forEach((l) => l());
  assert.equal(epoch.get(), 1);
  assert.equal(calls, 2);
  off1();
  f.finish();
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(epoch.get(), 2);
  assert.equal(calls, 3);
  off2();
});
