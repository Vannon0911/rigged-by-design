/** Serialisierbare Floor-Typen: Platzierungen, Besucher und Tick-Ergebnis. */
import type { VaCoinMicro } from '../economy/vacoin';
import type { VenueTier } from '../progression/venues-and-tiers';
import type { BuildableId, OperatorModId } from './catalog';
import type { FloorRoundEvent } from './floor-events';
import type { Visitor } from './visitors';

export interface PlacedItem {
  readonly id: number;
  readonly buildableId: BuildableId;
  readonly x: number;
  readonly y: number;
  mods: OperatorModId[];
}

export interface FloorView {
  readonly items: readonly PlacedItem[];
  readonly visitors: readonly Visitor[];
  readonly size: number;
  readonly venueTier: VenueTier;
}

export interface FloorSnapshot {
  readonly ticks: number;
  readonly nextId: number;
  readonly items: readonly PlacedItem[];
  readonly visitors: readonly Visitor[];
  readonly venueTier?: VenueTier;
  readonly size?: number;
}

export interface FloorTickResult {
  readonly spawned: number;
  readonly spins: number;
  readonly bets: VaCoinMicro;
  readonly payouts: VaCoinMicro;
  readonly left: number;
  readonly events: readonly FloorRoundEvent[];
}
