import { describe, expect, it } from 'vitest';
import { fromVC } from '../../economy/vacoin';
import { Prng } from '../../rng/prng';
import { addictionGain } from '../../simulation/floor-rules';
import { playFloorGame } from '../../simulation/floor-games';
import { getOperatorMod, rouletteModLoadout } from '../../simulation/operator-mods';
import { evaluateRouletteConfig } from '../roulette/roulette-engine';
import { DEFAULT_ROULETTE_CONFIG, type RouletteConfig } from '../roulette/roulette-types';

function config(overrides: Partial<RouletteConfig> = {}): RouletteConfig {
  return { ...DEFAULT_ROULETTE_CONFIG, ...overrides };
}

describe('Roulette-Betreiber-Mods', () => {
  it('uebersetzt Kessel-Mods in echte Pockets, Gewichte, Lightning und Suchtdruck', () => {
    const loadout = rouletteModLoadout([
      'MOD_ROULETTE_MAGNET',
      'MOD_ROULETTE_TRIPLE_ZERO',
      'MOD_ROULETTE_LIGHTNING',
    ]);
    expect(loadout.mods).toHaveLength(1);
    expect(loadout.mods[0]!.target).toBe('WEIGHT');
    expect(loadout.mods[0]!.symbols).toEqual(['0', '37', '38']);
    expect(loadout.tripleZero).toBe(true);
    expect(loadout.lightning).toBe(true);
    expect(loadout.addictionBonus).toBe(9);
    expect(getOperatorMod('MOD_ROULETTE_DOUBLE_ZERO').rouletteDoubleZero).toBe(true);
  });

  it('Sektor-Magnet verschiebt Gewicht und Hausvorteil messbar', () => {
    const base = evaluateRouletteConfig(config({ bet: 'RED' }), 25_000, 42);
    const magnet = evaluateRouletteConfig(
      config({ bet: 'RED', mods: getOperatorMod('MOD_ROULETTE_MAGNET').contracts }),
      25_000,
      42,
    );

    expect(magnet.greenRate).toBeGreaterThan(base.greenRate + 2.5);
    expect(magnet.measuredRTP).toBeLessThan(base.measuredRTP - 0.025);
    expect(magnet.houseEdge).toBeGreaterThan(base.houseEdge + 0.025);
    expect(magnet.addictionScore).toBeGreaterThan(base.addictionScore);
  });

  it('Dreifach-Null und Blitz-Taschen veraendern Kessel und Auszahlungsstruktur', () => {
    const triple = evaluateRouletteConfig(config({ bet: 'RED', tripleZero: true }), 25_000, 7);
    expect(triple.wheelSize).toBe(39);
    expect(triple.greenRate).toBeGreaterThan(6);
    expect(triple.measuredRTP).toBeLessThan(0.94);

    const lightning = evaluateRouletteConfig(
      config({ bet: 'STRAIGHT', straightNumber: 17, lightning: true }),
      25_000,
      11,
    );
    expect(lightning.maxPayoutBps).toBe(3_000_000);
    expect(lightning.lightningHitRate).toBeGreaterThan(0.02);
    expect(lightning.theoreticalRTP).toBeLessThan(0.973);
  });

  it('erhoeht den Suchtdruck einer Besucher-Runde am eigenen Kessel', () => {
    const base = playFloorGame('ROULETTE_TABLE', [], fromVC(0.2), new Prng(2026));
    const modded = playFloorGame(
      'ROULETTE_TABLE',
      ['MOD_ROULETTE_MAGNET', 'MOD_ROULETTE_TRIPLE_ZERO'],
      fromVC(0.2),
      new Prng(2026),
    );

    expect(base.addictionBonus ?? 0).toBe(0);
    expect(modded.addictionBonus).toBe(5);
    expect(addictionGain(false, false, false, 2, 1, modded.addictionBonus ?? 0))
      .toBeGreaterThan(addictionGain(false, false, false, 2, 1, 0));
  });
});
