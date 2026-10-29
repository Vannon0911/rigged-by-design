import { describe, expect, it } from 'vitest';
import { fromVC } from '../../economy/vacoin';
import type { ModContract } from '../../rng/bias-policy';
import { Prng } from '../../rng/prng';
import { evaluateRouletteConfig, playRouletteRound, spinRoulettePocket } from '../roulette/roulette-engine';
import { DEFAULT_ROULETTE_CONFIG, colorOf, type RouletteConfig } from '../roulette/roulette-types';

function magnet(value: number, maxBound: number): ModContract {
  return {
    id: 'roulette-magnet',
    name: 'Kessel-Magnet',
    target: 'WEIGHT',
    minBound: 1,
    maxBound,
    costVC: fromVC(1),
    description: 'Testmagnet',
    value,
    symbols: ['0'],
  };
}

function config(overrides: Partial<RouletteConfig> = {}): RouletteConfig {
  return { ...DEFAULT_ROULETTE_CONFIG, ...overrides };
}

describe('Roulette', () => {
  it('gleicher Seed liefert exakt dieselbe Pocket-Folge', () => {
    const left = new Prng(1337);
    const right = new Prng(1337);
    for (let spin = 0; spin < 500; spin += 1) {
      expect(spinRoulettePocket(config(), left)).toBe(spinRoulettePocket(config(), right));
    }
  });

  it('Rot/Schwarz trifft rund 48.65 % und liefert etwa 97.3 % RTP', () => {
    const proof = evaluateRouletteConfig(config({ bet: 'RED' }), 20_000, 42);
    expect(proof.hitRate).toBeGreaterThan(47);
    expect(proof.hitRate).toBeLessThan(50.5);
    expect(proof.measuredRTP).toBeGreaterThan(0.94);
    expect(proof.measuredRTP).toBeLessThan(1.0);
    expect(proof.theoreticalRTP).toBeCloseTo(36 / 37, 10);
    for (const row of proof.colorDistribution) {
      expect(Math.abs(row.deltaPct)).toBeLessThan(1.5);
    }
  });

  it('Straight-Wette zahlt 36x und trifft rund 2.7 %', () => {
    const straight = config({ bet: 'STRAIGHT', straightNumber: 17 });
    const proof = evaluateRouletteConfig(straight, 50_000, 7);
    expect(proof.hitRate).toBeGreaterThan(2);
    expect(proof.hitRate).toBeLessThan(3.4);
    expect(proof.measuredRTP).toBeGreaterThan(0.86);
    expect(proof.measuredRTP).toBeLessThan(1.09);

    const prng = new Prng(3);
    for (let spin = 0; spin < 2_000; spin += 1) {
      const round = playRouletteRound(straight, prng, fromVC(1));
      if (round.win) {
        expect(round.pocket).toBe(17);
        expect(round.payout).toBe(fromVC(36));
        break;
      }
    }
  });

  it('Kessel-Magnet bleibt innerhalb der vertraglichen Gewichtsgrenzen', () => {
    const biased = config({ bet: 'RED', mods: [magnet(99, 3)] });
    const proof = evaluateRouletteConfig(biased, 20_000, 11);
    expect(proof.greenRate).toBeGreaterThan(4);
    expect(proof.greenRate).toBeLessThan(15);
    expect(proof.measuredRTP).toBeLessThan(0.95);
    const green = proof.colorDistribution.find((row) => row.label === 'GREEN')!;
    expect(green.theoreticalPct).toBeCloseTo(3 / 39 * 100, 6);
    expect(Math.abs(green.deltaPct)).toBeLessThan(1.5);
    expect(proof.colorDistribution.reduce((sum, row) => sum + row.measuredPct, 0)).toBeCloseTo(100, 6);
  });

  it('gruene Null ist fuer Rot/Schwarz ein Near-Miss, nicht ein Gewinn', () => {
    const prng = new Prng(99);
    for (let spin = 0; spin < 3_000; spin += 1) {
      const round = playRouletteRound(config({ bet: 'EVEN' }), prng, fromVC(1));
      if (round.pocket === 0) {
        expect(round.win).toBe(false);
        expect(round.payout).toBe(0);
        expect(round.isNearMiss).toBe(true);
        expect(colorOf(0)).toBe('GREEN');
        return;
      }
    }
    throw new Error('Keine gruene Null in 3.000 Runden gefunden');
  });

  it('verlangt fuer Straight eine gueltige Pocket-Zahl', () => {
    expect(() => playRouletteRound(config({ bet: 'STRAIGHT' }), new Prng(1), fromVC(1))).toThrow(/0\.\.36/);
    expect(() => playRouletteRound(config({ bet: 'STRAIGHT', straightNumber: 37 }), new Prng(1), fromVC(1))).toThrow(/0\.\.36/);
  });
});
