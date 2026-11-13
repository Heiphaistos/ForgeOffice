// Habillage Impress des dispositions LibreOffice / OpenOffice : onglets de vue (Normal, Plan, Notes, Prospectus, Trieuse) et cellules de la barre d'etat.
import type { StatusBarProps, StatusItem } from '@forgeoffice/ui';
import type { Editor } from './editor.ts';
import { openView } from './ribbon/views.tsx';

const CM = 28.3465;
const fr = (pt: number): string => (pt / CM).toFixed(2).replace('.', ',');

const VIEWS: ReadonlyArray<{ id: 'normal' | 'outline' | 'notesPage' | 'handout' | 'sorter'; label: string }> = [
  { id: 'normal', label: 'Normal' },
  { id: 'outline', label: 'Plan' },
  { id: 'notesPage', label: 'Notes' },
  { id: 'handout', label: 'Prospectus' },
  { id: 'sorter', label: 'Trieuse de diapositives' },
];

/** Rangee d'onglets au-dessus de la zone de travail (OpenOffice ; LibreOffice la masque : ses vues passent par le menu Affichage). */
export function SuiteViewTabs({ ed }: { ed: Editor }) {
  const view = ed.ui.view === 'master' ? 'normal' : ed.ui.view;
  return (
    <div className="pp-viewtabs" role="tablist" aria-label="Vues">
      {VIEWS.map((v) => (
        <button
          key={v.id}
          type="button"
          role="tab"
          aria-selected={v.id === view}
          disabled={v.id === 'handout'}
          title={v.id === 'handout' ? "Pas d'équivalent dans ForgeOffice (Fichier > Imprimer > Documents)" : undefined}
          className={`pp-viewtabs__tab${v.id === view ? ' is-active' : ''}`}
          onClick={() => v.id !== 'handout' && openView(ed, v.id)}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}

/** Cellules de la barre d'etat, dans l'ordre et avec les libelles de la vraie suite (position et taille = objet selectionne, 0,00 sinon). */
export function suiteStatus(kind: 'lo' | 'oo', ed: Editor, total: number): Pick<StatusBarProps, 'left' | 'right' | 'views'> {
  const box = ed.selectedShapes[0]?.xfrm;
  const master = ed.deck.masters[0]?.name ?? 'Standard';
  const n = ed.slideIndex + 1;
  const pos: StatusItem = { id: 'sb-pos', label: box ? `${fr(box.x)} / ${fr(box.y)}` : '0,00 / 0,00', title: "Position de l'objet sélectionné" };
  const size: StatusItem = { id: 'sb-size', label: box ? `${fr(box.width)} x ${fr(box.height)}` : '0,00 x 0,00', title: "Taille de l'objet sélectionné" };
  if (kind === 'lo') {
    return {
      left: [
        { id: 'sb-save', label: '', icon: 'save', title: 'Le document n’a pas été modifié depuis la dernière sauvegarde.' },
        { id: 'sb-slide', label: `Diapo ${n} de ${total}`, title: 'Numéro de diapo' },
        { id: 'sb-master', label: master, title: 'Diapositive maîtresse' },
        pos,
        size,
      ],
      right: [{ id: 'sb-lang', label: 'Français (France)', title: 'Langue du texte' }],
      views: [],
    };
  }
  return {
    left: [pos, size, { id: 'sb-mod', label: '', title: 'Document modifié' }, { id: 'sb-slide', label: `Diapo ${n} / ${total}`, title: 'Numéro de diapo' }, { id: 'sb-master', label: master, title: 'Page maître' }],
    right: [],
    views: [],
  };
}
