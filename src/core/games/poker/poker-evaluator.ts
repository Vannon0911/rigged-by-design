/** Poker-Hand-Evaluator: 5 bis 7 Karten, Histogramm + Bitmaske, exakter Kicker-Score. */
import type { Card } from '../deck-engine';

export type HandCategory = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export const HAND_CATEGORY_NAMES = [
  'High Card',
  'Paar',
  'Zwei Paare',
  'Drilling',
  'Straße',
  'Flush',
  'Full House',
  'Vierling',
  'Straight Flush',
  'Royal Flush',
] as const;

export interface HandRank {
  readonly category: HandCategory;
  readonly categoryName: string;
  readonly score: number;
  readonly kickers: readonly number[];
}

const BASE = 15;
export const HAND_SCORE_BASE = BASE ** 5;

function topRanks(ranks: readonly number[], exclude: readonly number[], count: number): number[] {
  const unique = [...new Set(ranks)].filter((rank) => !exclude.includes(rank)).sort((a, b) => b - a);
  return unique.slice(0, count);
}

function straightHigh(ranks: readonly number[]): number | null {
  const set = new Set(ranks);
  if (set.has(14)) set.add(1);
  for (let high = 14; high >= 5; high -= 1) {
    let complete = true;
    for (let step = 0; step < 5; step += 1) {
      if (!set.has(high - step)) {
        complete = false;
        break;
      }
    }
    if (complete) return high;
  }
  return null;
}

function buildScore(category: HandCategory, kickers: readonly number[]): number {
  let score = category;
  for (let index = 0; index < 5; index += 1) score = score * BASE + (kickers[index] ?? 0);
  return score;
}

export function evaluateHand(cards: readonly Card[]): HandRank {
  if (cards.length < 5 || cards.length > 7) throw new Error('evaluateHand: 5 bis 7 Karten erwartet');
  const ranks = cards.map((card) => card.rank);
  const counts = new Map<number, number>();
  const suits = new Map<string, Card[]>();
  for (const card of cards) {
    counts.set(card.rank, (counts.get(card.rank) ?? 0) + 1);
    const suitCards = suits.get(card.suit) ?? [];
    suitCards.push(card);
    suits.set(card.suit, suitCards);
  }

  const flushCards = [...suits.values()].find((entry) => entry.length >= 5) ?? null;
  const flushRanks = flushCards?.map((card) => card.rank).sort((a, b) => b - a) ?? null;
  const straightFlush = flushRanks ? straightHigh(flushRanks) : null;
  const quads = [...new Set(ranks.filter((rank) => counts.get(rank) === 4))].sort((a, b) => b - a);
  const trips = [...new Set(ranks.filter((rank) => counts.get(rank) === 3))].sort((a, b) => b - a);
  const pairs = [...new Set(ranks.filter((rank) => (counts.get(rank) ?? 0) >= 2))].sort((a, b) => b - a);
  const straight = straightHigh(ranks);

  let category: HandCategory;
  let kickers: number[];

  if (straightFlush !== null) {
    category = straightFlush === 14 ? 9 : 8;
    kickers = [straightFlush];
  } else if (quads.length > 0) {
    category = 7;
    kickers = [quads[0]!, ...topRanks(ranks, [quads[0]!], 1)];
  } else if (trips.length >= 2) {
    category = 6;
    kickers = [trips[0]!, trips[1]!];
  } else if (trips.length === 1) {
    const pair = pairs.find((rank) => rank !== trips[0]);
    if (pair !== undefined) {
      category = 6;
      kickers = [trips[0]!, pair];
    } else {
      category = 3;
      kickers = [trips[0]!, ...topRanks(ranks, [trips[0]!], 2)];
    }
  } else if (flushRanks) {
    category = 5;
    kickers = flushRanks.slice(0, 5);
  } else if (straight !== null) {
    category = 4;
    kickers = [straight];
  } else if (pairs.length >= 2) {
    category = 2;
    kickers = [pairs[0]!, pairs[1]!, ...topRanks(ranks, [pairs[0]!, pairs[1]!], 1)];
  } else if (pairs.length === 1) {
    category = 1;
    kickers = [pairs[0]!, ...topRanks(ranks, [pairs[0]!], 3)];
  } else {
    category = 0;
    kickers = topRanks(ranks, [], 5);
  }

  return {
    category,
    categoryName: HAND_CATEGORY_NAMES[category],
    score: buildScore(category, kickers),
    kickers,
  };
}

export function handCategoryOf(score: number): HandCategory {
  return Math.min(9, Math.max(0, Math.floor(score / HAND_SCORE_BASE))) as HandCategory;
}

export function compareHands(left: HandRank, right: HandRank): number {
  return left.score - right.score;
}

export function hasFlushOrBetter(rank: HandRank): boolean {
  return rank.category >= 5;
}
