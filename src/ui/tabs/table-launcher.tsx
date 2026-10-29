/** Startknöpfe für die drei CPU-Tischspiele im Hustle-Tab. */
import { TABLE_GAME_NAMES, type CpuTableGame } from '../../core/simulation/cpu-tables';

const GAMES: readonly CpuTableGame[] = ['ROULETTE', 'BLACKJACK', 'POKER'];

const SUBTITLE: Readonly<Record<CpuTableGame, string>> = {
  ROULETTE: '37 Pockets · optional 00/000 · Blitz bis 300x',
  BLACKJACK: '6 Decks · Hit/Stand · Blackjack 3:2',
  POKER: '5 Karten gegen den Dealer · Ante-Bonus',
};

export interface TableLauncherProps {
  readonly disabled: boolean;
  readonly onOpen: (game: CpuTableGame) => void;
}

export function TableLauncher({ disabled, onOpen }: TableLauncherProps) {
  return (
    <>
      <div className="section-label">C · Tische im CPU-Casino</div>
      <div className="table-launcher">
        {GAMES.map((game) => (
          <button
            type="button"
            key={game}
            className="table-launch-card"
            disabled={disabled}
            onClick={() => onOpen(game)}
          >
            <strong>{TABLE_GAME_NAMES[game]}</strong>
            <span>{SUBTITLE[game]}</span>
          </button>
        ))}
      </div>
      {disabled && <p className="lock-hint">Baue zuerst eine eigene Spielstätte auf, bevor du fremde Tische besuchst.</p>}
    </>
  );
}
