/** Deterministische Zuege aus gewichteten Listen plus exakte Theorie-Wahrscheinlichkeiten. */
import type { Prng } from './prng';

export interface WeightedEntry<T> {
  readonly value: T;
  readonly weight: number;
}

function totalWeight<T>(entries: readonly WeightedEntry<T>[]): number {
  if (entries.length === 0) throw new Error('weighted-pool: leere Liste');
  let total = 0;
  for (const entry of entries) {
    if (!Number.isFinite(entry.weight) || entry.weight <= 0) {
      throw new Error(`weighted-pool: ungueltiges Gewicht fuer ${String(entry.value)}`);
    }
    total += entry.weight;
  }
  if (!Number.isFinite(total) || total <= 0) throw new Error('weighted-pool: Gesamtgewicht muss > 0 sein');
  return total;
}

/** Exakte Einzelwahrscheinlichkeit: weight / Summe aller Gewichte. */
export function getTheoreticalProbabilities<T>(entries: readonly WeightedEntry<T>[]): ReadonlyMap<T, number> {
  const total = totalWeight(entries);
  const probabilities = new Map<T, number>();
  for (const entry of entries) {
    probabilities.set(entry.value, (probabilities.get(entry.value) ?? 0) + entry.weight / total);
  }
  return probabilities;
}

export function pickWeightedIndex<T>(entries: readonly WeightedEntry<T>[], prng: Prng): number {
  const total = totalWeight(entries);
  let threshold = prng.nextFloat() * total;
  for (let index = 0; index < entries.length; index += 1) {
    threshold -= entries[index]!.weight;
    if (threshold < 0) return index;
  }
  return entries.length - 1;
}

export function pickWeighted<T>(entries: readonly WeightedEntry<T>[], prng: Prng): T {
  return entries[pickWeightedIndex(entries, prng)]!.value;
}
