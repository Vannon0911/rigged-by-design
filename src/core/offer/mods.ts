/** Betreiber-Mods: zweiseitig. Sie ziehen Gäste an und kosten Geduld, Geld oder Sucht. */
import { fromVC, type VaCoinMicro } from '../economy/vacoin';
import type { ModContract } from '../rng/bias-policy';
import type { VenueTier } from '../venues';
import type { OfferTag } from './tags';

export type ModId =
  | 'MOD_NEON_FRAME'
  | 'MOD_CHERRY_FLOOD'
  | 'MOD_NEAR_MISS'
  | 'MOD_EXTRA_LINE'
  | 'MOD_EXTRA_REEL'
  | 'MOD_FREE_DRINK';

export interface OfferMod {
  readonly id: ModId;
  readonly name: string;
  readonly description: string;
  readonly priceVC: VaCoinMicro;
  readonly attractionBps: number;
  /** Geduld pro Spin: positiv = Gast bleibt länger. */
  readonly patienceDelta: number;
  readonly addictionBonus: number;
  /** Betriebskosten pro Spin, aus dem Tresor. */
  readonly operatingCostVC: VaCoinMicro;
  /** Zusätzliche Walzen-Slots, die der Mod freischaltet. */
  readonly reelSlots: number;
  readonly tag: OfferTag;
  readonly minVenueTier: VenueTier;
  readonly contract?: ModContract;
}

export const OFFER_MODS: readonly OfferMod[] = [
  {
    id: 'MOD_NEON_FRAME',
    name: 'Neon-Rahmen',
    description: 'Leuchtet nachts bis zur Straße. +Anziehung, +Geduld.',
    priceVC: fromVC(14),
    attractionBps: 250,
    patienceDelta: 2,
    addictionBonus: 0,
    operatingCostVC: 0 as VaCoinMicro,
    reelSlots: 0,
    tag: 'NEON',
    minVenueTier: 1,
  },
  {
    id: 'MOD_CHERRY_FLOOD',
    name: 'Kirschen-Flut',
    description: 'Mehr Kirschen, mehr kleine Treffer. Fühlt sich nach Gewinn an.',
    priceVC: fromVC(18),
    attractionBps: 150,
    patienceDelta: -2,
    addictionBonus: 2,
    operatingCostVC: 0 as VaCoinMicro,
    reelSlots: 0,
    tag: 'CLASSIC',
    minVenueTier: 1,
    contract: {
      id: 'MOD_CHERRY_FLOOD',
      name: 'Kirschen-Flut',
      target: 'WEIGHT',
      minBound: 1,
      maxBound: 3,
      costVC: fromVC(18),
      description: 'Kirschen-Gewicht x1.6',
      value: 1.6,
      symbols: ['CHERRY'],
    },
  },
  {
    id: 'MOD_NEAR_MISS',
    name: 'Near-Miss-Magnet',
    description: '35 % der Nieten sehen aus wie Fast-Jackpots. Zieht, kostet Geduld.',
    priceVC: fromVC(26),
    attractionBps: 300,
    patienceDelta: -6,
    addictionBonus: 5,
    operatingCostVC: 0 as VaCoinMicro,
    reelSlots: 0,
    tag: 'NEON',
    minVenueTier: 1,
    contract: {
      id: 'MOD_NEAR_MISS',
      name: 'Near-Miss-Magnet',
      target: 'NEAR_MISS',
      minBound: 0,
      maxBound: 0.35,
      costVC: fromVC(26),
      description: '35 % Near-Miss-Chance',
      value: 0.35,
    },
  },
  {
    id: 'MOD_EXTRA_LINE',
    name: 'Diagonale Leitungen',
    description: 'Zwei zusätzliche Gewinnlinien: mehr Action pro Spin.',
    priceVC: fromVC(30),
    attractionBps: 180,
    patienceDelta: -3,
    addictionBonus: 3,
    operatingCostVC: 0 as VaCoinMicro,
    reelSlots: 0,
    tag: 'SPEED',
    minVenueTier: 1,
    contract: {
      id: 'MOD_EXTRA_LINE',
      name: 'Diagonale Leitungen',
      target: 'PAYLINES',
      minBound: 0,
      maxBound: 2,
      costVC: fromVC(30),
      description: '+2 Gewinnlinien',
      value: 2,
    },
  },
  {
    id: 'MOD_EXTRA_REEL',
    name: 'Vierte Walze',
    description: 'Schaltet einen zusätzlichen Walzen-Slot frei. Mehr Kombinationen.',
    priceVC: fromVC(40),
    attractionBps: 260,
    patienceDelta: -2,
    addictionBonus: 2,
    operatingCostVC: 0 as VaCoinMicro,
    reelSlots: 1,
    tag: 'HIGH_STAKES',
    minVenueTier: 2,
  },
  {
    id: 'MOD_FREE_DRINK',
    name: 'Freier Fusel',
    description: 'Ein Drink pro Spin. Gäste halten länger, du zahlst pro Spin.',
    priceVC: fromVC(22),
    attractionBps: 120,
    patienceDelta: 6,
    addictionBonus: 1,
    operatingCostVC: fromVC(0.02),
    reelSlots: 0,
    tag: 'BOOZE',
    minVenueTier: 1,
  },
];

const MOD_INDEX = new Map(OFFER_MODS.map((mod) => [mod.id, mod]));

export function getMod(id: ModId): OfferMod {
  const mod = MOD_INDEX.get(id);
  if (!mod) throw new Error(`Unbekannter Mod: ${id}`);
  return mod;
}

export function modsForVenue(tier: VenueTier): readonly OfferMod[] {
  return OFFER_MODS.filter((mod) => mod.minVenueTier <= tier);
}

export function modContracts(modIds: readonly ModId[]): readonly ModContract[] {
  return modIds.flatMap((id) => {
    const contract = getMod(id).contract;
    return contract ? [contract] : [];
  });
}
