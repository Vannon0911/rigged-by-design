/** Katalog: Automaten und Deko. Jede Zeile ist eine Kaufentscheidung. */
import { fromVC, type VaCoinMicro } from '../economy/vacoin';
import type { VenueTier } from '../venues';
import { STARTER_REELS, type ReelId } from './reels';
import type { OfferTag } from './tags';

export type MachineId = 'SLOT_RUSTY' | 'SLOT_NEON' | 'SLOT_MIRROR';
export type DecorId = 'DECO_CARPET' | 'DECO_NEON_SIGN' | 'DECO_BOOZE' | 'DECO_VELVET';
export type ItemId = MachineId | DecorId;

export interface ItemDef {
  readonly id: ItemId;
  readonly kind: 'MACHINE' | 'DECO';
  readonly name: string;
  readonly description: string;
  readonly priceVC: VaCoinMicro;
  readonly attractionBps: number;
  readonly spawnBonusBps: number;
  readonly patienceBonus: number;
  readonly startingAddiction: number;
  readonly paylines: number;
  readonly maxMods: number;
  readonly minBetVC: VaCoinMicro;
  readonly maxBetVC: VaCoinMicro;
  readonly tags: readonly OfferTag[];
  readonly starterReels: readonly ReelId[];
  readonly minVenueTier: VenueTier;
}

const DECO_BASE = {
  kind: 'DECO' as const,
  paylines: 0,
  maxMods: 0,
  minBetVC: fromVC(0),
  maxBetVC: fromVC(0),
  tags: [] as readonly OfferTag[],
  starterReels: [] as readonly ReelId[],
  minVenueTier: 1 as VenueTier,
};

export const ITEMS: readonly ItemDef[] = [
  {
    ...DECO_BASE,
    id: 'SLOT_RUSTY',
    kind: 'MACHINE',
    name: 'Rostiger 3-Walzen-Slot',
    description: 'Ein Kasten, drei Walzen, eine Linie. Dein erster Automat ist gratis.',
    priceVC: fromVC(18),
    attractionBps: 900,
    spawnBonusBps: 0,
    patienceBonus: 0,
    startingAddiction: 0,
    paylines: 1,
    maxMods: 2,
    minBetVC: fromVC(0.02),
    maxBetVC: fromVC(0.25),
    tags: ['CLASSIC'],
    starterReels: STARTER_REELS,
  },
  {
    ...DECO_BASE,
    id: 'SLOT_NEON',
    kind: 'MACHINE',
    name: 'Neon-Kabinett Mk. II',
    description: 'Drei Linien, vier Mod-Slots, Licht, das nach Reichtum aussieht.',
    priceVC: fromVC(60),
    attractionBps: 1700,
    spawnBonusBps: 400,
    patienceBonus: 0,
    startingAddiction: 4,
    paylines: 3,
    maxMods: 4,
    minBetVC: fromVC(0.1),
    maxBetVC: fromVC(1),
    tags: ['NEON'],
    starterReels: ['REEL_MIXED', 'REEL_MIXED', 'REEL_MIXED'],
  },
  {
    ...DECO_BASE,
    id: 'SLOT_MIRROR',
    kind: 'MACHINE',
    name: 'Spiegel-Automat',
    description: 'Sechs Walzen-Slots, fünf Mods, High-Stakes-Publikum. Ab Stufe 2.',
    priceVC: fromVC(160),
    attractionBps: 2600,
    spawnBonusBps: 800,
    patienceBonus: -2,
    startingAddiction: 8,
    paylines: 3,
    maxMods: 5,
    minBetVC: fromVC(0.25),
    maxBetVC: fromVC(3),
    tags: ['NEON', 'HIGH_STAKES'],
    starterReels: ['REEL_MIXED', 'REEL_MIXED', 'REEL_MIXED', 'REEL_MIXED'],
    minVenueTier: 2,
  },
  {
    ...DECO_BASE,
    id: 'DECO_CARPET',
    name: 'Abgetretener Teppich',
    description: 'Einmal Rot, immer Rot. Gäste halten länger durch.',
    priceVC: fromVC(10),
    attractionBps: 120,
    spawnBonusBps: 700,
    patienceBonus: 4,
    startingAddiction: 0,
    tags: [],
  },
  {
    ...DECO_BASE,
    id: 'DECO_NEON_SIGN',
    name: 'Neon-Reklameschild',
    description: 'Zieht mehr Gäste an und schiebt die Sucht ein Stück nach oben.',
    priceVC: fromVC(24),
    attractionBps: 380,
    spawnBonusBps: 2200,
    patienceBonus: 0,
    startingAddiction: 6,
    tags: ['NEON'],
  },
  {
    ...DECO_BASE,
    id: 'DECO_BOOZE',
    name: 'Fusel-Spender',
    description: 'Ein Schluck Geduld für jeden neuen Gast. Kostet Betrieb.',
    priceVC: fromVC(32),
    attractionBps: 200,
    spawnBonusBps: 400,
    patienceBonus: 12,
    startingAddiction: 2,
    tags: ['BOOZE'],
  },
  {
    ...DECO_BASE,
    id: 'DECO_VELVET',
    name: 'Samtvorhang',
    description: 'Fühlt sich nach teuer an. Bessere Kundschaft, weniger Geduld.',
    priceVC: fromVC(80),
    attractionBps: 520,
    spawnBonusBps: 900,
    patienceBonus: -3,
    startingAddiction: 2,
    tags: ['HIGH_STAKES'],
    minVenueTier: 2,
  },
];

const ITEM_INDEX = new Map(ITEMS.map((item) => [item.id, item]));

export function getItem(id: ItemId): ItemDef {
  const item = ITEM_INDEX.get(id);
  if (!item) throw new Error(`Unbekanntes Objekt: ${id}`);
  return item;
}

export function isMachine(id: ItemId): boolean {
  return getItem(id).kind === 'MACHINE';
}

export function itemsForVenue(tier: VenueTier): readonly ItemDef[] {
  return ITEMS.filter((item) => item.minVenueTier <= tier);
}
