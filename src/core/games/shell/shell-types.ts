/** Typen, Regeln und Basis-Mathematik des Hütchenspiels. */
import type { VaCoinMicro } from '../../economy/vacoin';
import { resolveHitRateShift, type ModContract } from '../../rng/bias-policy';
import type { NumberManipulation } from '../../rng/number-rng';

const BPS = 10_000;
const BASE_MULTIPLIER_BPS = 28_000;
const CUP_STEP_BPS = 6_000;
const DOUBLE_BONUS_BPS = 16_000;
const MAX_HIT_RATE = 0.95;

export const SHELL_MAX_SAMPLE = 200_000;

export type ShellVariant = 'CLASSIC' | 'DOUBLE_BALL';

export interface ShellConfig {
  readonly id: string;
  readonly cups: 3 | 4 | 5;
  readonly variant: ShellVariant;
  /** Optionaler Auszahlungsfaktor; Standard waechst mit Bechern und Doppel-Kugel. */
  readonly multiplierBps?: number;
  /** Zahlen-Pull auf die Becher-Indizes; wird pro Kugel angewendet. */
  readonly manipulation?: NumberManipulation;
  readonly mods: readonly ModContract[];
}

export const DEFAULT_SHELL_CONFIG: ShellConfig = {
  id: 'shell-classic',
  cups: 3,
  variant: 'CLASSIC',
  mods: [],
};

export interface ShellRound {
  readonly cups: number;
  readonly variant: ShellVariant;
  readonly winning: readonly number[];
  readonly picked: readonly number[];
  readonly hit: boolean;
  readonly isNearMiss: boolean;
  readonly totalBet: VaCoinMicro;
  readonly payout: VaCoinMicro;
  readonly multiplierBps: number;
  readonly effectiveHitRate: number;
  readonly heatGain: number;
}

export interface ShellMathProof {
  readonly sampleSize: number;
  readonly seed: number;
  readonly hitRate: number;
  readonly nearMissRate: number;
  readonly measuredRTP: number;
  readonly theoreticalRTP: number;
  readonly houseEdge: number;
  readonly addictionScore: number;
  readonly multiplierBps: number;
  readonly effectiveHitRate: number;
  readonly heatPerSpin: number;
  readonly totalPayout: VaCoinMicro;
  readonly totalBet: VaCoinMicro;
}

/** exakte Kombinationen C(n, k), ganzzahlig. */
function comb(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let result = 1;
  for (let index = 0; index < k; index += 1) result = (result * (n - index)) / (index + 1);
  return Math.round(result);
}

function rulesOf(config: ShellConfig): { balls: number; picks: number } {
  return config.variant === 'DOUBLE_BALL' ? { balls: 2, picks: 2 } : { balls: 1, picks: 1 };
}

export function resolveShellMultiplierBps(config: ShellConfig): number {
  if (config.multiplierBps !== undefined) return config.multiplierBps;
  const cupBonus = (config.cups - 3) * CUP_STEP_BPS;
  const doubleBonus = config.variant === 'DOUBLE_BALL' ? DOUBLE_BONUS_BPS : 0;
  return BASE_MULTIPLIER_BPS + cupBonus + doubleBonus;
}

/** Faire Trefferquote vor jedem Magnet-Eingriff. */
export function fairShellHitRate(config: ShellConfig): number {
  const { balls, picks } = rulesOf(config);
  return comb(picks, balls) / comb(config.cups, balls);
}

/** Trefferquote inklusive HIT_RATE-Mods; negativer Shift ist der Magnet-Trick des Betreibers. */
export function effectiveShellHitRate(config: ShellConfig): number {
  const shifted = fairShellHitRate(config) + resolveHitRateShift(config.mods);
  return Math.min(MAX_HIT_RATE, Math.max(0.02, shifted));
}

export function theoreticalShellRTP(config: ShellConfig): number {
  return (effectiveShellHitRate(config) * resolveShellMultiplierBps(config)) / BPS;
}

export function assertShellConfig(config: ShellConfig): void {
  if (!Number.isInteger(config.cups) || config.cups < 3 || config.cups > 5) {
    throw new Error(`ShellConfig ${config.id}: 3 bis 5 Becher erlaubt`);
  }
  if (config.variant === 'DOUBLE_BALL' && config.cups !== 4) {
    throw new Error(`ShellConfig ${config.id}: Doppel-Kugel braucht exakt 4 Becher`);
  }
  const multiplier = resolveShellMultiplierBps(config);
  if (!Number.isSafeInteger(multiplier) || multiplier <= 0) {
    throw new Error(`ShellConfig ${config.id}: Multiplikator muss eine positive Ganzzahl sein`);
  }
}
