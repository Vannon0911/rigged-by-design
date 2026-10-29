/** Eigener Roulette-, Blackjack- oder Poker-Tisch: echte Core-Runde, Tresor deckt Gewinne. */
import { useEffect, useRef, useState } from 'react';
import { toVCString } from '../../core/economy/vacoin';
import type { RouletteBetType } from '../../core/games/roulette/roulette-types';
import { getBuildable, getOperatorMod } from '../../core/simulation/catalog';
import { TABLE_GAME_NAMES } from '../../core/simulation/cpu-tables';
import { gameStore, useGameStore } from '../../store/use-game-store';
import type { OwnCardGame } from '../../store/own-play';
import { CardAndRouletteView } from '../../stage/games/card-and-roulette-view';

const ROULETTE_BETS: readonly { id: RouletteBetType; label: string; dozen?: 1 | 2 | 3 }[] = [
  { id: 'RED', label: 'ROT' },
  { id: 'BLACK', label: 'SCHWARZ' },
  { id: 'EVEN', label: 'GERADE' },
  { id: 'ODD', label: 'UNGERADE' },
  { id: 'STRAIGHT', label: '17 DIREKT' },
  { id: 'DOZEN', label: '1-12', dozen: 1 },
];

export interface OwnCardPlayProps {
  readonly game: OwnCardGame;
}

export function OwnCardPlay({ game }: OwnCardPlayProps) {
  const state = useGameStore();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<CardAndRouletteView | null>(null);
  const lockRef = useRef(false);
  const [betType, setBetType] = useState<RouletteBetType>('RED');
  const [dozen, setDozen] = useState<1 | 2 | 3>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('Bereit. Der Tresor deckt jeden Gewinn.');
  const table = state.placements.find((item) => getBuildable(item.buildableId).kind === game);
  const mods = table?.mods.map((id) => getOperatorMod(id).name).join(' · ') || 'Keine Betreiber-Mods';

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let view: CardAndRouletteView | null = null;
    const boot = async (): Promise<void> => {
      try {
        const created = await CardAndRouletteView.create(host);
        if (disposed) { created.destroy(); return; }
        view = created;
        viewRef.current = created;
      } catch (cause) {
        if (!disposed) setError(cause instanceof Error ? cause.message : 'Tisch-Renderer konnte nicht starten.');
      }
    };
    void boot();
    return () => { disposed = true; viewRef.current = null; view?.destroy(); host.replaceChildren(); };
  }, []);

  const play = async (): Promise<void> => {
    if (lockRef.current) return;
    lockRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = gameStore.playOwnCard(game, betType, dozen);
      if (!result) { setError(gameStore.getSnapshot().notice); return; }
      setNotice(result.label);
      if (result.roulette) await viewRef.current?.showRoulette(result.roulette);
      if (result.blackjack) await viewRef.current?.showBlackjack(result.blackjack);
      if (result.poker) await viewRef.current?.showPoker(result.poker);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Runde fehlgeschlagen.');
    } finally {
      lockRef.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="card-table-panel">
      <div className="table-actions">
        {game === 'ROULETTE' && ROULETTE_BETS.map((bet) => (
          <button
            type="button"
            key={bet.label}
            className={bet.id === betType && (bet.dozen ?? 1) === dozen ? 'bet-chip active' : 'bet-chip'}
            disabled={busy}
            onClick={() => { setBetType(bet.id); setDozen(bet.dozen ?? 1); }}
          >
            {bet.label}
          </button>
        ))}
        <span className="hint">
          EIGENER TISCH · {TABLE_GAME_NAMES[game]} · EINSATZ {toVCString(state.bet)}
        </span>
      </div>

      <div className="table-host" ref={hostRef} aria-label="Eigener Kessel- und Kartentisch" />
      <p className="hint">TISCH-MODS: {mods}</p>
      {!table && <p className="lab-error">Baue zuerst einen eigenen {TABLE_GAME_NAMES[game]}. Er steht im Baumarkt.</p>}
      {error && <p className="lab-error">{error}</p>}

      <button
        type="button"
        className="spin-cta"
        disabled={!table || state.cash < state.bet || busy}
        onClick={() => void play()}
      >
        {busy ? '...' : game === 'ROULETTE' ? 'KESSEL DREHEN' : game === 'BLACKJACK' ? 'HAND GEBEN' : 'DEALEN'}
      </button>
      <div className="round-strip">
        <span>{notice}</span>
        <strong>{table ? `${table.mods.length} Mods · Tresor ${toVCString(state.vault)}` : 'NICHT GEBAUT'}</strong>
      </div>
    </div>
  );
}
