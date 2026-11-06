// Enregistrement des dialogues et raccourcis du lot Formules et noms (une ligne d'import dans ui/register.ts).
import { registerDialog } from '../registry.ts';
import { FM, S } from '../../strings/index.ts';
import { CalcOptionsDialog } from './CalcOptionsDialog.tsx';
import { ErrorCheckDialog } from './ErrorCheckDialog.tsx';
import { EvaluateDialog } from './EvaluateDialog.tsx';
import { FnWizardDialog } from './FnWizard.tsx';
import { NameEditDialog, NamesManagerDialog } from './NamesDialogs.tsx';

declare module '../registry.ts' {
  interface DialogMap {
    nameEdit: { index: number | null; from?: 'names' };
    errorCheck: { options?: boolean };
    calcOptions: Record<never, never>;
  }
}

registerDialog({ id: 'names', title: FM.names.title, render: (_d, x) => <NamesManagerDialog x={x} /> });
registerDialog({ id: 'nameEdit', title: (d) => (d.index === null ? FM.nameEdit.titleNew : FM.nameEdit.titleEdit), render: (d, x) => <NameEditDialog x={x} index={d.index} {...(d.from ? { from: d.from } : {})} /> });
registerDialog({ id: 'fnWizard', title: S.fnWizard, render: (d, x, h) => <FnWizardDialog x={x} {...(d.fn ? { initial: d.fn } : {})} onInsert={h.insertFormula} /> });
registerDialog({ id: 'evaluate', title: FM.evaluate.title, render: (_d, x) => <EvaluateDialog x={x} /> });
registerDialog({ id: 'errorCheck', title: FM.errors.title, render: (d, x, h) => <ErrorCheckDialog x={x} host={h} options={!!d.options} /> });
registerDialog({ id: 'calcOptions', title: FM.calc.iterTitle, render: (_d, x) => <CalcOptionsDialog x={x} /> });
