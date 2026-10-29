/** Betreiber-Mods: Vertraege, Preise und Geduld-Strafen fuer die eigenen Automaten. */
import { fromVC, type VaCoinMicro } from '../economy/vacoin';
import type { ModContract } from '../rng/bias-policy';

export type OperatorModId = 'MOD_LDW_GEAR' | 'MOD_NEAR_MISS' | 'MOD_EXTRA_LINE' | 'MOD_LEAD_WEIGHT';

export interface OperatorMod {
  readonly id: OperatorModId;
  readonly name: string;
  readonly priceVC: VaCoinMicro;
  readonly description: string;
  readonly contracts: readonly ModContract[];
  readonly patiencePenalty: number;
}

export const OPERATOR_MODS: readonly OperatorMod[] = [
  {
    id: 'MOD_LDW_GEAR',
    name: 'Scheingewinn-Getriebe',
    priceVC: fromVC(12),
    description: '+Kirschen-Gewicht: Kirschen zahlen 0.5x, hohe Sucht und mehr Hausvorteil.',
    patiencePenalty: 0,
    contracts: [
      {
        id: 'MOD_LDW_GEAR',
        name: 'Scheingewinn-Getriebe',
        target: 'WEIGHT',
        minBound: 1,
        maxBound: 3,
        costVC: fromVC(12),
        description: 'Cherry-Flut',
        value: 1.6,
        symbols: ['CHERRY'],
      },
    ],
  },
  {
    id: 'MOD_NEAR_MISS',
    name: 'Near-Miss-Magnetbremse',
    priceVC: fromVC(25),
    description: 'Erzwingt 35 % Near-Misses bei Nieten: massiver Sucht-Boost.',
    patiencePenalty: 0,
    contracts: [
      {
        id: 'MOD_NEAR_MISS',
        name: 'Near-Miss-Magnetbremse',
        target: 'NEAR_MISS',
        minBound: 0,
        maxBound: 0.35,
        costVC: fromVC(25),
        description: '35 % optische Fast-Jackpots',
        value: 0.35,
      },
    ],
  },
  {
    id: 'MOD_EXTRA_LINE',
    name: 'Diagonale Zusatzleitungen',
    priceVC: fromVC(30),
    description: 'Schaltet bis zu +2 Gewinnlinien frei.',
    patiencePenalty: 0,
    contracts: [
      {
        id: 'MOD_EXTRA_LINE',
        name: 'Diagonale Zusatzleitungen',
        target: 'PAYLINES',
        minBound: 0,
        maxBound: 2,
        costVC: fromVC(30),
        description: '+2 aktive Linien',
        value: 2,
      },
    ],
  },
  {
    id: 'MOD_LEAD_WEIGHT',
    name: 'Gezinktes Bleigewicht',
    priceVC: fromVC(20),
    description: '-40 % Jackpot-Gewicht, mehr Nieten, hoher Hausgewinn - senkt die Geduld.',
    patiencePenalty: 4,
    contracts: [
      {
        id: 'MOD_LEAD_WEIGHT',
        name: 'Gezinktes Bleigewicht',
        target: 'WEIGHT',
        minBound: 0.1,
        maxBound: 1,
        costVC: fromVC(20),
        description: 'Jackpot-Gewicht auf 60 %',
        value: 0.6,
        symbols: ['VACOIN_DIAMOND'],
      },
    ],
  },
];

const MOD_INDEX = new Map(OPERATOR_MODS.map((mod) => [mod.id, mod]));

export function getOperatorMod(id: OperatorModId): OperatorMod {
  const mod = MOD_INDEX.get(id);
  if (!mod) throw new Error(`Unbekannter Betreiber-Mod: ${id}`);
  return mod;
}
