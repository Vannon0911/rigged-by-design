/** Kompakte, deterministische Runden fuer alle Spiele. Auszahlung in Basispunkten (10000 = 1x). */
import type { GameId } from '../sim/types';
import type { Prng } from '../rng/prng';

export interface RoundResult {
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

/** 10000 -> "1x", 14500 -> "1,45x". Nur fuer Anzeige. */
function multiplier(bps: number): string {
  return `${parseFloat((bps / 10_000).toFixed(2))}x`.replace('.', ',');
}

function slot(prng: Prng): RoundResult {
  const reels = [0, 1, 2].map(() => SLOT_SYMBOLS[prng.nextInt(0, SLOT_SYMBOLS.length - 1)]!);
  const [a = 'BLANK', b = 'BLANK', c = 'BLANK'] = reels;
  const triple = a === b && b === c;
  const pair = a === b || b === c;
  const bps = triple ? (SLOT_TRIPLE_BPS[a] ?? 0) : pair ? 14_000 : 0;
  const label = bps === 0 ? 'Niete' : `${triple ? 'Dreier' : 'Paar'} ${multiplier(bps)}`;
  return { game: 'SLOT', multiplierBps: bps, label, detail: reels };
}

function card(prng: Prng): string {
  const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  return `${ranks[prng.nextInt(0, 12)]!}${['♠', '♥', '♦', '♣'][prng.nextInt(0, 3)]!}`;
}

function blackjack(prng: Prng): RoundResult {
  const hand = [card(prng), card(prng)];
  const dealer = [card(prng), card(prng)];
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
  const hand = [0, 1, 2, 3, 4].map(() => card(prng));
  const ranks = hand.map((entry) => entry.slice(0, -1));
  const counts = new Map<string, number>();
  for (const rank of ranks) counts.set(rank, (counts.get(rank) ?? 0) + 1);
  const max = Math.max(...counts.values());
  const pairs = [...counts.values()].filter((count) => count === 2).length;
  const flush = new Set(hand.map((entry) => entry.slice(-1))).size === 1;
  const bps = max >= 4 ? 300_000
    : max === 3 ? 35_000
      : pairs === 2 ? 22_000
        : flush ? 80_000
          : max === 2 ? 11_500
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
  const number = prng.nextInt(0, 36);
  const red = RED.has(number);
  // Fester Satz auf Rot: 18 von 37 Feldern; 1,95x statt 2x haelt die RTP bei 94,9 %.
  const win = number !== 0 && red;
  const bps = win ? 19_500 : 0;
  const label = win ? `Rot ${multiplier(bps)}` : number === 0 ? 'Zero - verloren' : 'Schwarz - verloren';
  return { game: 'ROULETTE', multiplierBps: bps, label, detail: [`${number}`, red ? 'rot' : 'schwarz', 'Satz: Rot'] };
}

function plinko(prng: Prng): RoundResult {
  let slot = 0;
  for (let row = 0; row < 8; row += 1) slot += prng.nextInt(0, 1);
  const table = [200_000, 40_000, 14_500, 4_000, 2_000, 4_000, 14_500, 40_000, 200_000];
  const bps = table[slot] ?? 0;
  return {
    game: 'PLINKO',
    multiplierBps: bps,
    label: `Fach ${slot + 1} - ${multiplier(bps)}`,
    detail: ['●', ...Array.from({ length: 8 }, (_, i) => (i <= slot ? '╲' : '╱'))],
  };
}

function shell(prng: Prng): RoundResult {
  const win = prng.nextInt(0, 2) === 0;
  return {
    game: 'SHELL',
    multiplierBps: win ? 28_500 : 0,
    label: win ? `Kugel gefunden ${multiplier(28_500)}` : 'Leer',
    detail: ['🥚', '·', '·'],
  };
}

function dice(prng: Prng): RoundResult {
  const a = prng.nextInt(1, 6);
  const b = prng.nextInt(1, 6);
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
