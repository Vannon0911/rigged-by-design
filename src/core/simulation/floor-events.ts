/** Sichtbares 1:1-Event pro echtem Gast-Spin: Symbole, Differenz und Gesamtbilanz. */
import { subVC, type VaCoinMicro } from '../economy/vacoin';
import type { SlotSymbol } from '../slot/slot-types';
import type { BuildableId } from './catalog';
import { visitorNetResult, type Visitor } from './visitors';

export type FloorRoundVisual =
  | { readonly kind: 'SLOT'; readonly symbols: readonly SlotSymbol[] }
  | {
      readonly kind: 'SHELL';
      readonly cups: number;
      readonly winning: readonly number[];
      readonly picked: readonly number[];
      readonly hit: boolean;
    }
  | { readonly kind: 'DICE'; readonly dice: readonly number[]; readonly sum: number; readonly win: boolean }
  | {
      readonly kind: 'ROULETTE';
      readonly pocket: number;
      readonly pocketLabel: string;
      readonly color: 'RED' | 'BLACK' | 'GREEN';
      readonly win: boolean;
    }
  | {
      readonly kind: 'CARDS';
      readonly game: 'BLACKJACK' | 'POKER';
      readonly player: readonly string[];
      readonly dealer: readonly string[];
      readonly label: string;
      readonly win: boolean;
    };

export interface FloorRoundEvent {
  readonly seq: number;
  readonly visitorId: number;
  readonly visitorName: string;
  readonly gameId: BuildableId;
  readonly gameX: number;
  readonly gameY: number;
  readonly bet: VaCoinMicro;
  readonly payout: VaCoinMicro;
  readonly net: VaCoinMicro;
  readonly total: VaCoinMicro;
  readonly isWin: boolean;
  readonly isNearMiss: boolean;
  readonly isLDW: boolean;
  readonly visual: FloorRoundVisual;
}

export interface FloorEventInput {
  readonly seq: number;
  readonly visitor: Visitor;
  readonly gameId: BuildableId;
  readonly gameX: number;
  readonly gameY: number;
  readonly bet: VaCoinMicro;
  readonly payout: VaCoinMicro;
  readonly isNearMiss: boolean;
  readonly isLDW: boolean;
  readonly visual: FloorRoundVisual;
}

export function makeFloorEvent(input: FloorEventInput): FloorRoundEvent {
  return {
    seq: input.seq,
    visitorId: input.visitor.id,
    visitorName: input.visitor.name,
    gameId: input.gameId,
    gameX: input.gameX,
    gameY: input.gameY,
    bet: input.bet,
    payout: input.payout,
    net: subVC(input.payout, input.bet),
    total: visitorNetResult(input.visitor),
    isWin: input.payout > input.bet,
    isNearMiss: input.isNearMiss,
    isLDW: input.isLDW,
    visual: input.visual,
  };
}
