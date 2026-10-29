/** Spielansicht: ein grosser Pixi-Screen fuer alle sechs Spielarten. */
import type { CpuTableGame } from '../../core/simulation/cpu-tables';
import { useGameStore } from '../../store/use-game-store';
import { CardTablesPanel } from '../../stage/card-tables-panel';
import { OwnCardPlay } from './own-card-play';
import { OwnTablePlay } from './own-table-play';
import { SlotPlay } from './slot-play';

export type PlayGame = 'SLOT' | 'SHELL' | 'DICE' | 'ROULETTE' | 'BLACKJACK' | 'POKER';

const TABS: readonly { id: PlayGame; label: string; tier: number }[] = [
  { id: 'SLOT', label: 'SLOT', tier: 1 },
  { id: 'SHELL', label: 'HÜTCHEN', tier: 1 },
  { id: 'DICE', label: 'WÜRFEL', tier: 2 },
  { id: 'ROULETTE', label: 'ROULETTE', tier: 3 },
  { id: 'BLACKJACK', label: 'BLACKJACK', tier: 3 },
  { id: 'POKER', label: 'POKER', tier: 4 },
];

export interface PlayStageProps {
  readonly game: PlayGame;
  readonly source: 'CPU' | 'OWN';
  readonly onGame: (game: PlayGame) => void;
  readonly onSource: (source: 'CPU' | 'OWN') => void;
  readonly onExit: () => void;
}

export function PlayStage({ game, source, onGame, onSource, onExit }: PlayStageProps) {
  const state = useGameStore();
  const active = TABS.find((entry) => entry.id === game)!;
  const locked = active.tier > state.venueTier;

  return (
    <section className="play-stage">
      <header className="play-tabs">
        <div className="play-tab-list">
          {TABS.map((entry) => (
            <button type="button" key={entry.id} className={entry.id === game ? 'active' : ''} disabled={entry.tier > state.venueTier} onClick={() => onGame(entry.id)}>
              {entry.label}
            </button>
          ))}
        </div>
        <button type="button" className="play-back" onClick={onExit}>ZURÜCK ZUM FLOOR</button>
      </header>

      <div className="play-body">
        {locked ? (
          <div className="play-locked"><strong>NOCH GESPERRT</strong><p>Dieses Spiel braucht Casino-Stufe {active.tier}. Baue deinen Standort aus.</p></div>
        ) : game === 'SLOT' ? (
          <SlotPlay source={source} onSource={onSource} />
        ) : game === 'SHELL' || game === 'DICE' ? (
          <OwnTablePlay kind={game} />
        ) : source === 'OWN' ? (
          <OwnCardPlay game={game} />
        ) : (
          <CardTablesPanel game={game as CpuTableGame} />
        )}
      </div>
    </section>
  );
}
