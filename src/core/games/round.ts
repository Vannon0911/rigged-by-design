/** Dispatcher: jedes Spiel hat seine eigene Engine, alle liefern dieselbe Ergebnisform. */
import type { GameId } from '../sim/types';
import type { Prng } from '../rng/prng';
import { playBlackjack, playVideoPoker } from './engines/cards';
import { playSlot } from './engines/slot';
import { playShell, rollDice, spinRoulette } from './engines/table';
import { createPlinkoBoard, PLINKO_POCKETS, type PlinkoDrop } from './plinko-board';

interface RoundResult {
  readonly game: GameId;
  readonly multiplierBps: number;
  readonly label: string;
  readonly detail: readonly string[];
}

/** Paytable auf die gemessene Fachverteilung des Boards geeicht. */
const PLINKO_PAYOUT_BPS = [23_000, 26_000, 10_500, 0, 0, 0, 10_500, 26_000, 60_000] as const;
const plinkoBoard = createPlinkoBoard();

/** Alle Baelle des Wurfs zahlen zusammen; ein einzelner Ball bleibt die normale Runde. */
function payoutOf(drop: PlinkoDrop): number {
  return drop.pockets.reduce((total, pocket) => total + (PLINKO_PAYOUT_BPS[pocket] ?? 0), 0);
}

function plinko(prng: Prng): RoundResult {
  const drop = plinkoBoard.drop(prng);
  const bps = payoutOf(drop);
  const lanes = drop.pockets.length > 1
    ? `${drop.pockets.length}× ${drop.pockets.map((pocket) => pocket + 1).join('/')}`
    : `${drop.pocket + 1}/${PLINKO_POCKETS}`;
  return {
    game: 'PLINKO',
    multiplierBps: bps,
    label: `Fach ${drop.pocket + 1} - ${(bps / 10_000).toFixed(2).replace('.', ',')}x`,
    detail: ['●', lanes, `${drop.steps} Schritte`],
  };
}

/** Standard-Satz je Spiel, solange der Spieler keine eigene Wettart waehlt. */
export function playRound(game: GameId, prng: Prng): RoundResult {
  if (game === 'BLACKJACK') return { game, ...playBlackjack(prng) };
  if (game === 'POKER') return { game, ...playVideoPoker(prng) };
  if (game === 'ROULETTE') {
    const outcome = spinRoulette(prng, { kind: 'RED' });
    return { game, multiplierBps: outcome.multiplierBps, label: outcome.label, detail: outcome.detail };
  }
  if (game === 'PLINKO') return plinko(prng);
  if (game === 'SHELL') return { game, ...playShell(prng) };
  if (game === 'DICE') return { game, ...rollDice(prng, { kind: 'OVER' }) };
  return { game: 'SLOT', ...playSlot(prng) };
}
