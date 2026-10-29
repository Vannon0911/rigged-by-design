/** Roulette: 37 Basis-Pockets, optionale 00/000, einfache Wetten, Kessel-Bias und exakte RTP. */
import type { VaCoinMicro } from '../../economy/vacoin';
import type { ModContract } from '../../rng/bias-policy';
import type { NumberManipulation } from '../../rng/number-rng';

export type RouletteBetType = 'RED' | 'BLACK' | 'EVEN' | 'ODD' | 'STRAIGHT' | 'DOZEN';
export type RouletteColor = 'RED' | 'BLACK' | 'GREEN';

export const ROULETTE_POCKETS = 37;
export const DOUBLE_ZERO_POCKET = 37;
export const TRIPLE_ZERO_POCKET = 38;
export const STRAIGHT_BASE_BPS = 360_000;
export const LIGHTNING_BASE_STRAIGHT_BPS = 300_000;
/** Gesamtrueckzahlung der Blitz-Pockets: 100x, 200x, 300x. */
export const LIGHTNING_MULTIPLIERS_BPS = [1_000_000, 2_000_000, 3_000_000] as const;
export const RED_NUMBERS: readonly number[] = [
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
];

export interface LightningPocket {
  readonly pocket: number;
  readonly label: string;
  readonly multiplierBps: number;
}

export interface RouletteConfig {
  readonly id: string;
  readonly bet: RouletteBetType;
  readonly straightNumber?: number;
  readonly dozen?: 1 | 2 | 3;
  readonly payoutBps?: number;
  readonly pocketWeights?: Readonly<Record<string, number>>;
  /** Zahlen-Pull auf Sektor-Zahlen; die Gewichte bleiben begrenzt. */
  readonly manipulation?: NumberManipulation;
  readonly mods: readonly ModContract[];
  readonly doubleZero?: boolean;
  readonly tripleZero?: boolean;
  readonly lightning?: boolean;
}

export interface RouletteRound {
  readonly pocket: number;
  readonly pocketLabel: string;
  readonly wheelSize: number;
  readonly color: RouletteColor;
  readonly bet: RouletteBetType;
  readonly straightNumber: number | null;
  readonly win: boolean;
  readonly totalBet: VaCoinMicro;
  readonly payout: VaCoinMicro;
  readonly payoutBps: number;
  readonly isNearMiss: boolean;
  readonly lightningPockets: readonly LightningPocket[];
  readonly lightningMultiplierBps: number | null;
}

export interface RouletteProof {
  readonly sampleSize: number;
  readonly seed: number;
  readonly hitRate: number;
  readonly greenRate: number;
  readonly measuredRTP: number;
  readonly theoreticalRTP: number;
  readonly houseEdge: number;
  readonly addictionScore: number;
  readonly payoutBps: number;
  readonly wheelSize: number;
  readonly lightningHitRate: number;
  readonly maxPayoutBps: number;
  readonly colorDistribution: readonly {
    readonly label: string;
    readonly theoreticalPct: number;
    readonly measuredPct: number;
    readonly deltaPct: number;
  }[];
  readonly totalPayout: VaCoinMicro;
  readonly totalBet: VaCoinMicro;
}

export const DEFAULT_ROULETTE_CONFIG: RouletteConfig = {
  id: 'roulette-european',
  bet: 'RED',
  mods: [],
  doubleZero: false,
  tripleZero: false,
  lightning: false,
};

/** Alle aktiven Kessel-Pockets; tripleZero bringt 00 und 000 mit. */
export function wheelPockets(config: RouletteConfig): number[] {
  const last = config.tripleZero ? TRIPLE_ZERO_POCKET : config.doubleZero ? DOUBLE_ZERO_POCKET : ROULETTE_POCKETS - 1;
  return Array.from({ length: last + 1 }, (_, pocket) => pocket);
}

export function wheelSize(config: RouletteConfig): number {
  return config.tripleZero ? 39 : config.doubleZero ? 38 : 37;
}

export function pocketLabel(pocket: number): string {
  if (pocket === DOUBLE_ZERO_POCKET) return '00';
  if (pocket === TRIPLE_ZERO_POCKET) return '000';
  return String(pocket);
}

export function colorOf(pocket: number): RouletteColor {
  if (pocket === 0 || pocket === DOUBLE_ZERO_POCKET || pocket === TRIPLE_ZERO_POCKET) return 'GREEN';
  return RED_NUMBERS.includes(pocket) ? 'RED' : 'BLACK';
}

export function pocketCount(bet: RouletteBetType): number {
  if (bet === 'STRAIGHT') return 1;
  return bet === 'DOZEN' ? 12 : 18;
}

export function resolveRoulettePayoutBps(config: RouletteConfig): number {
  if (config.payoutBps !== undefined) return config.payoutBps;
  if (config.bet === 'STRAIGHT') {
    return config.lightning ? LIGHTNING_BASE_STRAIGHT_BPS : STRAIGHT_BASE_BPS;
  }
  return config.bet === 'DOZEN' ? 30_000 : 20_000;
}

export function winsRoulette(
  bet: RouletteBetType,
  pocket: number,
  straightNumber: number | null,
  dozen: 1 | 2 | 3 = 1,
): boolean {
  if (bet === 'STRAIGHT') return pocket === straightNumber;
  const housePocket = pocket === 0 || pocket === DOUBLE_ZERO_POCKET || pocket === TRIPLE_ZERO_POCKET;
  if (bet === 'RED') return colorOf(pocket) === 'RED';
  if (bet === 'BLACK') return colorOf(pocket) === 'BLACK';
  if (bet === 'DOZEN') {
    const low = (dozen - 1) * 12 + 1;
    return pocket >= low && pocket <= low + 11;
  }
  if (bet === 'EVEN') return !housePocket && pocket % 2 === 0;
  return !housePocket && pocket % 2 === 1;
}

export function assertRouletteConfig(config: RouletteConfig): void {
  if (config.dozen !== undefined && (config.dozen !== 1 && config.dozen !== 2 && config.dozen !== 3)) {
    throw new Error(`RouletteConfig ${config.id}: Dutzend muss 1, 2 oder 3 sein`);
  }
  if (config.bet === 'STRAIGHT') {
    const number = config.straightNumber;
    if (!Number.isInteger(number) || number === undefined || !wheelPockets(config).includes(number)) {
      throw new Error(`RouletteConfig ${config.id}: Straight-Wette braucht eine aktive Pocket (0..${wheelSize(config) - 1})`);
    }
  }
  if (config.payoutBps !== undefined && (!Number.isSafeInteger(config.payoutBps) || config.payoutBps <= 0)) {
    throw new Error(`RouletteConfig ${config.id}: payoutBps muss eine positive Ganzzahl sein`);
  }
}

export function rouletteAddictionScore(hitRate: number, config: RouletteConfig, rtp: number): number {
  const rtpPenalty = rtp < 0.65 ? (0.65 - rtp) * 50 : 0;
  const straightBonus = config.bet === 'STRAIGHT' ? 16 : 0;
  const magnet = config.mods.some((mod) => mod.target === 'WEIGHT') ? 6 : 0;
  const lightning = config.lightning ? 18 : 0;
  const greens = (wheelSize(config) - ROULETTE_POCKETS) * 3;
  return Math.round(Math.min(100, Math.max(0, hitRate * 0.9 + straightBonus + magnet + lightning + greens - rtpPenalty)));
}
