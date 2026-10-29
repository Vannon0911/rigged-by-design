/** Tisch-Labor-Modell: einheitliche Beweiszeilen fuer Huetchen, Wuerfel, Roulette, Blackjack und Poker. */
import { fromVC } from '../../core/economy/vacoin';
import { DEFAULT_BLACKJACK_CONFIG, applyBlackjackMods } from '../../core/games/blackjack/blackjack-types';
import { evaluateBlackjackConfig } from '../../core/games/blackjack/blackjack-evaluator';
import { DEFAULT_DICE_CONFIG, evaluateDiceConfig } from '../../core/games/dice/dice-engine';
import { evaluatePokerConfig } from '../../core/games/poker/poker-math';
import { DEFAULT_POKER_CONFIG, resolvePokerConfig } from '../../core/games/poker/poker-types';
import { evaluateRouletteConfig } from '../../core/games/roulette/roulette-engine';
import { DEFAULT_ROULETTE_CONFIG, type RouletteConfig } from '../../core/games/roulette/roulette-types';
import { DEFAULT_SHELL_CONFIG, evaluateShellConfig } from '../../core/games/shell/shell-engine';
import type { ModContract } from '../../core/rng/bias-policy';
import type { DeterminismReport } from './lab-model';

export type TableGameId = 'SHELL' | 'DICE' | 'ROULETTE' | 'BLACKJACK' | 'POKER';
export type TableVariant = 'FAIR' | 'RIGGED';

export const TABLE_LAB_GAMES: readonly { id: TableGameId; name: string; note: string }[] = [
  { id: 'SHELL', name: 'Hütchenspiel', note: '3 Becher, 1 Kugel, 2.8x. Jeder Becher ist eine echte Ziehung.' },
  { id: 'DICE', name: 'Street Craps', note: 'Zwei W6, Over/Under. Teufelswürfel ist der Haus-Mod.' },
  { id: 'ROULETTE', name: 'Roulette', note: '37 Pockets, optional 00/000 und Blitz-Pockets - Rot/Schwarz 1:1.' },
  { id: 'BLACKJACK', name: 'Blackjack', note: '6 Decks, Basisstrategie, Dealer steht auf 17.' },
  { id: 'POKER', name: 'Casino Hold’em', note: '5 Karten gegen den Dealer, Dealer braucht ein Paar.' },
];

const MAGNET: ModContract = {
  id: 'roulette-magnet',
  name: 'Kessel-Magnet',
  target: 'WEIGHT',
  minBound: 1,
  maxBound: 3,
  costVC: fromVC(1),
  description: 'Gruene Null schwerer gewichtet',
  value: 3,
  symbols: ['0'],
};

export interface TableProofView {
  readonly game: TableGameId;
  readonly label: string;
  readonly variant: TableVariant;
  readonly sampleSize: number;
  readonly seed: number;
  readonly hitRate: number;
  readonly rtp: number;
  readonly houseEdge: number;
  readonly addictionScore: number;
  readonly extras: readonly { readonly label: string; readonly value: string }[];
}

function pct(value: number): string {
  return `${value.toFixed(2)} %`;
}

