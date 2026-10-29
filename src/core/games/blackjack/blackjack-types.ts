/** Blackjack-Vertraege: Haus-Mods, Konfiguration, Tisch-Zustand und Beweisformat. */
import { fromVC, type VaCoinMicro } from '../../economy/vacoin';
import type { Card, DeckModId } from '../deck-engine';

export type BlackjackAction = 'HIT' | 'STAND' | 'DOUBLE';
export type BlackjackModId =
  | 'BJ_DEALER_PUSH_22'
  | 'BJ_SIX_FIVE_BONUS'
  | 'BJ_GREEDY_TENS'
  | 'BJ_FAT_FIVES'
  | 'BJ_FIFTH_ACE'
  | 'BJ_DEATH_CARD'
  | 'BJ_BIASED_DEALER';

export type BlackjackOutcome =
  | 'PLAYER_BLACKJACK'
  | 'PLAYER_WIN'
  | 'DEALER_BUST'
  | 'DEALER_WIN'
  | 'PLAYER_BUST'
  | 'PUSH'
  | 'PUSH_22';

export interface BlackjackMod {
  readonly id: BlackjackModId;
  readonly name: string;
  readonly description: string;
  readonly priceVC: VaCoinMicro;
}

export interface BlackjackConfig {
  readonly id: string;
  readonly decks: number;
  /** Einsatz pro Hand in Mikro-VC. */
  readonly baseBet: VaCoinMicro;
  readonly dealerPush22: boolean;
  /** Gesamtrueckzahlung inkl. Einsatz: 25_000 = 3:2, 22_000 = 6:5. */
  readonly blackjackPayoutBps: number;
  readonly threeCardBonus: boolean;
  readonly deckMods: readonly DeckModId[];
  readonly dealerBias: boolean;
  readonly dealerBiasPeekDepth: number;
}

export interface BlackjackHand {
  readonly cards: readonly Card[];
  readonly total: number;
  readonly soft: boolean;
  readonly blackjack: boolean;
  readonly bust: boolean;
}

export interface BlackjackState {
  readonly phase: 'PLAYER' | 'SETTLED';
  readonly player: BlackjackHand;
  readonly dealer: BlackjackHand;
  readonly dealerHoleHidden: boolean;
  readonly bet: VaCoinMicro;
  readonly totalBet: VaCoinMicro;
  readonly bonusBet: VaCoinMicro;
  readonly bonusPayout: VaCoinMicro;
  readonly payout: VaCoinMicro;
  readonly outcome: BlackjackOutcome | null;
  readonly dealerPush22Applied: boolean;
  readonly dealerBiasUsed: boolean;
  readonly canHit: boolean;
  readonly canStand: boolean;
  readonly canDouble: boolean;
  readonly hits: number;
}

export interface BlackjackRound {
  readonly playerCards: readonly Card[];
  readonly dealerCards: readonly Card[];
  readonly playerTotal: number;
  readonly dealerTotal: number;
  readonly playerBlackjack: boolean;
  readonly dealerBlackjack: boolean;
  readonly outcome: BlackjackOutcome;
  readonly totalBet: VaCoinMicro;
  readonly payout: VaCoinMicro;
  readonly bonusBet: VaCoinMicro;
  readonly bonusPayout: VaCoinMicro;
  readonly dealerPush22Applied: boolean;
  readonly dealerBiasUsed: boolean;
}

export interface BlackjackProof {
  readonly sampleSize: number;
  readonly seed: number;
  readonly hitRate: number;
  readonly pushRate: number;
  readonly blackjackRate: number;
  readonly bustRate: number;
  readonly dealerBustRate: number;
  readonly measuredRTP: number;
  readonly houseEdge: number;
  readonly addictionScore: number;
  readonly bonusRtp: number;
  readonly totalPayout: VaCoinMicro;
  readonly totalBet: VaCoinMicro;
}

