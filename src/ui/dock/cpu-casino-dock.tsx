/** Rechtes Dock fuer fremde CPU-Casinos: Casino, Einsatz und Startknopf. */
import { toVCString, type VaCoinMicro } from '../../core/economy/vacoin';
import { getVenue } from '../../core/progression/venues-and-tiers';
import { CPU_CASINOS, getCpuCasino, type CpuCasinoId } from '../../core/simulation/cpu-casinos';
import { TABLE_GAME_NAMES, type CpuTableGame } from '../../core/simulation/cpu-tables';
import { resolvePaylines } from '../../core/slot/slot-engine';
import { gameStore, useGameStore } from '../../store/use-game-store';

const CHIPS: readonly VaCoinMicro[] = [0.1, 0.5, 1].map((value) => Math.round(value * 10_000) as VaCoinMicro);

export interface CpuCasinoDockProps {
  readonly onSlot: () => void;
  readonly onTable: (game: CpuTableGame) => void;
}

export function CpuCasinoDock({ onSlot, onTable }: CpuCasinoDockProps) {
  const game = useGameStore();
  const casino = getCpuCasino(game.casinoId);
  const tier = getVenue(game.venueTier).tier;
  const lines = resolvePaylines(casino.slot).length;

  return (
    <section className="cpu-dock">
      <header className="dock-head">
        <div><span>FREMDE CASINOS</span><h2>Wo du selbst zockst</h2></div>
        <strong>{toVCString(game.cash)}</strong>
      </header>

      <div className="cpu-casino-list">
        {CPU_CASINOS.map((entry) => {
          const locked = entry.venueTier > tier;
          return (
            <button type="button" key={entry.id} className={entry.id === game.casinoId ? 'selected' : ''} disabled={locked} onClick={() => gameStore.selectCasino(entry.id as CpuCasinoId)}>
              <span className="cpu-dot" />
              <div><strong>{entry.name}</strong><small>{entry.description}</small></div>
              <em>{locked ? `RANG ${entry.venueTier}` : `${Math.round(entry.targetRtp * 100)}% RTP`}</em>
            </button>
          );
        })}
      </div>

      <div className="cpu-bet">
        <span>EINSATZ / LINIE</span>
        {CHIPS.map((value) => (
          <button type="button" key={value} className={game.bet === value ? 'active' : ''} disabled={value < casino.minBetVC || value > casino.maxBetVC} onClick={() => gameStore.setBet(value)}>
            {toVCString(value).replace(' VC', '')}
          </button>
        ))}
        <small>{lines} Linien · Gesamt {toVCString((game.bet * lines) as VaCoinMicro)}</small>
      </div>

      <button type="button" className="dock-main-cta" disabled={!game.hasGame} onClick={onSlot}>
        SLOT-AUTOMAT ÖFFNEN
      </button>
      <div className="cpu-table-buttons">
        {(['ROULETTE', 'BLACKJACK', 'POKER'] as const).map((entry) => (
          <button type="button" key={entry} disabled={!game.hasGame} onClick={() => onTable(entry)}>
            {TABLE_GAME_NAMES[entry]}
          </button>
        ))}
      </div>
      {!game.hasGame && <p className="dock-note">Baue zuerst ein eigenes Spiel auf, bevor dich die Straße reinlässt.</p>}
      {game.lastSpin && <p className="dock-note">Letzter Spin: {game.lastSpin.payout > 0 ? `+${toVCString(game.lastSpin.payout)}` : 'Niete'} · {toVCString(game.lastSpin.bet)} Einsatz</p>}
    </section>
  );
}
