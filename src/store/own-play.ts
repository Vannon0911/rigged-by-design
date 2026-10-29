/** Eigenes Gerät: Spieler setzt aus der Brieftasche, der Tresor deckt Gewinne. */
import type { CasinoFloor } from '../core/simulation/casino-floor';
import { getBuildable, getOperatorMod } from '../core/simulation/catalog';
import { playFloorGame, type FloorGameOutcome } from '../core/simulation/floor-games';
import type { Ledger } from '../core/economy/ledger';
import { canAfford, toVCString, ZERO_VC, type VaCoinMicro } from '../core/economy/vacoin';
import type { Prng } from '../core/rng/prng';
import { resolvePaylines, spinSlot } from '../core/slot/slot-engine';
import type { SlotConfig, SpinResult } from '../core/slot/slot-types';
import { playBlackjackAuto } from '../core/games/blackjack/blackjack-evaluator';
import { DEFAULT_BLACKJACK_CONFIG, type BlackjackRound } from '../core/games/blackjack/blackjack-types';
import { playPokerRound } from '../core/games/poker/poker-engine';
import { DEFAULT_POKER_CONFIG, resolvePokerConfig, type PokerRound } from '../core/games/poker/poker-types';
import { playRouletteRound } from '../core/games/roulette/roulette-engine';
import { rouletteModLoadout } from '../core/simulation/operator-mods';
import {
  DEFAULT_ROULETTE_CONFIG,
  type RouletteBetType,
  type RouletteRound,
} from '../core/games/roulette/roulette-types';

export type OwnCardGame = 'ROULETTE' | 'BLACKJACK' | 'POKER';

export interface OwnCardOptions {
  readonly rouletteBet?: RouletteBetType;
  readonly rouletteDozen?: 1 | 2 | 3;
}

export interface OwnCardResult {
  readonly game: OwnCardGame;
  readonly label: string;
  readonly totalBet: VaCoinMicro;
  readonly payout: VaCoinMicro;
  readonly roulette: RouletteRound | null;
  readonly blackjack: BlackjackRound | null;
  readonly poker: PokerRound | null;
}

function refund(ledger: Ledger, amount: VaCoinMicro, tick: number, reason: string): void {
  ledger.transfer('CASINO_VAULT', 'PLAYER_CASH', amount, reason, tick);
}

function settleOwnTable(
  ledger: Ledger,
  tick: number,
  kind: OwnCardGame,
  totalBet: VaCoinMicro,
  payout: VaCoinMicro,
): void {
  if (!canAfford(ledger.getBalance('PLAYER_CASH'), totalBet)) {
    throw new Error('Nicht genug Bargeld für diese Runde.');
  }
  if (payout > ZERO_VC && !canAfford(ledger.getBalance('CASINO_VAULT'), payout)) {
    throw new Error('Der Tresor deckt diesen Gewinn nicht. Zahle zuerst Deckung ein.');
  }
  ledger.transfer('PLAYER_CASH', 'CASINO_VAULT', totalBet, `own ${kind} bet`, tick);
  if (payout > ZERO_VC) {
    ledger.transfer('CASINO_VAULT', 'PLAYER_CASH', payout, `own ${kind} win`, tick);
  }
}

export function playOwnSlotRound(
  ledger: Ledger,
  prng: Prng,
  tick: number,
  config: SlotConfig,
): SpinResult {
  const totalBet = (config.baseBet * resolvePaylines(config).length) as VaCoinMicro;
  if (!canAfford(ledger.getBalance('PLAYER_CASH'), totalBet)) throw new Error('Nicht genug Bargeld für diesen Spin.');
  ledger.transfer('PLAYER_CASH', 'CASINO_VAULT', totalBet, `own slot bet ${config.id}`, tick);
  const spin = spinSlot(config, prng);
  if (spin.totalPayout > 0) {
    if (!canAfford(ledger.getBalance('CASINO_VAULT'), spin.totalPayout)) {
      refund(ledger, totalBet, tick, 'own slot refund - vault empty');
      throw new Error('Der Tresor deckt diesen Gewinn nicht. Zahle zuerst Deckung ein.');
    }
    ledger.transfer('CASINO_VAULT', 'PLAYER_CASH', spin.totalPayout, `own slot win ${config.id}`, tick);
  }
  return spin;
}

