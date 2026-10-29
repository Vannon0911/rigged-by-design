/** Blackjack-Regeln: Handwertung, Basisstrategie, 3-Card-Bonus und Suchtformel. */
import { handValue, isSoftHand, type Card } from '../deck-engine';
import type { BlackjackAction, BlackjackConfig, BlackjackHand } from './blackjack-types';

export function isNatural(cards: readonly Card[]): boolean {
  return cards.length === 2 && handValue(cards) === 21;
}

export function makeHand(cards: readonly Card[]): BlackjackHand {
  const total = handValue(cards);
  return {
    cards: [...cards],
    total,
    soft: isSoftHand(cards),
    blackjack: isNatural(cards),
    bust: total > 21,
  };
}

/** Einfache, deterministische Basisstrategie. Double nur bei erlaubter Aktion. */
export function basicStrategy(hand: BlackjackHand, dealerUp: Card, canDouble: boolean): BlackjackAction {
  const up = dealerUp.rank === 14 ? 11 : Math.min(10, dealerUp.rank);
  if (hand.soft) {
    if (canDouble && hand.total >= 13 && hand.total <= 18 && up >= 4 && up <= 6) return 'DOUBLE';
    return hand.total >= 18 ? 'STAND' : 'HIT';
  }
  if (canDouble && (hand.total === 10 || hand.total === 11) && up <= 9) return 'DOUBLE';
  if (canDouble && hand.total === 9 && up >= 3 && up <= 6) return 'DOUBLE';
  if (hand.total >= 17) return 'STAND';
  if (hand.total >= 13 && up <= 6) return 'STAND';
  if (hand.total === 12 && up >= 4 && up <= 6) return 'STAND';
  return 'HIT';
}

/** 3-Card-Bonus: Gesamtrueckzahlung der Nebenwette in Basispunkten. */
export function threeCardBonusBps(cards: readonly Card[]): number {
  if (cards.length < 3) return 0;
  const hand = cards.slice(0, 3);
  const ranks = hand.map((card) => card.rank).sort((a, b) => a - b);
  const flush = hand.every((card) => card.suit === hand[0]!.suit);
  const unique = new Set(ranks).size === 3;
  const straight = unique && (ranks[2]! - ranks[0]! === 2 || ranks.join(',') === '2,3,14');
  const trips = ranks[0] === ranks[2];
  if (trips) return flush ? 40_000 : 30_000;
  if (straight) return flush ? 40_000 : 6_000;
  if (flush) return 4_000;
  if (!unique) return 1_500;
  return 0;
}

export function blackjackAddictionScore(
  hitRate: number,
  pushRate: number,
  blackjackRate: number,
  config: BlackjackConfig,
  rtp: number,
): number {
  const rtpPenalty = rtp < 0.65 ? (0.65 - rtp) * 50 : 0;
  const score = hitRate * 0.6 + pushRate * 0.8 + blackjackRate * 1.2 +
    (config.threeCardBonus ? 12 : 0) + (config.dealerPush22 ? 8 : 0) +
    (config.blackjackPayoutBps < 25_000 ? 6 : 0) + (config.dealerBias ? 5 : 0) - rtpPenalty;
  return Math.round(Math.min(100, Math.max(0, score)));
}
