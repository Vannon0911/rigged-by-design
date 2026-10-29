/** Mathematischer Beweis: echte Spins, RTP, Trefferquote, Suchtdruck. */
import { addVC, ZERO_VC, type VaCoinMicro } from '../economy/vacoin';
import { Prng } from '../rng/prng';
import { getTheoreticalProbabilities } from '../rng/weighted-pool';
import { getEffectiveWeights, spinSlot } from './slot-engine';
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

const RTP_PENALTY_THRESHOLD = 0.65;
const RTP_PENALTY_WEIGHT = 25;
const CELLS_PER_SPIN = 9;

function percent(count: number, total: number): number {
  return total === 0 ? 0 : (count / total) * 100;
}

export function proveSlotMath(config: SlotConfig, sampleSize = 10_000, seed = 42): SlotMathProof {
  if (!Number.isSafeInteger(sampleSize) || sampleSize <= 0) {
    throw new Error('proveSlotMath: sampleSize muss eine positive Ganzzahl sein');
  }
  if (!Number.isSafeInteger(seed)) throw new Error('proveSlotMath: seed muss eine Ganzzahl sein');

  const prng = new Prng(seed);
  const weights = getEffectiveWeights(config);
  const entries = SLOT_SYMBOLS.map((value) => ({ value, weight: weights[value] }));
  const theoretical = getTheoreticalProbabilities(entries);
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
  const houseEdge = 1 - measuredRTP;
  const rtpPenalty =
    measuredRTP < RTP_PENALTY_THRESHOLD ? (RTP_PENALTY_THRESHOLD - measuredRTP) * RTP_PENALTY_WEIGHT : 0;
  const addictionScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        hitRate * 0.9 + ldwRate * 1.1 + nearMissRate * 1.3 + config.paylines.length * 4 - rtpPenalty,
      ),
    ),
  );

  const drawnCells = sampleSize * CELLS_PER_SPIN;
  const symbolDistribution = SLOT_SYMBOLS.map((symbol) => {
    const theoreticalPct = (theoretical.get(symbol) ?? 0) * 100;
    const measuredPct = percent(counts[symbol], drawnCells);
    return { symbol, theoreticalPct, measuredPct, deltaPct: measuredPct - theoreticalPct };
  });

  return {
    sampleSize,
    seed,
    hitRate,
    ldwRate,
    nearMissRate,
    measuredRTP,
    houseEdge,
    addictionScore,
    symbolDistribution,
    totalPayout,
    totalBet,
  };
}
