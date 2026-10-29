/** Spielt Roulette, Blackjack oder Poker im CPU-Casino und zeigt die echte Core-Runde im Pixi-Tisch. */
import { useEffect, useRef, useState } from 'react';
import { toVCString } from '../core/economy/vacoin';
import type { RouletteBetType } from '../core/games/roulette/roulette-types';
import { TABLE_GAME_NAMES, type CpuTableGame } from '../core/simulation/cpu-tables';
import { gameStore, useGameStore } from '../store/use-game-store';
import { CardAndRouletteView } from './games/card-and-roulette-view';

const GAMES: readonly CpuTableGame[] = ['ROULETTE', 'BLACKJACK', 'POKER'];
const ROULETTE_BETS: readonly { id: RouletteBetType; label: string; dozen?: 1 | 2 | 3 }[] = [
  { id: 'RED', label: 'ROT' },
  { id: 'BLACK', label: 'SCHWARZ' },
  { id: 'EVEN', label: 'GERADE' },
  { id: 'ODD', label: 'UNGERADE' },
  { id: 'STRAIGHT', label: '17 DIREKT' },
  { id: 'DOZEN', label: '1-12', dozen: 1 },
  { id: 'DOZEN', label: '13-24', dozen: 2 },
  { id: 'DOZEN', label: '25-36', dozen: 3 },
];

export interface CardTablesPanelProps {
  readonly game: CpuTableGame;
}

export function CardTablesPanel({ game }: CardTablesPanelProps) {
  const state = useGameStore();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<CardAndRouletteView | null>(null);
  const lockRef = useRef(false);
  const [active, setActive] = useState<CpuTableGame>(game);
  const [rouletteBet, setRouletteBet] = useState<RouletteBetType>('RED');
  const [rouletteDozen, setRouletteDozen] = useState<1 | 2 | 3>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setActive(game); }, [game]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let view: CardAndRouletteView | null = null;
    const boot = async (): Promise<void> => {
      try {
        const created = await CardAndRouletteView.create(host);
        if (disposed) {
          created.destroy();
          return;
        }
        view = created;
        viewRef.current = created;
      } catch (cause) {
        if (!disposed) setError(cause instanceof Error ? cause.message : 'Tisch-Renderer konnte nicht starten.');
      }
    };
    void boot();
    return () => {
      disposed = true;
      viewRef.current = null;
      view?.destroy();
      host.replaceChildren();
    };
  }, []);

  const play = async (): Promise<void> => {
    if (lockRef.current) return;
    lockRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = gameStore.playCpuTable(
        active,
        active === 'ROULETTE' ? rouletteBet : undefined,
        active === 'ROULETTE' ? rouletteDozen : undefined,
      );
      if (!result) {
        setError(state.notice);
        return;
      }
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

  const canPlay = state.hasGame && state.cash >= state.bet;

  return (
    <div className="card-table-panel">
      <div className="table-actions">
        {GAMES.map((entry) => (
          <button
            type="button"
            key={entry}
            className={entry === active ? 'table-switch active' : 'table-switch'}
            disabled={busy}
            onClick={() => setActive(entry)}
          >
            {TABLE_GAME_NAMES[entry]}
          </button>
        ))}
        <span className="hint">Einsatz {toVCString(state.bet)} · Limit aus dem gewählten CPU-Casino</span>
      </div>

      {active === 'ROULETTE' && (
        <div className="table-actions roulette-bets">
          {ROULETTE_BETS.map((bet) => (
            <button
              type="button"
              key={bet.id}
              className={bet.id === rouletteBet && (bet.dozen ?? 1) === rouletteDozen ? 'bet-chip active' : 'bet-chip'}
              disabled={busy}
              onClick={() => { setRouletteBet(bet.id); setRouletteDozen(bet.dozen ?? 1); }}
            >
              {bet.label}
            </button>
          ))}
        </div>
      )}

      <div className="table-host" ref={hostRef} aria-label="Roulette- und Kartentisch" />
      {error && <p className="lab-error">{error}</p>}

      <button type="button" className="spin-cta" disabled={!canPlay || busy} onClick={() => void play()}>
        {busy ? '...' : active === 'ROULETTE' ? 'KESSEL DREHEN' : active === 'BLACKJACK' ? 'HAND GEBEN' : 'DEALEN'}
      </button>
      <div className="round-strip">
        <span>{state.notice}</span>
        {state.lastTable && state.lastTable.game === active && (
          <strong>{state.lastTable.payout > 0 ? `+${toVCString(state.lastTable.payout)}` : '0.0000 VC'}</strong>
        )}
      </div>
    </div>
  );
}
