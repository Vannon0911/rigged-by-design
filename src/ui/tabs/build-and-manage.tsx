import { useState } from 'react';
import { toVCString } from '../../core/economy/vacoin';
import { getVenue } from '../../core/progression/venues-and-tiers';
import { BUILDABLES, getBuildable, type BuildableId } from '../../core/simulation/catalog';
import { visitorNetResult } from '../../core/simulation/visitors';
import { gameStore, useGameStore } from '../../store/use-game-store';
import { OperatorModPanel } from './operator-mod-panel';

const GLYPH: Record<BuildableId, string> = {
  SHELL_CART: '⌂',
  SLOT_RUSTY: '▦',
  DICE_TABLE: '⚄',
  SLOT_NEON: '◫',
  ROULETTE_TABLE: '◉',
  BLACKJACK_TABLE: '♠',
  POKER_TABLE: '♦',
  DECO_CARPET: '▩',
  DECO_NEON_SIGN: '✦',
  DECO_BOOZE: '⌂',
};

const KIND_NOTE = {
  SLOT: 'Automaten-Spiel',
  SHELL: 'Hütchenspiel · 2.8x',
  DICE: 'Street Craps · 2 Würfel',
  ROULETTE: 'Roulette · 37 Pockets',
  BLACKJACK: 'Blackjack · 3:2',
  POKER: 'Casino Hold’em',
  DECO: 'Dekoration',
} as const;

const OUTFITS = ['Lumpen', 'Street', 'Business', 'High Roller'];

function statusOf(addiction: number): { key: string; label: string } {
  if (addiction >= 100) return { key: 'lock', label: 'Sucht-Lock-In bis Bankrott!' };
  if (addiction >= 75) return { key: 'hot', label: 'Angefixt' };
  return { key: 'calm', label: 'Vorsichtig' };
}

export function BuildAndManage() {
  const game = useGameStore();
  const [selected, setSelected] = useState<BuildableId>('SHELL_CART');
  const venue = getVenue(game.venueTier);
  const available = BUILDABLES.filter((entry) => venue.allowedBuildables.includes(entry.id));
  const active = available.some((entry) => entry.id === selected) ? selected : available[0]!.id;
  const item = getBuildable(active);
  const gameCount = game.placements.filter((placed) => getBuildable(placed.buildableId).kind !== 'DECO').length;

  return (
    <section className="tab-page">
      <header className="tab-head">
        <h2>Eigenes Casino &amp; Baumarkt</h2>
        <span className="hint">{game.placements.length}/{game.floorSize * game.floorSize} Felder · {game.visitors.length} Gäste</span>
      </header>

      <div className="section-label">Baumarkt</div>
      <div className="catalog-grid">
        {available.map((entry) => (
          <button
            type="button"
            key={entry.id}
            className={entry.id === selected ? 'catalog-card active' : 'catalog-card'}
            onClick={() => setSelected(entry.id)}
          >
            <header>
              <strong>{entry.name}</strong>
              <span>{toVCString(entry.priceVC)}</span>
            </header>
            <p>{entry.description}</p>
            <small>{entry.kind === 'SLOT' ? `${entry.paylines} Payline(s) · max. ${entry.maxMods} Mods` : KIND_NOTE[entry.kind]}</small>
          </button>
        ))}
      </div>

      <div className="place-panel">
        <p className="hint">
          Ausgewählt: <strong>{item.name}</strong> ({toVCString(item.priceVC)}). Klicke ein freies Feld im {venue.gridSize}×{venue.gridSize}-Grid.
        </p>
        <div className="build-grid">
          {Array.from({ length: game.floorSize * game.floorSize }, (_, index) => {
            const x = index % game.floorSize;
            const y = Math.floor(index / game.floorSize);
            const placed = game.placements.find((entry) => entry.x === x && entry.y === y);
            const buildable = placed ? getBuildable(placed.buildableId) : null;
            return (
              <button
                type="button"
                key={index}
                className={[
                  'build-cell',
                  buildable ? 'occupied' : 'empty',
                  buildable ? `b-${buildable.id.toLowerCase()}` : '',
                ].join(' ')}
                title={buildable ? `${buildable.name} (${x},${y})` : `Feld ${x},${y} bebauen`}
                disabled={Boolean(buildable)}
                onClick={() => gameStore.build(active, x, y)}
              >
                {placed ? GLYPH[placed.buildableId] : ''}
              </button>
            );
          })}
        </div>
        <p className="hint">
          Teppich senkt den Geduldsverlust · Neon-Schild bringt Gäste · Fusel-Spender kauft Geduld für Tresorgeld.
        </p>
      </div>

      <div className="section-label">Betreiber-Mods</div>
      <p className="hint">Nur für deine eigenen Spiele. Sie erhöhen Hausvorteil und Sucht, niemals deinen CPU-Bonus.</p>
      <OperatorModPanel placements={game.placements} tier={game.venueTier} cash={game.cash} />

      <div className="section-label">Live-Gäste ({game.visitors.length})</div>
      <p className="hint">Σ = Gesamtbilanz seit Buy-in · rot: Gast vorn · grün: Casino vorn.</p>
      {game.visitors.length === 0 ? (
        <p className="hint">Noch keine Gäste. Ein Automat und ein Neon-Schild helfen.</p>
      ) : (
        <ul className="visitor-list">
          {game.visitors.map((visitor) => {
            const mood = statusOf(visitor.addiction);
            const net = visitorNetResult(visitor);
            return (
              <li key={visitor.id} className={`visitor ${mood.key}`}>
                <div className="visitor-id">
                  <strong>{visitor.name}</strong>
                  <span>{OUTFITS[visitor.outfitTier]}</span>
                </div>
                <div className="visitor-wallet">
                  <span>{toVCString(visitor.wallet)}</span>
                  <small className={net > 0 ? 'visitor-net win' : net < 0 ? 'visitor-net loss' : 'visitor-net'}>
                    Σ {toVCString(net)}
                  </small>
                </div>
                <div className="visitor-addiction">
                  <div className="addiction-track">
                    <span style={{ width: `${visitor.addiction}%` }} />
                  </div>
                  <small>
                    Sucht {visitor.addiction}% · Geduld {Math.max(0, Math.round(visitor.patience))}% · {visitor.spins} Spins
                  </small>
                </div>
                <div className="visitor-actions">
                  {visitor.pendingPayout > 0 ? (
                    <button type="button" className="visitor-pay" onClick={() => gameStore.payVisitor(visitor.id)}>
                      {toVCString(visitor.pendingPayout)} auszahlen
                    </button>
                  ) : (
                    <div className={`visitor-state ${mood.key}`}>{mood.label}</div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="hint">
        {gameCount} Spielstätten · {game.placements.length - gameCount} Deko · Tresor deckt Auszahlungen bis {toVCString(game.vault)}.
        {' '}Offene Gewinne: {toVCString(game.pendingPayouts)} — Gäste warten auf deine Auszahlung.
      </p>
    </section>
  );
}
