/** Wachstum des eigenen Casinos: Venue-Rang, Bauwerke und CPU-Freischaltungen. */
import { addVC, fromVC, type VaCoinMicro } from '../economy/vacoin';
import { getVenue, type VenueTier } from '../progression/venues-and-tiers';
import { getBuildable } from './catalog';

export interface CasinoGrowth {
  readonly venueTier: VenueTier;
  readonly revenueVC: VaCoinMicro;
  readonly gameCount: number;
  readonly uniqueKinds: number;
  readonly buildValueVC: VaCoinMicro;
}

export interface VenueRequirement {
  readonly tier: VenueTier;
  readonly name: string;
  readonly minRevenueVC: VaCoinMicro;
  readonly minGames: number;
  readonly unlockCostVC: VaCoinMicro;
}

const REQUIREMENTS: Readonly<Record<Exclude<VenueTier, 4>, VenueRequirement>> = {
  1: { tier: 2, name: getVenue(2).name, minRevenueVC: fromVC(10), minGames: 2, unlockCostVC: fromVC(50) },
  2: { tier: 3, name: getVenue(3).name, minRevenueVC: fromVC(80), minGames: 4, unlockCostVC: fromVC(250) },
  3: { tier: 4, name: getVenue(4).name, minRevenueVC: fromVC(600), minGames: 6, unlockCostVC: fromVC(1500) },
};

export function requirementFor(tier: VenueTier): VenueRequirement | null {
  return tier === 4 ? null : REQUIREMENTS[tier];
}

export function growthFrom(
  items: readonly { readonly buildableId: Parameters<typeof getBuildable>[0] }[],
  revenueVC: VaCoinMicro,
  venueTier: VenueTier,
): CasinoGrowth {
  let gameCount = 0;
  let buildValueVC = 0 as VaCoinMicro;
  const kinds = new Set<string>();
  for (const item of items) {
    const buildable = getBuildable(item.buildableId);
    buildValueVC = addVC(buildValueVC, buildable.priceVC);
    if (buildable.kind === 'DECO') continue;
    gameCount += 1;
    kinds.add(buildable.kind);
  }
  return { venueTier, revenueVC, gameCount, uniqueKinds: kinds.size, buildValueVC };
}

export function upgradeBlockers(tier: VenueTier, growth: CasinoGrowth, cash: VaCoinMicro): string[] {
  const requirement = requirementFor(tier);
  if (!requirement) return ['Maximale Standort-Stufe erreicht.'];
  const blockers: string[] = [];
  if (growth.revenueVC < requirement.minRevenueVC) {
    blockers.push(`Umsatz ${(growth.revenueVC / 10_000).toFixed(2)} / ${(requirement.minRevenueVC / 10_000).toFixed(2)} VC`);
  }
  if (growth.gameCount < requirement.minGames) {
    blockers.push(`${growth.gameCount} / ${requirement.minGames} Spielstaetten`);
  }
  if (cash < requirement.unlockCostVC) {
    blockers.push(`Bargeld ${(cash / 10_000).toFixed(2)} / ${(requirement.unlockCostVC / 10_000).toFixed(2)} VC`);
  }
  return blockers;
}

export function canUpgradeVenue(
  tier: VenueTier,
  growth: CasinoGrowth,
  cash: VaCoinMicro,
): boolean {
  const requirement = requirementFor(tier);
  return Boolean(requirement) &&
    growth.revenueVC >= requirement!.minRevenueVC &&
    growth.gameCount >= requirement!.minGames &&
    cash >= requirement!.unlockCostVC;
}

/** Jede CPU-Stufe oeffnet erst, wenn das eigene Casino gross genug ist. */
export function canEnterCpuCasino(ownTier: VenueTier, cpuTier: VenueTier): boolean {
  return cpuTier <= ownTier;
}
