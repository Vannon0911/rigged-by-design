/** Poker-Beweis: Kategorienverteilung, Dealer-Qualifikation, RTP und Suchtdruck. */
import { addVC, fromVC, ZERO_VC } from '../../economy/vacoin';
import { Prng } from '../../rng/prng';
import { playPokerRound } from './poker-engine';
import { HAND_CATEGORY_NAMES, type HandCategory } from './poker-evaluator';
import { pokerAddictionScore, type PokerConfig, type PokerProof } from './poker-types';

const MAX_SAMPLE = 100_000;

export function evaluatePokerConfig(config: PokerConfig, sampleSize = 10_000, seed = 42): PokerProof {
  if (!Number.isSafeInteger(sampleSize) || sampleSize <= 0 || sampleSize > MAX_SAMPLE) {
    throw new Error(`evaluatePokerConfig: sampleSize muss 1..${MAX_SAMPLE} sein`);
  }
  if (!Number.isSafeInteger(seed)) throw new Error('evaluatePokerConfig: seed muss eine Ganzzahl sein');

  const prng = new Prng(seed);
  const ante = fromVC(1);
  const bonusBet = config.jackpotBonus ? fromVC(0.2) : ZERO_VC;
  const counts = Array.from({ length: 10 }, () => 0);
  let wins = 0;
  let pushes = 0;
  let qualified = 0;
  let flushPlus = 0;
  let totalPayout = ZERO_VC;
  let totalBet = ZERO_VC;

  for (let round = 0; round < sampleSize; round += 1) {
    const result = playPokerRound(config, prng, ante, bonusBet);
    if (result.outcome === 'PLAYER_WIN') wins += 1;
    if (result.outcome === 'PUSH' || result.outcome === 'DEALER_NOT_QUALIFIED') pushes += 1;
    if (result.dealerQualified) qualified += 1;
    if (result.playerRank.category >= 5) flushPlus += 1;
    counts[result.playerRank.category] = (counts[result.playerRank.category] ?? 0) + 1;
    totalPayout = addVC(totalPayout, result.payout);
    totalBet = addVC(totalBet, result.totalBet);
  }

  const hitRate = (wins / sampleSize) * 100;
  const pushRate = (pushes / sampleSize) * 100;
  const flushPlusRate = (flushPlus / sampleSize) * 100;
  const measuredRTP = totalBet > 0 ? totalPayout / totalBet : 0;

  return {
    sampleSize,
    seed,
    hitRate,
    pushRate,
    dealerQualifyRate: (qualified / sampleSize) * 100,
    flushPlusRate,
    measuredRTP,
    houseEdge: 1 - measuredRTP,
    addictionScore: pokerAddictionScore(hitRate, pushRate, flushPlusRate, config, measuredRTP),
    categoryDistribution: counts.map((count, category) => ({
      category: category as HandCategory,
      label: HAND_CATEGORY_NAMES[category]!,
      count,
      pct: (count / sampleSize) * 100,
    })),
    totalPayout,
    totalBet,
  };
}
