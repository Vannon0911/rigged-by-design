import { describe, expect, it } from 'vitest';
import { fromVC, mulVC } from '../../economy/vacoin';
import { evaluateRouletteConfig, playRouletteRound } from '../../games/roulette/roulette-engine';
import {
  DEFAULT_ROULETTE_CONFIG,
  pocketLabel,
  wheelPockets,
  wheelSize,
  winsRoulette,
  type RouletteConfig,
} from '../../games/roulette/roulette-types';
import {
  Shoe,
  cardValue,
  drawWithBias,
  verifyShoeIntegrity,
  type DeckModId,
} from '../deck-engine';
import { Prng } from '../prng';

const ALL_DECK_MODS: readonly DeckModId[] = [
  'DECK_GREEDY_TENS',
  'DECK_FAT_FIVES',
  'DECK_FIFTH_ACE',
  'DECK_DEATH_CARD',
];

function config(overrides: Partial<RouletteConfig> = {}): RouletteConfig {
  return { ...DEFAULT_ROULETTE_CONFIG, ...overrides };
}

describe('Kartenstiefel', () => {
  it('bewahrt bei maximalem Lookahead-Bias nach jedem Zug das exakte Inventar', () => {
    const shoe = new Shoe(new Prng(1337), 6, ALL_DECK_MODS);
    const initialSize = shoe.initialDeckSize;
    expect(initialSize).toBe(324);
    const prng = new Prng(99);

    while (shoe.remaining > 0) {
      const card = drawWithBias(shoe, prng, 1, (drawn) => cardValue(drawn), 3);
      expect(card.id).toBeTruthy();
      expect(verifyShoeIntegrity(shoe)).toBe(true);
      expect(shoe.drawnCards.length + shoe.remaining).toBe(initialSize);
    }

    expect(shoe.drawnCards).toHaveLength(initialSize);
    expect(new Set(shoe.drawnCards.map((card) => String(card.id))).size).toBe(initialSize);
  });

  it('verschiebt den Erwartungswert des Lookahead-Bias messbar nach oben', () => {
    const average = (bias: number): number => {
      let sum = 0;
      for (let seed = 1; seed <= 800; seed += 1) {
        const shoe = new Shoe(new Prng(seed), 1);
        const card = drawWithBias(shoe, new Prng(seed + 5_000), bias, (drawn) => cardValue(drawn), 3);
        sum += cardValue(card);
      }
      return sum / 800;
    };

    const fair = average(0);
    const rigged = average(1);
    expect(rigged).toBeGreaterThan(fair + 0.7);
    expect(fair).toBeGreaterThan(6);
  });
});

describe('Roulette-Mathematik', () => {
  it('standard 36x und Lightning 30x + Blitz-RTP sind exakt berechenbar', () => {
    const standard = config({ bet: 'STRAIGHT', straightNumber: 17 });
    const std = evaluateRouletteConfig(standard, 60_000, 7);
    expect(std.payoutBps).toBe(360_000);
    expect(std.wheelSize).toBe(37);
    expect(std.theoreticalRTP).toBeCloseTo(36 / 37, 10);
    expect(std.lightningHitRate).toBe(0);

    const lightning = config({ ...standard, lightning: true });
    const light = evaluateRouletteConfig(lightning, 100_000, 7);
    const expected = 30 / 37 + 175 / (37 * 37);
    expect(light.payoutBps).toBe(300_000);
    expect(light.maxPayoutBps).toBe(3_000_000);
    expect(light.theoreticalRTP).toBeCloseTo(expected, 9);
    expect(light.theoreticalRTP).toBeLessThan(std.theoreticalRTP);
    expect(light.lightningHitRate).toBeGreaterThan(0);
    expect(light.measuredRTP).toBeLessThan(1.05);
  });

  it('Lightning zieht 1 bis 3 Glückszahlen und zahlt 100x bis 300x', () => {
    const lightning = config({ bet: 'STRAIGHT', straightNumber: 17, lightning: true });
    const prng = new Prng(2026);
    let normalHit = false;
    let luckyHit = false;

    for (let round = 0; round < 80_000 && (!normalHit || !luckyHit); round += 1) {
      const result = playRouletteRound(lightning, prng, fromVC(1));
      expect(result.lightningPockets.length).toBeGreaterThanOrEqual(1);
      expect(result.lightningPockets.length).toBeLessThanOrEqual(3);
      for (const pocket of result.lightningPockets) {
        expect(pocket.multiplierBps).toBeGreaterThanOrEqual(1_000_000);
        expect(pocket.multiplierBps).toBeLessThanOrEqual(3_000_000);
      }
      if (!result.win) continue;
      if (result.lightningMultiplierBps === null) {
        normalHit = true;
        expect(result.payout).toBe(fromVC(30));
      } else {
        luckyHit = true;
        expect(result.payout).toBe(mulVC(fromVC(1), result.lightningMultiplierBps));
      }
    }

    expect(normalHit && luckyHit).toBe(true);
  });

  it('Dutzend-Wetten decken je 12 Zahlen und zahlen 3x', () => {
    const third = config({ bet: 'DOZEN', dozen: 3 });
    expect(winsRoulette('DOZEN', 25, null, 3)).toBe(true);
    expect(winsRoulette('DOZEN', 36, null, 3)).toBe(true);
    expect(winsRoulette('DOZEN', 24, null, 3)).toBe(false);
    expect(winsRoulette('DOZEN', 0, null, 3)).toBe(false);

    const proof = evaluateRouletteConfig(third, 30_000, 13);
    expect(proof.payoutBps).toBe(30_000);
    expect(proof.hitRate).toBeGreaterThan(30);
    expect(proof.hitRate).toBeLessThan(35);
    expect(proof.theoreticalRTP).toBeCloseTo(12 / 37 * 3, 10);
  });

  it('00 und 000 sind grüne Haus-Pockets, auch für Gerade/Ungerade', () => {
    const double = config({ bet: 'STRAIGHT', straightNumber: 37, doubleZero: true });
    expect(wheelPockets(double)).toHaveLength(38);
    expect(wheelSize(double)).toBe(38);
    expect(pocketLabel(37)).toBe('00');
    expect(pocketLabel(38)).toBe('000');
    expect(winsRoulette('ODD', 37, null)).toBe(false);
    expect(winsRoulette('EVEN', 38, null)).toBe(false);

    let seenDoubleZero = false;
    const prng = new Prng(5);
    for (let round = 0; round < 8_000; round += 1) {
      const result = playRouletteRound(double, prng, fromVC(1));
      if (result.pocket !== 37) continue;
      seenDoubleZero = true;
      expect(result.win).toBe(true);
      expect(result.payout).toBe(fromVC(36));
      expect(result.color).toBe('GREEN');
      break;
    }
    expect(seenDoubleZero).toBe(true);

    const triple = config({ bet: 'EVEN', tripleZero: true });
    expect(wheelPockets(triple)).toHaveLength(39);
    const proof = evaluateRouletteConfig(triple, 25_000, 11);
    expect(proof.greenRate).toBeGreaterThan(6);
    expect(proof.greenRate).toBeLessThan(9.5);
  });
});
