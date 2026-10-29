import { describe, expect, it } from 'vitest';
import { fromVC } from '../../economy/vacoin';
import { applyWeightBias, type ModContract } from '../../rng/bias-policy';
import { Prng } from '../../rng/prng';
import { getTheoreticalProbabilities } from '../../rng/weighted-pool';
import { proveSlotMath } from '../slot-evaluator';
import { spinSlot } from '../slot-engine';
import { DEFAULT_SLOT_CONFIG, type SlotConfig } from '../slot-types';

const CLASSIC: SlotConfig = {
  ...DEFAULT_SLOT_CONFIG,
  id: 'classic-3-lines',
  paylines: ['MIDDLE', 'TOP', 'BOTTOM'],
};

/** "Scheingewinn-Getriebe": mehr Kirschpaare, winzige Auszahlungen, optische Fast-Jackpots. */
const LDW_GEAR: readonly ModContract[] = [
  {
    id: 'MOD_LDW_WEIGHT',
    name: 'Scheingewinn-Getriebe',
    target: 'WEIGHT',
    minBound: 1,
    maxBound: 3,
    costVC: fromVC(45),
    description: 'Cherry-Flut',
    value: 1.6,
    symbols: ['CHERRY'],
  },
  {
    id: 'MOD_LDW_PAYOUT',
    name: 'Kulanz-Kuerzung',
    target: 'PAYOUT',
    minBound: 1_000,
    maxBound: 10_000,
    costVC: fromVC(25),
    description: 'Auszahlung auf 25 %',
    value: 2_500,
  },
  {
    id: 'MOD_LDW_NEAR',
    name: 'Fast-Jackpot-Blitz',
    target: 'NEAR_MISS',
    minBound: 0,
    maxBound: 0.5,
    costVC: fromVC(30),
    description: '30 % Knapp-daneben',
    value: 0.3,
  },
];

function sequence(config: SlotConfig, seed: number, spins: number) {
  const prng = new Prng(seed);
  return Array.from({ length: spins }, () => spinSlot(config, prng, 10_000));
}

describe('RNG- und Slot-Beweise', () => {
  it('gleicher Seed + gleiche Config = bit-identische Spin-Sequenz ueber 500 Spins', () => {
    const first = sequence(CLASSIC, 20261029, 500);
    const second = sequence(CLASSIC, 20261029, 500);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first).toHaveLength(500);
  });

  it('getState/setState stellt den Strom exakt wieder her', () => {
    const prng = new Prng(4711);
    prng.nextFloat();
    const state = prng.getState();
    const expected = [prng.nextFloat(), prng.nextFloat(), prng.nextInt(1, 6)];
    const restored = new Prng(1);
    restored.setState(state);
    expect([restored.nextFloat(), restored.nextFloat(), restored.nextInt(1, 6)]).toEqual(expected);
  });

  it('Symbolverteilung weicht nach 20.000 Spins um weniger als 1.5 Prozentpunkte ab', () => {
    const proof = proveSlotMath(CLASSIC, 20_000, 42);
    expect(proof.symbolDistribution).toHaveLength(5);
    const theoreticalTotal = proof.symbolDistribution.reduce((sum, entry) => sum + entry.theoreticalPct, 0);
    expect(theoreticalTotal).toBeCloseTo(100, 10);
    for (const entry of proof.symbolDistribution) {
      expect(Math.abs(entry.deltaPct)).toBeLessThan(1.5);
    }
  });

  it('Scheingewinn-Getriebe hebt hitRate und addictionScore, senkt aber den RTP', () => {
    const base = proveSlotMath(DEFAULT_SLOT_CONFIG, 20_000, 42);
    const rigged = proveSlotMath({ ...DEFAULT_SLOT_CONFIG, id: 'vault-rigged', mods: LDW_GEAR }, 20_000, 42);

    expect(rigged.hitRate).toBeGreaterThan(base.hitRate + 5);
    expect(rigged.addictionScore).toBeGreaterThan(base.addictionScore + 5);
    expect(rigged.measuredRTP).toBeLessThan(base.measuredRTP);
    expect(rigged.nearMissRate).toBeGreaterThan(0);
    expect(rigged.houseEdge).toBeGreaterThan(base.houseEdge);
  });

  it('NEAR_MISS erscheint nur auf echten Nieten und erzeugt nie Auszahlung', () => {
    const config: SlotConfig = { ...DEFAULT_SLOT_CONFIG, id: 'near-miss-only', mods: [LDW_GEAR[2]!] };
    const prng = new Prng(123456);
    let nearMisses = 0;
    for (let spin = 0; spin < 2_000; spin += 1) {
      const result = spinSlot(config, prng, 10_000);
      if (result.isNearMiss) {
        nearMisses += 1;
        expect(result.totalPayout).toBe(0);
        expect(result.lineWins).toHaveLength(0);
      }
    }
    expect(nearMisses).toBeGreaterThan(0);
  });

  it('Weight-Bias wird hart auf die Vertragsgrenzen geklemmt und normalisiert', () => {
    const contract: ModContract = {
      id: 'MOD_CLAMP',
      name: 'Clamp',
      target: 'WEIGHT',
      minBound: 0.5,
      maxBound: 2,
      costVC: fromVC(1),
      description: 'Test',
      value: 10,
      symbols: ['C'],
    };
    const weights = applyWeightBias({ A: 10, B: 10, C: 10 }, [contract]);
    expect(weights.C / (weights.A + weights.B + weights.C)).toBeCloseTo(0.5, 10);

    const probabilities = getTheoreticalProbabilities([
      { value: 'A', weight: 1 },
      { value: 'B', weight: 3 },
    ]);
    expect(probabilities.get('A')).toBe(0.25);
    expect(probabilities.get('B')).toBe(0.75);
  });
});
