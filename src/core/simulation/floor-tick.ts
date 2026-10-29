/** Ein vollstaendiger Floor-Tick: Spawn, Spielauswahl, Einsatz, Auszahlung und Event. */
import type { Ledger } from '../economy/ledger';
import { ZERO_VC, addVC, type VaCoinMicro } from '../economy/vacoin';
import type { Prng } from '../rng/prng';
import { getVenue, type VenueTier } from '../progression/venues-and-tiers';
import { getBuildable, getOperatorMod } from './catalog';
import { makeFloorEvent, type FloorRoundEvent } from './floor-events';
import { playFloorGame } from './floor-games';
import { addictionGain, betFor, decoBonus, pickGame } from './floor-rules';
import type { FloorTickResult, PlacedItem } from './floor-types';
import { spawnVisitor } from './floor-spawn';
import { placeVisitorBet, reserveVisitorWin } from './visitor-ledger';
import type { Visitor } from './visitors';

const SPAWN_CHANCE = 0.12;
const PATIENCE_LOSS = 4;

export interface FloorTickInput {
  readonly ledger: Ledger;
  readonly prng: Prng;
  readonly items: readonly PlacedItem[];
  readonly games: readonly PlacedItem[];
  readonly visitors: Visitor[];
  readonly ticks: number;
  readonly maxVisitors: number;
  readonly venueTier: VenueTier;
  readonly nextId: () => number;
  readonly nextEventId: () => number;
  readonly removeVisitor: (id: number) => boolean;
}

export function tickFloor(input: FloorTickInput): FloorTickResult {
  let spawned = 0;
  const variety = new Set(input.games.map((game) => getBuildable(game.buildableId).kind)).size;
  const varietySpawn = 1 + Math.max(0, variety - 1) * 0.08;
  const spawnChance = Math.min(0.9, SPAWN_CHANCE * varietySpawn * (1 + decoBonus(input.items, 'spawnBonusBps') / 10_000));
  if (input.visitors.length < input.maxVisitors && input.prng.nextFloat() < spawnChance) {
    const venue = getVenue(input.venueTier);
    input.visitors.push(spawnVisitor({
      ledger: input.ledger,
      prng: input.prng,
      id: input.nextId(),
      items: input.items,
      startingAddiction: decoBonus(input.items, 'startingAddiction'),
      tick: input.ticks,
      budgetMin: venue.budgetMinVC,
      budgetMax: venue.budgetMaxVC,
    }));
    spawned = 1;
  }

  const events: FloorRoundEvent[] = [];
  let spins = 0;
  let bets = ZERO_VC;
  let payouts = ZERO_VC;
  let left = 0;

  for (const visitor of [...input.visitors]) {
    if (visitor.pendingPayout > ZERO_VC) {
      visitor.patience = Math.max(0, visitor.patience - 8);
      continue;
    }
    if (input.games.length === 0) {
      visitor.patience -= 12;
      if (visitor.patience <= 0 && input.removeVisitor(visitor.id)) left += 1;
      continue;
    }

    const game = pickGame(input.games, input.prng);
    const buildable = getBuildable(game.buildableId);
    const modPenalty = game.mods.reduce((sum, id) => sum + getOperatorMod(id).patiencePenalty, 0);
    const minSessionBet = (buildable.minBetVC * buildable.paylines) as VaCoinMicro;
    if (visitor.addiction >= 100) {
      visitor.patience = 100;
      if (visitor.wallet < minSessionBet) {
        if (input.removeVisitor(visitor.id)) left += 1;
        continue;
      }
    } else {
      visitor.patience -= PATIENCE_LOSS * (1 - decoBonus(input.items, 'patienceLossReductionBps') / 10_000) + modPenalty;
    }

    const betPerLine = betFor(visitor, buildable.minBetVC, buildable.maxBetVC, buildable.paylines);
    if (visitor.patience <= 0 || betPerLine === ZERO_VC) {
      if (input.removeVisitor(visitor.id)) left += 1;
      continue;
    }

    const round = playFloorGame(game.buildableId, game.mods, betPerLine, input.prng, input.venueTier);
    placeVisitorBet(input.ledger, visitor, round.totalBet, input.ticks);

    let paid = ZERO_VC;
    if (round.payout > ZERO_VC) {
      const vault = input.ledger.getBalance('CASINO_VAULT');
      paid = round.payout <= vault ? round.payout : vault;
      if (paid > ZERO_VC) reserveVisitorWin(input.ledger, visitor, paid, input.ticks);
    }

    visitor.spins += 1;
    visitor.addiction = Math.min(100, visitor.addiction + addictionGain(
      round.isNearMiss,
      round.isLDW,
      paid > 0,
      buildable.paylines + game.mods.length,
      variety,
      round.addictionBonus ?? 0,
    ));
    events.push(makeFloorEvent({
      seq: input.nextEventId(),
      visitor,
      gameId: game.buildableId,
      gameX: game.x,
      gameY: game.y,
      bet: round.totalBet,
      payout: paid,
      isNearMiss: round.isNearMiss,
      isLDW: round.isLDW,
      visual: round.visual,
    }));
    spins += 1;
    bets = addVC(bets, round.totalBet);
    payouts = addVC(payouts, paid);
  }

  return { spawned, spins, bets, payouts, left, events };
}

export type { VaCoinMicro };
