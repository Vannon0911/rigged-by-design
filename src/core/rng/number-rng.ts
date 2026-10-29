/** Zahlenbasiertes Universal-RNG; Manipulationen werden hart geklemmt. */
import type { Prng } from './prng';

export interface NumberManipulation {
  /** Gewinnzahlen, in deren Richtung (oder von denen weg) gezogen wird. */
  readonly targetNumbers?: readonly number[];
  /** -1 = stark wegdruecken, 0 = neutral, +1 = stark heranziehen. */
  readonly pullStrength?: number;
  /** Relative Verschiebung des Mittelwerts, -0.5 bis +0.5 der Spanne. */
  readonly windowShift?: number;
  /** Optionale Vertragsgrenzen aus bias-policy.ts; werden zusaetzlich geklemmt. */
  readonly minBound?: number;
  readonly maxBound?: number;
}

export interface NumberRollResult {
  readonly rawNumber: number;
  readonly finalNumber: number;
  readonly wasManipulated: boolean;
  /** Gleichverteilte Basiswahrscheinlichkeit der Zielmenge. */
  readonly theoreticalHitChance: number;
  /** Wahrscheinlichkeit der Zielmenge nach angewendeter Manipulation. */
  readonly realHitChance: number;
}

export const NUMBER_LIMITS = { minPullStrength: -1, maxPullStrength: 1, minWindowShift: -0.5, maxWindowShift: 0.5 } as const;

const stats = { calls: 0 };

export function getNumberRollCount(): number { return stats.calls; }
export function resetNumberRollStats(): void { stats.calls = 0; }

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function safeTargets(numbers: readonly number[] | undefined, min: number, max: number): number[] {
  if (!numbers) return [];
  const unique = new Set<number>();
  for (const value of numbers) {
    if (Number.isSafeInteger(value) && value >= min && value <= max) unique.add(value);
  }
  return [...unique].sort((left, right) => left - right);
}

function nearestTarget(value: number, targets: readonly number[]): number {
  let best = targets[0]!;
  let distance = Math.abs(best - value);
  for (const target of targets) {
    const next = Math.abs(target - value);
    if (next < distance) {
      best = target;
      distance = next;
    }
  }
  return best;
}

function awayFromTarget(value: number, targets: readonly number[], min: number, max: number): number {
  const forbidden = new Set(targets);
  for (let distance = 1; distance <= max - min; distance += 1) {
    const right = value + distance;
    if (right <= max && !forbidden.has(right)) return right;
    const left = value - distance;
    if (left >= min && !forbidden.has(left)) return left;
  }
  return value;
}

/**
 * Zieht exakt eine Ganzzahl in [min, max]. Die rohe Zahl ist immer uniform;
 * erst danach werden Fenster-Shift und Ziel-Pull begrenzt angewendet.
 */
export function rollNumber(
  min: number,
  max: number,
  manipulation: NumberManipulation,
  prng: Prng,
): NumberRollResult {
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min > max) {
    throw new Error(`rollNumber: ungueltiger Bereich ${String(min)}..${String(max)}`);
  }
  stats.calls += 1;

  const range = max - min + 1;
  const targets = safeTargets(manipulation.targetNumbers, min, max);
  const theoreticalHitChance = targets.length / range;
  const rawNumber = prng.nextInt(min, max);
  const shift = clamp(
    Number.isFinite(manipulation.windowShift ?? 0) ? manipulation.windowShift ?? 0 : 0,
    NUMBER_LIMITS.minWindowShift,
    NUMBER_LIMITS.maxWindowShift,
  );
  const shifted = clamp(rawNumber + Math.round((max - min) * shift), min, max);
  const rawPull = Number.isFinite(manipulation.pullStrength ?? 0) ? manipulation.pullStrength ?? 0 : 0;
  const lowerBound = clamp(manipulation.minBound ?? NUMBER_LIMITS.minPullStrength, -1, 1);
  const upperBound = clamp(manipulation.maxBound ?? NUMBER_LIMITS.maxPullStrength, -1, 1);
  const pull = clamp(rawPull, Math.min(lowerBound, upperBound), Math.max(lowerBound, upperBound));

  let finalNumber = shifted;
  let realHitChance = targets.length === 0 ? 0 : theoreticalHitChance;
  if (targets.length > 0 && pull !== 0) {
    const chance = Math.abs(pull);
    if (pull > 0) {
      const target = nearestTarget(shifted, targets);
      if (prng.nextFloat() < chance) finalNumber = target;
      realHitChance = theoreticalHitChance + chance * (1 - theoreticalHitChance);
    } else if (targets.includes(shifted) && prng.nextFloat() < chance) {
      finalNumber = awayFromTarget(shifted, targets, min, max);
      realHitChance = theoreticalHitChance * (1 - chance);
    } else {
      realHitChance = theoreticalHitChance * (1 - chance);
    }
  } else if (targets.length > 0 && pull === 0) {
    realHitChance = theoreticalHitChance;
  }

  return {
    rawNumber,
    finalNumber,
    wasManipulated: finalNumber !== rawNumber,
    theoreticalHitChance: clamp(theoreticalHitChance, 0, 1),
    realHitChance: clamp(realHitChance, 0, 1),
  };
}

export interface WeightedNumberEntry<T> {
  readonly value: T;
  readonly weight: number;
}

export interface WeightedNumberRoll<T> { readonly value: T; readonly roll: NumberRollResult; }

/** Zieht einen gewichteten Wert ueber genau eine rollNumber-Ganzzahl. */
export function rollWeightedNumber<T>(
  entries: readonly WeightedNumberEntry<T>[],
  manipulation: NumberManipulation,
  prng: Prng,
): WeightedNumberRoll<T> {
  if (entries.length === 0) throw new Error('rollWeightedNumber: leere Liste');
  let total = 0;
  for (const entry of entries) {
    if (!Number.isFinite(entry.weight) || entry.weight <= 0) {
      throw new Error(`rollWeightedNumber: ungueltiges Gewicht fuer ${String(entry.value)}`);
    }
    total += Math.round(entry.weight);
  }
  if (total <= 0) throw new Error('rollWeightedNumber: Gesamtgewicht muss > 0 sein');
  const roll = rollNumber(0, total - 1, manipulation, prng);
  let cursor = roll.finalNumber;
  for (const entry of entries) {
    cursor -= Math.round(entry.weight);
    if (cursor < 0) return { value: entry.value, roll };
  }
  return { value: entries[entries.length - 1]!.value, roll };
}
