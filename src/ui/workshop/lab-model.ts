/** Reine Helfer fuer das RNG-Beweis-Labor: Presets, Seed-Parsing, Determinismus. */
import { Prng } from '../../core/rng/prng';
import { OWN_SLOT_BASE, OWN_SLOT_MAX_MODS } from '../../core/simulation/own-slot';
import { CPU_CASINOS } from '../../core/simulation/cpu-casinos';
import { spinSlot } from '../../core/slot/slot-engine';
import type { SlotConfig, SpinResult } from '../../core/slot/slot-types';

export interface LabSlot {
  readonly id: string;
  readonly name: string;
  readonly note: string;
  readonly config: SlotConfig;
}

/** Die echten CPU-Casino-Configs, nicht kopierte Wunschwerte. */
export const CPU_LAB_SLOTS: readonly LabSlot[] = CPU_CASINOS.map((casino) => ({
  id: casino.id,
  name: casino.name,
  note: casino.description,
  config: casino.slot,
}));

export { OWN_SLOT_BASE, OWN_SLOT_MAX_MODS };
export const LAB_SEED = 1337;
export const PREVIEW_SEED = 4242;

export const SYMBOL_LABELS = {
  BLANK: 'Niete',
  CHERRY: 'Kirsche',
  BELL: 'Glocke',
  SEVEN: 'Sieben',
  VACOIN_DIAMOND: 'Diamant',
  WILD: 'Wild-Multiplikator',
} as const;

export interface DeterminismReport {
  readonly spins: number;
  readonly identical: number;
  readonly mismatchAt: number | null;
}

export function parseSeed(text: string): number | null {
  const trimmed = text.trim();
  if (!/^-?\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isSafeInteger(value) ? value : null;
}

function signature(result: SpinResult): string {
  const grid = result.grid.map((column) => column.join(',')).join('|');
  const wins = result.lineWins.map((win) => `${win.payline}:${win.symbol}:${win.count}:${win.payout}`).join('|');
  return `${grid}#${wins}#${result.totalPayout}#${result.totalBet}#${result.isNearMiss}#${result.isLDW}`;
}

/** Zwei getrennte PRNGs mit identischem Seed muessen dieselbe Folge liefern. */
export function verifyDeterminism(config: SlotConfig, seed: number, spins = 1000): DeterminismReport {
  const left = new Prng(seed);
  const right = new Prng(seed);
  for (let index = 0; index < spins; index += 1) {
    if (signature(spinSlot(config, left)) !== signature(spinSlot(config, right))) {
      return { spins, identical: index, mismatchAt: index + 1 };
    }
  }
  return { spins, identical: spins, mismatchAt: null };
}

export function pct(value: number, digits = 2): string {
  return `${value.toFixed(digits)} %`;
}

/** Abweichung in Prozentpunkten, immer mit Vorzeichen. */
export function signedPp(value: number, digits = 2): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)} pp`;
}

export type AddictionTone = 'low' | 'mid' | 'high';

export function addictionTone(score: number): AddictionTone {
  if (score < 40) return 'low';
  if (score < 70) return 'mid';
  return 'high';
}