export function playOwnTableRound(
  ledger: Ledger,
  prng: Prng,
  tick: number,
  floor: CasinoFloor,
  kind: 'SHELL' | 'DICE',
  bet: VaCoinMicro,
): FloorGameOutcome {
  const item = floor.items.find((entry) => getBuildable(entry.buildableId).kind === kind);
  if (!item) throw new Error(kind === 'SHELL' ? 'Baue zuerst einen Hütchenspiel-Karton.' : 'Baue zuerst einen Würfeltisch.');
  if (!canAfford(ledger.getBalance('PLAYER_CASH'), bet)) throw new Error('Nicht genug Bargeld für diese Runde.');
  ledger.transfer('PLAYER_CASH', 'CASINO_VAULT', bet, `own table bet ${kind}`, tick);
  try {
    const outcome = playFloorGame(item.buildableId, item.mods, bet, prng, floor.venueTier);
    if (outcome.payout > 0) {
      if (!canAfford(ledger.getBalance('CASINO_VAULT'), outcome.payout)) throw new Error('Der Tresor deckt diesen Gewinn nicht.');
      ledger.transfer('CASINO_VAULT', 'PLAYER_CASH', outcome.payout, `own table win ${kind}`, tick);
    }
    return outcome;
  } catch (error) {
    if (canAfford(ledger.getBalance('CASINO_VAULT'), bet)) refund(ledger, bet, tick, 'own table refund');
    throw error;
  }
}

/** Echte Karten-/Kesselrunde am eigenen Tisch. Die installierten Betreiber-Mods wirken mit. */
export function playOwnCardRound(
  ledger: Ledger,
  prng: Prng,
  tick: number,
  floor: CasinoFloor,
  game: OwnCardGame,
  bet: VaCoinMicro,
  options: OwnCardOptions = {},
): OwnCardResult {
  const item = floor.items.find((entry) => getBuildable(entry.buildableId).kind === game);
  if (!item) throw new Error(`Baue zuerst ${game === 'ROULETTE' ? 'einen Roulette-Tisch' : game === 'BLACKJACK' ? 'einen Blackjack-Tisch' : 'einen Poker-Tisch'}.`);
  if (!Number.isSafeInteger(bet) || bet <= 0) throw new Error('Der Einsatz muss größer als 0 sein.');
  const mods = item.mods.map((id) => getOperatorMod(id));
  let roulette: RouletteRound | null = null;
  let blackjack: BlackjackRound | null = null;
  let poker: PokerRound | null = null;
  let label = '';

  if (game === 'ROULETTE') {
    const loadout = rouletteModLoadout(item.mods);
    roulette = playRouletteRound(
      {
        ...DEFAULT_ROULETTE_CONFIG,
        id: `own-${item.id}-roulette`,
        bet: options.rouletteBet ?? 'RED',
        straightNumber: 17,
        dozen: options.rouletteDozen ?? 1,
        mods: loadout.mods,
        doubleZero: loadout.doubleZero,
        tripleZero: loadout.tripleZero,
        lightning: loadout.lightning,
      },
      prng,
      bet,
    );
    label = roulette.win
      ? `Eigener Kessel: ${roulette.pocketLabel} ${roulette.color} · +${toVCString(roulette.payout)}.`
      : `Eigener Kessel: ${roulette.pocketLabel} ${roulette.color} · ${toVCString(roulette.totalBet)} verloren.`;
  } else if (game === 'BLACKJACK') {
    blackjack = playBlackjackAuto(
      {
        ...DEFAULT_BLACKJACK_CONFIG,
        id: `own-${item.id}-blackjack`,
        baseBet: bet,
        deckMods: mods.flatMap((mod) => mod.deckMods ?? []),
      },
      prng,
      bet,
      ZERO_VC,
      true,
    );
    label = blackjack.payout > 0
      ? `Eigener Blackjack: ${blackjack.outcome.replaceAll('_', ' ')} · +${toVCString(blackjack.payout)}.`
      : `Eigener Blackjack: ${blackjack.outcome.replaceAll('_', ' ')} · ${toVCString(blackjack.totalBet)} verloren.`;
  } else {
    const pokerMods = mods.some((mod) => mod.pokerSixCard) ? (['POKER_SIX_CARD_DEAL'] as const) : ([] as const);
    poker = playPokerRound(
      resolvePokerConfig({ ...DEFAULT_POKER_CONFIG, id: `own-${item.id}-poker`, ante: bet }, pokerMods),
      prng,
      bet,
    );
    label = poker.payout > 0
      ? `Eigener Poker: ${poker.playerRank.categoryName} · +${toVCString(poker.payout)}.`
      : `Eigener Poker: ${poker.playerRank.categoryName} gegen ${poker.dealerRank.categoryName}.`;
  }

  const round = roulette ?? blackjack ?? poker;
  if (!round) throw new Error('Runde konnte nicht ausgewertet werden.');
  settleOwnTable(ledger, tick, game, round.totalBet, round.payout);
  return { game, label, totalBet: round.totalBet, payout: round.payout, roulette, blackjack, poker };
}
