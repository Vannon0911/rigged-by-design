/** Typen, Regeln und Standardwerte des Wuerfelspiels. */
import type { VaCoinMicro } from '../../economy/vacoin';
import type { ModContract } from '../../rng/bias-policy';
import type { WeightedEntry } from '../../rng/weighted-pool';
import type { NumberManipulation } from '../../rng/number-rng';

export const DICE_FACES = [1, 2, 3, 4, 5, 6] as const;
export type DiceFace = (typeof DICE_FACES)[number];
export type DiceBetType = 'OVER_UNDER' | 'EXACT_SEVEN' | 'DOUBLES_OR_TRIPLES';
export type DiceSide = 'OVER' | 'UNDER';
export type DevilFace = 'SKULL' | 'GOLD' | 'BLANK';

export const DICE_MAX_SAMPLE = 200_000;

export interface DiceConfig {
  readonly id: string;
  readonly diceCount: 2 | 3 | 4;
  readonly bet: DiceBetType;
  readonly side?: DiceSide;
  readonly threshold?: number;
  readonly weights?: Readonly<Partial<Record<DiceFace, number>>>;
  /** Zahlen-Pull auf die gewichtete Wuerfel-Sequenz. */
  readonly manipulation?: NumberManipulation;
  readonly mods: readonly ModContract[];
  readonly devilDie?: boolean;
  /** Fester Auszahlungsfaktor; sonst aus fairen Gewinnchancen auf ~92 % RTP berechnet. */
  readonly payoutBps?: number;
}

export const DEFAULT_DICE_CONFIG: DiceConfig = {
  id: 'dice-street',
  diceCount: 2,
  bet: 'OVER_UNDER',
  side: 'OVER',
  mods: [],
};

export const DEVIL_ENTRIES: readonly WeightedEntry<DevilFace>[] = [
  { value: 'SKULL', weight: 1 },
  { value: 'GOLD', weight: 1 },
  { value: 'BLANK', weight: 4 },
];

export interface DiceRound {
  readonly dice: readonly DiceFace[];
  readonly sum: number;
  readonly baseWin: boolean;
  readonly devil: DevilFace | null;
  readonly win: boolean;
  readonly totalBet: VaCoinMicro;
  readonly payout: VaCoinMicro;
  readonly payoutBps: number;
  readonly isNearMiss: boolean;
}

export interface DiceMathProof {
  readonly sampleSize: number;
  readonly seed: number;
  readonly hitRate: number;
  readonly nearMissRate: number;
  readonly measuredRTP: number;
  readonly theoreticalRTP: number;
  readonly houseEdge: number;
  readonly addictionScore: number;
  readonly payoutBps: number;
  readonly skullRate: number;
  readonly goldRate: number;
  readonly faceDistribution: readonly {
    readonly face: DiceFace;
    readonly theoreticalPct: number;
    readonly measuredPct: number;
    readonly deltaPct: number;
  }[];
}

export function resolveDiceThreshold(config: DiceConfig): number {
  if (config.threshold !== undefined) return config.threshold;
  return config.diceCount === 2 ? 7 : config.diceCount === 3 ? 10 : 14;
}

export function assertDiceConfig(config: DiceConfig): void {
  if (!Number.isInteger(config.diceCount) || config.diceCount < 2 || config.diceCount > 4) {
    throw new Error(`DiceConfig ${config.id}: 2 bis 4 Würfel erlaubt`);
  }
  if (!Number.isFinite(resolveDiceThreshold(config))) {
    throw new Error(`DiceConfig ${config.id}: Schwellenwert ungueltig`);
  }
  if (config.payoutBps !== undefined && (!Number.isSafeInteger(config.payoutBps) || config.payoutBps <= 0)) {
    throw new Error(`DiceConfig ${config.id}: payoutBps muss eine positive Ganzzahl sein`);
  }
  if (config.weights) {
    for (const face of DICE_FACES) {
      const weight = config.weights[face];
      if (weight !== undefined && (!Number.isFinite(weight) || weight <= 0)) {
        throw new Error(`DiceConfig ${config.id}: Gewicht für ${face} muss > 0 sein`);
      }
    }
  }
}

export function winsOn(dice: readonly number[], config: DiceConfig): boolean {
  const sum = dice.reduce((total, face) => total + face, 0);
  if (config.bet === 'OVER_UNDER') {
    return (config.side ?? 'OVER') === 'OVER'
      ? sum > resolveDiceThreshold(config)
      : sum < resolveDiceThreshold(config);
  }
  if (config.bet === 'EXACT_SEVEN') return sum === 7;
  return new Set(dice).size < dice.length;
}

export function isNearMiss(config: DiceConfig, sum: number): boolean {
  if (config.bet === 'OVER_UNDER') return sum === resolveDiceThreshold(config);
  if (config.bet === 'EXACT_SEVEN') return sum === 6 || sum === 8;
  return false;
}

export function diceAddictionScore(
  hitRate: number,
  payoutBps: number,
  nearMissRate: number,
  config: DiceConfig,
  rtp: number,
): number {
  const multiplier = payoutBps / 10_000;
  const rtpPenalty = rtp < 0.65 ? (0.65 - rtp) * 50 : 0;
  const score = hitRate * 0.8 + multiplier * 7 + (config.diceCount - 2) * 4 +
    (config.devilDie ? 8 : 0) + nearMissRate * 0.6 - rtpPenalty;
  return Math.round(Math.min(100, Math.max(0, score)));
}
