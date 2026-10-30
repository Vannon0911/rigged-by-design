/** Bau-Popup: kaufen, liefern, Personal, Preise, Deko und Freischaltung. */
import { BUILD_DEFS } from '../core/sim/offers';
import { CARPETS, type CarpetId, type StaffRole, type TemplateId } from '../core/sim/types';
import type { GameView } from '../store/types';
import { ColorRow, CrateList, DisputeList, StaffGrid, TemplateGrid } from './build-panel-parts';
import { vc } from './format';

interface Props {
  readonly view: GameView;
  readonly onClose: () => void;
  readonly onBuy: (id: (typeof BUILD_DEFS)[number]['id']) => void;
  readonly onTemplate: (id: TemplateId) => void;
  readonly onHire: (role: StaffRole) => void;
  readonly onFire: (role: StaffRole) => void;
  readonly onPrice: (key: 'drinkPrice' | 'slotMinBet', value: number) => void;
  readonly onCarpet: (id: CarpetId) => void;
  readonly onRepair: (id: number) => void;
  readonly onClean: () => void;
  readonly onPickup: (id: number) => void;
  readonly onUnload: () => void;
  readonly onOrderDrinks: (count: number) => void;
  readonly onOrderParts: (count: number) => void;
  readonly onUpgradeBar: () => void;
  readonly onUpgradeWc: () => void;
  readonly onWall: (color: string) => void;
  readonly onNeon: (color: string) => void;
  readonly onServeDesk: () => void;
  readonly onCalm: (id: number) => void;
}

const WALLS = ['#241a35', '#3d1f2e', '#1f3d2e', '#2e3d1f'];
const NEONS = ['#00ffcc', '#ff2e88', '#ffd166', '#b06bff'];

export function BuildPanel(props: Props) {
  const { view } = props;
  const broken = view.furniture.filter((item) => item.condition < 85 || item.damaged || item.clogged)
    .sort((a, b) => a.condition - b.condition).slice(0, 4);
  const carrying = /^KRATE:(\d+)$/.exec(view.player.carrying);
  const carriedId = carrying ? Number(carrying[1]) : null;
  return (
    <aside className="build-panel" aria-label="Bauen">
      <header className="build-head">
        <div>
          <span className="eyebrow">DEIN ANGEBOT</span>
          <h2>Bauen</h2>
        </div>
        <button type="button" className="popup-close" onClick={props.onClose} aria-label="Schließen">×</button>
      </header>
      <div className="build-scroll">
        <p className="panel-note">Käufe kommen als Kiste am Eingang an. Abholen, tragen, aufstellen.</p>

        <h3>Spiele & Deko</h3>
        <div className="build-grid">
          {BUILD_DEFS.map((def) => {
            const poor = view.house < def.cost;
            return (
              <button
                key={def.id}
                type="button"
                draggable
                className={`build-card${poor ? ' poor' : ''}`}
                onDragStart={(event) => {
                  event.dataTransfer.setData('text/build', def.id);
                  event.dataTransfer.effectAllowed = 'copy';
                }}
                onClick={() => props.onBuy(def.id)}
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

        <h3>Lieferungen {view.crates.length > 0 ? `(${view.crates.length})` : ''}</h3>
        <CrateList view={view} carriedId={carriedId} onPickup={props.onPickup} onUnload={props.onUnload} />
        <DisputeList view={view} onCalm={props.onCalm} />

        <h3>Haus</h3>
        <TemplateGrid view={view} onTemplate={props.onTemplate} />

        <h3>Personal</h3>
        <StaffGrid view={view} onHire={props.onHire} onFire={props.onFire} />
        <div className="ops-row">
          <button type="button" className="btn" onClick={props.onServeDesk}>KASSE BEDIENEN</button>
        </div>

        <h3>Lager & Bar (Teile: {view.parts})</h3>
        <div className="ops-row">
          <button type="button" className="btn" onClick={() => props.onOrderDrinks(6)} disabled={view.house < view.prices.drinkCrateCost * 6}>
            6 DRINKS {vc(view.prices.drinkCrateCost * 6, 1)}
          </button>
          <button type="button" className="btn" onClick={() => props.onOrderParts(2)} disabled={view.house < view.prices.partCost * 2}>
            2 ERSATZTEILE {vc(view.prices.partCost * 2, 1)}
          </button>
          <button type="button" className="btn" onClick={props.onUpgradeBar} disabled={view.barLevel >= 3 || view.house < view.prices.barUpgrade}>
            BAR STUFE {view.barLevel}{view.barLevel < 3 ? ` · ${vc(view.prices.barUpgrade, 0)}` : ' · MAX'}
          </button>
          <button type="button" className="btn" onClick={props.onUpgradeWc} disabled={view.wcLevel >= 3 || view.house < view.prices.wcUpgrade}>
            WC STUFE {view.wcLevel}{view.wcLevel < 3 ? ` · ${vc(view.prices.wcUpgrade, 0)}` : ' · MAX'}
          </button>
        </div>

        <h3>Preise</h3>
        <div className="price-grid">
          <label>
            <span>DRINK</span>
            <input type="number" min="0" step="0.05" defaultValue={(view.prices.drinkPrice / 10_000).toFixed(2)}
              onBlur={(event) => props.onPrice('drinkPrice', Number(event.target.value))} />
          </label>
          <label>
            <span>MINDESTEINSATZ</span>
            <input type="number" min="0" step="0.05" defaultValue={(view.prices.slotMinBet / 10_000).toFixed(2)}
              onBlur={(event) => props.onPrice('slotMinBet', Number(event.target.value))} />
          </label>
        </div>

        <h3>Farben</h3>
        <div className="price-grid">
          <div>
            <span>WAND</span>
            <ColorRow colors={WALLS} active={view.wallColor} onPick={props.onWall} />
          </div>
          <div>
            <span>NEON</span>
            <ColorRow colors={NEONS} active={view.neonColor} onPick={props.onNeon} />
          </div>
        </div>

        <h3>Teppich</h3>
        <div className="carpet-row">
          {(Object.keys(CARPETS) as CarpetId[]).map((id) => (
            <button
              key={id}
              type="button"
              className={`carpet${view.carpet === id ? ' active' : ''}`}
              style={{ background: `#${CARPETS[id].color.toString(16).padStart(6, '0')}` }}
              onClick={() => props.onCarpet(id)}
              title={CARPETS[id].name}
              aria-label={CARPETS[id].name}
            />
          ))}
        </div>

        <h3>Betrieb</h3>
        <div className="ops-row">
          <button type="button" className="btn" onClick={props.onClean} disabled={view.dirtyTiles.length === 0 || view.house < view.prices.cleaningCost * view.dirtyTiles.length}>
            PUTZEN {view.dirtyTiles.length > 0 ? `(${view.dirtyTiles.length}) · ${vc(view.prices.cleaningCost * view.dirtyTiles.length, 2)}` : ''}
          </button>
          {broken.map((item) => (
            <button key={item.id} type="button" className="btn repair" onClick={() => props.onRepair(item.id)} disabled={view.house < view.prices.repairCost || view.parts <= 0}>
              {item.label} reparieren · {vc(view.prices.repairCost, 0)}{item.clogged ? ' · VERSTOPFT' : ''}
            </button>
          ))}
          {broken.length === 0 && <small className="muted">Alles heil.</small>}
        </div>
      </div>
    </aside>
  );
}
