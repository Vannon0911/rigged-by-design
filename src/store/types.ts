/** Snapshot-Typen: alles, was die UI sieht. Kein Zugriff auf interne Stores. */
import type { VaCoinMicro } from '../core/economy/vacoin';
import type { FloorRoundEvent } from '../core/floor/events';
import type { PlacedItem } from '../core/floor/types';
import type { MachineState } from '../core/machine/machine';
import type { ReelId } from '../core/offer/reels';
import type { HouseSpinResult } from '../core/visit/houses';
import type { Visitor } from '../core/visitors/visitor';
import type { VenueTier } from '../core/venues';

export interface UpgradeView {
  readonly name: string;
  readonly cost: VaCoinMicro;
  readonly machinesNeeded: number;
  readonly machines: number;
  readonly available: boolean;
  readonly blockers: readonly string[];
}

export interface GameSnapshot {
  readonly cash: VaCoinMicro;
  readonly vault: VaCoinMicro;
  readonly pending: VaCoinMicro;
  readonly revenue: VaCoinMicro;
  readonly visitors: readonly Visitor[];
  readonly machines: readonly MachineState[];
  readonly items: readonly PlacedItem[];
  readonly ownedReels: readonly ReelId[];
  readonly venueTier: VenueTier;
  readonly venueName: string;
  readonly gridSize: number;
  readonly tick: number;
  readonly ledgerOk: boolean;
  readonly notice: string;
  readonly events: readonly FloorRoundEvent[];
  readonly lastEvent: FloorRoundEvent | null;
  readonly lastHouse: HouseSpinResult | null;
  readonly upgrade: UpgradeView | null;
}
