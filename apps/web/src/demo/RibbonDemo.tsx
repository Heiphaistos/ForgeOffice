// Page de demonstration (?app=demo) : ruban complet, Backstage, barre d'etat, dialogues, volet, theme clair/sombre/contraste.
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { MODULES, type Services } from '@forgeoffice/core';
import {
  AppBadge, Backstage, BackstageAction, BackstageHeading, BackstageSection, BackstageTile, BACKSTAGE_PAGES, Button, ColorPalette, Dialog,
  FileList, FontPicker, Icon, NumberField, Ribbon, StatusBar, TaskPane, TextField, TitleBar, applyTheme, collectCommands,
  isThemeChoice, useContextMenu, type BackstagePage, type FileRow, type QuickAccessItem, type ThemeChoice,
} from '@forgeoffice/ui';
import { INITIAL_STATE, STYLE_PRESETS, demoTabs, type DemoState } from './demo-ribbon.tsx';
import './demo.css';

const word = MODULES.word;

function initialTheme(): ThemeChoice {
  const t = new URLSearchParams(window.location.search).get('theme') ?? '';
  return isThemeChoice(t) ? t : 'light';
}

function PagePreview({ lines = 6 }: { lines?: number }) {
  return (
    <span className="demo-thumb">
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} style={{ width: `${90 - ((i * 17) % 40)}%` }} />
      ))}
    </span>
  );
}

