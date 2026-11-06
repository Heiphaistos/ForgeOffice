// Enregistrement du dialogue « Format de cellule » (Ctrl+1, lanceurs du ruban, menu contextuel).
import { registerDialog } from '../../registry.ts';
import { FC } from '../../../strings/index.ts';
import { FormatCellsDialog } from './editor.tsx';

registerDialog({ id: 'formatCells', title: FC.title, render: (d, x) => <FormatCellsDialog x={x} {...(d.tab ? { tab: d.tab } : {})} {...(d.category ? { category: d.category } : {})} /> });
