/** Serialisierbare Floor-Typen: Platzierungen, Besucher und Tick-Ergebnis. */
import type { VaCoinMicro } from '../economy/vacoin';
import type { BuildableId, OperatorModId } from './catalog';
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
}

export interface FloorSnapshot {
  readonly ticks: number;
  readonly nextId: number;
  readonly items: readonly PlacedItem[];
  readonly visitors: readonly Visitor[];
}

export interface FloorTickResult {
  readonly spawned: number;
  readonly spins: number;
  readonly bets: VaCoinMicro;
  readonly payouts: VaCoinMicro;
  readonly left: number;
}
