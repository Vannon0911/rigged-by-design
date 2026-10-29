/** Reine Floor-Regeln: Deko-Summen, Spielauswahl und Einsatzberechnung. */
import type { VaCoinMicro } from '../economy/vacoin';
import type { Prng } from '../rng/prng';
import { pickWeightedIndex } from '../rng/weighted-pool';
import { getBuildable } from './catalog';
import type { PlacedItem } from './floor-types';
import type { Visitor } from './visitors';

export type DecoKey = 'spawnBonusBps' | 'patienceLossReductionBps' | 'startingAddiction';

export function decoBonus(items: readonly PlacedItem[], key: DecoKey): number {
  return items.reduce((sum, item) => sum + getBuildable(item.buildableId)[key], 0);
}

export function pickGame(games: readonly PlacedItem[], prng: Prng): PlacedItem {
  const entries = games.map((game) => ({
    value: game,
    weight: 100 + getBuildable(game.buildableId).attractionBps / 100,
  }));
  return entries[pickWeightedIndex(entries, prng)]!.value;
}

export function betFor(
  visitor: Visitor,
  min: VaCoinMicro,
  max: VaCoinMicro,
  lines: number,
): VaCoinMicro {
  const budget = Math.floor(visitor.wallet / lines);
  if (budget < min) return 0 as VaCoinMicro;
  const ceiling = visitor.addiction >= 100
    ? max
    : Math.min(max, min + Math.round(((max - min) * visitor.addiction) / 100));
  return Math.min(Math.max(min, ceiling), budget) as VaCoinMicro;
}

/** Suchtdruck: kleine Erfolge und viele Gewinnwege ziehen staerker als reine Nieten. */
export function addictionGain(
  isNearMiss: boolean,
  isLDW: boolean,
  win: boolean,
  winPaths: number,
  variety: number,
  bonus = 0,
): number {
  const thrill = isNearMiss ? 14 : isLDW ? 10 : win ? 6 : 2;
  const paths = Math.min(8, Math.max(0, winPaths));
  const room = Math.min(4, Math.max(0, variety - 1));
  return Math.min(24, 2 + thrill + paths + room + Math.max(0, Math.round(bonus)));
}
