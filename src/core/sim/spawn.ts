/** Nachfrage: Gäste kommen nur, wenn der Laden sauber, heil und einladend wirkt. */
import type { Prng } from '../rng/prng';
import { attractionOf } from './offers';
import { makeGuest, randomFiat, randomPersona } from './traits';
import type { Guest, WorldState } from './types';
import { exchangePoint, pathTo, spawnPoint } from './world';

const MAX_GUESTS: Record<WorldState['template'], number> = { SMALL: 10, MEDIUM: 18, LARGE: 28 };

export function maxGuests(world: WorldState): number {
  return MAX_GUESTS[world.template];
}

/** 0..1: Ordnung, Zustand und Attraktion bestimmen den Zulauf. */
export function reputation(world: WorldState): number {
  if (world.furniture.length === 0) return 0;
  const condition = world.furniture.reduce((sum, item) => sum + item.condition, 0) / world.furniture.length;
  const dirtPenalty = Math.min(40, world.dirty.size * 2.5);
  const staffBonus = (world.staff.cleaner ? 6 : 0) + (world.staff.bartender ? 5 : 0) + (world.staff.guard ? 4 : 0);
  const attraction = Math.min(30, attractionOf(world) / 260);
  return Math.max(0, Math.min(100, condition * 0.7 + staffBonus + attraction - dirtPenalty));
}

export function spawnChance(world: WorldState): number {
  return 0.015 + (reputation(world) / 100) * 0.075;
}

/** Ein Casino mit zwei Plaetzen zieht keine zehn Gaeste an; Sitzplaetze begrenzen den Andrang. */
export function serviceCapacity(world: WorldState): number {
  const seats = world.furniture.reduce((sum, item) => sum + (item.gameId ? item.seats : 0), 0);
  return Math.min(maxGuests(world), 3 + seats * 2);
}

export function spawnGuest(world: WorldState, prng: Prng): Guest | null {
  if (world.guests.length >= serviceCapacity(world)) return null;
  const id = world.nextGuestId++;
  const persona = randomPersona(prng, world.template);
  const spawn = spawnPoint(world);
  const guest = makeGuest({ id, persona, prng, fiat: randomFiat(prng, world.template, persona), spawn });
  const target = exchangePoint(world);
  if (!target) return null;
  guest.targetZone = 'exchange';
  guest.path = pathTo(world, spawn, target);
  guest.pathIndex = 0;
  guest.queueIndex = world.guests.filter((entry) => entry.state === 'EXCHANGE').length;
  world.guests.push(guest);
  return guest;
}
