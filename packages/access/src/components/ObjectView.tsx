// Aiguillage : la vue d'un onglet selon le genre d'objet et le mode d'affichage.
import { Datasheet } from './Datasheet.tsx';
import { FormView } from './FormView.tsx';
import { MacroView } from './MacroView.tsx';
import { QueryDesign } from './QueryDesign.tsx';
import { Relations } from './Relations.tsx';
import { ReportView } from './ReportView.tsx';
import { TableDesign } from './TableDesign.tsx';
import { AnalysisView, DocView } from './ToolsViews.tsx';
import type { ViewProps } from './view-types.ts';

export function ObjectView(props: ViewProps) {
  const { tab } = props;
  switch (tab.kind) {
    case 'table':
      return tab.view === 'design' || tab.isNew ? <TableDesign {...props} /> : <Datasheet key={tab.name} db={props.db} ctx={props.ctx} register={props.register} source={{ kind: 'table', name: tab.name }} />;
    case 'requete':
      return <QueryDesign {...props} />;
    case 'formulaire':
      return <FormView {...props} />;
    case 'etat':
      return <ReportView {...props} />;
    case 'macro':
      return <MacroView {...props} />;
    case 'relations':
      return <Relations {...props} />;
    case 'doc':
      return <DocView {...props} />;
    case 'analysis':
      return <AnalysisView {...props} />;
  }
}
