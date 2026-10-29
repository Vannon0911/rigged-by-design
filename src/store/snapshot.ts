/** Baut den öffentlichen Snapshot aus Ledger, Floor und Ereignissen. */
import type { Ledger } from '../core/economy/ledger';
import type { CasinoFloor } from '../core/floor/floor';
import type { FloorRoundEvent } from '../core/floor/events';
import type { HouseSpinResult } from '../core/visit/houses';
import { pendingPayoutTotal } from '../core/visitors/ledger';
import { getVenue, nextVenue } from '../core/venues';
import type { GameSnapshot, UpgradeView } from './types';

export interface SnapshotInput {
  readonly ledger: Ledger;
  readonly floor: CasinoFloor;
  readonly tick: number;
  readonly notice: string;
  readonly events: readonly FloorRoundEvent[];
  readonly lastHouse: HouseSpinResult | null;
}

function upgradeView(floor: CasinoFloor, cash: number): UpgradeView | null {
  const next = nextVenue(floor.venueTier);
  if (!next) return null;
  const machinesNeeded = next.tier - 1;
  const machines = floor.machines.length;
  const blockers: string[] = [];
  if (machines < machinesNeeded) blockers.push(`${machines}/${machinesNeeded} Automaten`);
  if (cash < next.upgradeCostVC) blockers.push('zu wenig Bargeld');
  return {
    name: next.name,
    cost: next.upgradeCostVC,
    machinesNeeded,
    machines,
    available: blockers.length === 0,
    blockers,
  };
}

export function buildSnapshot(input: SnapshotInput): GameSnapshot {
  const venue = getVenue(input.floor.venueTier);
  const cash = input.ledger.getBalance('PLAYER_CASH');
  return {
    cash,
    vault: input.ledger.getBalance('CASINO_VAULT'),
    pending: pendingPayoutTotal(input.floor.visitors),
    revenue: input.floor.revenueVC,
    visitors: input.floor.visitors,
    machines: input.floor.machines,
    items: input.floor.items,
    ownedReels: input.floor.ownedReels,
    venueTier: input.floor.venueTier,
    venueName: venue.name,
    gridSize: input.floor.size,
    tick: input.tick,
    ledgerOk: input.ledger.verifyLedgerIntegrity(),
    notice: input.notice,
    events: input.events,
    lastEvent: input.events.at(-1) ?? null,
    lastHouse: input.lastHouse,
    upgrade: upgradeView(input.floor, cash),
  };
}

