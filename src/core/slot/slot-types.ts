/** Symbole, Zahlenbaender, Paylines und dynamische Slot-Vertraege. */
import { fromVC, type VaCoinMicro } from '../economy/vacoin';
import type { ModContract } from '../rng/bias-policy';
import type { NumberManipulation } from '../rng/number-rng';

export const SLOT_SYMBOLS = ['BLANK', 'CHERRY', 'BELL', 'SEVEN', 'VACOIN_DIAMOND', 'WILD'] as const;
export type SlotSymbol = (typeof SLOT_SYMBOLS)[number];

/** Basisgewichte fuer automatisch erzeugte Standard-Walzen. */
export const BASE_WEIGHTS: Readonly<Record<SlotSymbol, number>> = {
  BLANK: 30,
  CHERRY: 40,
  BELL: 15,
  SEVEN: 10,
  VACOIN_DIAMOND: 5,
  WILD: 4,
};

export interface SlotPayout {
  readonly two?: number;
  readonly three?: number;
  readonly four?: number;
  readonly five?: number;
  readonly six?: number;
}

/** Auszahlung in Basispunkten des Linieneinsatzes (10_000 = 1x). */
export const PAYTABLE: Readonly<Record<SlotSymbol, SlotPayout>> = {
  BLANK: {},
  CHERRY: { two: 5_000, three: 15_000, four: 30_000, five: 50_000, six: 80_000 },
  BELL: { three: 40_000, four: 80_000, five: 150_000, six: 250_000 },
  SEVEN: { three: 150_000, four: 300_000, five: 500_000, six: 800_000 },
  VACOIN_DIAMOND: { three: 500_000, four: 1_000_000, five: 2_500_000, six: 5_000_000 },
  WILD: { two: 1_000, three: 25_000, four: 60_000, five: 150_000, six: 300_000 },
};

/** Legacy-Paylines fuer 3 Walzen (0 = oben, 1 = Mitte, 2 = unten). */
export const PAYLINES = {
  MIDDLE: [1, 1, 1],
  TOP: [0, 0, 0],
  BOTTOM: [2, 2, 2],
  DIAGONAL_DOWN: [0, 1, 2],
  DIAGONAL_UP: [2, 1, 0],
} as const;

export type PaylineId = keyof typeof PAYLINES;
export const PAYLINE_ORDER: readonly PaylineId[] = ['MIDDLE', 'TOP', 'BOTTOM', 'DIAGONAL_DOWN', 'DIAGONAL_UP'];

/** Eine aktive Linie fuer beliebig viele Walzen. */
export interface PaylinePattern {
  readonly id: string;
  readonly rows: readonly number[];
}

export type ReelStrip =
  | readonly SlotSymbol[]
  | {
      readonly id?: string;
      /** Index = Zahl auf dem Band; jedes Element ist ein Symbol. */
      readonly symbols: readonly SlotSymbol[];
      readonly manipulation?: NumberManipulation;
    };

export type SlotPaytable = Partial<Record<SlotSymbol, SlotPayout>>;

export interface SlotConfig {
  readonly id: string;
  /** Einsatz pro Linie in Mikro-VC. */
  readonly baseBet: VaCoinMicro;
  /** 3 bis 6 Rollen. Fehlt reels, werden 3 Standard-Walzen aus weights gebaut. */
  readonly reels?: readonly ReelStrip[];
  /** 1 bis 9 aktive Linien. Ein Legacy-Array zaehlt als Linienanzahl. */
  readonly paylines: number | readonly PaylineId[];
  /** Gewichts-Overrides fuer automatisch erzeugte Standard-Walzen. */
  readonly weights?: Readonly<Partial<Record<SlotSymbol, number>>>;
  /** Eigene Auszahlungsmultiplikatoren pro Symbol und Trefferlaenge. */
  readonly paytable?: SlotPaytable;
  /** Alias fuer paytable. */
  readonly payouts?: SlotPaytable;
  /** Manipulation pro Rolle; hat Vorrang vor reelManipulations. */
  readonly reelManipulations?: readonly (NumberManipulation | undefined)[];
  readonly mods: readonly ModContract[];
}

export interface LineWin {
  readonly payline: string;
  readonly rows: readonly number[];
  readonly symbol: SlotSymbol;
  readonly count: 2 | 3 | 4 | 5 | 6;
  readonly payout: VaCoinMicro;
}

export interface SpinResult {
  /** grid[reel][row], 3 bis 6 Rollen x 3 sichtbare Zeilen. */
  readonly grid: readonly (readonly SlotSymbol[])[];
  readonly lineWins: readonly LineWin[];
  readonly totalPayout: VaCoinMicro;
  readonly totalBet: VaCoinMicro;
  readonly isNearMiss: boolean;
  readonly isLDW: boolean;
}

export const DEFAULT_SLOT_CONFIG: SlotConfig = {
  id: 'vault-classic',
  baseBet: fromVC(1),
  paylines: ['MIDDLE'],
  mods: [],
};
