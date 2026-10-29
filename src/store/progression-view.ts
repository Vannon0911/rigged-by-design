/** Reine View-Ableitung: Run-Zustand + Venue zu einem UI-Snapshot. */
import type { VaCoinMicro } from '../core/economy/vacoin';
import { META_UNLOCKS, type MetaProgress, type MetaUnlock } from '../core/progression/meta-progression';
import {
  RUN_PERKS,
  TRIBUTE_INTERVAL,
  type RogueliteSnapshot,
  type RunPerk,
  type RunPerkId,
  type RunStatus,
} from '../core/progression/roguelite-loop';
import { getVenue, nextVenue, type Venue, type VenueTier } from '../core/progression/venues-and-tiers';
import {
  canUpgradeVenue,
  requirementFor,
  upgradeBlockers,
  type CasinoGrowth,
  type VenueRequirement,
} from '../core/simulation/progression';

export interface ProgressionSnapshot {
  readonly venue: Venue;
  readonly nextVenue: Venue | null;
  readonly floorSize: number;
  readonly ticksUntilTribute: number;
  readonly tributeDueVC: VaCoinMicro;
  readonly status: RunStatus;
  readonly cycle: number;
  readonly offeredPerks: readonly RunPerk[];
  readonly chosenPerks: readonly RunPerk[];
  readonly meta: MetaProgress;
  readonly revenueVC: VaCoinMicro;
  readonly notice: string;
  readonly upgradeCostVC: VaCoinMicro;
  readonly canUpgrade: boolean;
  readonly nextRequirement: VenueRequirement | null;
  readonly upgradeBlockers: readonly string[];
  readonly growth: CasinoGrowth;
  readonly canPayTribute: boolean;
  readonly metaUnlocks: readonly MetaUnlock[];
  readonly runNumber: number;
}

function perkById(id: RunPerkId): RunPerk {
  return RUN_PERKS.find((perk) => perk.id === id)!;
}

export interface ProgressionViewInput {
  readonly venueTier: VenueTier;
  readonly run: RogueliteSnapshot;
  readonly notice: string;
  readonly cash: VaCoinMicro;
  readonly vault: VaCoinMicro;
  readonly growth: CasinoGrowth;
}

export function buildProgressionSnapshot(input: ProgressionViewInput): ProgressionSnapshot {
  const venue = getVenue(input.venueTier);
  const next = nextVenue(input.venueTier);
  const canPay = input.run.status === 'TRIBUTE_DUE' &&
    input.cash + input.vault >= input.run.tributeDueVC;
  const nextRequirement = requirementFor(input.venueTier);
  const blockers = upgradeBlockers(input.venueTier, input.growth, input.cash);
  return {
    venue,
    nextVenue: next,
    floorSize: venue.gridSize,
    ticksUntilTribute: Math.max(0, TRIBUTE_INTERVAL - input.run.ticksIntoCycle),
    tributeDueVC: input.run.tributeDueVC,
    status: input.run.status,
    cycle: input.run.cycle,
    offeredPerks: input.run.offeredPerks.map(perkById),
    chosenPerks: input.run.chosenPerks.map(perkById),
    meta: input.run.meta,
    revenueVC: input.run.revenueVC,
    notice: input.notice,
    upgradeCostVC: next?.unlockCostVC ?? (0 as VaCoinMicro),
    canUpgrade: Boolean(next) && input.run.status !== 'RUN_OVER' && canUpgradeVenue(input.venueTier, input.growth, input.cash),
    nextRequirement,
    upgradeBlockers: blockers,
    growth: input.growth,
    canPayTribute: canPay,
    metaUnlocks: META_UNLOCKS,
    runNumber: input.run.runNumber,
  };
}
