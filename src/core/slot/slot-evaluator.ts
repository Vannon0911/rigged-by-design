/** Mathematischer Beweis: echte Spins, RTP, Trefferquote, Suchtdruck ueber dynamische Rollen. */
import { addVC, ZERO_VC, type VaCoinMicro } from '../economy/vacoin';
import { Prng } from '../rng/prng';
import { getTheoreticalSymbolProbabilities, resolvePaylines, resolveReels, spinSlot } from './slot-engine';
import { SLOT_SYMBOLS, type SlotConfig, type SlotSymbol } from './slot-types';

export interface SymbolDeviation {
  readonly symbol: SlotSymbol;
  readonly theoreticalPct: number;
  readonly measuredPct: number;
  readonly deltaPct: number;
}

export interface SlotMathProof {
  readonly sampleSize: number;
  readonly seed: number;
  readonly reelCount: number;
  readonly paylineCount: number;
  readonly hitRate: number;
  readonly ldwRate: number;
  readonly nearMissRate: number;
  readonly measuredRTP: number;
  readonly houseEdge: number;
  readonly addictionScore: number;
  readonly symbolDistribution: readonly SymbolDeviation[];
  readonly totalPayout: VaCoinMicro;
  readonly totalBet: VaCoinMicro;
}

function percent(count: number, total: number): number {
  return total === 0 ? 0 : (count / total) * 100;
}

function addictionScore(
  hitRate: number,
  ldwRate: number,
  nearMissRate: number,
  reelCount: number,
  paylineCount: number,
  measuredRTP: number,
): number {
  if (measuredRTP < 0.05) return 0;
  const rtpPenalty = measuredRTP < 0.65 ? (0.65 - measuredRTP) * 25 : 0;
  const winPaths = (reelCount - 2) * 4 + paylineCount * 4;
  return Math.max(
    0,
    Math.min(100, Math.round(hitRate * 0.9 + ldwRate * 1.1 + nearMissRate * 1.3 + winPaths - rtpPenalty)),
  );
}

export function proveSlotMath(config: SlotConfig, sampleSize = 10_000, seed = 42): SlotMathProof {
  if (!Number.isSafeInteger(sampleSize) || sampleSize <= 0) {
    throw new Error('proveSlotMath: sampleSize muss eine positive Ganzzahl sein');
  }
  if (!Number.isSafeInteger(seed)) throw new Error('proveSlotMath: seed muss eine Ganzzahl sein');

  const prng = new Prng(seed);
  const reels = resolveReels(config);
  const paylines = resolvePaylines(config);
  const theoretical = getTheoreticalSymbolProbabilities(config);
  const counts = Object.fromEntries(SLOT_SYMBOLS.map((symbol) => [symbol, 0])) as Record<SlotSymbol, number>;

  let hits = 0;
  let ldw = 0;
  let nearMiss = 0;
  let totalPayout = ZERO_VC;
  let totalBet = ZERO_VC;

  for (let spin = 0; spin < sampleSize; spin += 1) {
    const result = spinSlot(config, prng, 10_000);
    totalPayout = addVC(totalPayout, result.totalPayout);
    totalBet = addVC(totalBet, result.totalBet);
    if (result.totalPayout > 0) hits += 1;
    if (result.isLDW) ldw += 1;
    if (result.isNearMiss) nearMiss += 1;
    for (const column of result.grid) for (const symbol of column) counts[symbol] += 1;
  }

  const hitRate = percent(hits, sampleSize);
  const ldwRate = percent(ldw, sampleSize);
  const nearMissRate = percent(nearMiss, sampleSize);
  const measuredRTP = totalBet > 0 ? totalPayout / totalBet : 0;
  const drawnCells = sampleSize * reels.length * 3;
  const symbolDistribution = SLOT_SYMBOLS.map((symbol) => {
    const theoreticalPct = (theoretical[symbol] ?? 0) * 100;
    const measuredPct = percent(counts[symbol], drawnCells);
    return { symbol, theoreticalPct, measuredPct, deltaPct: measuredPct - theoreticalPct };
  });

  return {
    sampleSize,
    seed,
    reelCount: reels.length,
    paylineCount: paylines.length,
    hitRate,
    ldwRate,
    nearMissRate,
    measuredRTP,
    houseEdge: 1 - measuredRTP,
    addictionScore: addictionScore(hitRate, ldwRate, nearMissRate, reels.length, paylines.length, measuredRTP),
    symbolDistribution,
    totalPayout,
    totalBet,
  };
}
