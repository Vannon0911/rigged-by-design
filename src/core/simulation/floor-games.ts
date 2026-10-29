/** Eine Besucher-Runde an einer Spielstaette: Slot, Becher, Wuerfel, Roulette oder Karten. */
import type { VaCoinMicro } from '../economy/vacoin';
import { playBlackjackAuto } from '../games/blackjack/blackjack-evaluator';
import { DEFAULT_BLACKJACK_CONFIG, type BlackjackOutcome } from '../games/blackjack/blackjack-types';
import { cardLabel } from '../games/deck-engine';
import { DEFAULT_DICE_CONFIG, playDiceRound } from '../games/dice/dice-engine';
import { playPokerRound } from '../games/poker/poker-engine';
import { DEFAULT_POKER_CONFIG, resolvePokerConfig, type PokerOutcome } from '../games/poker/poker-types';
import { DEFAULT_ROULETTE_CONFIG, playRouletteRound } from '../games/roulette/roulette-engine';
import { rouletteModLoadout } from './operator-mods';
import { DEFAULT_SHELL_CONFIG, playShellRound } from '../games/shell/shell-engine';
import type { Prng } from '../rng/prng';
import { spinSlot } from '../slot/slot-engine';
import type { SlotConfig, SlotSymbol } from '../slot/slot-types';
import { getBuildable, getOperatorMod, type BuildableId, type OperatorModId } from './catalog';
import type { FloorRoundVisual } from './floor-events';

const BLACKJACK_LABELS: Readonly<Record<BlackjackOutcome, string>> = {
  PLAYER_BLACKJACK: 'BLACKJACK',
  PLAYER_WIN: 'GEWINNT',
  DEALER_BUST: 'DEALER ÜBERKAUFT',
  DEALER_WIN: 'DEALER GEWINNT',
  PLAYER_BUST: 'ÜBERKAUFT',
  PUSH: 'PUSH',
  PUSH_22: 'PUSH 22',
};

const POKER_LABELS: Readonly<Record<PokerOutcome, string>> = {
  PLAYER_WIN: 'HAND GEWINNT',
  DEALER_WIN: 'DEALER GEWINNT',
  PUSH: 'PUSH',
  DEALER_NOT_QUALIFIED: 'DEALER QUALIFIZIERT NICHT',
};

export interface FloorGameOutcome {
  readonly totalBet: VaCoinMicro;
  readonly payout: VaCoinMicro;
  readonly isNearMiss: boolean;
  readonly isLDW: boolean;
  readonly visual: FloorRoundVisual;
  readonly addictionBonus?: number;
}

function lineSymbols(
  grid: readonly (readonly SlotSymbol[])[],
  rows: readonly number[],
): SlotSymbol[] {
  return rows.map((row, reel) => grid[reel]?.[row] ?? 'BLANK');
}

