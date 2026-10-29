/** Uebersetzt Zielwerte in die Indizes eines gewichteten Zahlenbands. */
import type { NumberManipulation, WeightedNumberEntry } from './number-rng';

export function manipulationForBand<T>(
  entries: readonly WeightedNumberEntry<T>[],
  manipulation: NumberManipulation,
): NumberManipulation {
  const wanted = manipulation.targetNumbers;
  if (!wanted || wanted.length === 0) return manipulation;
  const targetValues = new Set(wanted);
  const targetNumbers: number[] = [];
  let cursor = 0;
  for (const entry of entries) {
    const weight = Math.round(entry.weight);
    if (typeof entry.value === 'number' && targetValues.has(entry.value)) {
      for (let offset = 0; offset < weight; offset += 1) targetNumbers.push(cursor + offset);
    }
    cursor += weight;
  }
  return { ...manipulation, targetNumbers };
}