export function runTableProof(
  game: TableGameId,
  seed: number,
  sampleSize: number,
  variant: TableVariant = 'FAIR',
): TableProofView {
  const rigged = variant === 'RIGGED';
  if (game === 'SHELL') {
    const config = { ...DEFAULT_SHELL_CONFIG, cups: rigged ? 5 as const : 3 as const };
    const proof = evaluateShellConfig(config, sampleSize, seed);
    return {
      game, label: 'Hütchenspiel', variant, sampleSize, seed,
      hitRate: proof.hitRate, rtp: proof.measuredRTP, houseEdge: proof.houseEdge,
      addictionScore: proof.addictionScore,
      extras: [
        { label: 'Auszahlung', value: `${(proof.multiplierBps / 10_000).toFixed(2)}x` },
        { label: 'Near-Miss', value: pct(proof.nearMissRate) },
        { label: 'Heat / Spin', value: proof.heatPerSpin.toFixed(2) },
      ],
    };
  }
  if (game === 'DICE') {
    const proof = evaluateDiceConfig({ ...DEFAULT_DICE_CONFIG, devilDie: rigged }, sampleSize, seed);
    return {
      game, label: 'Street Craps', variant, sampleSize, seed,
      hitRate: proof.hitRate, rtp: proof.measuredRTP, houseEdge: proof.houseEdge,
      addictionScore: proof.addictionScore,
      extras: [
        { label: 'Auszahlung', value: `${(proof.payoutBps / 10_000).toFixed(2)}x` },
        { label: 'Near-Miss', value: pct(proof.nearMissRate) },
        { label: 'Totenkopf', value: pct(proof.skullRate) },
      ],
    };
  }
  if (game === 'ROULETTE') {
    const config: RouletteConfig = {
      ...DEFAULT_ROULETTE_CONFIG,
      id: 'lab-roulette',
      bet: 'STRAIGHT',
      straightNumber: 17,
      mods: rigged ? [MAGNET] : [],
      doubleZero: rigged,
      tripleZero: rigged,
      lightning: rigged,
    };
    const proof = evaluateRouletteConfig(config, sampleSize, seed);
    return {
      game, label: 'Roulette', variant, sampleSize, seed,
      hitRate: proof.hitRate, rtp: proof.measuredRTP, houseEdge: proof.houseEdge,
      addictionScore: proof.addictionScore,
      extras: [
        { label: 'Kessel-Pockets', value: `${proof.wheelSize}` },
        { label: 'Blitz-Treffer', value: pct(proof.lightningHitRate) },
        { label: 'Theorie-RTP', value: pct(proof.theoreticalRTP * 100) },
        { label: 'Max-Payout', value: `${(proof.maxPayoutBps / 10_000).toFixed(0)}x` },
      ],
    };
  }
  if (game === 'BLACKJACK') {
    const config = rigged
      ? applyBlackjackMods(DEFAULT_BLACKJACK_CONFIG, ['BJ_DEALER_PUSH_22', 'BJ_GREEDY_TENS', 'BJ_BIASED_DEALER'])
      : DEFAULT_BLACKJACK_CONFIG;
    const proof = evaluateBlackjackConfig(config, sampleSize, seed);
    return {
      game, label: 'Blackjack', variant, sampleSize, seed,
      hitRate: proof.hitRate, rtp: proof.measuredRTP, houseEdge: proof.houseEdge,
      addictionScore: proof.addictionScore,
      extras: [
        { label: 'Blackjack', value: pct(proof.blackjackRate) },
        { label: 'Push', value: pct(proof.pushRate) },
        { label: 'Überkauft', value: pct(proof.bustRate) },
      ],
    };
  }
  const config = rigged
    ? resolvePokerConfig(DEFAULT_POKER_CONFIG, ['POKER_SIX_CARD_DEAL', 'POKER_RIVER_BLUFF_TAX'])
    : DEFAULT_POKER_CONFIG;
  const proof = evaluatePokerConfig(config, sampleSize, seed);
  return {
    game, label: 'Casino Hold’em', variant, sampleSize, seed,
    hitRate: proof.hitRate, rtp: proof.measuredRTP, houseEdge: proof.houseEdge,
    addictionScore: proof.addictionScore,
    extras: [
      { label: 'Dealer qualifiziert', value: pct(proof.dealerQualifyRate) },
      { label: 'Flush+', value: pct(proof.flushPlusRate) },
      { label: 'Push', value: pct(proof.pushRate) },
    ],
  };
}

/** Zwei identische Seeds muessen exakt dieselben Kennzahlen liefern. */
export function verifyTableDeterminism(
  game: TableGameId,
  seed: number,
  spins = 1000,
  variant: TableVariant = 'FAIR',
): DeterminismReport {
  const first = JSON.stringify(runTableProof(game, seed, spins, variant));
  const second = JSON.stringify(runTableProof(game, seed, spins, variant));
  return first === second
    ? { spins, identical: spins, mismatchAt: null }
    : { spins, identical: 0, mismatchAt: 1 };
}