export function playFloorGame(
  buildableId: BuildableId,
  mods: readonly OperatorModId[],
  betPerLine: VaCoinMicro,
  prng: Prng,
  venueTier: 1 | 2 | 3 | 4 = 1,
): FloorGameOutcome {
  const buildable = getBuildable(buildableId);

  if (buildable.kind === 'SLOT') {
    const venueReels = {
      id: `venue-reels-${venueTier}`,
      name: 'Venue-Rollenausbau',
      target: 'REELS' as const,
      minBound: 0,
      maxBound: 3,
      costVC: 0 as VaCoinMicro,
      description: `Stufe ${venueTier}: ${venueTier + 2} Rollen`,
      value: venueTier - 1,
    };
    const config: SlotConfig = {
      id: `floor-${buildableId}`,
      baseBet: betPerLine,
      paylines: buildable.paylines,
      mods: [...mods.flatMap((id) => getOperatorMod(id).contracts), venueReels],
    };
    const spin = spinSlot(config, prng, 10_000);
    const paylineRows = spin.lineWins[0]?.rows ?? Array.from({ length: spin.grid.length }, () => 1);
    return {
      totalBet: spin.totalBet,
      payout: spin.totalPayout,
      isNearMiss: spin.isNearMiss,
      isLDW: spin.isLDW,
      visual: { kind: 'SLOT', symbols: lineSymbols(spin.grid, paylineRows) },
    };
  }

  if (buildable.kind === 'SHELL') {
    const round = playShellRound({ ...DEFAULT_SHELL_CONFIG, id: `floor-${buildableId}` }, prng, betPerLine);
    return {
      totalBet: betPerLine,
      payout: round.payout,
      isNearMiss: round.isNearMiss,
      isLDW: false,
      visual: {
        kind: 'SHELL',
        cups: round.cups,
        winning: [...round.winning],
        picked: [...round.picked],
        hit: round.hit,
      },
    };
  }

  if (buildable.kind === 'DICE') {
    const round = playDiceRound({ ...DEFAULT_DICE_CONFIG, id: `floor-${buildableId}` }, prng, betPerLine);
    return {
      totalBet: betPerLine,
      payout: round.payout,
      isNearMiss: round.isNearMiss,
      isLDW: false,
      visual: { kind: 'DICE', dice: [...round.dice], sum: round.sum, win: round.win },
    };
  }

  if (buildable.kind === 'ROULETTE') {
    const loadout = rouletteModLoadout(mods);
    const round = playRouletteRound({
      ...DEFAULT_ROULETTE_CONFIG,
      id: `floor-${buildableId}`,
      mods: loadout.mods,
      doubleZero: loadout.doubleZero,
      tripleZero: loadout.tripleZero,
      lightning: loadout.lightning,
    }, prng, betPerLine);
    return {
      totalBet: betPerLine,
      payout: round.payout,
      isNearMiss: round.isNearMiss,
      isLDW: false,
      visual: { kind: 'ROULETTE', pocket: round.pocket, pocketLabel: round.pocketLabel, color: round.color, win: round.win },
      addictionBonus: loadout.addictionBonus,
    };
  }

  if (buildable.kind === 'BLACKJACK') {
    const deckMods = mods.flatMap((id) => getOperatorMod(id).deckMods ?? []);
    const round = playBlackjackAuto(
      { ...DEFAULT_BLACKJACK_CONFIG, id: `floor-${buildableId}`, baseBet: betPerLine, deckMods },
      prng,
      betPerLine,
      0 as VaCoinMicro,
      false,
    );
    return {
      totalBet: round.totalBet,
      payout: round.payout,
      isNearMiss: round.outcome === 'PUSH' || round.outcome === 'PUSH_22',
      isLDW: false,
      visual: {
        kind: 'CARDS',
        game: 'BLACKJACK',
        player: round.playerCards.map(cardLabel),
        dealer: round.dealerCards.map(cardLabel),
        label: BLACKJACK_LABELS[round.outcome],
        win: round.payout > round.totalBet,
      },
    };
  }

  if (buildable.kind === 'POKER') {
    const sixCard = mods.some((id) => getOperatorMod(id).pokerSixCard === true);
    const base = { ...DEFAULT_POKER_CONFIG, id: `floor-${buildableId}`, ante: betPerLine };
    const round = playPokerRound(
      sixCard ? resolvePokerConfig(base, ['POKER_SIX_CARD_DEAL']) : base,
      prng,
      betPerLine,
    );
    return {
      totalBet: round.totalBet,
      payout: round.payout,
      isNearMiss: round.isNearMiss,
      isLDW: false,
      visual: {
        kind: 'CARDS',
        game: 'POKER',
        player: round.playerCards.map(cardLabel),
        dealer: round.dealerCards.map(cardLabel),
        label: round.playerRank.categoryName + ' · ' + POKER_LABELS[round.outcome],
        win: round.outcome === 'PLAYER_WIN',
      },
    };
  }

  throw new Error(`playFloorGame: ${buildableId} ist keine Spielstaette`);
}
