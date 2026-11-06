// Questions simples sans boite native (`window.prompt` / `window.confirm` bloquent la page, ne suivent pas le theme et sont
// absentes de certaines WebView) : `const ask = useAsk()`, `await ask.confirm(...)` / `await ask.prompt(...)`, puis `ask.dialog` dans le rendu du module.
import { useCallback, useRef, useState, type ReactElement } from 'react';
import { S } from '../strings.ts';
import { Dialog } from './Dialog.tsx';
import { TextField } from './Controls.tsx';

type Question = { kind: 'confirm'; message: string; yes: string } | { kind: 'prompt'; message: string; initial: string };

export interface Ask {
  /** Vrai si l'utilisateur confirme. */
  confirm(message: string, yes?: string): Promise<boolean>;
  /** Texte saisi, ou null si la boite est annulee. */
  prompt(message: string, initial?: string): Promise<string | null>;
  /** Boite a rendre dans le module (null quand aucune question n'est posee). */
  dialog: ReactElement | null;
}

export function useAsk(): Ask {
  const [question, setQuestion] = useState<Question | null>(null);
  const [text, setText] = useState('');
  const resolver = useRef<((v: string | boolean | null) => void) | null>(null);
  const open = useCallback((q: Question) => new Promise<string | boolean | null>((resolve) => {
    resolver.current?.(null); // une question deja posee est annulee
    resolver.current = resolve;
    setText(q.kind === 'prompt' ? q.initial : '');
    setQuestion(q);
  }), []);
  const close = (value: string | boolean | null): void => {
    setQuestion(null);
    resolver.current?.(value);
    resolver.current = null;
  };
  const confirm = useCallback(async (message: string, yes: string = S.dialog.ok) => (await open({ kind: 'confirm', message, yes })) === true, [open]);
  const prompt = useCallback(async (message: string, initial = '') => {
    const v = await open({ kind: 'prompt', message, initial });
    return typeof v === 'string' ? v : null;
  }, [open]);
  const dialog = question === null ? null : (
    <Dialog
      open
      title={question.message}
      width={420}
      onClose={() => close(question.kind === 'prompt' ? null : false)}
      actions={[
        { label: question.kind === 'prompt' ? S.dialog.ok : question.yes, primary: true, onClick: () => close(question.kind === 'prompt' ? text : true) },
        { label: S.dialog.cancel, onClick: () => close(question.kind === 'prompt' ? null : false) },
      ]}
    >
      {question.kind === 'prompt' && <TextField label={question.message} value={text} onChange={(e) => setText(e.currentTarget.value)} data-autofocus />}
    </Dialog>
  );
  return { confirm, prompt, dialog };
}
