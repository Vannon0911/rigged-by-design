/** Ein einziger serialisierbarer Weltzustand. Geld liegt nicht hier, sondern im Ledger. */
import type { VaCoinMicro } from '../economy/vacoin';

export type TemplateId = 'SMALL' | 'MEDIUM' | 'LARGE';
type ZoneKind = 'ENTRANCE' | 'EXCHANGE' | 'GAMING' | 'BAR' | 'TOILET' | 'STORAGE' | 'LOUNGE';
export type GameId = 'SLOT' | 'BLACKJACK' | 'POKER' | 'ROULETTE' | 'PLINKO' | 'SHELL' | 'DICE';
type GuestState = 'ENTER' | 'EXCHANGE' | 'CHOOSE' | 'WAIT' | 'PLAY' | 'DRINK' | 'TOILET' | 'CASHOUT' | 'LEAVE' | 'ANGRY';
type Need = 'play' | 'drink' | 'toilet' | 'social';
export type PersonaId = 'LUMPEN' | 'STREET' | 'BUSINESS' | 'HIGH_ROLLER' | 'STAMMGAST';
export type CarpetId = 'VIOLET' | 'CRIMSON' | 'JADE' | 'GOLD';
export type ModId = 'NEON' | 'NEAR_MISS' | 'CHERRY' | 'FREE_DRINK' | 'EXTRA_REEL' | 'VELVET';

export interface Point { readonly x: number; readonly y: number; }

export interface Zone {
  readonly id: string;
  readonly name: string;
  readonly kind: ZoneKind;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly color: number;
}

export interface Furniture {
  readonly id: number;
  readonly kind: 'SLOT' | 'TABLE' | 'BAR' | 'TOILET' | 'EXCHANGE' | 'DECOR' | 'STORAGE';
  readonly gameId?: GameId;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly seats: number;
  readonly label: string;
  readonly price: VaCoinMicro;
  readonly quality: number;
  condition: number;
  damaged: boolean;
  dirt: number;
  readonly zoneId: string;
  occupants: number[];
  mods: ModId[];
  reels: number;
  baseBet: VaCoinMicro;
}

export interface Guest {
  readonly id: number;
  readonly name: string;
  readonly persona: PersonaId;
  fiat: VaCoinMicro;
  mood: number;
  patience: number;
  addiction: number;
  sociability: number;
  state: GuestState;
  stateTicks: number;
  position: Point;
  path: Point[];
  pathIndex: number;
  targetFurniture: number;
  targetZone: string;
  queueIndex: number;
  need: Need;
  anger: number;
  dirtTimer: number;
  lastResult: string;
  spins: number;
}

export interface Player {
  position: Point;
  path: Point[];
  pathIndex: number;
  carrying: string;
}

export interface PriceBook {
  entryFee: VaCoinMicro;
  drinkPrice: VaCoinMicro;
  slotMinBet: VaCoinMicro;
  staffWage: VaCoinMicro;
  guardWage: VaCoinMicro;
  cleaningCost: VaCoinMicro;
  repairCost: VaCoinMicro;
}

export interface StaffState {
  guard: boolean;
  cleaner: boolean;
  bartender: boolean;
}

export interface WorldState {
  template: TemplateId;
  size: number;
  zones: readonly Zone[];
  furniture: Furniture[];
  guests: Guest[];
  player: Player;
  dirty: Set<number>;
  prices: PriceBook;
  staff: StaffState;
  carpet: CarpetId;
  tick: number;
  day: number;
  nextGuestId: number;
  nextFurnitureId: number;
  lastEvent: string;
  guardsHired: number;
}

export const TILE = 26;
export const REGION = 30;
export const CARPETS: Readonly<Record<CarpetId, { name: string; color: number }>> = {
  VIOLET: { name: 'Violett', color: 0x1b0f2a },
  CRIMSON: { name: 'Karmin', color: 0x2a0d17 },
  JADE: { name: 'Jade', color: 0x0d241f },
  GOLD: { name: 'Gold', color: 0x2a2210 },
};
