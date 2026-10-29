/** Slot-Engine: 3 Walzen, 1-3 Linien, NEAR_MISS nur auf echten Nieten. */
import { addVC, mulVC, ZERO_VC, type VaCoinMicro } from '../economy/vacoin';
import {
  applyWeightBias,
  resolveExtraPaylines,
  resolveNearMissChance,
  resolvePayoutFactorBps,
} from '../rng/bias-policy';
import type { Prng } from '../rng/prng';
import { pickWeighted, type WeightedEntry } from '../rng/weighted-pool';
import {
  BASE_WEIGHTS,
  PAYLINES,
  PAYLINE_ORDER,
  PAYTABLE,
  SLOT_SYMBOLS,
  type LineWin,
  type PaylineId,
  type SlotConfig,
  type SlotSymbol,
  type SpinResult,
} from './slot-types';

export const MIN_PAYLINES = 1;
export const MAX_PAYLINES = 3;

export function getEffectiveWeights(config: SlotConfig): Readonly<Record<SlotSymbol, number>> {
  const base = { ...BASE_WEIGHTS, ...(config.weights ?? {}) };
  return applyWeightBias(base, config.mods);
}

/** Mods mit target PAYLINES fuellen bis zu drei aktive Linien auf. */
export function resolvePaylines(config: SlotConfig): readonly PaylineId[] {
  const lines = [...config.paylines];
  let extra = resolveExtraPaylines(config.mods);
  for (const candidate of PAYLINE_ORDER) {
    if (extra <= 0 || lines.length >= MAX_PAYLINES) break;
    if (lines.includes(candidate)) continue;
    lines.push(candidate);
    extra -= 1;
  }
  return lines;
}

function assertConfig(config: SlotConfig): void {
  if (!Number.isSafeInteger(config.baseBet) || config.baseBet <= 0) {
    throw new Error(`SlotConfig ${config.id}: baseBet muss > 0 sein`);
  }
  if (config.paylines.length < MIN_PAYLINES || config.paylines.length > MAX_PAYLINES) {
    throw new Error(`SlotConfig ${config.id}: 1 bis ${MAX_PAYLINES} Gewinnlinien erlaubt`);
  }
  if (new Set(config.paylines).size !== config.paylines.length) {
    throw new Error(`SlotConfig ${config.id}: doppelte Gewinnlinie`);
  }
  for (const line of config.paylines) {
    if (!(line in PAYLINES)) throw new Error(`SlotConfig ${config.id}: unbekannte Linie ${line}`);
  }
}

function drawGrid(entries: readonly WeightedEntry<SlotSymbol>[], prng: Prng): SlotSymbol[][] {
  const grid: SlotSymbol[][] = [];
  for (let reel = 0; reel < 3; reel += 1) {
    const column: SlotSymbol[] = [];
    for (let row = 0; row < 3; row += 1) column.push(pickWeighted(entries, prng));
    grid.push(column);
  }
  return grid;
}

function evaluateLines(
  paylines: readonly PaylineId[],
  grid: readonly (readonly SlotSymbol[])[],
  lineBet: VaCoinMicro,
  payoutFactorBps: number,
): LineWin[] {
  const wins: LineWin[] = [];
  for (const payline of paylines) {
    const rows = PAYLINES[payline];
    const top = grid[0]!;
    const middle = grid[1]!;
    const bottom = grid[2]!;
    const symbols: SlotSymbol[] = [top[rows[0]]!, middle[rows[1]]!, bottom[rows[2]]!];
    const symbol = symbols[0]!;
    if (symbol === 'BLANK') continue;
    const count = symbols[1] === symbol ? (symbols[2] === symbol ? 3 : 2) : 1;
    if (count === 1) continue;
    const bps = count === 3 ? PAYTABLE[symbol].three : PAYTABLE[symbol].two;
    if (bps <= 0) continue;
    const payout = mulVC(mulVC(lineBet, bps), payoutFactorBps);
    if (payout > 0) wins.push({ payline, symbol, count, payout });
  }
  return wins;
}

/**
 * Setzt bei einer Niete zwei Diamanten auf Walze 1 und 2 (obere Zeile).
 * Das kann nie einen Gewinn erzeugen: zwei Diamanten zahlen nichts,
 * und alle bereits zahlenden Linien sind per Definition Nieten.
 */
function forceNearMiss(grid: SlotSymbol[][], chance: number, prng: Prng): boolean {
  if (chance <= 0) return false;
  if (prng.nextFloat() >= chance) return false;
  grid[0]![0] = 'VACOIN_DIAMOND';
  grid[1]![0] = 'VACOIN_DIAMOND';
  return true;
}

export function spinSlot(config: SlotConfig, prng: Prng, betMultiplierBps = 10_000): SpinResult {
  assertConfig(config);
  if (!Number.isSafeInteger(betMultiplierBps) || betMultiplierBps <= 0) {
    throw new Error('spinSlot: betMultiplierBps muss eine positive Ganzzahl sein');
  }

  const weights = getEffectiveWeights(config);
  const entries: WeightedEntry<SlotSymbol>[] = SLOT_SYMBOLS.map((value) => ({ value, weight: weights[value] }));
  const paylines = resolvePaylines(config);
  const lineBet = mulVC(config.baseBet, betMultiplierBps);
  const totalBet = (lineBet * paylines.length) as VaCoinMicro;
  if (!Number.isSafeInteger(totalBet)) throw new Error('spinSlot: Einsatz ausserhalb des sicheren Bereichs');

  const grid = drawGrid(entries, prng);
  const lineWins = evaluateLines(paylines, grid, lineBet, resolvePayoutFactorBps(config.mods));
  let totalPayout = ZERO_VC;
  for (const win of lineWins) totalPayout = addVC(totalPayout, win.payout);

  const isNearMiss = totalPayout === ZERO_VC && forceNearMiss(grid, resolveNearMissChance(config.mods), prng);
  const isLDW = totalPayout > 0 && totalPayout < totalBet;
  return { grid, lineWins, totalPayout, totalBet, isNearMiss, isLDW };
}
