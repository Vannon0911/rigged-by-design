/** Dynamischer Slot: 3-6 Zahlenbaender, 1-9 Linien, rollNumber pro Walzenzelle. */
import { addVC, mulVC, ZERO_VC, type VaCoinMicro } from '../economy/vacoin';
import {
  applyWeightBias,
  resolveExtraPaylines,
  resolveExtraReels,
  resolveNearMissChance,
  resolvePayoutFactorBps,
} from '../rng/bias-policy';
import { rollNumber, type NumberManipulation } from '../rng/number-rng';
import type { Prng } from '../rng/prng';
import {
  BASE_WEIGHTS,
  PAYLINES,
  PAYLINE_ORDER,
  PAYTABLE,
  SLOT_SYMBOLS,
  type LineWin,
  type PaylineId,
  type PaylinePattern,
  type ReelStrip,
  type SlotConfig,
  type SlotPayout,
  type SlotSymbol,
  type SpinResult,
} from './slot-types';

export const MIN_REELS = 3;
export const MAX_REELS = 6;
export const MIN_PAYLINES = 1;
export const MAX_PAYLINES = 9;
const VISIBLE_ROWS = 3;
const STRIP_LENGTH = 100;

export function getEffectiveWeights(config: SlotConfig): Readonly<Record<SlotSymbol, number>> {
  const base = { ...BASE_WEIGHTS, ...(config.weights ?? {}) };
  return applyWeightBias(base, config.mods);
}

function symbolsOf(reel: ReelStrip): readonly SlotSymbol[] {
  return Array.isArray(reel) ? (reel as readonly SlotSymbol[]) : (reel as { symbols: readonly SlotSymbol[] }).symbols;
}

function manipulationOf(reel: ReelStrip): NumberManipulation | undefined {
  return Array.isArray(reel) ? undefined : (reel as { manipulation?: NumberManipulation }).manipulation;
}

function countsFor(weights: Readonly<Record<SlotSymbol, number>>): Record<SlotSymbol, number> {
  const total = SLOT_SYMBOLS.reduce((sum, symbol) => sum + weights[symbol], 0);
  const counts = Object.fromEntries(SLOT_SYMBOLS.map((symbol) => [symbol, 0])) as Record<SlotSymbol, number>;
  if (total <= 0) return counts;
  const exact = SLOT_SYMBOLS.map((symbol) => ({ symbol, value: (weights[symbol] / total) * STRIP_LENGTH }));
  let used = 0;
  for (const entry of exact) {
    counts[entry.symbol] = Math.floor(entry.value);
    used += counts[entry.symbol];
  }
  exact.sort((left, right) => (right.value % 1) - (left.value % 1));
  for (let index = 0; used < STRIP_LENGTH; index += 1, used += 1) {
    counts[exact[index % exact.length]!.symbol] += 1;
  }
  return counts;
}

/** Baut ein deterministisches Standard-Zahlenband aus den effektiven Gewichten. */
export function buildStandardStrip(weights: Readonly<Record<SlotSymbol, number>>, reelIndex = 0): readonly SlotSymbol[] {
  const counts = countsFor(weights);
  const strip: SlotSymbol[] = [];
  for (const symbol of SLOT_SYMBOLS) {
    for (let count = 0; count < counts[symbol]; count += 1) strip.push(symbol);
  }
  const rotation = reelIndex % Math.max(1, strip.length);
  return [...strip.slice(rotation), ...strip.slice(0, rotation)];
}

export function resolveReels(config: SlotConfig): readonly ReelStrip[] {
  const reelCount = Math.min(MAX_REELS, MIN_REELS + resolveExtraReels(config.mods));
  const reels = config.reels ?? Array.from({ length: reelCount }, (_, index) => ({
    id: `${config.id}-reel-${index + 1}`,
    symbols: buildStandardStrip(getEffectiveWeights(config), index),
  }));
  if (reels.length < MIN_REELS || reels.length > MAX_REELS) {
    throw new Error(`SlotConfig ${config.id}: 3 bis 6 Rollen erlaubt`);
  }
  reels.forEach((reel, index) => {
    if (symbolsOf(reel).length === 0) throw new Error(`SlotConfig ${config.id}: Rolle ${index + 1} ist leer`);
  });
  return reels;
}

function generatedRows(line: number, reels: number): readonly number[] {
  if (line === 0) return Array.from({ length: reels }, () => 1);
  if (line === 1) return Array.from({ length: reels }, () => 0);
  if (line === 2) return Array.from({ length: reels }, () => 2);
  if (line === 3) return Array.from({ length: reels }, (_, index) => Math.round((index * 2) / (reels - 1)));
  if (line === 4) return generatedRows(3, reels).map((row) => 2 - row);
  if (line === 5) return Array.from({ length: reels }, (_, index) => (index % 2 === 0 ? 0 : 1));
  if (line === 6) return Array.from({ length: reels }, (_, index) => (index % 2 === 0 ? 2 : 1));
  if (line === 7) return Array.from({ length: reels }, (_, index) => (index % 2 === 0 ? 0 : 2));
  return Array.from({ length: reels }, (_, index) => (index % 2 === 0 ? 2 : 0));
}

