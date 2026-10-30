/** Fremdes Haus: hier bist du Gast. Nur hier wird echtes Portemonnaie-Geld gesetzt. */
import { useState } from 'react';
import { HOUSE_FLOAT } from '../core/sim/money';
import type { GameId } from '../core/sim/types';
import type { GameView } from '../store/types';
import type { GameResult } from '../core/games/contracts';
import { vc } from './format';
import { PopupShell } from './popup-shell';

interface Props {
  readonly view: GameView;
  readonly onClose: () => void;
  readonly onPlay: (game: GameId, bet: number, edge: number) => GameResult | null;
  readonly onTakeHome: () => void;
}

const GAMES: readonly { id: GameId; name: string; icon: string; note: string }[] = [
  { id: 'SLOT', name: 'Book of Ra', icon: '▦', note: 'Walzen, Freispiele, ein Buch.' },
  { id: 'PLINKO', name: 'Plinko', icon: '▽', note: 'Kugel fallen lassen, zittern.' },
  { id: 'BLACKJACK', name: 'Blackjack', icon: '♠', note: 'Näher an 21 als das Haus.' },
  { id: 'POKER', name: 'Video Poker', icon: '♦', note: 'Fünf Karten, eine Entscheidung.' },
  { id: 'ROULETTE', name: 'Roulette', icon: '◉', note: 'Rot oder Schwarz. Zero lacht.' },
  { id: 'SHELL', name: 'Hütchenspiel', icon: '⌂', note: 'Finde die Kugel. Viel Glück.' },
  { id: 'DICE', name: 'Würfel', icon: '⚄', note: 'Über sieben gewinnt.' },
];

const HOUSES: readonly { id: string; name: string; edge: number; note: string }[] = [
  { id: 'neon', name: 'Neon-Keller', edge: 180, note: 'Faire Quoten, laute Musik.' },
  { id: 'harbor', name: 'Hafenkasino', edge: 280, note: 'Standard. Keiner mag dich hier.' },
  { id: 'palace', name: 'Gold-Palast', edge: 420, note: 'Teure Einsätze, schlechte Quoten.' },
];

const BETS = [0.5, 1, 2, 5];

export function GamesPopup({ view, onClose, onPlay, onTakeHome }: Props) {
  const [game, setGame] = useState<GameId>('SLOT');
  const [house, setHouse] = useState(HOUSES[0]!);
  const [bet, setBet] = useState(0.5);
  const [full, setFull] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<GameResult | null>(null);
  const selected = GAMES.find((entry) => entry.id === game)!;
  const cannotPay = view.wallet < bet * 10_000;

  const play = (): void => {
    if (spinning || cannotPay) return;
    setSpinning(true);
    window.setTimeout(() => {
      setResult(onPlay(game, bet, house.edge));
      setSpinning(false);
    }, 520);
  };

  return (
    <PopupShell eyebrow="DU BIST GAST" title={house.name} onClose={onClose} wide full={full}>
      <div className="foreign-top">
        <div className="house-tabs">
          {HOUSES.map((entry) => (
            <button key={entry.id} type="button" className={`house-tab${house.id === entry.id ? ' active' : ''}`} onClick={() => { setHouse(entry); setResult(null); }}>
              <strong>{entry.name}</strong><span>{entry.note} · Hausvorteil {entry.edge / 100}%</span>
            </button>
          ))}
        </div>
        <div className="foreign-wallet">
          <span>PORTEMONNAIE</span>
          <strong>{vc(view.wallet, 2)}</strong>
          <button type="button" className="btn small" onClick={onTakeHome} disabled={view.house <= HOUSE_FLOAT} title="Bis zu 5 VC; 5 VC bleiben als Betriebsreserve im Hauskonto.">ABHEBEN</button>
          <button type="button" className="btn small ghost" onClick={() => setFull((value) => !value)}>{full ? 'FENSTER' : 'VOLLBILD'}</button>
        </div>
      </div>

      <div className="game-select">
        {GAMES.map((entry) => (
          <button key={entry.id} type="button" className={`game-tab${game === entry.id ? ' active' : ''}`} onClick={() => { setGame(entry.id); setResult(null); }}>
            <b>{entry.icon}</b><strong>{entry.name}</strong><span>{entry.note}</span>
          </button>
        ))}
      </div>

      <div className={`table-stage${full ? ' full' : ''}`}>
        <div className={`game-screen${spinning ? ' spinning' : ''}`}>
          <div className="screen-title">{selected.name}</div>
          <div className="screen-result">
            {result ? result.detail.slice(0, 5).map((part, index) => <span key={index} className="screen-symbol">{part}</span>) : <span className="screen-symbol muted">BEREIT</span>}
          </div>
          <div className={`screen-label${result && result.payout > 0 ? ' win' : ''}`}>
            {spinning ? 'Das Rad dreht…' : result ? `${result.label}${result.payout > 0 ? ` · ${vc(result.payout, 2)}` : ''}` : 'Setze einen Einsatz.'}
          </div>
        </div>
        <div className="table-controls">
          <div className="bet-row">
            {BETS.map((value) => (
              <button key={value} type="button" className={`chip${bet === value ? ' active' : ''}`} onClick={() => setBet(value)}>{value} VC</button>
            ))}
          </div>
          <button type="button" className="btn primary big" disabled={spinning || cannotPay} onClick={play}>
            {cannotPay ? 'ZU WENIG BARGELD' : spinning ? 'SPIELT…' : `SPIELEN · ${bet} VC`}
          </button>
          <small>Gewinne gehen zurück ins Portemonnaie. Verluste bleiben hier.</small>
        </div>
      </div>
    </PopupShell>
  );
}
