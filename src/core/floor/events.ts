/** Ein sichtbares Ergebnis pro Gast-Spin: Symbole, Einsatz, Auszahlung, Bilanz. */
import type { VaCoinMicro } from '../economy/vacoin';
import type { SlotSymbol } from '../slot/slot-types';
import { visitorNetResult, type Visitor } from '../visitors/visitor';

export interface FloorRoundEvent {
  readonly seq: number;
  readonly visitorId: number;
  readonly visitorName: string;
  readonly machineId: number;
  readonly x: number;
  readonly y: number;
  readonly bet: VaCoinMicro;
  readonly payout: VaCoinMicro;
  readonly net: VaCoinMicro;
  readonly total: VaCoinMicro;
  readonly isWin: boolean;
  readonly isNearMiss: boolean;
  readonly isLDW: boolean;
  /** Mittlere Reihe des Walzenfensters. */
  readonly symbols: readonly SlotSymbol[];
}

export interface FloorEventInput {
  readonly seq: number;
  readonly visitor: Visitor;
  readonly machineId: number;
  readonly x: number;
  readonly y: number;
  readonly bet: VaCoinMicro;
  readonly payout: VaCoinMicro;
  readonly symbols: readonly SlotSymbol[];
  readonly isNearMiss: boolean;
  readonly isLDW: boolean;
}

export function makeFloorEvent(input: FloorEventInput): FloorRoundEvent {
  return {
    seq: input.seq,
    visitorId: input.visitor.id,
    visitorName: input.visitor.name,
    machineId: input.machineId,
    x: input.x,
    y: input.y,
    bet: input.bet,
    payout: input.payout,
    net: (input.payout - input.bet) as VaCoinMicro,
    total: visitorNetResult(input.visitor),
    isWin: input.payout > input.bet,
    isNearMiss: input.isNearMiss,
    isLDW: input.isLDW,
    symbols: input.symbols,
  };
}
