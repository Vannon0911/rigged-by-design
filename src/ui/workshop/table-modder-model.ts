/** Reine Konfiguration und Live-Mathematik fuer den Tisch-Baukasten. */
import { fromVC } from '../../core/economy/vacoin';
import type { DeckModId } from '../../core/games/cards/card-shoe';
import { DEFAULT_BLACKJACK_CONFIG, type BlackjackConfig } from '../../core/games/blackjack/blackjack-types';
import { evaluateBlackjackConfig } from '../../core/games/blackjack/blackjack-evaluator';
import { DEFAULT_DICE_CONFIG, evaluateDiceConfig, resolveDicePayoutBps, type DiceConfig } from '../../core/games/dice/dice-engine';
import { evaluatePokerConfig } from '../../core/games/poker/poker-math';
import { DEFAULT_POKER_CONFIG, type PokerConfig } from '../../core/games/poker/poker-types';
import { DEFAULT_ROULETTE_CONFIG, evaluateRouletteConfig, resolveRoulettePayoutBps, type RouletteConfig } from '../../core/games/roulette/roulette-engine';
import { DEFAULT_SHELL_CONFIG, evaluateShellConfig, resolveShellMultiplierBps, type ShellConfig } from '../../core/games/shell/shell-engine';
import type { ModContract } from '../../core/rng/bias-policy';

export type TableGameId = 'SHELL' | 'DICE' | 'ROULETTE' | 'BLACKJACK' | 'POKER';

export interface TableTab {
  readonly id: TableGameId;
  readonly name: string;
  readonly minTier: 1 | 2 | 3 | 4;
}

export const TABLE_TABS: readonly TableTab[] = [
  { id: 'SHELL', name: 'Hütchen', minTier: 1 },
  { id: 'DICE', name: 'Würfel', minTier: 2 },
  { id: 'ROULETTE', name: 'Roulette', minTier: 3 },
  { id: 'BLACKJACK', name: 'Blackjack', minTier: 3 },
  { id: 'POKER', name: 'Poker', minTier: 4 },
];

export interface TableBuilds {
  readonly shell: ShellConfig;
  readonly dice: DiceConfig;
  readonly roulette: RouletteConfig;
  readonly blackjack: BlackjackConfig;
  readonly poker: PokerConfig;
}

export const DEFAULT_TABLE_BUILDS: TableBuilds = {
  shell: { ...DEFAULT_SHELL_CONFIG, id: 'builder-shell' },
  dice: { ...DEFAULT_DICE_CONFIG, id: 'builder-dice' },
  roulette: { ...DEFAULT_ROULETTE_CONFIG, id: 'builder-roulette' },
  blackjack: { ...DEFAULT_BLACKJACK_CONFIG, id: 'builder-blackjack' },
  poker: { ...DEFAULT_POKER_CONFIG, id: 'builder-poker', ante: fromVC(0.5) },
};

export const BUILD_SAMPLE = 1200;
export const BUILD_SEED = 1337;

export interface TableProofView {
  readonly hitRate: number;
  readonly measuredRTP: number;
  readonly houseEdge: number;
  readonly addictionScore: number;
}

export function withShellBias(config: ShellConfig, value: number): ShellConfig {
  const magnet: ModContract = {
    id: 'builder-shell-magnet',
    name: 'Becher-Magnet',
    target: 'HIT_RATE',
    minBound: -0.35,
    maxBound: 0.35,
    costVC: fromVC(0),
    description: 'Zahlen-Bias auf die Trefferquote',
    value: Math.min(0.35, Math.max(-0.35, value)),
  };
  return { ...config, mods: value === 0 ? [] : [magnet] };
}

export function shellMultiplier(config: ShellConfig): number {
  return resolveShellMultiplierBps(config) / 10_000;
}

export function dicePayout(config: DiceConfig): number {
  return resolveDicePayoutBps(config) / 10_000;
}

export function roulettePayout(config: RouletteConfig): number {
  return resolveRoulettePayoutBps(config) / 10_000;
}

export function toggleDeckIds(deckMods: readonly DeckModId[], id: DeckModId): DeckModId[] {
  return deckMods.includes(id) ? deckMods.filter((entry) => entry !== id) : [...deckMods, id];
}

export function toggleDeck(config: BlackjackConfig, id: DeckModId): BlackjackConfig {
  return { ...config, deckMods: toggleDeckIds(config.deckMods, id) };
}

export function runTableBuildProof(builds: TableBuilds, game: TableGameId): TableProofView {
  if (game === 'SHELL') {
    const proof = evaluateShellConfig(builds.shell, BUILD_SAMPLE, BUILD_SEED);
    return { hitRate: proof.hitRate, measuredRTP: proof.measuredRTP, houseEdge: proof.houseEdge, addictionScore: proof.addictionScore };
  }
  if (game === 'DICE') {
    const proof = evaluateDiceConfig(builds.dice, BUILD_SAMPLE, BUILD_SEED);
    return { hitRate: proof.hitRate, measuredRTP: proof.measuredRTP, houseEdge: proof.houseEdge, addictionScore: proof.addictionScore };
  }
  if (game === 'ROULETTE') {
    const proof = evaluateRouletteConfig(builds.roulette, BUILD_SAMPLE, BUILD_SEED);
    return { hitRate: proof.hitRate, measuredRTP: proof.measuredRTP, houseEdge: proof.houseEdge, addictionScore: proof.addictionScore };
  }
  if (game === 'BLACKJACK') {
    const proof = evaluateBlackjackConfig(builds.blackjack, BUILD_SAMPLE, BUILD_SEED);
    return { hitRate: proof.hitRate, measuredRTP: proof.measuredRTP, houseEdge: proof.houseEdge, addictionScore: proof.addictionScore };
  }
  const proof = evaluatePokerConfig(builds.poker, BUILD_SAMPLE, BUILD_SEED);
  return { hitRate: proof.hitRate, measuredRTP: proof.measuredRTP, houseEdge: proof.houseEdge, addictionScore: proof.addictionScore };
}
