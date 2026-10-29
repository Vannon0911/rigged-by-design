/** Reine Bearbeitungs-Helfer fuer den Sucht-Spiel-Baukasten. */
import { resolveReels } from '../../core/slot/slot-engine';
import {
  PAYTABLE,
  SLOT_SYMBOLS,
  type ReelStrip,
  type SlotConfig,
  type SlotPayout,
  type SlotSymbol,
} from '../../core/slot/slot-types';

export const BUILDER_SYMBOLS = SLOT_SYMBOLS;
export const PAY_KEYS = ['two', 'three', 'four', 'five', 'six'] as const;
export type PayKey = (typeof PAY_KEYS)[number];

export function stripSymbols(reel: ReelStrip): SlotSymbol[] {
  return Array.isArray(reel) ? [...(reel as readonly SlotSymbol[])] : [...(reel as { symbols: readonly SlotSymbol[] }).symbols];
}

export function builderStrips(config: SlotConfig): SlotSymbol[][] {
  return resolveReels(config).map(stripSymbols);
}

export function symbolCounts(strip: readonly SlotSymbol[]): Record<SlotSymbol, number> {
  const counts = Object.fromEntries(SLOT_SYMBOLS.map((symbol) => [symbol, 0])) as Record<SlotSymbol, number>;
  for (const symbol of strip) counts[symbol] += 1;
  return counts;
}

export function withSymbolCount(strip: readonly SlotSymbol[], symbol: SlotSymbol, count: number): SlotSymbol[] {
  const counts = symbolCounts(strip);
  // Nur das gewaehlte Symbol aendern: bestehende Walzenlaenge bleibt erhalten.
  counts[symbol] = Math.max(0, Math.floor(count));
  if (SLOT_SYMBOLS.every((entry) => counts[entry] === 0)) counts[symbol] = 1;
  const next: SlotSymbol[] = [];
  for (const entry of SLOT_SYMBOLS) {
    for (let index = 0; index < counts[entry]; index += 1) next.push(entry);
  }
  return next;
}

function cleanManipulation(strip: readonly SlotSymbol[]): { targetNumbers: number[]; pullStrength: number; windowShift: number } {
  return {
    targetNumbers: strip.map((symbol, index) => (symbol === 'BLANK' ? index : -1)).filter((index) => index >= 0),
    pullStrength: 0,
    windowShift: 0,
  };
}

/** Materialisiert Reels und erzeugt pro Rolle eine Haus-Bias-Ziehung. */
export function withStrips(
  config: SlotConfig,
  strips: readonly (readonly SlotSymbol[])[],
  pull = 0,
  shift = 0,
): SlotConfig {
  const reels = strips.map((strip) => [...strip]);
  const reelManipulations = reels.map((strip) => ({
    ...cleanManipulation(strip),
    pullStrength: Math.min(1, Math.max(-1, pull)),
    windowShift: Math.min(0.5, Math.max(-0.5, shift)),
  }));
  const { weights: _unused, ...rest } = config;
  return { ...rest, reels, reelManipulations };
}

export function biasOf(config: SlotConfig): { pull: number; shift: number } {
  const first = config.reelManipulations?.[0];
  return { pull: first?.pullStrength ?? 0, shift: first?.windowShift ?? 0 };
}

export function payBps(config: SlotConfig, symbol: SlotSymbol, key: PayKey): number {
  return config.paytable?.[symbol]?.[key] ?? PAYTABLE[symbol][key] ?? 0;
}

export function withPayout(config: SlotConfig, symbol: SlotSymbol, key: PayKey, bps: number): SlotConfig {
  const table: SlotPayout = { ...(config.paytable?.[symbol] ?? {}), [key]: Math.max(0, Math.floor(bps)) };
  return { ...config, paytable: { ...(config.paytable ?? {}), [symbol]: table } };
}

export function addReel(strips: readonly SlotSymbol[][], copyIndex: number): SlotSymbol[][] {
  if (strips.length >= 6) return strips.map((strip) => [...strip]);
  const source = strips[Math.min(copyIndex, strips.length - 1)] ?? ['CHERRY', 'BELL', 'BLANK'];
  return [...strips.map((strip) => [...strip]), [...source]];
}

export function removeReel(strips: readonly SlotSymbol[][], index: number): SlotSymbol[][] {
  if (strips.length <= 3) return strips.map((strip) => [...strip]);
  return strips.filter((_, position) => position !== index).map((strip) => [...strip]);
}
