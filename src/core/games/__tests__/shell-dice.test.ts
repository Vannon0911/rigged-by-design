import { describe, expect, it } from 'vitest';
import { fromVC } from '../../economy/vacoin';
import type { ModContract } from '../../rng/bias-policy';
import { Prng } from '../../rng/prng';
import {
  DEFAULT_DICE_CONFIG,
  evaluateDiceConfig,
  getDiceWeights,
  playDiceRound,
  resolveDicePayoutBps,
  type DiceConfig,
} from '../dice/dice-engine';
import {
  DEFAULT_SHELL_CONFIG,
  effectiveShellHitRate,
  evaluateShellConfig,
  fairShellHitRate,
  playShellRound,
  resolveShellMultiplierBps,
  type ShellConfig,
} from '../shell/shell-engine';

function shellConfig(overrides: Partial<ShellConfig> = {}): ShellConfig {
  return { ...DEFAULT_SHELL_CONFIG, ...overrides };
}

function diceConfig(overrides: Partial<DiceConfig> = {}): DiceConfig {
  return { ...DEFAULT_DICE_CONFIG, ...overrides };
}

function magnet(value: number, minBound = -0.2, maxBound = 0): ModContract {
  return {
    id: 'magnet',
    name: 'Magnetischer Tisch',
    target: 'HIT_RATE',
    minBound,
    maxBound,
    costVC: fromVC(1),
    description: 'Testmagnet',
    value,
  };
}

describe('Hütchenspiel', () => {
  it('gleicher Seed erzeugt exakt dieselbe Rundenfolge', () => {
    const config = shellConfig({ cups: 5, variant: 'CLASSIC' });
    const left = new Prng(1337);
    const right = new Prng(1337);
    for (let round = 0; round < 200; round += 1) {
      const a = playShellRound(config, left, fromVC(0.5));
      const b = playShellRound(config, right, fromVC(0.5));
      expect(a.winning).toEqual(b.winning);
      expect(a.picked).toEqual(b.picked);
      expect(a.hit).toBe(b.hit);
      expect(a.payout).toBe(b.payout);
      expect(a.heatGain).toBe(b.heatGain);
    }
  });

  it('Magnet verschiebt die Trefferquote nur innerhalb der Vertragsgrenzen', () => {
    const fair = fairShellHitRate(shellConfig());
    expect(fair).toBeCloseTo(1 / 3, 10);
    expect(effectiveShellHitRate(shellConfig({ mods: [magnet(0.9, 0, 0.2)] }))).toBeCloseTo(fair + 0.2, 10);
    expect(effectiveShellHitRate(shellConfig({ mods: [magnet(-0.9)] }))).toBeCloseTo(fair - 0.2, 10);

    const fiveCups = shellConfig({ cups: 5 });
    expect(fairShellHitRate(fiveCups)).toBeCloseTo(1 / 5, 10);
    expect(effectiveShellHitRate({ ...fiveCups, mods: [magnet(-0.1)] })).toBeCloseTo(0.1, 10);
    expect(effectiveShellHitRate({ ...fiveCups, mods: [magnet(0.2, 0, 0.2)] })).toBeCloseTo(0.4, 10);
  });

  it('Magnet-Tisch senkt Trefferquote und RTP, erhoeht aber den Heat-Wert', () => {
    const clean = evaluateShellConfig(shellConfig(), 30_000, 13);
    const rigged = evaluateShellConfig(shellConfig({ mods: [magnet(-0.1)] }), 30_000, 13);
    expect(rigged.hitRate).toBeLessThan(clean.hitRate);
    expect(rigged.measuredRTP).toBeLessThan(clean.measuredRTP);
    expect(rigged.heatPerSpin).toBeGreaterThan(clean.heatPerSpin);
  });

  it('3 Becher zahlen 2.8x und liefern rund 93 % RTP', () => {
    const proof = evaluateShellConfig(shellConfig(), 50_000, 7);
    expect(resolveShellMultiplierBps(shellConfig())).toBe(28_000);
    expect(proof.hitRate).toBeCloseTo(33.33, 0);
    expect(proof.measuredRTP).toBeCloseTo(0.9333, 1);
    expect(proof.houseEdge).toBeGreaterThan(0.04);
    expect(proof.addictionScore).toBeGreaterThan(0);
    expect(proof.addictionScore).toBeLessThanOrEqual(100);
  });

  it('mehr Becher und Doppel-Kugel erhöhen Auszahlung, Risiko und Suchtdruck', () => {
    const three = resolveShellMultiplierBps(shellConfig());
    const five = resolveShellMultiplierBps(shellConfig({ cups: 5 }));
    const double = shellConfig({ cups: 4, variant: 'DOUBLE_BALL' });
    expect(five).toBeGreaterThan(three);
    expect(resolveShellMultiplierBps(double)).toBe(50_000);
    expect(fairShellHitRate(double)).toBeCloseTo(1 / 6, 10);

    const classic = evaluateShellConfig(shellConfig(), 20_000, 11);
    const risky = evaluateShellConfig(double, 20_000, 11);
    expect(risky.measuredRTP).toBeLessThan(classic.measuredRTP);
    expect(risky.addictionScore).toBeGreaterThan(classic.addictionScore);
    expect(risky.nearMissRate).toBeGreaterThan(50);
  });
});

