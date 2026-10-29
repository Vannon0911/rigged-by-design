/** Venues und Tiers: Das eigene Casino waechst vom 4x4-Hinterhof zum 10x10-Mogul-Palast. */
import { fromVC, type VaCoinMicro } from '../economy/vacoin';
import type { BuildableId } from '../simulation/catalog';
import type { CpuCasinoId } from '../simulation/cpu-casinos';

export type VenueTier = 1 | 2 | 3 | 4;

export interface Venue {
  readonly tier: VenueTier;
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly unlockCostVC: VaCoinMicro;
  readonly gridSize: number;
  readonly budgetMinVC: VaCoinMicro;
  readonly budgetMaxVC: VaCoinMicro;
  readonly allowedBuildables: readonly BuildableId[];
  readonly cpuCasinoId: CpuCasinoId;
}

const BASE_DECO: readonly BuildableId[] = ['DECO_CARPET', 'DECO_NEON_SIGN', 'DECO_BOOZE'];

export const VENUES: readonly Venue[] = [
  {
    tier: 1,
    id: 'TIER_1_STREET_CORNER',
    name: 'Nasse Straßenecke',
    description: 'Ein Karton, drei Becher und ein rostiger Automat. Arme Laufkundschaft, ehrliche Pleite.',
    unlockCostVC: fromVC(0),
    gridSize: 4,
    budgetMinVC: fromVC(2),
    budgetMaxVC: fromVC(10),
    allowedBuildables: ['SHELL_CART', 'SLOT_RUSTY'],
    cpuCasinoId: 'CPU_DIVE_BAR',
  },
  {
    tier: 2,
    id: 'TIER_2_BACKROOM_DEN',
    name: 'Hinterhof-Spelunke',
    description: 'Mehr Platz, Würfel und Neon. Die ersten Gäste bleiben freiwillig.',
    unlockCostVC: fromVC(50),
    gridSize: 6,
    budgetMinVC: fromVC(10),
    budgetMaxVC: fromVC(50),
    allowedBuildables: ['SHELL_CART', 'SLOT_RUSTY', 'DICE_TABLE', 'SLOT_NEON', ...BASE_DECO],
    cpuCasinoId: 'CPU_BACKROOM_CLUB',
  },
  {
    tier: 3,
    id: 'TIER_3_NEON_HALL',
    name: 'Neon-Spielhalle',
    description: 'Roulette, Blackjack und genug Teppich, dass niemand den Ausgang findet.',
    unlockCostVC: fromVC(250),
    gridSize: 8,
    budgetMinVC: fromVC(50),
    budgetMaxVC: fromVC(250),
    allowedBuildables: [
      'SHELL_CART', 'SLOT_RUSTY', 'DICE_TABLE', 'SLOT_NEON',
      'ROULETTE_TABLE', 'BLACKJACK_TABLE', ...BASE_DECO,
    ],
    cpuCasinoId: 'CPU_NEON_SPIRE',
  },
  {
    tier: 4,
    id: 'TIER_4_MOGUL_PALACE',
    name: 'Grand VaCoin Mogul-Palast',
    description: 'High-Stakes-Poker, VIP-Wale und ein Tresor, der die Syndikatsquote kennt.',
    unlockCostVC: fromVC(1_500),
    gridSize: 10,
    budgetMinVC: fromVC(500),
    budgetMaxVC: fromVC(5_000),
    allowedBuildables: [
      'SHELL_CART', 'SLOT_RUSTY', 'DICE_TABLE', 'SLOT_NEON',
      'ROULETTE_TABLE', 'BLACKJACK_TABLE', 'POKER_TABLE', ...BASE_DECO,
    ],
    cpuCasinoId: 'CPU_HIGH_ROLLER',
  },
];

const VENUE_INDEX = new Map(VENUES.map((venue) => [venue.tier, venue]));

export function getVenue(tier: number): Venue {
  const venue = VENUE_INDEX.get(tier as VenueTier);
  if (!venue) throw new Error(`Unbekanntes Venue-Tier: ${tier}`);
  return venue;
}

export function nextVenue(tier: VenueTier): Venue | null {
  return VENUE_INDEX.get((tier + 1) as VenueTier) ?? null;
}

export function isBuildableAllowed(tier: VenueTier, id: BuildableId): boolean {
  return getVenue(tier).allowedBuildables.includes(id);
}

export function venueUnlocksCpu(tier: VenueTier, casinoTier: VenueTier): boolean {
  return casinoTier <= tier;
}

export function budgetFor(tier: VenueTier): { min: VaCoinMicro; max: VaCoinMicro } {
  const venue = getVenue(tier);
  return { min: venue.budgetMinVC, max: venue.budgetMaxVC };
}
