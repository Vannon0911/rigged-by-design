/** Blackjack-Beweis: Basisstrategie-Autoplay, echte Haende, RTP und Sucht-Score. */
import { addVC, fromVC, ZERO_VC, type VaCoinMicro } from '../../economy/vacoin';
import { Prng } from '../../rng/prng';
import { BlackjackTable } from './blackjack-engine';
import { basicStrategy, blackjackAddictionScore } from './blackjack-rules';
import {
  type BlackjackConfig,
  type BlackjackProof,
  type BlackjackRound,
  type BlackjackState,
} from './blackjack-types';

const MAX_SAMPLE = 100_000;

function toRound(state: BlackjackState): BlackjackRound {
  return {
    playerCards: [...state.player.cards],
    dealerCards: [...state.dealer.cards],
    playerTotal: state.player.total,
    dealerTotal: state.dealer.total,
    playerBlackjack: state.player.blackjack,
    dealerBlackjack: state.dealer.blackjack,
    outcome: state.outcome ?? 'PUSH',
    totalBet: state.totalBet,
    payout: state.payout,
    bonusBet: state.bonusBet,
    bonusPayout: state.bonusPayout,
    dealerPush22Applied: state.dealerPush22Applied,
    dealerBiasUsed: state.dealerBiasUsed,
  };
}

export function playBlackjackAuto(
  config: BlackjackConfig,
  prng: Prng,
  bet: VaCoinMicro,
  bonusBet: VaCoinMicro = ZERO_VC,
  allowDouble = true,
): BlackjackRound {
  const table = new BlackjackTable(config, prng);
  let state = table.deal(bet, bonusBet);
  let guard = 0;
  while (state.phase === 'PLAYER' && guard < 24) {
    guard += 1;
    const action = basicStrategy(state.player, state.dealer.cards[0]!, state.canDouble && allowDouble);
    state = action === 'DOUBLE' ? table.double() : action === 'HIT' ? table.hit() : table.stand();
  }
  return toRound(state);
}

export function evaluateBlackjackConfig(
  config: BlackjackConfig,
  sampleSize = 10_000,
  seed = 42,
): BlackjackProof {
  if (!Number.isSafeInteger(sampleSize) || sampleSize <= 0 || sampleSize > MAX_SAMPLE) {
    throw new Error(`evaluateBlackjackConfig: sampleSize muss 1..${MAX_SAMPLE} sein`);
  }
  if (!Number.isSafeInteger(seed)) throw new Error('evaluateBlackjackConfig: seed muss eine Ganzzahl sein');

  const prng = new Prng(seed);
  const table = new BlackjackTable(config, prng);
  const bet = fromVC(1);
  const bonusBet = config.threeCardBonus ? fromVC(0.2) : ZERO_VC;
  let wins = 0;
  let pushes = 0;
  let naturals = 0;
  let busts = 0;
  let dealerBusts = 0;
  let totalPayout = ZERO_VC;
  let totalBet = ZERO_VC;
  let bonusPayout = ZERO_VC;
  let bonusWager = ZERO_VC;

  const playOne = (): BlackjackRound => {
    let state = table.deal(bet, bonusBet);
    while (state.phase === 'PLAYER') {
      const action = basicStrategy(state.player, state.dealer.cards[0]!, state.canDouble);
      state = action === 'DOUBLE' ? table.double() : action === 'HIT' ? table.hit() : table.stand();
    }
    return toRound(state);
  };

  for (let round = 0; round < sampleSize; round += 1) {
    const result = playOne();
    if (result.outcome === 'PLAYER_WIN' || result.outcome === 'PLAYER_BLACKJACK' || result.outcome === 'DEALER_BUST') {
      wins += 1;
    }
    if (result.outcome === 'PUSH' || result.outcome === 'PUSH_22') pushes += 1;
    if (result.playerBlackjack) naturals += 1;
    if (result.outcome === 'PLAYER_BUST') busts += 1;
    if (result.outcome === 'DEALER_BUST' || result.outcome === 'PUSH_22') dealerBusts += 1;
    totalPayout = addVC(totalPayout, result.payout);
    totalBet = addVC(totalBet, result.totalBet);
    bonusPayout = addVC(bonusPayout, result.bonusPayout);
    bonusWager = addVC(bonusWager, result.bonusBet);
  }

  const hitRate = (wins / sampleSize) * 100;
  const pushRate = (pushes / sampleSize) * 100;
  const blackjackRate = (naturals / sampleSize) * 100;
  const measuredRTP = totalBet > 0 ? totalPayout / totalBet : 0;
  return {
    sampleSize,
    seed,
    hitRate,
    pushRate,
    blackjackRate,
    bustRate: (busts / sampleSize) * 100,
    dealerBustRate: (dealerBusts / sampleSize) * 100,
    measuredRTP,
    houseEdge: 1 - measuredRTP,
    addictionScore: blackjackAddictionScore(hitRate, pushRate, blackjackRate, config, measuredRTP),
    bonusRtp: bonusWager > 0 ? bonusPayout / bonusWager : 0,
    totalPayout,
    totalBet,
  };
}
