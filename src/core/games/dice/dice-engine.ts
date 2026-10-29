/** Street Craps: gewichtete Würfel, drei Wettarten, Teufelswürfel und RTP-Beweis. */
import { ZERO_VC, addVC, fromVC, mulVC, type VaCoinMicro } from '../../economy/vacoin';
import { applyWeightBias } from '../../rng/bias-policy';
import { Prng } from '../../rng/prng';
import { rollWeightedNumber } from '../../rng/number-rng';
import { manipulationForBand } from '../../rng/number-band';
import { getTheoreticalProbabilities } from '../../rng/weighted-pool';
import {
  DEVIL_ENTRIES,
  DICE_FACES,
  DICE_MAX_SAMPLE,
  assertDiceConfig,
  diceAddictionScore,
  isNearMiss,
  resolveDiceThreshold,
  winsOn,
  type DevilFace,
  type DiceConfig,
  type DiceFace,
  type DiceMathProof,
  type DiceRound,
} from './dice-types';

export {
  DEFAULT_DICE_CONFIG,
  DEVIL_ENTRIES,
  DICE_FACES,
  resolveDiceThreshold,
  type DevilFace,
  type DiceBetType,
  type DiceConfig,
  type DiceFace,
  type DiceMathProof,
  type DiceRound,
  type DiceSide,
} from './dice-types';

const TARGET_RTP = 0.92;
function enumerate(diceCount: number, visit: (dice: readonly number[]) => void): void {
  const dice: number[] = [];
  const walk = (index: number): void => {
    if (index === diceCount) {
      visit([...dice]);
      return;
    }
    for (const face of DICE_FACES) {
      dice.push(face);
      walk(index + 1);
      dice.pop();
    }
  };
  walk(0);
}

const probabilityCache = new Map<string, number>();

function fairWinProbability(config: DiceConfig): number {
  const key = `${config.diceCount}|${config.bet}|${resolveDiceThreshold(config)}|${config.side ?? 'OVER'}`;
  const cached = probabilityCache.get(key);
  if (cached !== undefined) return cached;
  let wins = 0;
  let total = 0;
  enumerate(config.diceCount, (dice) => {
    total += 1;
    if (winsOn(dice, config)) wins += 1;
  });
  const probability = total === 0 ? 0 : wins / total;
  probabilityCache.set(key, probability);
  return probability;
}

export function resolveDicePayoutBps(config: DiceConfig): number {
  assertDiceConfig(config);
  if (config.payoutBps !== undefined) return config.payoutBps;
  const probability = fairWinProbability(config);
  if (probability <= 0) throw new Error(`DiceConfig ${config.id}: Wettart ist mathematisch unmoeglich`);
  return Math.max(100, Math.round((TARGET_RTP / probability) * 100) * 100);
}

export function getDiceWeights(config: DiceConfig): Readonly<Record<string, number>> {
  const base: Record<string, number> = {};
  for (const face of DICE_FACES) base[String(face)] = config.weights?.[face] ?? 100;
  return applyWeightBias(base, config.mods);
}

export function rollDice(config: DiceConfig, prng: Prng): DiceFace[] {
  const weights = getDiceWeights(config);
  const entries = DICE_FACES.map((face) => ({ value: face, weight: weights[String(face)]! }));
  const manipulation = manipulationForBand(entries, config.manipulation ?? {});
  const dice: DiceFace[] = [];
  for (let index = 0; index < config.diceCount; index += 1) {
    dice.push(rollWeightedNumber(entries, manipulation, prng).value);
  }
  return dice;
}

export function playDiceRound(config: DiceConfig, prng: Prng, bet: VaCoinMicro): DiceRound {
  assertDiceConfig(config);
  if (!Number.isSafeInteger(bet) || bet <= 0) throw new Error('playDiceRound: Einsatz muss > 0 sein');

  const payoutBps = resolveDicePayoutBps(config);
  const dice = rollDice(config, prng);
  const sum = dice.reduce((total, face) => total + face, 0);
  const baseWin = winsOn(dice, config);
  let payout = baseWin ? mulVC(bet, payoutBps) : ZERO_VC;

  let devil: DevilFace | null = null;
  if (config.devilDie) {
    devil = rollWeightedNumber(DEVIL_ENTRIES, manipulationForBand(DEVIL_ENTRIES, config.manipulation ?? {}), prng).value;
    if (devil === 'SKULL') payout = ZERO_VC;
    else if (devil === 'GOLD') payout = mulVC(payout, 30_000);
  }

  return {
    dice,
    sum,
    baseWin,
    devil,
    win: payout > ZERO_VC,
    totalBet: bet,
    payout,
    payoutBps,
    isNearMiss: !baseWin && isNearMiss(config, sum),
  };
}

export function evaluateDiceConfig(config: DiceConfig, sampleSize = 10_000, seed = 42): DiceMathProof {
  assertDiceConfig(config);
  if (!Number.isSafeInteger(sampleSize) || sampleSize <= 0 || sampleSize > DICE_MAX_SAMPLE) {
    throw new Error(`evaluateDiceConfig: sampleSize muss 1..${DICE_MAX_SAMPLE} sein`);
  }
  if (!Number.isSafeInteger(seed)) throw new Error('evaluateDiceConfig: seed muss eine Ganzzahl sein');

  const prng = new Prng(seed);
  const bet = fromVC(1);
  const payoutBps = resolveDicePayoutBps(config);
  const weights = getDiceWeights(config);
  const entries = DICE_FACES.map((face) => ({ value: face, weight: weights[String(face)]! }));
  const theoretical = getTheoreticalProbabilities(entries);
  const counts = Object.fromEntries(DICE_FACES.map((face) => [face, 0])) as Record<DiceFace, number>;

  let hits = 0;
  let nearMisses = 0;
  let skulls = 0;
  let golds = 0;
  let totalPayout = ZERO_VC;
  let totalBet = ZERO_VC;

  for (let round = 0; round < sampleSize; round += 1) {
    const result = playDiceRound(config, prng, bet);
    if (result.win) hits += 1;
    if (result.isNearMiss) nearMisses += 1;
    if (result.devil === 'SKULL') skulls += 1;
    if (result.devil === 'GOLD') golds += 1;
    for (const face of result.dice) counts[face] += 1;
    totalPayout = addVC(totalPayout, result.payout);
    totalBet = addVC(totalBet, result.totalBet);
  }

  const hitRate = (hits / sampleSize) * 100;
  const nearMissRate = (nearMisses / sampleSize) * 100;
  const measuredRTP = totalPayout / totalBet;
  const rolledDice = sampleSize * config.diceCount;
  const faceDistribution = DICE_FACES.map((face) => {
    const theoreticalPct = (theoretical.get(face) ?? 0) * 100;
    const measuredPct = (counts[face] / rolledDice) * 100;
    return { face, theoreticalPct, measuredPct, deltaPct: measuredPct - theoreticalPct };
  });

  return {
    sampleSize,
    seed,
    hitRate,
    nearMissRate,
    measuredRTP,
    theoreticalRTP: fairWinProbability(config) * (payoutBps / 10_000),
    houseEdge: 1 - measuredRTP,
    addictionScore: diceAddictionScore(hitRate, payoutBps, nearMissRate, config, measuredRTP),
    payoutBps,
    skullRate: (skulls / sampleSize) * 100,
    goldRate: (golds / sampleSize) * 100,
    faceDistribution,
  };
}
