// Panneau « Parametres du paragraphe » du profil OnlyOffice : memes sections, champs et textes que l'application reelle
// (Interligne ; Espacement des paragraphes ; Retraits ; Couleur d'arriere-plan ; lien « Afficher les parametres avances »),
// branches sur les commandes du ruban de la suite (retraits, espacements, interligne, remplissage), retrouvees par identifiant.
import type { ReactNode } from 'react';
import type { RibbonControl, RibbonTab } from '../../ribbon-types.ts';
import { Checkbox, NumberField } from '../Controls.tsx';
import { RibbonControlView } from '../ribbon/RibbonControls.tsx';
import type { ControlContext } from '../ribbon/RibbonControls.tsx';

const PT_PER_CM = 28.3465;

function all(controls: readonly RibbonControl[]): RibbonControl[] {
  return controls.flatMap((c) => (c.kind === 'row' ? all(c.controls) : [c]));
}

/** Commande du ruban (tous onglets) par identifiant, masquee ou non : les champs propres au panneau y sont declares masques. */
function byId(tabs: readonly RibbonTab[], id: string): RibbonControl | undefined {
  for (const t of tabs) for (const g of t.groups) for (const c of all(g.controls)) if (c.id === id) return c;
  return undefined;
}

/** Vrai quand le ruban sait regler retraits et espacements (Texte) : le panneau peut alors prendre la forme OnlyOffice. */
export function hasParagraphForm(tabs: readonly RibbonTab[]): boolean {
  return ['indleft', 'indright', 'before', 'after'].every((id) => byId(tabs, id)?.kind === 'number');
}

function Cm({ c, label }: { c: RibbonControl | undefined; label: string }) {
  if (c?.kind !== 'number') return <NumberField value={0} onChange={() => undefined} unit="cm" label={label} width={86} disabled />;
  const k = c.unit === 'pt' ? 1 / PT_PER_CM : 1; // le ruban compte en points pour les espacements, OnlyOffice en cm
  return <NumberField value={Number((c.value * k).toFixed(2))} step={0.1} min={c.min === undefined ? undefined : c.min * k} max={c.max === undefined ? undefined : c.max * k} unit="cm" label={label} width={86} onChange={(v) => c.onChange(c.unit === 'pt' ? v * PT_PER_CM : v)} />;
}

function Pair({ children }: { children: ReactNode }) {
  return <div className="fo-oo-pform__pair">{children}</div>;
}

function Lab({ label, children }: { label: string; children: ReactNode }) {
  return <label className="fo-oo-pform__lab"><span>{label}</span>{children}</label>;
}

export function ParagraphForm({ tabs, ctx, onAdvanced }: { tabs: readonly RibbonTab[]; ctx: ControlContext; onAdvanced?: () => void }) {
  const spacing = byId(tabs, 'spacing');
  const lsRule = byId(tabs, 'lsrule');
  const lsValue = byId(tabs, 'lsvalue');
  const first = byId(tabs, 'indfirst');
  const shading = byId(tabs, 'shading');
  const contextual = byId(tabs, 'contextual');
  const firstCm = first?.kind === 'number' ? first.value : 0;
  const special = firstCm > 0 ? 'first' : firstCm < 0 ? 'hanging' : 'none';
  const firstAbs: RibbonControl | undefined = first?.kind === 'number' ? { ...first, value: Math.abs(first.value), onChange: (v: number) => first.onChange(special === 'hanging' ? -v : v) } : undefined;
  const setSpecial = (v: string): void => { if (first?.kind === 'number') first.onChange(v === 'none' ? 0 : v === 'first' ? 1.25 : -1.25); };
  return (
    <div className="fo-oo-pform">
      <h3 className="fo-oo-form__title">Interligne</h3>
      {lsRule?.kind === 'combo' && lsValue?.kind === 'number' ? (
        <Pair>
          <RibbonControlView control={lsRule} mode="small" ctx={ctx} />
          <NumberField value={Number(lsValue.value.toFixed(2))} step={lsValue.step} min={lsValue.min} max={lsValue.max} unit={lsValue.unit} label="Valeur de l’interligne" width={86} onChange={lsValue.onChange} />
        </Pair>
      ) : (
        <div className="fo-oo-pform__line">{spacing && <RibbonControlView control={spacing} mode="small" ctx={ctx} />}</div>
      )}
      <h3 className="fo-oo-form__title">Espacement des paragraphes</h3>
      <Pair>
        <Lab label="Avant"><Cm c={byId(tabs, 'before')} label="Avant" /></Lab>
        <Lab label="Après"><Cm c={byId(tabs, 'after')} label="Après" /></Lab>
      </Pair>
      <Checkbox label="Ne pas ajouter d'intervalle entre paragraphes du même style" checked={contextual?.kind === 'checkbox' ? contextual.checked : false} disabled={contextual?.kind !== 'checkbox'} onChange={(v) => contextual?.kind === 'checkbox' && contextual.onChange(v)} />
      <hr className="fo-oo-pform__rule" />
      <h3 className="fo-oo-form__title">Retraits</h3>
      <Pair>
        <Lab label="À gauche"><Cm c={byId(tabs, 'indleft')} label="Retrait à gauche" /></Lab>
        <Lab label="Droite"><Cm c={byId(tabs, 'indright')} label="Retrait à droite" /></Lab>
      </Pair>
      <Lab label="Spécial">
        <Pair>
          <select className="fo-oo-pform__select" aria-label="Retrait spécial" value={special} disabled={!first} onChange={(e) => setSpecial(e.target.value)}>
            <option value="none">(aucun)</option>
            <option value="first">Première ligne</option>
            <option value="hanging">Suspendu</option>
          </select>
          <Cm c={firstAbs} label="Valeur du retrait spécial" />
        </Pair>
      </Lab>
      <hr className="fo-oo-pform__rule" />
      <div className="fo-oo-pform__shade">{shading && <RibbonControlView control={shading} mode="icon" ctx={ctx} />}<span>Couleur d'arrière-plan</span></div>
      <hr className="fo-oo-pform__rule" />
      {onAdvanced && <button type="button" className="fo-oo-pform__link" onClick={onAdvanced}>Afficher les paramètres avancés</button>}
    </div>
  );
}