export const BLACKJACK_MODS: readonly BlackjackMod[] = [
  {
    id: 'BJ_DEALER_PUSH_22',
    name: 'Dealer-Push bei 22',
    description: 'Dealer ueberkauft sich exakt auf 22: Die Hand gilt als Push statt als Spieler-Gewinn.',
    priceVC: fromVC(30),
  },
  {
    id: 'BJ_SIX_FIVE_BONUS',
    name: '6:5 Payout + 3-Card-Bonus',
    description: 'Blackjack zahlt nur 6:5, dafuer lockt ein süchtig machendes 3-Karten-Bonusfeld.',
    priceVC: fromVC(18),
  },
  {
    id: 'BJ_GREEDY_TENS',
    name: 'Gezinkter Zehner-Schuh',
    description: 'Pro Deck verschwinden zwei 10er - 20/21 wird fuer Spieler deutlich schwerer.',
    priceVC: fromVC(24),
  },
  {
    id: 'BJ_FAT_FIVES',
    name: 'Fette Fuenfen',
    description: 'Pro Deck kommen zwei Extra-5er hinzu: mehr kleine Haende, mehr Dealer-Decks bis 17.',
    priceVC: fromVC(15),
  },
  {
    id: 'BJ_FIFTH_ACE',
    name: 'Fuenftes Ass',
    description: 'Pro Deck kommt ein zusaetzliches Ass in den Schuh: mehr weiche Haende, mehr Blackjacks.',
    priceVC: fromVC(20),
  },
  {
    id: 'BJ_DEATH_CARD',
    name: 'Totenkopf-Sperrkarte',
    description: 'Pro Deck eine legale Zusatzkarte ohne Wert - sie blockiert Zuege, ohne Karten zu duplizieren.',
    priceVC: fromVC(26),
  },
  {
    id: 'BJ_BIASED_DEALER',
    name: 'Dealer-Spaeher',
    description: 'Der Dealer sieht bei drohendem Ueberkauf zwei Karten voraus (peekDepth 2).',
    priceVC: fromVC(35),
  },
];

export const DEFAULT_BLACKJACK_CONFIG: BlackjackConfig = {
  id: 'blackjack-classic',
  decks: 6,
  baseBet: fromVC(0.5),
  dealerPush22: false,
  blackjackPayoutBps: 25_000,
  threeCardBonus: false,
  deckMods: [],
  dealerBias: false,
  dealerBiasPeekDepth: 2,
};

export function applyBlackjackMods(
  base: BlackjackConfig,
  ids: readonly BlackjackModId[],
): BlackjackConfig {
  const deckMods = [...base.deckMods];
  let config: BlackjackConfig = { ...base, deckMods };
  if (ids.includes('BJ_DEALER_PUSH_22')) config = { ...config, dealerPush22: true };
  if (ids.includes('BJ_SIX_FIVE_BONUS')) {
    config = { ...config, blackjackPayoutBps: 22_000, threeCardBonus: true };
  }
  if (ids.includes('BJ_GREEDY_TENS') && !deckMods.includes('DECK_GREEDY_TENS')) {
    config = { ...config, deckMods: [...config.deckMods, 'DECK_GREEDY_TENS'] };
  }
  if (ids.includes('BJ_FAT_FIVES') && !deckMods.includes('DECK_FAT_FIVES')) {
    config = { ...config, deckMods: [...config.deckMods, 'DECK_FAT_FIVES'] };
  }
  if (ids.includes('BJ_FIFTH_ACE') && !deckMods.includes('DECK_FIFTH_ACE')) {
    config = { ...config, deckMods: [...config.deckMods, 'DECK_FIFTH_ACE'] };
  }
  if (ids.includes('BJ_DEATH_CARD') && !deckMods.includes('DECK_DEATH_CARD')) {
    config = { ...config, deckMods: [...config.deckMods, 'DECK_DEATH_CARD'] };
  }
  if (ids.includes('BJ_BIASED_DEALER')) config = { ...config, dealerBias: true };
  return config;
}
