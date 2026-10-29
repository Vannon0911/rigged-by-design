/** Öffentliche Snapshot-Typen des Game-Stores. */
import type { LedgerEntry } from '../core/economy/ledger';
import type { VaCoinMicro } from '../core/economy/vacoin';
import type { PlacedItem } from '../core/simulation/casino-floor';
import type { CpuCasinoId } from '../core/simulation/cpu-casinos';
import type { CpuTableResult } from '../core/simulation/cpu-table-play';
import type { FloorRoundEvent } from '../core/simulation/floor-events';
import type { Visitor } from '../core/simulation/visitors';
import type { SpinResult } from '../core/slot/slot-types';
import type { VenueTier } from '../core/progression/venues-and-tiers';

export interface LastSpin {
  readonly casinoId: CpuCasinoId;
  readonly bet: VaCoinMicro;
  readonly payout: VaCoinMicro;
  readonly spin: SpinResult;
}

export interface GameSnapshot {
  readonly cash: VaCoinMicro;
  readonly vault: VaCoinMicro;
  readonly pendingPayouts: VaCoinMicro;
  readonly hasGame: boolean;
  readonly hasSlot: boolean;
  readonly hasTable: boolean;
  readonly ledgerOk: boolean;
  readonly visitors: readonly Visitor[];
  readonly avgAddiction: number;
  readonly floorSize: number;
  readonly venueTier: VenueTier;
  readonly placements: readonly PlacedItem[];
  readonly floorEvents: readonly FloorRoundEvent[];
  readonly lastEntries: readonly LedgerEntry[];
  readonly now: number;
  readonly casinoId: CpuCasinoId;
  readonly bet: VaCoinMicro;
  readonly lastSpin: LastSpin | null;
  readonly lastTable: CpuTableResult | null;
  readonly notice: string;
}
