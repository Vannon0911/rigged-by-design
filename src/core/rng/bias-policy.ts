/**
 * Mod-Vertraege: begrenzen, wie stark ein Mod die Mathematik veraendern darf.
 *
 * Semantik der Grenzen je target:
 *  WEIGHT     - Faktor auf Symbolgewichte (1 = unveraendert)
 *  PAYOUT     - Auszahlungsfaktor in Basispunkten (10_000 = 100 %)
 *  PAYLINES   - Anzahl zusaetzlicher Gewinnlinien
 *  NEAR_MISS  - Wahrscheinlichkeit (0..1) fuer einen optischen Knapp-daneben
 *  HIT_RATE   - absolute Verschiebung der Trefferquote (-0.35..0.35), negativ = Hausvorteil
 *  REELS      - zusaetzliche Slot-Rollen (0..3), Gesamtzahl bleibt bei 3..6
 */
import type { VaCoinMicro } from '../economy/vacoin';

export type ModTarget = 'WEIGHT' | 'PAYOUT' | 'PAYLINES' | 'NEAR_MISS' | 'HIT_RATE' | 'REELS';

export interface ModContract {
  readonly id: string;
  readonly name: string;
  readonly target: ModTarget;
  readonly minBound: number;
  readonly maxBound: number;
  readonly costVC: VaCoinMicro;
  readonly description: string;
  /** Gewuenschter Effektwert; wird hart auf [minBound, maxBound] geklemmt. */
  readonly value?: number;
  /** Nur WEIGHT: betroffene Symbol-Keys. Fehlt = alle. */
  readonly symbols?: readonly string[];
}

const BPS = 10_000;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y > 0) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x;
}

/** Teilt alle Gewichte durch ihren GCD: exakte Wahrscheinlichkeiten, kleine Zahlen. */
export function normalizeWeights<T extends string>(weights: Readonly<Record<T, number>>): Record<T, number> {
  const keys = Object.keys(weights) as T[];
  let divisor = 0;
  for (const key of keys) {
    const weight = weights[key];
    if (!Number.isFinite(weight) || weight < 0) throw new Error(`normalizeWeights: ungueltiges Gewicht fuer ${key}`);
    divisor = gcd(divisor, Math.round(weight));
  }
  if (divisor <= 0) throw new Error('normalizeWeights: alle Gewichte sind 0');
  const normalized = {} as Record<T, number>;
  for (const key of keys) normalized[key] = Math.round(weights[key]) / divisor;
  return normalized;
}

export function applyWeightBias<T extends string>(
  baseWeights: Readonly<Record<T, number>>,
  modContracts: readonly ModContract[],
): Record<T, number> {
  const keys = Object.keys(baseWeights) as T[];
  const weights = { ...baseWeights } as Record<T, number>;
  for (const contract of modContracts) {
    if (contract.target !== 'WEIGHT') continue;
    const factor = clamp(contract.value ?? contract.maxBound, contract.minBound, contract.maxBound);
    const affected = contract.symbols ?? keys;
    for (const key of keys) {
      if (!affected.includes(key)) continue;
      const current = weights[key];
      weights[key] = current > 0 ? Math.max(1, Math.round(current * factor)) : 0;
    }
  }
  return normalizeWeights(weights);
}

export function resolveNearMissChance(modContracts: readonly ModContract[]): number {
  let chance = 0;
  for (const contract of modContracts) {
    if (contract.target !== 'NEAR_MISS') continue;
    chance = Math.max(chance, clamp(contract.value ?? contract.minBound, contract.minBound, contract.maxBound));
  }
  return clamp(chance, 0, 1);
}

export function resolvePayoutFactorBps(modContracts: readonly ModContract[]): number {
  let factor = BPS;
  for (const contract of modContracts) {
    if (contract.target !== 'PAYOUT') continue;
    factor = (factor * clamp(contract.value ?? contract.maxBound, contract.minBound, contract.maxBound)) / BPS;
  }
  return Math.round(factor);
}

export function resolveHitRateShift(modContracts: readonly ModContract[]): number {
  let shift = 0;
  for (const contract of modContracts) {
    if (contract.target !== 'HIT_RATE') continue;
    const value = clamp(contract.value ?? contract.minBound, contract.minBound, contract.maxBound);
    if (Math.abs(value) > Math.abs(shift)) shift = value;
  }
  return clamp(shift, -0.35, 0.35);
}

export function resolveExtraPaylines(modContracts: readonly ModContract[]): number {
  let extra = 0;
  for (const contract of modContracts) {
    if (contract.target !== 'PAYLINES') continue;
    extra += Math.round(clamp(contract.value ?? contract.minBound, contract.minBound, contract.maxBound));
  }
  return Math.max(0, extra);
}

export function resolveExtraReels(modContracts: readonly ModContract[]): number {
  let extra = 0;
  for (const contract of modContracts) {
    if (contract.target !== 'REELS') continue;
    extra += Math.round(clamp(contract.value ?? contract.minBound, contract.minBound, contract.maxBound));
  }
  return Math.max(0, Math.min(3, extra));
}
