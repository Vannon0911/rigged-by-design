/** Gast verlässt den Floor, wird wütend und wird ausgezahlt. */
import type { Ledger } from '../economy/ledger';
import { ZERO_VC } from '../economy/vacoin';
import { guestAccount, payPending } from './money';
import type { Furniture, Guest, WorldState } from './types';
import { furnitureById, releaseSeat, sendGuest } from './world';

export function becomeAngry(world: WorldState, guest: Guest): void {
  if (guest.targetFurniture) releaseSeat(world, guest.targetFurniture, guest.id);
  guest.state = 'ANGRY';
  guest.stateTicks = 0;
  guest.anger = 100;
  guest.targetFurniture = 0;
  world.lastEvent = `${guest.name} ist wütend.`;
}

export function leave(world: WorldState, guest: Guest): void {
  if (guest.targetFurniture) releaseSeat(world, guest.targetFurniture, guest.id);
  guest.targetFurniture = 0;
  guest.state = 'LEAVE';
  guest.stateTicks = 0;
  const entrance = world.zones.find((zone) => zone.kind === 'ENTRANCE');
  if (entrance) sendGuest(world, guest, { x: entrance.x + 1, y: entrance.y + Math.floor(entrance.h / 2) });
  else guest.path = [];
}

export function payAndLeave(world: WorldState, ledger: Ledger, guest: Guest): void {
  try {
    payPending(ledger, guest.id, world.tick);
    const balance = ledger.getBalance(guestAccount(guest.id));
    if (balance > ZERO_VC) {
      ledger.transfer(guestAccount(guest.id), 'WECHSELKASSE', balance, `gast ${guest.id} auszahlen`, world.tick);
      ledger.transfer('WECHSELKASSE', 'EXTERNAL_WORLD', balance, `gast ${guest.id} cash out`, world.tick);
    }
  } catch { /* Kasse ist leer; der Gast geht trotzdem */ }
  leave(world, guest);
}

export function targetedFurniture(world: WorldState, guest: Guest): Furniture | null {
  return furnitureById(world, guest.targetFurniture);
}
