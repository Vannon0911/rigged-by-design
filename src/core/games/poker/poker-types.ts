/** Poker-Vertraege: Casino-Hold'em-Regeln, Sucht-Mods, Paytables und Beweisformat. */
import { fromVC, type VaCoinMicro } from '../../economy/vacoin';
import type { DeckModId } from '../../rng/deck-cards';
import type { HandCategory, HandRank } from './poker-evaluator';

export type PokerModId = 'POKER_SIX_CARD_DEAL' | 'POKER_RIVER_BLUFF_TAX' | 'POKER_JACKPOT_FIELD';
export type PokerOutcome = 'PLAYER_WIN' | 'DEALER_WIN' | 'PUSH' | 'DEALER_NOT_QUALIFIED';
export type PokerTableTier = 'STANDARD' | 'SIX_CARD_SOFT';

export interface PokerMod {
  readonly id: PokerModId;
  readonly name: string;
  readonly description: string;
  readonly priceVC: VaCoinMicro;
}

export interface PokerConfig {
  readonly id: string;
  readonly ante: VaCoinMicro;
  readonly playerCards: 5 | 6;
  readonly tableTier: PokerTableTier;
  readonly dealerQualifyPair: boolean;
  readonly riverTaxBps: number;
  readonly jackpotBonus: boolean;
  /** Legale Zusatzkarten im Schuh, z.B. Extra-Ass oder Totenkopf-Sperrkarte. */
  readonly deckMods?: readonly DeckModId[];
  readonly mods: readonly PokerModId[];
}

export interface PokerRound {
  readonly playerCards: readonly import('../deck-engine').Card[];
  readonly dealerCards: readonly import('../deck-engine').Card[];
  readonly playerRank: HandRank;
  readonly dealerRank: HandRank;
  readonly dealerQualified: boolean;
  readonly outcome: PokerOutcome;
  readonly ante: VaCoinMicro;
  readonly riverTax: VaCoinMicro;
  readonly totalBet: VaCoinMicro;
  readonly bonusBet: VaCoinMicro;
  readonly payout: VaCoinMicro;
  readonly bonusPayout: VaCoinMicro;
  readonly sixCard: boolean;
  readonly isNearMiss: boolean;
}

export interface PokerProof {
  readonly sampleSize: number;
  readonly seed: number;
  readonly hitRate: number;
  readonly pushRate: number;
  readonly dealerQualifyRate: number;
  readonly flushPlusRate: number;
  readonly measuredRTP: number;
  readonly houseEdge: number;
  readonly addictionScore: number;
  readonly categoryDistribution: readonly {
    readonly category: HandCategory;
    readonly label: string;
    readonly count: number;
    readonly pct: number;
  }[];
  readonly totalPayout: VaCoinMicro;
  readonly totalBet: VaCoinMicro;
}

export const POKER_MODS: readonly PokerMod[] = [
  {
    id: 'POKER_SIX_CARD_DEAL',
    name: '6-Karten-Luxus-Deal',
    description: 'Spieler bekommt 6 Karten und waehlt die beste Hand. Paare und Zwei-Paare zahlen weniger.',
    priceVC: fromVC(28),
  },
  {
    id: 'POKER_RIVER_BLUFF_TAX',
    name: 'River-Bluff-Steuer',
    description: 'Pflichteinsatz vor der letzten Karte verdoppelt den Pot - mehr Action, schlechterer RTP.',
    priceVC: fromVC(22),
  },
  {
    id: 'POKER_JACKPOT_FIELD',
    name: 'Jackpot-Bonusfeld',
    description: 'Optionale Nebenwette auf die eigene Hand bis 500x Royal Flush.',
    priceVC: fromVC(40),
  },
];

/** Gewinn-Multiplikator auf den Ante (ohne Einsatzrueckgabe). */
export const ANTE_BONUS_BPS: readonly number[] = [
  0, 20_000, 30_000, 40_000, 50_000, 60_000, 80_000, 250_000, 600_000, 1_500_000,
];
export const SIX_CARD_ANTE_BONUS_BPS: readonly number[] = [
  0, 2_000, 8_000, 15_000, 30_000, 40_000, 50_000, 200_000, 500_000, 1_000_000,
];
/** Gesamtrueckzahlung der Jackpot-Nebenwette inkl. Einsatz. */
export const JACKPOT_RETURN_BPS: readonly number[] = [
  0, 1_500, 3_000, 5_000, 10_000, 20_000, 40_000, 100_000, 250_000, 500_000,
];

export const DEFAULT_POKER_CONFIG: PokerConfig = {
  id: 'poker-casino-holdem',
  ante: fromVC(0.5),
  playerCards: 5,
  tableTier: 'STANDARD',
  dealerQualifyPair: true,
  riverTaxBps: 0,
  jackpotBonus: false,
  deckMods: [],
  mods: [],
};

export function resolvePokerConfig(base: PokerConfig, mods: readonly PokerModId[]): PokerConfig {
  const sixCard = mods.includes('POKER_SIX_CARD_DEAL');
  return {
    ...base,
    playerCards: sixCard ? 6 : base.playerCards,
    tableTier: sixCard ? 'SIX_CARD_SOFT' : base.tableTier,
    riverTaxBps: mods.includes('POKER_RIVER_BLUFF_TAX') ? 10_000 : base.riverTaxBps,
    jackpotBonus: mods.includes('POKER_JACKPOT_FIELD') || base.jackpotBonus,
    mods: [...mods],
  };
}

export function anteBonusBps(config: PokerConfig, category: HandCategory): number {
  const table = config.tableTier === 'SIX_CARD_SOFT' ? SIX_CARD_ANTE_BONUS_BPS : ANTE_BONUS_BPS;
  return table[category] ?? 0;
}

export function pokerAddictionScore(
  hitRate: number,
  pushRate: number,
  flushPlusRate: number,
  config: PokerConfig,
  rtp: number,
): number {
  const rtpPenalty = rtp < 0.65 ? (0.65 - rtp) * 50 : 0;
  const score = hitRate * 0.7 + pushRate * 0.5 + flushPlusRate * 1.2 +
    (config.playerCards === 6 ? 10 : 0) + (config.jackpotBonus ? 10 : 0) +
    (config.riverTaxBps > 0 ? 8 : 0) - rtpPenalty;
  return Math.round(Math.min(100, Math.max(0, score)));
}