export default function RibbonDemo({ services }: { services: Services }) {
  const [st, setSt] = useState<DemoState>(() => ({ ...INITIAL_STATE, theme: initialTheme() }));
  const [preview, setPreview] = useState<string | null>(null);
  const [backstage, setBackstage] = useState<string | null>(null);
  const [dialog, setDialog] = useState<'font' | 'paragraph' | 'about' | null>(null);
  const [zoom, setZoom] = useState(100);
  const [view, setView] = useState('print');
  const [paneWidth, setPaneWidth] = useState(280);
  const [autoSave, setAutoSave] = useState(true);
  const [docName, setDocName] = useState('Démonstration ForgeOffice');
  const [modified, setModified] = useState(false);
  const context = useContextMenu();

  useEffect(() => {
    applyTheme(st.theme);
  }, [st.theme]);

  const set = useCallback((patch: Partial<DemoState>) => {
    setSt((s) => ({ ...s, ...patch }));
    setModified(true);
  }, []);
  const notify = useCallback((m: string) => services.notify(m, 'info'), [services]);

  const tabs = useMemo(() => demoTabs(st, { set, preview: setPreview, notify, openDialog: setDialog }), [st, set, notify]);
  const commands = useMemo(() => collectCommands(tabs), [tabs]);

  const quickAccess: QuickAccessItem[] = [
    { id: 'save', label: 'Enregistrer', icon: 'save', shortcut: 'Ctrl+S', onClick: () => { setModified(false); services.notify('Document enregistré', 'success'); } },
    { id: 'undo', label: 'Annuler', icon: 'arrow_undo', shortcut: 'Ctrl+Z', onClick: () => notify('Annuler') },
    { id: 'redo', label: 'Rétablir', icon: 'arrow_redo', shortcut: 'Ctrl+Y', onClick: () => notify('Rétablir') },
    { id: 'print', label: 'Impression rapide', icon: 'print', defaultVisible: false, onClick: () => services.print() },
    { id: 'new', label: 'Nouveau', icon: 'document_add', defaultVisible: false, onClick: () => notify('Nouveau document') },
  ];

  const styleCss = STYLE_PRESETS[preview ?? st.style]?.css ?? {};
  const textStyle: CSSProperties = {
    fontFamily: `"${st.font}", var(--fo-font)`,
    fontSize: `${(st.size * 4) / 3}px`,
    ...styleCss,
    fontWeight: st.bold ? 700 : styleCss.fontWeight,
    fontStyle: st.italic ? 'italic' : styleCss.fontStyle,
    textDecoration: [st.underline ? 'underline' : '', st.strike ? 'line-through' : ''].join(' ').trim() || undefined,
    color: st.color ?? styleCss.color,
    textAlign: st.align,
    marginTop: (st.spaceBefore * 4) / 3,
  };

  const recent: FileRow[] = [
    { id: '1', name: 'Rapport annuel 2026.docx', location: 'Documents » Travail', date: Date.now() - 20 * 60_000, icon: <AppBadge glyph="T" color={word.accent} size={24} />, pinned: true },
    { id: '2', name: 'Budget prévisionnel.xlsx', location: 'Documents » Finances', date: Date.now() - 26 * 3_600_000, icon: <AppBadge glyph="X" color={MODULES.excel.accent} size={24} /> },
    { id: '3', name: 'Présentation client.pptx', location: 'Bureau', date: Date.now() - 4 * 86_400_000, icon: <AppBadge glyph="P" color={MODULES.powerpoint.accent} size={24} /> },
  ];

  const pages: BackstagePage[] = [
    { ...BACKSTAGE_PAGES.home, render: () => (
      <>
        <BackstageHeading>Bonjour</BackstageHeading>
        <BackstageSection title="Nouveau">
          <div className="demo-tiles">
            <BackstageTile label="Document vierge" preview={<PagePreview lines={0} />} onClick={() => notify('Document vierge')} />
            <BackstageTile label="Lettre moderne" preview={<PagePreview />} onClick={() => notify('Lettre moderne')} />
            <BackstageTile label="Curriculum vitæ" preview={<PagePreview lines={9} />} onClick={() => notify('CV')} />
          </div>
        </BackstageSection>
        <BackstageSection title="Récents">
          <FileList rows={recent} grouped onOpen={(r) => notify(`Ouvrir ${r.name}`)} onTogglePin={(r) => notify(`Épingler ${r.name}`)} menuFor={(r) => [{ id: 'o', label: 'Ouvrir', icon: 'open', onClick: () => notify(`Ouvrir ${r.name}`) }, { id: 'c', label: 'Copier le chemin', icon: 'copy', onClick: () => notify('Chemin copié') }]} />
        </BackstageSection>
      </>
    ) },
    { ...BACKSTAGE_PAGES.new, render: () => <><BackstageHeading>Nouveau</BackstageHeading><div className="demo-tiles"><BackstageTile label="Document vierge" preview={<PagePreview lines={0} />} onClick={() => notify('Document vierge')} /></div></> },
    { ...BACKSTAGE_PAGES.open, render: () => <><BackstageHeading actions={<Button icon="folder_open" onClick={() => notify('Parcourir')}>Parcourir</Button>}>Ouvrir</BackstageHeading><FileList rows={recent} onOpen={(r) => notify(`Ouvrir ${r.name}`)} /></> },
    { ...BACKSTAGE_PAGES.info, render: () => (
      <>
        <BackstageHeading>Informations</BackstageHeading>
        <BackstageAction icon="shield_lock" title="Protéger le document" description="Contrôlez les types de modifications que les autres utilisateurs peuvent apporter à ce document." onClick={() => notify('Protéger')} />
        <BackstageAction icon="accessibility_checkmark" title="Inspecter le document" description="Avant de publier ce fichier, vérifiez qu'il ne contient pas de propriétés masquées ni d'informations personnelles." onClick={() => notify('Inspecter')} />
        <BackstageAction icon="history" title="Historique des versions" description="Affichez et restaurez les versions précédentes." onClick={() => notify('Versions')} />
      </>
    ) },
    { ...BACKSTAGE_PAGES.save, onSelect: () => { setModified(false); services.notify('Document enregistré', 'success'); setBackstage(null); } },
    { ...BACKSTAGE_PAGES.saveAs, render: () => <><BackstageHeading>Enregistrer sous</BackstageHeading><TextField label="Nom du fichier" defaultValue={`${docName}.docx`} /></> },
    { ...BACKSTAGE_PAGES.print, render: () => <><BackstageHeading actions={<Button appearance="primary" icon="print" onClick={() => services.print()}>Imprimer</Button>}>Imprimer</BackstageHeading><div className="demo-printpreview"><PagePreview lines={14} /></div></> },
    { ...BACKSTAGE_PAGES.export, render: () => <><BackstageHeading>Exporter</BackstageHeading><BackstageAction icon="document_pdf" title="Créer un document PDF" description="Conserve la mise en page et la mise en forme." onClick={() => notify('Export PDF')} /></> },
    { ...BACKSTAGE_PAGES.close, onSelect: () => void services.openModule('hub') },
    { ...BACKSTAGE_PAGES.account, render: () => <><BackstageHeading>Compte</BackstageHeading><p>ForgeOffice {services.version} — aucune connexion requise.</p></> },
    { ...BACKSTAGE_PAGES.options, render: () => (
      <>
        <BackstageHeading>Options</BackstageHeading>
        <BackstageSection title="Thème Office">
          <div className="demo-themes">
            {(['light', 'dark', 'contrast', 'system'] as const).map((t) => (
              <label key={t} className="demo-radio">
                <input type="radio" name="theme" checked={st.theme === t} onChange={() => set({ theme: t })} />
                {{ light: 'Blanc', dark: 'Noir', contrast: 'Contraste élevé', system: 'Utiliser le paramètre système' }[t]}
              </label>
            ))}
          </div>
        </BackstageSection>
      </>
    ) },
  ];

  return (
    <div className="demo">
      <TitleBar
        app={word}
        documentName={docName}
        location="Documents » ForgeOffice"
        saveState={modified ? 'modified' : 'saved'}
        autoSave={{ enabled: autoSave, onChange: setAutoSave }}
        quickAccess={quickAccess}
        commands={commands}
        onRename={setDocName}
        windowControls={services.windowControls}
        settings={services.settings}
      />
      <Ribbon
        tabs={tabs}
        onFile={() => setBackstage('home')}
        settings={services.settings}
        end={
          <>
            <Button size="small" appearance="subtle" icon="comment" onClick={() => notify('Commentaires')}>Commentaires</Button>
            <Button size="small" appearance="primary" icon="share" onClick={() => notify('Partager')}>Partager</Button>
          </>
        }
      />
      <div className="demo-body">
        {st.navPane && (
          <TaskPane title="Navigation" side="left" width={paneWidth} onWidthChange={setPaneWidth} onClose={() => set({ navPane: false })}>
            <TextField icon="search" placeholder="Rechercher dans le document" aria-label="Rechercher dans le document" />
            <ul className="demo-outline">
              <li className="is-active">Introduction</li>
              <li>Le ruban Office 2024</li>
              <li className="sub">Reduction adaptative</li>
              <li className="sub">Info-touches</li>
              <li>Conclusion</li>
            </ul>
          </TaskPane>
        )}
        <div className={`demo-workspace${st.grid ? ' has-grid' : ''}`} onContextMenu={(e) => context.open(e, [
          { id: 'cut', label: 'Couper', icon: 'cut', shortcut: 'Ctrl+X', onClick: () => notify('Couper') },
          { id: 'copy', label: 'Copier', icon: 'copy', shortcut: 'Ctrl+C', onClick: () => notify('Copier') },
          { id: 'paste', label: 'Options de collage', icon: 'clipboard_paste', items: [{ id: 'k', label: 'Conserver la mise en forme source', onClick: () => notify('Collage') }, { id: 't', label: 'Texte seul', onClick: () => notify('Collage texte') }] },
          { id: 's', kind: 'separator' },
          { id: 'font', label: 'Police…', icon: 'text_font', onClick: () => setDialog('font') },
          { id: 'para', label: 'Paragraphe…', icon: 'text_paragraph', onClick: () => setDialog('paragraph') },
          { id: 's2', kind: 'separator' },
          { id: 'link', label: 'Lien', icon: 'link', shortcut: 'Ctrl+K', onClick: () => notify('Lien') },
          { id: 'comment', label: 'Nouveau commentaire', icon: 'comment_add', onClick: () => notify('Commentaire') },
        ])}>
          {st.ruler && <div className="demo-ruler" style={{ width: 794 * (zoom / 100) }} />}
          <div className="demo-page" style={{ width: 794, transform: `scale(${zoom / 100})` }}>
            <p className="demo-text" style={textStyle}>
              ForgeOffice reprend le ruban d'Office 2024 : survolez un style de la galerie pour voir l'aperçu en direct,
              appuyez sur Alt pour afficher les Info-touches, Ctrl+F1 pour replier le ruban, Alt+Q pour rechercher une commande.
            </p>
            <p className="demo-text" style={{ ...textStyle, background: st.highlight ?? undefined }}>
              Réduisez la largeur de la fenêtre : les groupes se replient de droite à gauche, puis le ruban passe en mode simplifié
              sous 720 pixels, avec des cibles tactiles plus grandes.
            </p>
            <table className="demo-table" onClick={() => set({ tableSelected: true })}>
              <thead><tr><th>Module</th><th>Équivalent</th><th>État</th></tr></thead>
              <tbody>
                <tr><td>Texte</td><td>Word</td><td>En cours</td></tr>
                <tr><td>Tableur</td><td>Excel</td><td>En cours</td></tr>
                <tr><td>Présentation</td><td>PowerPoint</td><td>En cours</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <StatusBar
        left={[
          { id: 'page', label: 'Page 1 sur 1', onClick: () => notify('Atteindre') },
          { id: 'words', label: '64 mots', onClick: () => notify('Statistiques') },
          { id: 'proof', label: '', icon: 'text_proofing_tools', title: 'Vérification terminée' },
          { id: 'lang', label: 'Français (France)', onClick: () => notify('Langue') },
          { id: 'a11y', label: 'Accessibilité : vérification conseillée', icon: 'accessibility_checkmark', onClick: () => notify('Accessibilité') },
        ]}
        views={[{ id: 'read', label: 'Mode Lecture', icon: 'book_open' }, { id: 'print', label: 'Page', icon: 'document_one_page' }, { id: 'web', label: 'Web', icon: 'globe' }]}
        activeView={view}
        onViewChange={setView}
        zoom={zoom}
        onZoomChange={setZoom}
        zoomPresets={[{ label: 'Largeur de page', compute: () => (window.innerWidth - 80) / 8.14 }]}
      />
      <Backstage open={backstage !== null} appName={word.name} pages={pages} activePage={backstage ?? 'home'} onPageChange={setBackstage} onClose={() => setBackstage(null)} />
      <Dialog open={dialog === 'font'} title="Police" onClose={() => setDialog(null)} onConfirm={() => setDialog(null)} width={520}>
        <div className="demo-form">
          <label>Police :</label>
          <FontPicker value={st.font} onChange={(font) => set({ font })} width={220} />
          <label>Taille :</label>
          <NumberField value={st.size} min={1} max={1638} step={0.5} unit="pt" width={96} onChange={(size) => set({ size })} label="Taille" />
          <label>Couleur de police :</label>
          <ColorPalette value={st.color} onPick={(color) => set({ color })} />
        </div>
        <div className="demo-fontpreview" style={textStyle}>Aperçu de la police</div>
      </Dialog>
      <Dialog open={dialog === 'paragraph'} title="Paragraphe" onClose={() => setDialog(null)} onConfirm={() => setDialog(null)}>
        <div className="demo-form">
          <label>Espacement avant :</label>
          <NumberField value={st.spaceBefore} min={0} max={1584} step={6} unit="pt" width={96} onChange={(spaceBefore) => set({ spaceBefore })} label="Avant" />
          <label>Retrait gauche :</label>
          <NumberField value={0} min={-42} max={55} step={0.1} unit="cm" width={96} onChange={() => notify('Retrait')} label="Retrait" />
        </div>
      </Dialog>
      <Dialog open={dialog === 'about'} title="À propos de ForgeOffice" onClose={() => setDialog(null)} actions={[{ label: 'Fermer', primary: true, onClick: () => setDialog(null) }]}>
        <div className="demo-about">
          <Icon name="sparkle" size={32} color="var(--fo-accent)" />
          <p>ForgeOffice {services.version}. Icônes Fluent UI System Icons (MIT).</p>
        </div>
      </Dialog>
      {context.menu}
    </div>
  );
}