describe('Würfelspiel', () => {
  it('gleicher Seed erzeugt exakt dieselbe Würfelfolge', () => {
    const config = diceConfig({ diceCount: 3, bet: 'DOUBLES_OR_TRIPLES', devilDie: true });
    const left = new Prng(4242);
    const right = new Prng(4242);
    for (let round = 0; round < 200; round += 1) {
      const a = playDiceRound(config, left, fromVC(1));
      const b = playDiceRound(config, right, fromVC(1));
      expect(a.dice).toEqual(b.dice);
      expect(a.sum).toBe(b.sum);
      expect(a.devil).toBe(b.devil);
      expect(a.payout).toBe(b.payout);
    }
  });

  it('Bleikern-Gewichte bleiben an die WEIGHT-Grenzen gekettet', () => {
    const loaded = diceConfig({
      mods: [
        {
          id: 'lead-six',
          name: 'Bleikern',
          target: 'WEIGHT',
          minBound: 0.5,
          maxBound: 2,
          costVC: fromVC(1),
          description: 'Sechser doppelt',
          value: 99,
          symbols: ['6'],
        },
      ],
    });
    const weights = getDiceWeights(loaded);
    const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
    expect(weights['6']! / total).toBeCloseTo(2 / 7, 10);
    expect(weights['6']! / total).toBeLessThanOrEqual(2 / 7 + 1e-9);
    expect(weights['1']! / total).toBeCloseTo(1 / 7, 10);
  });

  it('Over/Under auf 7 zahlt 2.21x und trifft rund 41.7 %', () => {
    const config = diceConfig({ payoutBps: 22_100 });
    expect(resolveDicePayoutBps(config)).toBe(22_100);
    const proof = evaluateDiceConfig(config, 50_000, 99);
    expect(proof.hitRate).toBeCloseTo(41.67, 0);
    expect(proof.measuredRTP).toBeCloseTo(0.9208, 2);
    expect(proof.houseEdge).toBeGreaterThan(0.05);
    expect(proof.faceDistribution).toHaveLength(6);
    for (const face of proof.faceDistribution) {
      expect(Math.abs(face.deltaPct)).toBeLessThan(1.5);
    }
  });

  it('faire Auszahlungstabellen bleiben nahe 92 % RTP', () => {
    for (const bet of ['OVER_UNDER', 'EXACT_SEVEN', 'DOUBLES_OR_TRIPLES'] as const) {
      const bps = resolveDicePayoutBps(diceConfig({ bet }));
      const proof = evaluateDiceConfig(diceConfig({ bet }), 20_000, 5);
      expect(bps).toBeGreaterThan(0);
      expect(proof.measuredRTP).toBeGreaterThan(0.82);
      expect(proof.measuredRTP).toBeLessThan(1.02);
      expect(proof.addictionScore).toBeGreaterThanOrEqual(0);
      expect(proof.addictionScore).toBeLessThanOrEqual(100);
    }
  });

  it('Teufelswürfel zieht bei Totenkopf ein und verdreifacht bei Gold', () => {
    const config = diceConfig({ devilDie: true });
    const prng = new Prng(2026);
    const proof = evaluateDiceConfig(config, 20_000, 2026);
    expect(proof.skullRate).toBeCloseTo(16.67, 0);
    expect(proof.goldRate).toBeCloseTo(16.67, 0);

    let skull = false;
    let goldWin = false;
    for (let round = 0; round < 5_000 && (!skull || !goldWin); round += 1) {
      const result = playDiceRound(config, prng, fromVC(1));
      if (result.devil === 'SKULL') {
        skull = true;
        expect(result.payout).toBe(0);
      }
      if (result.devil === 'GOLD' && result.baseWin) {
        goldWin = true;
        expect(result.payout).toBe(22_100 * 3);
      }
    }
    expect(skull && goldWin).toBe(true);
  });
});
