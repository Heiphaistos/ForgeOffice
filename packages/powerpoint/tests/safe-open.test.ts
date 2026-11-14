import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isOpenableUrl } from '../src/app/safe-open.ts';

test('seules les adresses web et mailto: sont ouvertes depuis un lien de diaporama', () => {
  for (const ok of ['https://exemple.org/a', 'HTTP://exemple.org', 'mailto:a@b.fr', '  https://exemple.org']) assert.equal(isOpenableUrl(ok), true, ok);
  for (const bad of ['file:///C:/Windows/System32/calc.exe', 'smb://serveur/partage', 'ms-msdt:/id', 'javascript:alert(1)', 'java\tscript:alert(1)', 'data:text/html,x', 'vbscript:x', '\\\\serveur\\partage', 'calc.exe', '']) {
    assert.equal(isOpenableUrl(bad), false, bad);
  }
});
