/** Hütchenspiel: deterministische Runden, Magnet-Bias und RTP-Beweis. */
import { ZERO_VC, addVC, fromVC, mulVC, type VaCoinMicro } from '../../economy/vacoin';
import { resolveHitRateShift } from '../../rng/bias-policy';
import { Prng } from '../../rng/prng';
import {
  SHELL_MAX_SAMPLE,
  assertShellConfig,
  effectiveShellHitRate,
  resolveShellMultiplierBps,
  type ShellConfig,
  type ShellMathProof,
  type ShellRound,
} from './shell-types';

export {
  DEFAULT_SHELL_CONFIG,
  effectiveShellHitRate,
  fairShellHitRate,
  resolveShellMultiplierBps,
  theoreticalShellRTP,
  type ShellConfig,
  type ShellMathProof,
  type ShellRound,
  type ShellVariant,
} from './shell-types';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function drawUnique(prng: Prng, count: number, picks: number): number[] {
  const pool = Array.from({ length: count }, (_, index) => index);
  for (let index = 0; index < picks; index += 1) {
    const swap = prng.nextInt(index, count - 1);
    const left = pool[index]!;
    pool[index] = pool[swap]!;
    pool[swap] = left;
  }
  return pool.slice(0, picks);
}

function losingPicks(config: ShellConfig, winning: readonly number[], prng: Prng): number[] {
  if (config.variant === 'DOUBLE_BALL') {
    const empty = Array.from({ length: config.cups }, (_, index) => index).filter((cup) => !winning.includes(cup));
    return [winning[prng.nextInt(0, winning.length - 1)]!, empty[prng.nextInt(0, empty.length - 1)]!];
  }
  const offset = 1 + prng.nextInt(0, config.cups - 2);
  return [(winning[0]! + offset) % config.cups];
}

export function playShellRound(config: ShellConfig, prng: Prng, bet: VaCoinMicro): ShellRound {
  assertShellConfig(config);
  if (!Number.isSafeInteger(bet) || bet <= 0) throw new Error('playShellRound: Einsatz muss > 0 sein');

  const balls = config.variant === 'DOUBLE_BALL' ? 2 : 1;
  const multiplierBps = resolveShellMultiplierBps(config);
  const effectiveHitRate = effectiveShellHitRate(config);
  const hit = prng.nextFloat() < effectiveHitRate;
  const winning = drawUnique(prng, config.cups, balls);
  const picked = hit ? winning : losingPicks(config, winning, prng);
  const isNearMiss = !hit && picked.some((cup) => winning.includes(cup));
  const payout = hit ? mulVC(bet, multiplierBps) : ZERO_VC;
  const magnetHeat = Math.round(Math.abs(resolveHitRateShift(config.mods)) * 10);
  const heatGain = 1 + magnetHeat + (config.variant === 'DOUBLE_BALL' ? 2 : 0);

  return {
    cups: config.cups,
    variant: config.variant,
    winning,
    picked,
    hit,
    isNearMiss,
    totalBet: bet,
    payout,
    multiplierBps,
    effectiveHitRate,
    heatGain,
  };
}

function addictionScore(config: ShellConfig, hitRate: number, nearMissRate: number, rtp: number): number {
  const multiplier = resolveShellMultiplierBps(config) / 10_000;
  const pressure = (config.cups - 3) * 6 + (config.variant === 'DOUBLE_BALL' ? 8 : 0);
  const magnet = Math.abs(resolveHitRateShift(config.mods));
  const rtpPenalty = rtp < 0.65 ? (0.65 - rtp) * 50 : 0;
  return Math.round(
    clamp(hitRate + multiplier * 9 + pressure + nearMissRate * 0.2 + magnet * 20 - rtpPenalty, 0, 100),
  );
}

export function evaluateShellConfig(config: ShellConfig, sampleSize = 10_000, seed = 42): ShellMathProof {
  assertShellConfig(config);
  if (!Number.isSafeInteger(sampleSize) || sampleSize <= 0 || sampleSize > SHELL_MAX_SAMPLE) {
    throw new Error(`evaluateShellConfig: sampleSize muss 1..${SHELL_MAX_SAMPLE} sein`);
  }
  if (!Number.isSafeInteger(seed)) throw new Error('evaluateShellConfig: seed muss eine Ganzzahl sein');

  const prng = new Prng(seed);
  const bet = fromVC(1);
  let hits = 0;
  let nearMisses = 0;
  let heat = 0;
  let totalPayout = ZERO_VC;
  let totalBet = ZERO_VC;

  for (let round = 0; round < sampleSize; round += 1) {
    const result = playShellRound(config, prng, bet);
    if (result.hit) hits += 1;
    if (result.isNearMiss) nearMisses += 1;
    heat += result.heatGain;
    totalPayout = addVC(totalPayout, result.payout);
    totalBet = addVC(totalBet, result.totalBet);
  }

  const hitRate = (hits / sampleSize) * 100;
  const nearMissRate = (nearMisses / sampleSize) * 100;
  const measuredRTP = totalPayout / totalBet;

  return {
    sampleSize,
    seed,
    hitRate,
    nearMissRate,
    measuredRTP,
    theoreticalRTP: (effectiveShellHitRate(config) * resolveShellMultiplierBps(config)) / 10_000,
    houseEdge: 1 - measuredRTP,
    addictionScore: addictionScore(config, hitRate, nearMissRate, measuredRTP),
    multiplierBps: resolveShellMultiplierBps(config),
    effectiveHitRate: effectiveShellHitRate(config),
    heatPerSpin: heat / sampleSize,
    totalPayout,
    totalBet,
  };
}
