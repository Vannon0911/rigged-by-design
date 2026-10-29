/** Roulette-Engine: dynamischer Kessel, Bias-Grenzen, Lightning und RTP-Beweis. */
import { addVC, fromVC, mulVC, ZERO_VC, type VaCoinMicro } from '../../economy/vacoin';
import { applyWeightBias } from '../../rng/bias-policy';
import { Prng } from '../../rng/prng';
import { rollWeightedNumber } from '../../rng/number-rng';
import { manipulationForBand } from '../../rng/number-band';
import { getTheoreticalProbabilities } from '../../rng/weighted-pool';
import {
  LIGHTNING_MULTIPLIERS_BPS,
  assertRouletteConfig,
  colorOf,
  pocketCount,
  pocketLabel,
  resolveRoulettePayoutBps,
  rouletteAddictionScore,
  wheelPockets,
  wheelSize,
  winsRoulette,
  type RouletteConfig,
  type RouletteProof,
  type RouletteRound,
} from './roulette-types';
import { expectedLightningExtraRtp, rollLightningPockets } from './roulette-lightning';

export {
  DEFAULT_ROULETTE_CONFIG,
  RED_NUMBERS,
  ROULETTE_POCKETS,
  colorOf,
  pocketLabel,
  resolveRoulettePayoutBps,
  wheelPockets,
  wheelSize,
  winsRoulette,
  type RouletteBetType,
  type RouletteColor,
  type RouletteConfig,
  type RouletteProof,
  type RouletteRound,
} from './roulette-types';
export { expectedLightningExtraRtp, rollLightningPockets } from './roulette-lightning';

const MAX_SAMPLE = 200_000;
const BPS = 10_000;

export function getPocketWeights(config: RouletteConfig): Record<string, number> {
  const base: Record<string, number> = {};
  for (const pocket of wheelPockets(config)) {
    base[String(pocket)] = config.pocketWeights?.[String(pocket)] ?? 100;
  }
  return applyWeightBias(base, config.mods);
}

export function spinRoulettePocket(config: RouletteConfig, prng: Prng): number {
  const weights = getPocketWeights(config);
  const entries = wheelPockets(config).map((pocket) => ({
    value: pocket,
    weight: weights[String(pocket)]!,
  }));
  return rollWeightedNumber(entries, manipulationForBand(entries, config.manipulation ?? {}), prng).value;
}

export function playRouletteRound(config: RouletteConfig, prng: Prng, bet: VaCoinMicro): RouletteRound {
  assertRouletteConfig(config);
  if (!Number.isSafeInteger(bet) || bet <= 0) throw new Error('playRouletteRound: Einsatz muss > 0 sein');
  const pocket = spinRoulettePocket(config, prng);
  const lightning = rollLightningPockets(config, prng);
  const straightNumber = config.straightNumber ?? null;
  const win = winsRoulette(config.bet, pocket, straightNumber, config.dozen);
  const basePayoutBps = resolveRoulettePayoutBps(config);
  const lucky = config.bet === 'STRAIGHT' && win
    ? lightning.find((entry) => entry.pocket === pocket) ?? null
    : null;
  const payoutBps = lucky?.multiplierBps ?? basePayoutBps;
  const color = colorOf(pocket);
  const isNearMiss = !win && (
    config.bet === 'STRAIGHT'
      ? pocket >= 37 || Math.abs(pocket - (straightNumber ?? 0)) === 1
      : color === 'GREEN'
  );
  return {
    pocket,
    pocketLabel: pocketLabel(pocket),
    wheelSize: wheelSize(config),
    color,
    bet: config.bet,
    straightNumber,
    win,
    totalBet: bet,
    payout: win ? mulVC(bet, payoutBps) : ZERO_VC,
    payoutBps,
    isNearMiss,
    lightningPockets: lightning,
    lightningMultiplierBps: lucky?.multiplierBps ?? null,
  };
}

export function evaluateRouletteConfig(
  config: RouletteConfig,
  sampleSize = 10_000,
  seed = 42,
): RouletteProof {
  assertRouletteConfig(config);
  if (!Number.isSafeInteger(sampleSize) || sampleSize <= 0 || sampleSize > MAX_SAMPLE) {
    throw new Error(`evaluateRouletteConfig: sampleSize muss 1..${MAX_SAMPLE} sein`);
  }
  if (!Number.isSafeInteger(seed)) throw new Error('evaluateRouletteConfig: seed muss eine Ganzzahl sein');

  const prng = new Prng(seed);
  const bet = fromVC(1);
  const pockets = wheelPockets(config);
  const weights = getPocketWeights(config);
  const theoretical = getTheoreticalProbabilities(
    pockets.map((pocket) => ({ value: pocket, weight: weights[String(pocket)]! })),
  );
  const colors = { RED: 0, BLACK: 0, GREEN: 0 };
  let hits = 0;
  let lightningHits = 0;
  let totalPayout = ZERO_VC;
  let totalBet = ZERO_VC;

  for (let round = 0; round < sampleSize; round += 1) {
    const result = playRouletteRound(config, prng, bet);
    colors[result.color] += 1;
    if (result.win) hits += 1;
    if (result.lightningMultiplierBps !== null) lightningHits += 1;
    totalPayout = addVC(totalPayout, result.payout);
    totalBet = addVC(totalBet, result.totalBet);
  }

  const theoreticalPct = { RED: 0, BLACK: 0, GREEN: 0 };
  for (const pocket of pockets) {
    theoreticalPct[colorOf(pocket)] += (theoretical.get(pocket) ?? 0) * 100;
  }
  const hitRate = (hits / sampleSize) * 100;
  const measuredRTP = totalPayout / totalBet;
  const basePayout = resolveRoulettePayoutBps(config) / BPS;
  const winProbability = pocketCount(config.bet) / pockets.length;
  const theoreticalRTP = winProbability * basePayout +
    (config.bet === 'STRAIGHT' && config.lightning ? expectedLightningExtraRtp(pockets.length) : 0);
  const colorDistribution = (['RED', 'BLACK', 'GREEN'] as const).map((label) => {
    const measuredPct = (colors[label] / sampleSize) * 100;
    return { label, theoreticalPct: theoreticalPct[label], measuredPct, deltaPct: measuredPct - theoreticalPct[label] };
  });

  return {
    sampleSize,
    seed,
    hitRate,
    greenRate: (colors.GREEN / sampleSize) * 100,
    measuredRTP,
    theoreticalRTP,
    houseEdge: 1 - measuredRTP,
    addictionScore: rouletteAddictionScore(hitRate, config, measuredRTP),
    payoutBps: resolveRoulettePayoutBps(config),
    wheelSize: pockets.length,
    lightningHitRate: (lightningHits / sampleSize) * 100,
    maxPayoutBps: config.bet === 'STRAIGHT' && config.lightning
      ? LIGHTNING_MULTIPLIERS_BPS[LIGHTNING_MULTIPLIERS_BPS.length - 1]!
      : resolveRoulettePayoutBps(config),
    colorDistribution,
    totalPayout,
    totalBet,
  };
}
