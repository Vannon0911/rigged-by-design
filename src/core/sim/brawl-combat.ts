/** Prügelei ohne Security: der Spieler kämpft selbst. Sieg gibt XP, Niederlage zieht einen Straf-Event. */
import type { Ledger } from '../economy/ledger';
import type { Prng } from '../rng/prng';
import { buildDistribution, rollNumber } from '../rng/weighted';
import { grantXp } from './player-rpg';
import { applyPenalty, rollPenalty, type PenaltyKind } from './penalty-pool';
import type { WorldState } from './types';
import { guestById } from './world';

const XP_BRAWL_WIN = 45;
const BASE_WIN_CHANCE = 50;
const WIN_CHANCE_PER_LEVEL = 12;
const CROWD_MOOD_BONUS = 12;

type BrawlOutcome = 'WON' | 'LOST' | 'NONE';

interface BrawlResult {
  readonly outcome: BrawlOutcome;
  readonly penalty: PenaltyKind | null;
  readonly stolen: number;
}

/** Siegchance in Prozent (5..95) aus Kampfkraft-Stufen. Dieselbe Formel zeigt das UI an. */
export function brawlWinChance(world: WorldState): number {
  return Math.max(5, Math.min(95, BASE_WIN_CHANCE + world.player.rpg.brawlLevel * WIN_CHANCE_PER_LEVEL));
}

/** Entscheidet den Kampf deterministisch über die gewichtete Ziehung. */
export function resolvePlayerBrawl(world: WorldState, ledger: Ledger, prng: Prng, disputeId: number): BrawlResult {
  const dispute = world.disputes.find((entry) => entry.id === disputeId);
  if (!dispute) return { outcome: 'NONE', penalty: null, stolen: 0 };
  const chance = brawlWinChance(world);
  const roll = rollNumber(prng, buildDistribution(1, 100));
  if (roll.value <= chance) {
    world.disputes = world.disputes.filter((entry) => entry.id !== disputeId);
    for (const guest of world.guests) {
      if (dispute.guestIds.includes(guest.id)) {
        guest.disputeId = null;
        guest.state = 'CHOOSE';
        guest.stateTicks = 0;
      } else {
        guest.mood = Math.min(100, guest.mood + CROWD_MOOD_BONUS);
      }
    }
    grantXp(world.player.rpg, XP_BRAWL_WIN);
    world.lastEvent = 'Starker Boss! Der Schläger wird vor die Tür gesetzt.';
    return { outcome: 'WON', penalty: null, stolen: 0 };
  }
  const penalty = rollPenalty(prng);
  const stolen = applyPenalty(world, ledger, prng, penalty);
  world.disputes = world.disputes.filter((entry) => entry.id !== disputeId);
  for (const id of dispute.guestIds) {
    const guest = guestById(world, id);
    if (guest) guest.disputeId = null;
  }
  return { outcome: 'LOST', penalty, stolen };
}
