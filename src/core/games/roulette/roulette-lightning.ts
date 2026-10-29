/** Blitz-Multiplikatoren: 1 bis 3 Glueckszahlen pro Runde, deterministisch aus dem PRNG. */
import { rollNumber } from '../../rng/number-rng';
import type { Prng } from '../../rng/prng';
import {
  LIGHTNING_MULTIPLIERS_BPS,
  pocketLabel,
  wheelPockets,
  type LightningPocket,
  type RouletteConfig,
} from './roulette-types';

const COUNT_WEIGHTS = [70, 25, 5] as const;
const MULTIPLIER_RATIOS = [100, 200, 300] as const;

export function rollLightningPockets(config: RouletteConfig, prng: Prng): LightningPocket[] {
  if (!config.lightning) return [];
  const pool = [...wheelPockets(config)];
  const roll = rollNumber(1, 100, {}, prng).finalNumber;
  const count = roll <= 70 ? 1 : roll <= 95 ? 2 : 3;
  const picked: number[] = [];
  for (let index = 0; index < count && pool.length > 0; index += 1) {
    const swap = rollNumber(0, pool.length - 1, {}, prng).finalNumber;
    const pocket = pool[swap]!;
    pool[swap] = pool[pool.length - 1]!;
    pool.pop();
    picked.push(pocket);
  }
  return picked.map((pocket, index) => ({
    pocket,
    label: pocketLabel(pocket),
    multiplierBps: LIGHTNING_MULTIPLIERS_BPS[index]!,
  }));
}

/**
 * Exakter Zusatz-RTP eines Straight-Einsatzes: die erwartete Multiplikator-
 * summe geteilt durch Kesselgroesse^2 (Trefferchance * Glueckszahlchance).
 */
export function expectedLightningExtraRtp(wheelSizeValue: number): number {
  const expectedSum = COUNT_WEIGHTS.reduce((sum, weight, index) => {
    const slice = MULTIPLIER_RATIOS.slice(0, index + 1).reduce((value, ratio) => value + ratio, 0);
    return sum + weight * slice;
  }, 0) / 100;
  return expectedSum / (wheelSizeValue * wheelSizeValue);
}
