import { describe, expect, it } from 'vitest';
import { fromVC } from '../../economy/vacoin';
import { Prng } from '../../rng/prng';
import { cardLabel, type Card } from '../deck-engine';
import { evaluateHand, compareHands, handCategoryOf } from '../poker/poker-evaluator';
import { playPokerRound } from '../poker/poker-engine';
import { DEFAULT_POKER_CONFIG, resolvePokerConfig } from '../poker/poker-types';
import { evaluatePokerConfig } from '../poker/poker-math';

const SUITS = { S: 'SPADES', H: 'HEARTS', D: 'DIAMONDS', C: 'CLUBS' } as const;

function card(text: string): Card {
  const suit = SUITS[text.slice(-1) as keyof typeof SUITS]!;
  const label = text.slice(0, -1);
  const rank = label === 'A' ? 14 : label === 'K' ? 13 : label === 'Q' ? 12 : label === 'J' ? 11 : Number(label);
  return { rank, suit };
}

function hand(text: string): Card[] {
  return text.split(' ').map(card);
}

describe('Poker-Evaluator', () => {
  it('erkennt alle Kategorien inklusive Wheel und Royal Flush', () => {
    const royal = evaluateHand(hand('AS KS QS JS 10S'));
    expect(royal.category).toBe(9);
    expect(evaluateHand(hand('9H 8H 7H 6H 5H')).category).toBe(8);
    expect(evaluateHand(hand('7S 7H 7D 4C 4S')).category).toBe(6);
    expect(evaluateHand(hand('AS 2D 3C 4H 5S')).category).toBe(4);
    expect(evaluateHand(hand('AS 2D 3C 4H 5S')).kickers[0]).toBe(5);
    expect(evaluateHand(hand('7S 7H 7D KC 2S 3D')).category).toBe(3);
    expect(evaluateHand(hand('AS AH 9D 9C 3S')).category).toBe(2);
    expect(evaluateHand(hand('AS AH 9D 9C 3S')).kickers[0]).toBe(14);
    expect(evaluateHand(hand('AS AH 9D 9C 3S')).kickers[2]).toBe(3);
    expect(handCategoryOf(royal.score)).toBe(9);
    expect(() => evaluateHand(hand('AS KS QS JS'))).toThrow(/5 bis 7/);
  });

  it('vergleicht Kicker exakt und nimmt die beste 7-Karten-Hand', () => {
    const low = evaluateHand(hand('AS AH 9D 9C 3S'));
    const high = evaluateHand(hand('AS AH 9D 9C 4S'));
    expect(compareHands(high, low)).toBeGreaterThan(0);
    expect(evaluateHand(hand('AS KS QS JS 10S 2D 3C')).category).toBe(9);
    expect(evaluateHand(hand('2S 2H 2D 3C 3H 4S 5D')).category).toBe(6);
    expect(evaluateHand(hand('10S JS QD KH AC 2S 3D')).category).toBe(4);
  });
});

describe('Poker-Runden', () => {
  it('gleicher Seed liefert identische Karten und Payouts', () => {
    const left = new Prng(808);
    const right = new Prng(808);
    for (let round = 0; round < 100; round += 1) {
      const a = playPokerRound(DEFAULT_POKER_CONFIG, left, fromVC(1));
      const b = playPokerRound(DEFAULT_POKER_CONFIG, right, fromVC(1));
      expect(a.playerCards.map(cardLabel)).toEqual(b.playerCards.map(cardLabel));
      expect(a.dealerCards.map(cardLabel)).toEqual(b.dealerCards.map(cardLabel));
      expect(a.payout).toBe(b.payout);
    }
  });

  it('6-Karten-Deal trifft haeufiger, bleibt aber hinter dem Hausvorteil', () => {
    const five = evaluatePokerConfig(DEFAULT_POKER_CONFIG, 12_000, 42);
    const sixConfig = resolvePokerConfig(DEFAULT_POKER_CONFIG, ['POKER_SIX_CARD_DEAL']);
    const six = evaluatePokerConfig(sixConfig, 12_000, 42);
    expect(five.measuredRTP).toBeGreaterThan(0.85);
    expect(five.measuredRTP).toBeLessThan(1.02);
    expect(six.measuredRTP).toBeGreaterThan(0.85);
    expect(six.measuredRTP).toBeLessThan(1.02);
    expect(six.hitRate).toBeGreaterThan(five.hitRate);
    expect(six.flushPlusRate).toBeGreaterThan(five.flushPlusRate);
  });

  it('River-Steuer verdoppelt den Einsatz und senkt den RTP', () => {
    const taxed = resolvePokerConfig(DEFAULT_POKER_CONFIG, ['POKER_RIVER_BLUFF_TAX']);
    const base = evaluatePokerConfig(DEFAULT_POKER_CONFIG, 8_000, 7);
    const tax = evaluatePokerConfig(taxed, 8_000, 7);
    expect(tax.measuredRTP).toBeLessThan(base.measuredRTP - 0.1);
    const round = playPokerRound(taxed, new Prng(3), fromVC(1));
    expect(round.riverTax).toBe(fromVC(1));
    expect(round.totalBet).toBe(fromVC(2));
  });

  it('Jackpot-Feld zahlt auf die eigene Hand und der Dealer qualifiziert sich', () => {
    const config = resolvePokerConfig(DEFAULT_POKER_CONFIG, ['POKER_JACKPOT_FIELD']);
    const prng = new Prng(2026);
    let paid = false;
    for (let round = 0; round < 2_000 && !paid; round += 1) {
      const result = playPokerRound(config, prng, fromVC(1), fromVC(0.2));
      if (result.playerRank.category >= 1) {
        paid = result.bonusPayout > 0;
        expect(paid).toBe(true);
      }
    }
    expect(paid).toBe(true);
    const proof = evaluatePokerConfig(config, 4_000, 9);
    expect(proof.dealerQualifyRate).toBeGreaterThan(40);
    expect(proof.dealerQualifyRate).toBeLessThan(60);
  });
});
