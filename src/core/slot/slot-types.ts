/** Symbole, Paytable, Gewinnlinien und Vertraege eines Slots. */
import { fromVC, type VaCoinMicro } from '../economy/vacoin';
import type { ModContract } from '../rng/bias-policy';

export const SLOT_SYMBOLS = ['BLANK', 'CHERRY', 'BELL', 'SEVEN', 'VACOIN_DIAMOND'] as const;
export type SlotSymbol = (typeof SLOT_SYMBOLS)[number];

/** Basisgewichte: CHERRY-haltig, Jackpot bewusst selten. */
export const BASE_WEIGHTS: Readonly<Record<SlotSymbol, number>> = {
  BLANK: 30,
  CHERRY: 40,
  BELL: 15,
  SEVEN: 10,
  VACOIN_DIAMOND: 5,
};

/** Auszahlung in Basispunkten des Linieneinsatzes (10_000 = 1x). */
export const PAYTABLE: Readonly<Record<SlotSymbol, { readonly two: number; readonly three: number }>> = {
  BLANK: { two: 0, three: 0 },
  CHERRY: { two: 5_000, three: 15_000 },
  BELL: { two: 0, three: 40_000 },
  SEVEN: { two: 0, three: 150_000 },
  VACOIN_DIAMOND: { two: 0, three: 500_000 },
};

/** Zeilenindex je Walze (0 = oben, 2 = unten). */
export const PAYLINES = {
  MIDDLE: [1, 1, 1],
  TOP: [0, 0, 0],
  BOTTOM: [2, 2, 2],
  DIAGONAL_DOWN: [0, 1, 2],
  DIAGONAL_UP: [2, 1, 0],
} as const;

export type PaylineId = keyof typeof PAYLINES;
export const PAYLINE_ORDER: readonly PaylineId[] = ['MIDDLE', 'TOP', 'BOTTOM', 'DIAGONAL_DOWN', 'DIAGONAL_UP'];

export interface SlotConfig {
  readonly id: string;
  /** Einsatz pro Linie in Mikro-VC. */
  readonly baseBet: VaCoinMicro;
  /** Optionale Gewichts-Overrides je Symbol (z. B. faire CPU-Casino-Gewichte). */
  readonly weights?: Readonly<Partial<Record<SlotSymbol, number>>>;
  /** 1 bis 3 aktive Linien (Mods koennen bis 3 auffuellen). */
  readonly paylines: readonly PaylineId[];
  readonly mods: readonly ModContract[];
}

export interface LineWin {
  readonly payline: PaylineId;
  readonly symbol: SlotSymbol;
  readonly count: 2 | 3;
  readonly payout: VaCoinMicro;
}

export interface SpinResult {
  /** grid[reel][row], 3 Walzen x 3 Zeilen. */
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
