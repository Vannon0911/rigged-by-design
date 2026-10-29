/** Bau-Popup: kaufbare Spiele, Deko, Preise, Personal und der Teppich. */
import { BUILD_DEFS, type BuildId } from '../core/sim/offers';
import { CARPETS, type CarpetId, type TemplateId } from '../core/sim/types';
import type { GameView } from '../store/types';
import { vc } from './format';

interface Props {
  readonly view: GameView;
  readonly placing: BuildId | null;
  readonly onClose: () => void;
  readonly onPick: (id: BuildId) => void;
  readonly onTemplate: (id: TemplateId) => void;
  readonly onHire: (role: 'guard' | 'cleaner' | 'bartender') => void;
  readonly onFire: (role: 'guard' | 'cleaner' | 'bartender') => void;
  readonly onPrice: (key: 'drinkPrice' | 'slotMinBet', value: number) => void;
  readonly onCarpet: (id: CarpetId) => void;
  readonly onRepair: (id: number) => void;
  readonly onClean: () => void;
}

const TEMPLATES: readonly { id: TemplateId; name: string; note: string; cost: number }[] = [
  { id: 'SMALL', name: 'Kleine Bude', note: '1 Saal, 1 Automat, alles überschaubar.', cost: 30 },
  { id: 'MEDIUM', name: 'Mittleres Haus', note: 'Mehr Tische, Bar, Klo, Platz für Personal.', cost: 120 },
  { id: 'LARGE', name: 'Großes Casino', note: 'Alle Spiele, Deko, Personal, volle Fläche.', cost: 600 },
];

export function BuildPanel(props: Props) {
  const { view, placing, onClose, onPick, onTemplate, onHire, onFire, onPrice, onCarpet, onRepair, onClean } = props;
  const broken = view.furniture.filter((item) => item.condition < 85).sort((a, b) => a.condition - b.condition).slice(0, 4);
  return (
    <aside className="build-panel" aria-label="Bauen">
      <header className="build-head">
        <div>
          <span className="eyebrow">DEIN ANGEBOT</span>
          <h2>Bauen</h2>
        </div>
        <button type="button" className="popup-close" onClick={onClose} aria-label="Schließen">×</button>
      </header>
      <div className="build-scroll">
        <p className="panel-note">Ziehe ein Spiel auf den Floor oder klicke es an und setze es mit einem Klick.</p>

        <h3>Spiele & Deko</h3>
        <div className="build-grid">
          {BUILD_DEFS.map((def) => {
            const poor = view.house < def.cost;
            return (
              <button
                key={def.id}
                type="button"
                draggable
                className={`build-card${placing === def.id ? ' placing' : ''}${poor ? ' poor' : ''}`}
                onDragStart={(event) => {
                  event.dataTransfer.setData('text/build', def.id);
                  event.dataTransfer.effectAllowed = 'copy';
                }}
                onClick={() => onPick(def.id)}
                disabled={poor}
              >
                <span className="build-icon">{def.gameId ? '▦' : '✿'}</span>
                <strong>{def.name}</strong>
                <small>{def.description}</small>
                <b>{def.cost === 0 ? 'gratis' : vc(def.cost, 0)}</b>
              </button>
            );
          })}
        </div>

        <h3>Haus</h3>
        <div className="template-grid">
          {TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              className={`template-card${view.template === template.id ? ' active' : ''}`}
              onClick={() => onTemplate(template.id)}
              disabled={view.template === template.id}
            >
              <strong>{template.name}</strong>
              <span>{template.note}</span>
              <b>{vc(template.cost * 10_000, 0)}</b>
            </button>
          ))}
        </div>

        <h3>Personal</h3>
        <div className="staff-grid">
          <Staff label="Guard" note="Hält Wut im Zaum. Tageslohn." wage={view.prices.guardWage} on={view.staff.guard} onHire={() => onHire('guard')} onFire={() => onFire('guard')} />
          <Staff label="Reinigung" note="Putzt automatisch. Tageslohn." wage={view.prices.staffWage} on={view.staff.cleaner} onHire={() => onHire('cleaner')} onFire={() => onFire('cleaner')} />
          <Staff label="Barkeeper" note="Bar bleibt besetzt. Tageslohn." wage={view.prices.staffWage} on={view.staff.bartender} onHire={() => onHire('bartender')} onFire={() => onFire('bartender')} />
        </div>

        <h3>Preise</h3>
        <div className="price-grid">
          <label>
            <span>DRINK</span>
            <input type="number" min="0" step="0.05" defaultValue={(view.prices.drinkPrice / 10_000).toFixed(2)}
              onBlur={(event) => onPrice('drinkPrice', Number(event.target.value))} />
          </label>
          <label>
            <span>MINDESTEINSATZ</span>
            <input type="number" min="0" step="0.05" defaultValue={(view.prices.slotMinBet / 10_000).toFixed(2)}
              onBlur={(event) => onPrice('slotMinBet', Number(event.target.value))} />
          </label>
        </div>

        <h3>Teppich</h3>
        <div className="carpet-row">
          {(Object.keys(CARPETS) as CarpetId[]).map((id) => (
            <button
              key={id}
              type="button"
              className={`carpet${view.carpet === id ? ' active' : ''}`}
              style={{ background: `#${CARPETS[id].color.toString(16).padStart(6, '0')}` }}
              onClick={() => onCarpet(id)}
              title={CARPETS[id].name}
              aria-label={CARPETS[id].name}
            />
          ))}
        </div>

        <h3>Betrieb</h3>
        <div className="ops-row">
          <button type="button" className="btn" onClick={onClean} disabled={view.dirtyTiles.length === 0}>
            PUTZEN {view.dirtyTiles.length > 0 ? `(${view.dirtyTiles.length})` : ''}
          </button>
          {broken.map((item) => (
            <button key={item.id} type="button" className="btn repair" onClick={() => onRepair(item.id)}>
              {item.label} reparieren · {vc(view.prices.repairCost * (100 - Math.floor(item.condition)), 0)}
            </button>
          ))}
          {broken.length === 0 && <small className="muted">Alles heil.</small>}
        </div>
      </div>
    </aside>
  );
}

function Staff(props: { label: string; note: string; wage: number; on: boolean; onHire: () => void; onFire: () => void }) {
  return (
    <div className={`staff${props.on ? ' on' : ''}`}>
      <div><strong>{props.label}</strong><small>{props.note} · {vc(props.wage, 0)}/Tag</small></div>
      <button type="button" className={`btn small${props.on ? ' ghost' : ''}`} onClick={props.on ? props.onFire : props.onHire}>
        {props.on ? 'ENTLASSEN' : 'EINSTELLEN'}
      </button>
    </div>
  );
}
