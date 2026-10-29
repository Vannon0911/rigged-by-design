/** Serialisierbarer Floor: Objekte, Gäste, Walzen-Inventar und Tick-Ergebnis. */
import type { VaCoinMicro } from '../economy/vacoin';
import type { ItemId } from '../offer/catalog';
import type { ModId } from '../offer/mods';
import type { ReelId } from '../offer/reels';
import type { VenueTier } from '../venues';
import type { FloorRoundEvent } from './events';
import type { Visitor } from '../visitors/visitor';

export interface PlacedItem {
  readonly id: number;
  readonly catalogId: ItemId;
  readonly x: number;
  readonly y: number;
  readonly reels: readonly ReelId[];
  readonly mods: readonly ModId[];
  readonly baseBet: VaCoinMicro;
}

export interface FloorSnapshot {
  readonly ticks: number;
  readonly nextId: number;
  readonly items: readonly PlacedItem[];
  readonly visitors: readonly Visitor[];
  readonly venueTier: VenueTier;
  readonly ownedReels: readonly ReelId[];
  readonly totalRevenueVC: VaCoinMicro;
}

export interface FloorTickResult {
  readonly spawned: number;
  readonly spins: number;
  readonly bets: VaCoinMicro;
  readonly payouts: VaCoinMicro;
  readonly left: number;
  readonly events: readonly FloorRoundEvent[];
}
