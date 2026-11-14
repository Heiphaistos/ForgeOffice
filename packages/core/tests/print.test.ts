import assert from 'node:assert/strict';
import { test } from 'node:test';
import { afterPrint } from '../src/print.ts';

function fakeWindow(): EventTarget & { setTimeout: typeof setTimeout; clearTimeout: typeof clearTimeout } {
  const w = new EventTarget() as EventTarget & { setTimeout: typeof setTimeout; clearTimeout: typeof clearTimeout };
  w.setTimeout = setTimeout;
  w.clearTimeout = clearTimeout;
  return w;
}

test('afterPrint : attend l evenement afterprint, une seule fois', () => {
  const w = fakeWindow();
  (globalThis as { window?: unknown }).window = w;
  let n = 0;
  afterPrint(() => n++, 60_000);
  assert.equal(n, 0, 'rien tant que la boite d impression est ouverte');
  w.dispatchEvent(new Event('afterprint'));
  w.dispatchEvent(new Event('afterprint'));
  assert.equal(n, 1);
});

test('afterPrint : filet si afterprint n arrive jamais', async () => {
  (globalThis as { window?: unknown }).window = fakeWindow();
  let n = 0;
  afterPrint(() => n++, 10);
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(n, 1);
});
