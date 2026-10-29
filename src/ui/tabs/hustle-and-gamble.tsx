import { useEffect, useState } from 'react';
import { fromVC, toVCString, type VaCoinMicro } from '../../core/economy/vacoin';
import { getVenue } from '../../core/progression/venues-and-tiers';
import { CPU_CASINOS, getCpuCasino, type CpuCasinoId } from '../../core/simulation/cpu-casinos';
import { resolvePaylines } from '../../core/slot/slot-engine';
import type { CpuTableGame } from '../../core/simulation/cpu-tables';
import { gameStore, useGameStore } from '../../store/use-game-store';
import { TableLauncher } from './table-launcher';

const CHIPS: readonly VaCoinMicro[] = [fromVC(0.1), fromVC(0.5), fromVC(1)];
const AUTO_SPIN_MS = 2200;

function chipLabel(value: VaCoinMicro): string {
  return toVCString(value).replace(' VC', '');
}

export interface HustleAndGambleProps {
  readonly onSpin: () => Promise<boolean>;
  readonly slotOpen: boolean;
  readonly onOpenSlot: () => void;
  readonly onOpenTable: (game: CpuTableGame) => void;
}

export function HustleAndGamble({ onSpin, slotOpen, onOpenSlot, onOpenTable }: HustleAndGambleProps) {
  const game = useGameStore();
  const [auto, setAuto] = useState(false);
  const casino = getCpuCasino(game.casinoId);
  const venue = getVenue(game.venueTier);
  const lines = resolvePaylines(casino.slot).length;
  const maxBet = Math.min(casino.maxBetVC, Math.floor(game.cash / lines)) as VaCoinMicro;
  const locked = casino.venueTier > venue.tier;
  const canSpin =
    game.hasGame &&
    slotOpen &&
    !locked &&
    game.bet >= casino.minBetVC &&
    game.bet <= casino.maxBetVC &&
    game.bet * lines <= game.cash;

  useEffect(() => {
    if (!auto || !slotOpen) return;
    const timer = window.setInterval(() => {
      void onSpin().then((ok) => {
        if (!ok) setAuto(false);
      });
    }, AUTO_SPIN_MS);
    return () => window.clearInterval(timer);
  }, [auto, onSpin, slotOpen]);

  useEffect(() => {
    if (auto && (!canSpin || !slotOpen)) setAuto(false);
  }, [auto, canSpin, slotOpen]);

  const toggleAuto = (): void => {
    const next = !auto;
    setAuto(next);
    if (next) void onSpin();
  };

  const pickCasino = (id: CpuCasinoId): void => {
    const target = getCpuCasino(id);
    if (target.venueTier > venue.tier) return;
    setAuto(false);
    gameStore.selectCasino(id);
  };

  const pickBet = (value: VaCoinMicro): void => {
    setAuto(false);
    gameStore.setBet(value);
  };

  return (
    <section className="tab-page">
      <header className="tab-head">
        <h2>Eigenes Geschäft &amp; CPU-Casinos</h2>
        <span className="hint">Erst die Straße, dann der Palast.</span>
      </header>

      <div className="section-label">A · Deine Straßenkasse</div>
      <article className="street-panel">
        <header>
          <div>
            <strong>{venue.name}</strong>
            <p>{game.hasGame ? 'Dein erstes Spiel steht. Gäste zahlen in den Tresor, du zahlst Gewinne aus.' : 'Noch kein Spiel aufgebaut.'}</p>
          </div>
          <span className="job-pay">{toVCString(game.cash)}</span>
        </header>
        <div className="street-stats">
          <span>Tresor {toVCString(game.vault)}</span>
          <span>{game.visitors.length} Gäste</span>
          <span>Ø Sucht {Math.round(game.avgAddiction)} %</span>
          <span>Rang {venue.tier} / 4</span>
        </div>
        <p className="hint">
          Kein Pfand, kein Türsteher-Job: Dein Kapital kommt aus dem Hütchenspiel-Karton, aus
          Tresor-Abhebungen und aus den CPU-Casinos. Jede Stufe schaltet größere Tische und
          dickere CPU-Casinos frei.
        </p>
      </article>

      <div className="section-label">B · Fremde CPU-Casinos</div>
      <div className="casino-grid">
        {CPU_CASINOS.map((entry) => {
          const venueLock = entry.venueTier > venue.tier;
          return (
            <button
              type="button"
              key={entry.id}
              className={entry.id === game.casinoId ? 'casino-card active' : 'casino-card'}
              disabled={venueLock}
              onClick={() => pickCasino(entry.id)}
            >
              <strong>{entry.name}</strong>
              <span>{entry.description}</span>
              <small>{resolvePaylines(entry.slot).length} Linien · Ziel-RTP {Math.round(entry.targetRtp * 100)} %</small>
              {venueLock && <em>Gesperrt bis Casino-Rang {entry.venueTier}</em>}
            </button>
          );
        })}
      </div>

      <div className="bet-panel">
        <div className="bet-row">
          <span className="bet-label">Einsatz / Linie</span>
          {CHIPS.map((value) => (
            <button
              type="button"
              key={value}
              className={game.bet === value ? 'bet-chip active' : 'bet-chip'}
              disabled={value < casino.minBetVC || value > casino.maxBetVC || value * lines > game.cash}
              onClick={() => pickBet(value)}
            >
              {chipLabel(value)}
            </button>
          ))}
          <button
            type="button"
            className={game.bet === maxBet ? 'bet-chip active' : 'bet-chip'}
            disabled={maxBet < casino.minBetVC}
            onClick={() => pickBet(maxBet)}
          >
            MAX
          </button>
        </div>
        <p className="hint">
          Gesamt {toVCString((game.bet * lines) as VaCoinMicro)} pro Spin · {lines} Linien · Fenster{' '}
          {toVCString(casino.minBetVC)} - {toVCString(casino.maxBetVC)}
        </p>
        {!game.hasGame && <p className="lock-hint">Baue zuerst ein Spiel im Baumarkt.</p>}
        {game.hasGame && locked && <p className="lock-hint">Gesperrt: Eigenes Casino braucht Rang {casino.venueTier}.</p>}
      </div>

      <div className="spin-row">
        <button
          type="button"
          className="spin-cta"
          disabled={slotOpen ? !canSpin : !game.hasGame}
          onClick={() => (slotOpen ? void onSpin() : onOpenSlot())}
        >
          {slotOpen ? 'SPIN!' : 'SLOT ÖFFNEN'}
        </button>
        <button
          type="button"
          className={auto ? 'auto-cta on' : 'auto-cta'}
          disabled={!canSpin}
          onClick={toggleAuto}
        >
          {auto ? 'AUTO-SPIN: AN' : 'AUTO-SPIN: AUS'}
        </button>
      </div>

      <TableLauncher disabled={!game.hasGame} onOpen={onOpenTable} />

      {game.lastSpin && (
        <div className={game.lastSpin.spin.isNearMiss ? 'round-strip near' : 'round-strip'}>
          <span>Letzte Runde</span>
          <span>Einsatz {toVCString(game.lastSpin.bet)}</span>
          <strong>{game.lastSpin.payout > 0 ? `+${toVCString(game.lastSpin.payout)}` : '0.0000 VC'}</strong>
          <span>
            {game.lastSpin.spin.isNearMiss
              ? 'NEAR MISS'
              : game.lastSpin.spin.isLDW
                ? 'LDW - Verlust als Gewinn'
                : game.lastSpin.payout > 0
                  ? 'GEWINN'
                  : 'NIETE'}
          </span>
        </div>
      )}
    </section>
  );
}
