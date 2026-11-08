// Boite « Puces et numéros » : symbole ou numérotation, police du symbole, couleur, taille, « commencer par ».
import { useState } from 'react';
import { Button, Dialog, NumberField } from '@forgeoffice/ui';
import { addMedia } from '@forgeoffice/pptx';
import { S } from '../strings.ts';
import { S3 } from './strings-text.ts';
import type { Editor } from './editor.ts';
import { applyParagraph, colorFromHex, currentParagraph, hexOf } from './format.ts';
import { IMAGE_FILTERS, extensionOf } from './insert.ts';
import { NUMBER_SCHEMES, SYMBOLS, applyBulletForm, bulletForm, type BulletForm, type BulletKind } from './bullet-model.ts';

const NUMBER_NAMES = S.home.numberNames as Readonly<Record<string, string>>;

export function BulletsDialog({ ed, onClose }: { ed: Editor; onClose: () => void }) {
  const [form, setForm] = useState<BulletForm>(() => bulletForm(currentParagraph(ed), (c) => (c === 'text' ? null : hexOf(ed, c))));
  const patch = <K extends keyof BulletForm>(key: K, value: BulletForm[K]): void => setForm((f) => ({ ...f, [key]: value }));
  const B = S3.bullets;
  const [picked, setPicked] = useState<{ name: string; bytes: Uint8Array } | null>(null);
  const choose = async (): Promise<void> => {
    const file = await ed.services.openFile(IMAGE_FILTERS);
    if (file) {
      setPicked({ name: file.name, bytes: file.bytes });
      setForm((f) => ({ ...f, kind: 'image' }));
    }
  };
  const ok = (): void => {
    const final = { ...form };
    const apply = (): void => applyParagraph(ed, (props) => applyBulletForm(props, final, (hex) => colorFromHex(ed, hex)), 'bullets-dialog');
    if (picked && final.kind === 'image') {
      const deck = { ...ed.deck, media: { ...ed.deck.media } };
      const ext = extensionOf(picked.name);
      final.mediaId = addMedia(deck, picked.bytes, ext === 'jpg' ? 'jpeg' : ext);
      ed.commit(deck, 'bullets-dialog');
      // Le paragraphe est modifie apres le rendu qui porte le nouveau media (l'edition part de la presentation courante).
      window.setTimeout(apply, 0);
    } else apply();
    onClose();
  };
  const kinds: ReadonlyArray<[BulletKind, string]> = [['none', B.none], ['char', B.symbol], ['auto', B.numbering], ['image', B.picture]];
  return (
    <Dialog open title={B.title} onClose={onClose} onConfirm={ok} width={460} actions={[{ label: S.common.ok, primary: true, onClick: ok }, { label: S.common.cancel, onClick: onClose }]}>
      <div className="pp-stack" data-testid="bullets-dialog">
        <div className="pp-form__row">
          {kinds.map(([id, label]) => (
            <label key={id} className="pp-radio"><input type="radio" name="pp-bullet-kind" checked={form.kind === id} onChange={() => patch('kind', id)} /> {label}</label>
          ))}
        </div>
        {form.kind === 'char' && (
          <fieldset className="pp-group">
            <legend>{B.symbol}</legend>
            <div className="pp-form__row" data-testid="bullet-symbols">
              {SYMBOLS.map((s) => (
                <button key={s.char + s.font} type="button" className="pp-chip" aria-pressed={form.char === s.char && form.font === s.font} style={{ fontFamily: s.font, minWidth: 32, outline: form.char === s.char && form.font === s.font ? '2px solid var(--fo-accent, #c43e1c)' : undefined }} onClick={() => setForm((f) => ({ ...f, char: s.char, font: s.font }))}>{s.char}</button>
              ))}
            </div>
            <div className="pp-form">
              <label htmlFor="pp-bullet-char">{B.custom}</label>
              <input id="pp-bullet-char" maxLength={2} value={form.char} onChange={(e) => patch('char', e.target.value)} />
            </div>
          </fieldset>
        )}
        {form.kind === 'image' && (
          <fieldset className="pp-group">
            <legend>{B.picture}</legend>
            <div className="pp-form__row">
              <Button size="small" onClick={() => void choose()}>{B.choosePicture}</Button>
              <span data-testid="bullet-picture-name">{picked?.name ?? (form.mediaId ? B.currentPicture : B.noPicture)}</span>
            </div>
          </fieldset>
        )}
        {form.kind === 'auto' && (
          <fieldset className="pp-group">
            <legend>{B.numbering}</legend>
            <div className="pp-form">
              <label htmlFor="pp-bullet-scheme">{B.style}</label>
              <select id="pp-bullet-scheme" value={form.scheme} onChange={(e) => patch('scheme', e.target.value)}>
                {NUMBER_SCHEMES.map((id) => <option key={id} value={id}>{NUMBER_NAMES[id] ?? id}</option>)}
              </select>
              <label>{B.startAt}</label>
              <NumberField value={form.startAt} min={1} max={32767} step={1} width={110} onChange={(v) => patch('startAt', Math.round(v))} label={B.startAt} />
            </div>
          </fieldset>
        )}
        {form.kind !== 'none' && (
          <div className="pp-form">
            <label>{B.size}</label>
            <NumberField value={form.size} min={25} max={400} step={5} unit="%" width={110} onChange={(v) => patch('size', v)} label={B.size} />
            <label htmlFor="pp-bullet-color">{B.color}</label>
            <div className="pp-form__row">
              <input id="pp-bullet-color" type="color" value={form.color ?? '#000000'} disabled={form.color === null} onChange={(e) => patch('color', e.target.value)} />
              <label className="pp-radio"><input type="checkbox" checked={form.color === null} onChange={(e) => patch('color', e.target.checked ? null : '#000000')} /> {B.followText}</label>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
