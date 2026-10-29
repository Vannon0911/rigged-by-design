import { useEffect, useState } from 'react';
import { fromVC, toVCString, type VaCoinMicro } from '../../core/economy/vacoin';
import { CPU_CASINOS, getCpuCasino, type CpuCasinoId } from '../../core/simulation/cpu-casinos';
import { JOBS } from '../../core/simulation/hustle-work';
import { gameStore, useGameStore } from '../../store/use-game-store';

const CHIPS: readonly VaCoinMicro[] = [fromVC(0.1), fromVC(0.5), fromVC(1)];
const AUTO_SPIN_MS = 2200;

function chipLabel(value: VaCoinMicro): string {
  return toVCString(value).replace(' VC', '');
}

export interface HustleAndGambleProps {
  readonly onSpin: () => Promise<boolean>;
}

export function HustleAndGamble({ onSpin }: HustleAndGambleProps) {
  const game = useGameStore();
  const [auto, setAuto] = useState(false);
  const casino = getCpuCasino(game.casinoId);
  const lines = casino.slot.paylines.length;
  const maxBet = Math.min(casino.maxBetVC, Math.floor(game.cash / lines)) as VaCoinMicro;
  const locked = game.cash < casino.unlockBalanceVC;
  const canSpin =
    !locked &&
    game.bet >= casino.minBetVC &&
    game.bet <= casino.maxBetVC &&
    game.bet * lines <= game.cash;

  useEffect(() => {
    if (!auto) return;
    const timer = window.setInterval(() => {
      void onSpin().then((ok) => {
        if (!ok) setAuto(false);
      });
    }, AUTO_SPIN_MS);
    return () => window.clearInterval(timer);
  }, [auto, onSpin]);

  useEffect(() => {
    if (auto && !canSpin) setAuto(false);
  }, [auto, canSpin]);

  const toggleAuto = (): void => {
    const next = !auto;
    setAuto(next);
    if (next) void onSpin();
  };

  const pickCasino = (id: CpuCasinoId): void => {
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
        <h2>Arbeiten &amp; CPU-Casinos</h2>
        <span className="hint">Kapital beschaffen, dann riskieren.</span>
      </header>

      <div className="section-label">A · Arbeiten gehen</div>
      <div className="job-grid">
        {JOBS.map((job) => {
          const state = game.jobs[job.id];
          const progress = state.ready
            ? 100
            : Math.max(0, 100 - ((state.readyAt - game.now) / state.cooldown) * 100);
          const wait = Math.max(0, Math.ceil(state.readyAt - game.now));
          return (
            <article className={state.ready ? 'job ready' : 'job'} key={job.id}>
              <header>
                <div>
                  <h3>{job.name}</h3>
                  <p>{job.description}</p>
                </div>
                <span className="job-pay">+{toVCString(job.payVC)}</span>
              </header>
              <div className="cooldown-track">
                <span style={{ width: `${progress}%` }} />
              </div>
              <button type="button" disabled={!state.ready} onClick={() => gameStore.work(job.id)}>
                {state.ready ? 'Arbeit antreten' : `bereit in ${wait}s`}
              </button>
            </article>
          );
        })}
      </div>

      <div className="section-label">B · Fremde CPU-Casinos</div>
      <div className="casino-grid">
        {CPU_CASINOS.map((entry) => {
          const missing = game.cash < entry.unlockBalanceVC;
          return (
            <button
              type="button"
              key={entry.id}
              className={entry.id === game.casinoId ? 'casino-card active' : 'casino-card'}
              onClick={() => pickCasino(entry.id)}
            >
              <strong>{entry.name}</strong>
              <span>{entry.description}</span>
              <small>{entry.slot.paylines.length} Linien · Ziel-RTP {Math.round(entry.targetRtp * 100)} %</small>
              {missing && <em>Gesperrt bis {toVCString(entry.unlockBalanceVC)}</em>}
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
        {locked && <p className="lock-hint">Gesperrt: erst ab {toVCString(casino.unlockBalanceVC)} auf der Uhr.</p>}
      </div>

      <div className="spin-row">
        <button type="button" className="spin-cta" disabled={!canSpin} onClick={() => void onSpin()}>
          SPIN!
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
