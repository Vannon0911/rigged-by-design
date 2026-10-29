/** Casino Hold'em gegen den Dealer: Ante, optionale Jackpot-Wette und River-Steuer. */
import { addVC, mulVC, ZERO_VC, type VaCoinMicro } from '../../economy/vacoin';
import type { Prng } from '../../rng/prng';
import { Shoe } from '../deck-engine';
import { evaluateHand } from './poker-evaluator';
import {
  JACKPOT_RETURN_BPS,
  anteBonusBps,
  type PokerConfig,
  type PokerOutcome,
  type PokerRound,
} from './poker-types';

export {
  ANTE_BONUS_BPS,
  DEFAULT_POKER_CONFIG,
  JACKPOT_RETURN_BPS,
  POKER_MODS,
  SIX_CARD_ANTE_BONUS_BPS,
  anteBonusBps,
  resolvePokerConfig,
  type PokerConfig,
  type PokerMod,
  type PokerModId,
  type PokerOutcome,
  type PokerProof,
  type PokerRound,
  type PokerTableTier,
} from './poker-types';

const MAX_PLAYER_CARDS = 6;

export function playPokerRound(
  config: PokerConfig,
  prng: Prng,
  ante: VaCoinMicro,
  bonusBet: VaCoinMicro = ZERO_VC,
): PokerRound {
  if (!Number.isSafeInteger(ante) || ante <= 0) throw new Error('playPokerRound: Ante muss > 0 sein');
  if (!Number.isSafeInteger(bonusBet) || bonusBet < 0) throw new Error('playPokerRound: Bonus-Einsatz ungueltig');
  if (config.playerCards < 5 || config.playerCards > MAX_PLAYER_CARDS) {
    throw new Error(`PokerConfig ${config.id}: 5 oder 6 Spielerkarten erlaubt`);
  }

  const shoe = new Shoe(prng, 6, config.deckMods ?? []);
  const playerCards = Array.from({ length: config.playerCards }, () => shoe.draw());
  const dealerCards = Array.from({ length: 5 }, () => shoe.draw());
  const playerRank = evaluateHand(playerCards);
  const dealerRank = evaluateHand(dealerCards);
  const dealerQualified = !config.dealerQualifyPair || dealerRank.category >= 1;
  const riverTax = mulVC(ante, config.riverTaxBps);
  const totalBet = addVC(ante, riverTax);

  let outcome: PokerOutcome;
  let payout = ZERO_VC;
  if (playerRank.score > dealerRank.score) {
    if (dealerQualified) {
      outcome = 'PLAYER_WIN';
      payout = addVC(totalBet, mulVC(ante, anteBonusBps(config, playerRank.category)));
    } else {
      outcome = 'DEALER_NOT_QUALIFIED';
      payout = totalBet;
    }
  } else if (playerRank.score === dealerRank.score) {
    outcome = 'PUSH';
    payout = totalBet;
  } else {
    outcome = 'DEALER_WIN';
  }

  const bonusPayout = config.jackpotBonus && bonusBet > ZERO_VC
    ? mulVC(bonusBet, JACKPOT_RETURN_BPS[playerRank.category] ?? 0)
    : ZERO_VC;

  return {
    playerCards,
    dealerCards,
    playerRank,
    dealerRank,
    dealerQualified,
    outcome,
    ante,
    riverTax,
    totalBet,
    bonusBet,
    payout,
    bonusPayout,
    sixCard: config.playerCards === 6,
    isNearMiss: playerRank.category >= 2 && outcome !== 'PLAYER_WIN',
  };
}
