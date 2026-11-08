// Import CSV : decodage, delimiteur, encodage.
import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeLines, detectDelimiter, detectEncoding } from '../src/logic/csv-import.ts';

const bytes = (s: string): Uint8Array => new TextEncoder().encode(s);

test('decodage : BOM retire, lignes vides internes gardees, finales ignorees', () => {
  assert.deepEqual(decodeLines(new Uint8Array([0xef, 0xbb, 0xbf, ...bytes('a;b\r\n\r\nc;d\r\n\r\n')]), 'utf-8'), ['a;b', null, 'c;d']);
});

test('delimiteur : tab, point-virgule, virgule', () => {
  assert.equal(detectDelimiter(['a;b;c', '1;2;3']), ';');
  assert.equal(detectDelimiter(['a\tb', '1\t2']), '\t');
  assert.equal(detectDelimiter(['a,b,c;']), ',');
  assert.equal(detectDelimiter(['rien']), ',');
});

test('encodage : UTF-8 valide, sinon Windows-1252 ; accents decodes', () => {
  assert.equal(detectEncoding(bytes('été')), 'utf-8');
  const latin = new Uint8Array([0xe9, 0x74, 0xe9]);
  assert.equal(detectEncoding(latin), 'windows-1252');
  assert.deepEqual(decodeLines(latin, 'windows-1252'), ['été']);
});
