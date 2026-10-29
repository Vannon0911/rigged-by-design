/** Walzen sind kaufbare Objekte: feste Symbolbaender, tauschbar, auch mit nur einem Symbol. */
import { fromVC, type VaCoinMicro } from '../economy/vacoin';
import type { SlotSymbol } from '../slot/slot-types';

export type ReelId =
  | 'REEL_STREET'
  | 'REEL_MIXED'
  | 'REEL_CHERRY'
  | 'REEL_BELL'
  | 'REEL_SEVEN'
  | 'REEL_DIAMOND'
  | 'REEL_WILD'
  | 'REEL_SINGLE_BLANK'
  | 'REEL_SINGLE_CHERRY'
  | 'REEL_SINGLE_SEVEN'
  | 'REEL_SINGLE_WILD';

export interface ReelDef {
  readonly id: ReelId;
  readonly name: string;
  readonly priceVC: VaCoinMicro;
  readonly symbols: readonly SlotSymbol[];
}

/** Preis skaliert invers zur Laenge: eine Walze mit einem Symbol ist teuer. */
export const REELS: readonly ReelDef[] = [
  {
    id: 'REEL_STREET',
    name: 'Straßen-Walze',
    priceVC: fromVC(8),
    symbols: ['BLANK', 'BLANK', 'CHERRY', 'BLANK', 'BELL', 'CHERRY', 'BLANK', 'SEVEN', 'CHERRY', 'BLANK'],
  },
  {
    id: 'REEL_MIXED',
    name: 'Gemischte Walze',
    priceVC: fromVC(12),
    symbols: ['CHERRY', 'BELL', 'BLANK', 'SEVEN', 'CHERRY', 'WILD', 'BLANK', 'BELL', 'CHERRY', 'VACOIN_DIAMOND'],
  },
  {
    id: 'REEL_CHERRY',
    name: 'Kirschen-Walze',
    priceVC: fromVC(10),
    symbols: ['CHERRY', 'CHERRY', 'BLANK', 'CHERRY', 'BELL', 'CHERRY', 'BLANK', 'CHERRY', 'WILD', 'CHERRY'],
  },
  {
    id: 'REEL_BELL',
    name: 'Glocken-Walze',
    priceVC: fromVC(14),
    symbols: ['BELL', 'BLANK', 'BELL', 'CHERRY', 'BELL', 'SEVEN', 'BLANK', 'BELL', 'CHERRY', 'BELL'],
  },
  {
    id: 'REEL_SEVEN',
    name: 'Siebenen-Walze',
    priceVC: fromVC(20),
    symbols: ['SEVEN', 'BLANK', 'CHERRY', 'SEVEN', 'BELL', 'BLANK', 'SEVEN', 'CHERRY', 'VACOIN_DIAMOND', 'BELL'],
  },
  {
    id: 'REEL_DIAMOND',
    name: 'Diamant-Walze',
    priceVC: fromVC(28),
    symbols: ['VACOIN_DIAMOND', 'BLANK', 'CHERRY', 'BELL', 'BLANK', 'VACOIN_DIAMOND', 'SEVEN', 'CHERRY', 'WILD', 'BLANK'],
  },
  {
    id: 'REEL_WILD',
    name: 'Wild-Walze',
    priceVC: fromVC(36),
    symbols: ['WILD', 'CHERRY', 'BELL', 'BLANK', 'WILD', 'SEVEN', 'CHERRY', 'BLANK', 'BELL', 'CHERRY'],
  },
  {
    id: 'REEL_SINGLE_BLANK',
    name: 'Leer-Walze (1 Symbol)',
    priceVC: fromVC(6),
    symbols: ['BLANK'],
  },
  {
    id: 'REEL_SINGLE_CHERRY',
    name: 'Kirschen-Walze (1 Symbol)',
    priceVC: fromVC(60),
    symbols: ['CHERRY'],
  },
  {
    id: 'REEL_SINGLE_SEVEN',
    name: 'Siebenen-Walze (1 Symbol)',
    priceVC: fromVC(120),
    symbols: ['SEVEN'],
  },
  {
    id: 'REEL_SINGLE_WILD',
    name: 'Wild-Walze (1 Symbol)',
    priceVC: fromVC(180),
    symbols: ['WILD'],
  },
];

const REEL_INDEX = new Map(REELS.map((reel) => [reel.id, reel]));

export function getReel(id: ReelId): ReelDef {
  const reel = REEL_INDEX.get(id);
  if (!reel) throw new Error(`Unbekannte Walze: ${id}`);
  return reel;
}

export const STARTER_REELS: readonly ReelId[] = ['REEL_MIXED', 'REEL_MIXED', 'REEL_MIXED'];
