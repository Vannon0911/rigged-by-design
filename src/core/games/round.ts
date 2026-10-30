/** Kompakte, deterministische Runden fuer alle Spiele. Auszahlung in Basispunkten (10000 = 1x). */
import type { GameId } from '../sim/types';
import type { Prng } from '../rng/prng';
import { createShoe, type Card } from '../rng/shoe';
import { buildDistribution, rollNumber } from '../rng/weighted';
import { createPlinkoBoard, PLINKO_POCKETS } from './plinko-board';

interface RoundResult {
  readonly game: GameId;
  readonly multiplierBps: number;
  readonly label: string;
  readonly detail: readonly string[];
}

const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const SLOT_SYMBOLS = ['CHERRY', 'BELL', 'SEVEN', 'DIAMOND', 'BLANK'] as const;
const SLOT_TRIPLE_BPS: Readonly<Record<string, number>> = {
  CHERRY: 60_000,
  BELL: 60_000,
  SEVEN: 120_000,
  DIAMOND: 300_000,
  BLANK: 90_000,
};

/** Alle Spiele ziehen ueber denselben Vertrag; die Chance kommt aus derselben Verteilung. */
const SLOT_REEL = buildDistribution(0, SLOT_SYMBOLS.length - 1);
const ROULETTE_NUMBER = buildDistribution(0, 36);
const SHELL_POSITION = buildDistribution(0, 2);
const DIE = buildDistribution(1, 6);

/** 10000 -> "1x", 14500 -> "1,45x". Nur fuer Anzeige. */
function multiplier(bps: number): string {
  return `${parseFloat((bps / 10_000).toFixed(2))}x`.replace('.', ',');
}

function slot(prng: Prng): RoundResult {
  const reels = [0, 1, 2].map(() => SLOT_SYMBOLS[rollNumber(prng, SLOT_REEL).value]!);
  const [a = 'BLANK', b = 'BLANK', c = 'BLANK'] = reels;
  const triple = a === b && b === c;
  const pair = a === b || b === c;
  const bps = triple ? (SLOT_TRIPLE_BPS[a] ?? 0) : pair ? 14_000 : 0;
  const label = bps === 0 ? 'Niete' : `${triple ? 'Dreier' : 'Paar'} ${multiplier(bps)}`;
  return { game: 'SLOT', multiplierBps: bps, label, detail: reels };
}

/** Karten kommen aus dem Schuh; ein Blatt kann keine Karte doppelt enthalten. */
const cardLabel = (card: Card): string => `${card.rank}${card.suit}`;

function blackjack(prng: Prng): RoundResult {
  const shoe = createShoe(prng);
  const hand = [cardLabel(shoe.draw()), cardLabel(shoe.draw())];
  const dealer = [cardLabel(shoe.draw()), cardLabel(shoe.draw())];
  const value = (cards: string[]): number => cards.reduce((sum, entry) => {
    const rank = entry.slice(0, -1);
    return sum + (rank === 'A' ? 11 : ['J', 'Q', 'K'].includes(rank) ? 10 : Number(rank));
  }, 0);
  const player = value(hand) > 21 ? value(hand) - 10 : value(hand);
  const house = value(dealer) > 21 ? value(dealer) - 10 : value(dealer);
  const bps = player > house ? 19_000 : player === house ? 10_000 : 0;
  const label = bps === 19_000 ? `Gewonnen ${multiplier(bps)}` : bps === 10_000 ? 'Push' : 'Verloren';
  return { game: 'BLACKJACK', multiplierBps: bps, label, detail: [...hand, 'gegen', ...dealer] };
}

function poker(prng: Prng): RoundResult {
  const shoe = createShoe(prng);
  const hand = Array.from({ length: 5 }, () => cardLabel(shoe.draw()));
  const ranks = hand.map((entry) => entry.slice(0, -1));
  const counts = new Map<string, number>();
  for (const rank of ranks) counts.set(rank, (counts.get(rank) ?? 0) + 1);
  const max = Math.max(...counts.values());
  const pairs = [...counts.values()].filter((count) => count === 2).length;
  const flush = new Set(hand.map((entry) => entry.slice(-1))).size === 1;
  // Auf die echten Fuenf-Karten-Haeufigkeiten des Schuhs geeicht (Paar 42,3 %,
  // zwei Paare 4,75 %, Drilling/Full House 2,26 %, Flush 0,20 %, Vierling 0,02 %).
  const bps = max >= 4 ? 400_000
    : max === 3 ? 60_000
      : pairs === 2 ? 30_000
        : flush ? 90_000
          : max === 2 ? 15_000
            : 0;
  const label = max >= 4 ? `Vierling ${multiplier(bps)}`
    : max === 3 ? `Drilling/Full House ${multiplier(bps)}`
      : pairs === 2 ? `Zwei Paare ${multiplier(bps)}`
        : flush ? `Flush ${multiplier(bps)}`
          : max === 2 ? `Paar ${multiplier(bps)}`
            : 'Nichts';
  return { game: 'POKER', multiplierBps: bps, label, detail: hand };
}

function roulette(prng: Prng): RoundResult {
  const number = rollNumber(prng, ROULETTE_NUMBER).value;
  const red = RED.has(number);
  // Fester Satz auf Rot: 18 von 37 Feldern; 1,95x statt 2x haelt die RTP bei 94,9 %.
  const win = number !== 0 && red;
  const bps = win ? 19_500 : 0;
  const label = win ? `Rot ${multiplier(bps)}` : number === 0 ? 'Zero - verloren' : 'Schwarz - verloren';
  return { game: 'ROULETTE', multiplierBps: bps, label, detail: [`${number}`, red ? 'rot' : 'schwarz', 'Satz: Rot'] };
}

/** Paytable auf die gemessene Fachverteilung des Boards geeicht. */
const PLINKO_PAYOUT_BPS = [23_000, 26_000, 10_500, 0, 0, 0, 10_500, 26_000, 60_000] as const;
const plinkoBoard = createPlinkoBoard();

function plinko(prng: Prng): RoundResult {
  const drop = plinkoBoard.drop(prng);
  const bps = PLINKO_PAYOUT_BPS[drop.pocket] ?? 0;
  return {
    game: 'PLINKO',
    multiplierBps: bps,
    label: `Fach ${drop.pocket + 1} - ${multiplier(bps)}`,
    detail: ['●', `${drop.pocket + 1}/${PLINKO_POCKETS}`, `${drop.steps} Schritte`],
  };
}

function shell(prng: Prng): RoundResult {
  const win = rollNumber(prng, SHELL_POSITION).value === 0;
  return {
    game: 'SHELL',
    multiplierBps: win ? 28_500 : 0,
    label: win ? `Kugel gefunden ${multiplier(28_500)}` : 'Leer',
    detail: ['🥚', '·', '·'],
  };
}

function dice(prng: Prng): RoundResult {
  const a = rollNumber(prng, DIE).value;
  const b = rollNumber(prng, DIE).value;
  const win = a + b > 7;
  return {
    game: 'DICE',
    multiplierBps: win ? 22_800 : 0,
    label: win ? `${a + b} gewinnt ${multiplier(22_800)}` : `${a + b}`,
    detail: [`${a}`, `${b}`],
  };
}

export function playRound(game: GameId, prng: Prng): RoundResult {
  if (game === 'BLACKJACK') return blackjack(prng);
  if (game === 'POKER') return poker(prng);
  if (game === 'ROULETTE') return roulette(prng);
  if (game === 'PLINKO') return plinko(prng);
  if (game === 'SHELL') return shell(prng);
  if (game === 'DICE') return dice(prng);
  return slot(prng);
}
