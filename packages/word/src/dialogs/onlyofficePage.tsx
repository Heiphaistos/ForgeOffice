// Profil OnlyOffice : boite « Marges » (captures docs/captures/onlyoffice-ref/10.0/dlg-marges.png), branchee sur la section courante.
// Les reglages de page propres a ForgeOffice (taille, colonnes, en-tetes...) restent atteignables par « Plus d'options de page ».
import { useState } from 'react';
import { Dialog, NumberField } from '@forgeoffice/ui';
import type { Section } from '@forgeoffice/docx';
import type { Ctl } from '../app/types.ts';
import { cmToPt, ptToCm } from '../ribbon/shared.ts';
import { PageSetupDialog } from './page.tsx';
import { Select } from './common.tsx';

type Close = { c: Ctl; onClose: () => void };

const cm = (pt: number): number => Number(ptToCm(pt).toFixed(2));

/** Apercu : page a l'echelle avec le bloc de texte entre les marges. */
function Preview({ s }: { s: Section }) {
  const h = 98;
  const k = h / s.pageHeight;
  const w = Math.round(s.pageWidth * k);
  const m = s.margins;
  return (
    <div className="fo-oo-page" style={{ width: w, height: h }} aria-hidden="true">
      <div className="fo-oo-page__text" style={{ left: m.left * k, right: m.right * k, top: m.top * k, bottom: m.bottom * k }} />
    </div>
  );
}

export function OoPageDialog({ c, onClose }: Close) {
  const [more, setMore] = useState(false);
  const [st, setSt] = useState<Section>({ ...c.section, margins: { ...c.section.margins } });
  const [scope, setScope] = useState<'section' | 'document'>('section');
  if (more) return <PageSetupDialog c={c} onClose={onClose} />;
  const m = st.margins;
  const setM = (k: keyof Section['margins']) => (v: number): void => setSt({ ...st, margins: { ...m, [k]: cmToPt(v) } });
  const ok = (): void => {
    c.act.setSection({ margins: st.margins, orientation: st.orientation, pageWidth: st.pageWidth, pageHeight: st.pageHeight }, scope);
    onClose();
  };
  const num = (label: string, key: keyof Section['margins']): React.ReactNode => (
    <label>{label}<NumberField value={cm(m[key])} min={0} max={55} step={0.1} unit="cm" width={86} label={label} onChange={setM(key)} /></label>
  );
  return (
    <Dialog open title="Marges" onClose={onClose} onConfirm={ok} width={404}
      actions={[{ label: 'OK', primary: true, onClick: ok }, { label: 'Annuler', onClick: onClose }]}>
      <div className="fo-oo-margins">
        <div className="fo-oo-margins__fields">
          <h4>Marges</h4>
          <div className="fo-oo-dlgtabs__grid">{num('Haut', 'top')}{num('Bas', 'bottom')}{num('Gauche', 'left')}{num('Droite', 'right')}</div>
          <h4>Position de la reliure</h4>
          <div className="fo-oo-dlgtabs__grid">
            <NumberField value={cm(m.gutter)} min={0} max={55} step={0.1} unit="cm" width={86} label="Position de la reliure" onChange={setM('gutter')} />
            <Select value="left" label="Côté de la reliure" options={[['left', 'Gauche']]} onChange={() => undefined} />
          </div>
          <h4>Orientation</h4>
          <Select value={st.orientation} label="Orientation" options={[['portrait', 'Portrait'], ['landscape', 'Paysage']]}
            onChange={(o) => o !== st.orientation && setSt({ ...st, orientation: o, pageWidth: st.pageHeight, pageHeight: st.pageWidth })} />
          <h4>Plusieurs pages</h4>
          <Select value="normal" label="Plusieurs pages" options={[['normal', 'Normal']]} onChange={() => undefined} />
          {c.sectionCount > 1 && (
            <>
              <h4>Appliquer à</h4>
              <Select value={scope} label="Appliquer à" options={[['section', `Section ${c.sectionIndex + 1}`], ['document', 'Tout le document']]} onChange={setScope} />
            </>
          )}
          <button type="button" className="fo-oo-link" onClick={() => setMore(true)}>Plus d’options de page…</button>
        </div>
        <div className="fo-oo-margins__preview"><h4>Aperçu</h4><div className="fo-oo-margins__box"><Preview s={st} /></div></div>
      </div>
    </Dialog>
  );
}