export function resolvePaylines(config: SlotConfig): readonly PaylinePattern[] {
  const reels = resolveReels(config);
  const explicit = Array.isArray(config.paylines) ? config.paylines : null;
  const baseCount = explicit ? explicit.length : (config.paylines as number);
  if (!Number.isInteger(baseCount) || baseCount < MIN_PAYLINES || baseCount > MAX_PAYLINES) {
    throw new Error(`SlotConfig ${config.id}: 1 bis 9 Gewinnlinien erlaubt`);
  }
  const requested = Math.min(MAX_PAYLINES, baseCount + resolveExtraPaylines(config.mods));
  const patterns: PaylinePattern[] = [];
  if (explicit) {
    for (const id of explicit) {
      if (!(id in PAYLINES)) throw new Error(`SlotConfig ${config.id}: unbekannte Linie ${id}`);
      patterns.push({ id, rows: PAYLINES[id as PaylineId] });
    }
  }
  for (let index = 0; patterns.length < requested; index += 1) {
    const id = explicit ? PAYLINE_ORDER[index % PAYLINE_ORDER.length]! : `LINE_${index + 1}`;
    const legacy = reels.length === MIN_REELS && !explicit && index < PAYLINE_ORDER.length;
    const rows = legacy ? PAYLINES[PAYLINE_ORDER[index]!] : generatedRows(index, reels.length);
    if (!patterns.some((entry) => entry.rows.join(',') === rows.join(','))) patterns.push({ id, rows });
  }
  return patterns.slice(0, requested);
}

function paytableOf(config: SlotConfig, symbol: SlotSymbol): SlotPayout {
  return { ...PAYTABLE[symbol], ...(config.paytable?.[symbol] ?? {}), ...(config.payouts?.[symbol] ?? {}) };
}

function payoutBps(config: SlotConfig, symbol: SlotSymbol, count: number): number {
  const table = paytableOf(config, symbol);
  const key = (['two', 'three', 'four', 'five', 'six'] as const)[count - 2];
  return key ? table[key] ?? 0 : 0;
}

function evaluateLines(
  paylines: readonly PaylinePattern[],
  grid: readonly (readonly SlotSymbol[])[],
  lineBet: VaCoinMicro,
  payoutFactorBps: number,
  config: SlotConfig,
): LineWin[] {
  const wins: LineWin[] = [];
  for (const payline of paylines) {
    if (payline.rows.length !== grid.length) continue;
    const symbols = payline.rows.map((row, reel) => grid[reel]![row]!);
    if (symbols[0] === 'BLANK') continue;
    const target = symbols.find((symbol) => symbol !== 'WILD') ?? 'WILD';
    if (target === 'BLANK') continue;
    let count = 0;
    while (count < symbols.length && (symbols[count] === target || symbols[count] === 'WILD')) count += 1;
    if (count < 2) continue;
    const bps = payoutBps(config, target, count);
    if (bps <= 0) continue;
    const payout = mulVC(mulVC(lineBet, bps), payoutFactorBps);
    if (payout > 0) wins.push({ payline: payline.id, rows: payline.rows, symbol: target, count: count as 2 | 3 | 4 | 5 | 6, payout });
  }
  return wins;
}

function forceNearMiss(grid: SlotSymbol[][], chance: number, prng: Prng): boolean {
  if (chance <= 0 || rollNumber(0, 9_999, {}, prng).finalNumber >= Math.round(chance * 10_000)) return false;
  grid[0]![0] = 'VACOIN_DIAMOND';
  grid[1]![0] = 'VACOIN_DIAMOND';
  return true;
}

export function spinSlot(config: SlotConfig, prng: Prng, betMultiplierBps = 10_000): SpinResult {
  if (!Number.isSafeInteger(config.baseBet) || config.baseBet <= 0) throw new Error(`SlotConfig ${config.id}: baseBet > 0`);
  if (!Number.isSafeInteger(betMultiplierBps) || betMultiplierBps <= 0) throw new Error('spinSlot: betMultiplierBps ungueltig');
  const reels = resolveReels(config);
  const paylines = resolvePaylines(config);
  const lineBet = mulVC(config.baseBet, betMultiplierBps);
  const totalBet = (lineBet * paylines.length) as VaCoinMicro;
  if (!Number.isSafeInteger(totalBet)) throw new Error('spinSlot: Einsatz ausserhalb des sicheren Bereichs');

  const grid: SlotSymbol[][] = reels.map((reel, index) => {
    const symbols = symbolsOf(reel);
    const manipulation = manipulationOf(reel) ?? config.reelManipulations?.[index] ?? {};
    const stop = rollNumber(0, symbols.length - 1, manipulation, prng).finalNumber;
    return Array.from({ length: VISIBLE_ROWS }, (_, row) => symbols[(stop + row) % symbols.length]!);
  });
  const lineWins = evaluateLines(paylines, grid, lineBet, resolvePayoutFactorBps(config.mods), config);
  let totalPayout = ZERO_VC;
  for (const win of lineWins) totalPayout = addVC(totalPayout, win.payout);
  const isNearMiss = totalPayout === ZERO_VC && forceNearMiss(grid, resolveNearMissChance(config.mods), prng);
  return { grid, lineWins, totalPayout, totalBet, isNearMiss, isLDW: totalPayout > 0 && totalPayout < totalBet };
}

/** Durchschnittliche Symbolwahrscheinlichkeit ueber alle Rollen (matcht die Zahlenbaender). */
export function getTheoreticalSymbolProbabilities(config: SlotConfig): Readonly<Record<SlotSymbol, number>> {
  const reels = resolveReels(config);
  const result = Object.fromEntries(SLOT_SYMBOLS.map((symbol) => [symbol, 0])) as Record<SlotSymbol, number>;
  for (const reel of reels) {
    const symbols = symbolsOf(reel);
    for (const symbol of symbols) result[symbol] += 1 / symbols.length / reels.length;
  }
  return result;
}
