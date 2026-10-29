// @loc-exception: Gastentscheidung, Service und Wut teilen einen Zustandsautomaten; getrennt waere der Ablauf schwerer zu verfolgen.
/** Gäste-Verhalten: entscheiden, laufen, spielen, trinken, wütend werden. */
import type { Ledger } from '../economy/ledger';
import { canAfford, mulVC, ZERO_VC, type VaCoinMicro } from '../economy/vacoin';
import { playRound } from '../games/round';
import type { Prng } from '../rng/prng';
import { guestAccount, HAUSKONTO, payPending, pendingAccount, placeBet, SHOP, winToPending } from './money';
import { modEffects, offerScore } from './offers';
import { getPersona } from './personas';
import type { Furniture, Guest, WorldState } from './types';
import { furnitureById, freeSeat, interactionPoint, releaseSeat, reserveSeat, sendGuest, zoneById } from './world';

const clamp = (value: number): number => Math.max(0, Math.min(100, value));

export function moveGuest(guest: Guest): boolean {
  if (guest.pathIndex >= guest.path.length) return true;
  guest.position = { ...guest.path[guest.pathIndex]! };
  guest.pathIndex += 1;
  return guest.pathIndex >= guest.path.length;
}

export function releaseAndChoose(world: WorldState, guest: Guest): void {
  if (guest.targetFurniture) releaseSeat(world, guest.targetFurniture, guest.id);
  guest.targetFurniture = 0;
  guest.path = [];
  guest.pathIndex = 0;
  guest.state = 'CHOOSE';
  guest.stateTicks = 0;
}

function startActivity(world: WorldState, guest: Guest, item: Furniture): boolean {
  if (!reserveSeat(world, item.id, guest.id)) return false;
  const point = interactionPoint(world, item);
  if (!point) { releaseSeat(world, item.id, guest.id); return false; }
  guest.targetFurniture = item.id;
  guest.targetZone = item.zoneId;
  guest.state = item.kind === 'BAR' ? 'DRINK' : item.kind === 'TOILET' ? 'TOILET' : item.kind === 'DECOR' ? 'WAIT' : 'PLAY';
  guest.stateTicks = 0;
  guest.bubble = item.kind === 'BAR' ? 'Ein Drink.' : item.kind === 'TOILET' ? 'Wo ist das Klo?' : item.kind === 'DECOR' ? 'Kurz verschnaufen.' : `${item.label}? Her damit.`;
  sendGuest(world, guest, point);
  return true;
}

function waitForSpace(world: WorldState, guest: Guest): void {
  const lounge = world.zones.find((zone) => zone.kind === 'LOUNGE') ?? world.zones.find((zone) => zone.kind === 'ENTRANCE');
  guest.state = 'WAIT';
  guest.stateTicks = 0;
  guest.targetFurniture = 0;
  guest.patience = Math.max(0, guest.patience - 4);
  guest.mood = Math.max(0, guest.mood - 2);
  guest.bubble = guest.patience < 20 ? 'Ich bin hier fertig.' : 'Alles voll. Ich warte.';
  const zone = lounge ? zoneById(world, lounge.id) : null;
  if (zone) {
    guest.targetZone = zone.id;
    sendGuest(world, guest, { x: zone.x + 1, y: zone.y + 1 });
  }
  if (guest.patience <= 0) becomeAngry(world, guest);
}

export function chooseActivity(world: WorldState, guest: Guest, ledger: Ledger, prng: Prng): void {
  const wallet = ledger.getBalance(guestAccount(guest.id));
  const pending = ledger.getBalance(pendingAccount(guest.id));
  if (wallet < world.prices.slotMinBet) {
    guest.bubble = pending > ZERO_VC ? 'Ich will mein Geld.' : 'Ich bin pleite.';
    guest.state = 'CASHOUT';
    guest.stateTicks = 0;
    guest.path = [];
    if (guest.targetFurniture) releaseSeat(world, guest.targetFurniture, guest.id);
    guest.targetFurniture = 0;
    return;
  }

  const wantsToilet = guest.need === 'toilet' || guest.patience < 22 || guest.mood < 22;
  if (wantsToilet) {
    const toilet = world.furniture.find((item) => item.kind === 'TOILET' && freeSeat(item));
    if (toilet && startActivity(world, guest, toilet)) return;
  }

  const wantsDrink = wallet >= world.prices.drinkPrice
    && (guest.need === 'drink' || guest.mood < 44 || guest.patience < 38 || (guest.sociability > 68 && guest.mood < 55));
  if (wantsDrink) {
    const bar = world.furniture.find((item) => item.kind === 'BAR' && freeSeat(item));
    if (bar && startActivity(world, guest, bar)) return;
  }

  if (guest.need === 'social' || (guest.sociability > 72 && guest.mood < 50 && guest.addiction < 20)) {
    const sofa = world.furniture.find((item) => item.kind === 'DECOR' && item.seats > 0 && freeSeat(item));
    if (sofa && startActivity(world, guest, sofa)) {
      guest.mood = Math.min(100, guest.mood + 2);
      return;
    }
  }

  const candidates = world.furniture
    .filter((item) => item.gameId && item.condition >= 18 && freeSeat(item))
    .map((item) => ({ item, score: offerScore(world, guest, item, wallet) }))
    .filter((entry) => entry.score > 0);
  const total = candidates.reduce((sum, entry) => sum + entry.score, 0);
  if (total > 0) {
    let roll = prng.nextFloat() * total;
    for (const entry of candidates) {
      roll -= entry.score;
      if (roll <= 0) { if (startActivity(world, guest, entry.item)) return; break; }
    }
  }

  const bar = world.furniture.find((item) => item.kind === 'BAR' && freeSeat(item));
  if (bar && startActivity(world, guest, bar)) return;
  waitForSpace(world, guest);
}

function playSpin(world: WorldState, ledger: Ledger, prng: Prng, guest: Guest, item: Furniture): void {
  const wallet = ledger.getBalance(guestAccount(guest.id));
  const bet = Math.min(wallet, Math.max(world.prices.slotMinBet, item.baseBet)) as VaCoinMicro;
  if (!canAfford(wallet, bet)) {
    if (guest.targetFurniture) releaseSeat(world, guest.targetFurniture, guest.id);
    guest.targetFurniture = 0;
    guest.path = [];
    guest.state = 'CASHOUT';
    return;
  }
  const result = playRound(item.gameId ?? 'SLOT', prng);
  const effects = modEffects(item);
  try {
    placeBet(ledger, guest.id, bet, world.tick);
  } catch {
    if (guest.targetFurniture) releaseSeat(world, guest.targetFurniture, guest.id);
    guest.targetFurniture = 0;
    guest.path = [];
    guest.state = 'CASHOUT';
    return;
  }
  let bps = result.multiplierBps;
  if (bps > 0 && item.mods.includes('CHERRY')) bps += 120;
  const gross = bps > 0 ? mulVC(bet, bps) : ZERO_VC;
  const house = ledger.getBalance(HAUSKONTO);
  const payout = Math.min(gross, house) as VaCoinMicro;
  if (payout > ZERO_VC) winToPending(ledger, guest.id, payout, world.tick);
  if (effects.operating > ZERO_VC) {
    try { ledger.transfer(HAUSKONTO, SHOP, effects.operating, 'mod betrieb', world.tick); } catch { /* Konto reicht nicht */ }
  }
  // Ein Rueckfluss unter dem Einsatz ist kein Gewinn: Laune folgt dem Netto, nicht dem Payout.
  const netWin = payout > bet;
  const push = payout === bet;
  guest.lastResult = payout > ZERO_VC || !item.mods.includes('NEAR_MISS') ? result.label
    : 'FAST!';
  guest.mood = clamp(guest.mood + (netWin ? 8 : push ? 0 : -2) + (effects.patience > 0 ? 1 : 0));
  guest.patience = clamp(guest.patience - 1 + effects.patience);
  guest.addiction = clamp(guest.addiction + (netWin ? 3 : 1) * getPersona(guest.persona).addictionRate);
  guest.spins += 1;
  guest.stateTicks += 1;
  item.condition = Math.max(0, item.condition - 0.18);
  if (prng.nextFloat() < 0.07) world.dirty.add((guest.position.y * world.size + guest.position.x) | 0);
  if (guest.stateTicks >= 6 || guest.patience <= 0) {
    releaseAndChoose(world, guest);
    guest.need = guest.mood < 50 ? 'drink' : 'play';
  }
}

export function actAtTarget(world: WorldState, ledger: Ledger, prng: Prng, guest: Guest, item: Furniture): void {
  if (guest.state === 'PLAY') { playSpin(world, ledger, prng, guest, item); return; }
  if (guest.state === 'DRINK') {
    if (guest.stateTicks === 0) {
      const wallet = ledger.getBalance(guestAccount(guest.id));
      if (canAfford(wallet, world.prices.drinkPrice)) {
        try { ledger.transfer(guestAccount(guest.id), HAUSKONTO, world.prices.drinkPrice, 'getraenk', world.tick); } catch { /* egal */ }
        guest.mood = clamp(guest.mood + 12);
        guest.patience = clamp(guest.patience + 9);
        guest.bubble = 'Prost!';
        guest.dirtTimer += 1;
        if (guest.dirtTimer > 4) { world.dirty.add((guest.position.y * world.size + guest.position.x) | 0); guest.dirtTimer = 0; }
      } else guest.bubble = 'Kein Geld für einen Drink.';
    }
    guest.stateTicks += 1;
    if (guest.stateTicks > 3) releaseAndChoose(world, guest);
    return;
  }
  if (guest.state === 'TOILET') {
    if (guest.stateTicks === 0) {
      guest.mood = clamp(guest.mood + 7);
      guest.patience = clamp(guest.patience + 14);
      guest.bubble = 'Endlich.';
    }
    guest.stateTicks += 1;
    if (guest.stateTicks > 2) releaseAndChoose(world, guest);
    return;
  }
  if (guest.state === 'WAIT') {
    guest.stateTicks += 1;
    if (guest.stateTicks > 3) {
      releaseAndChoose(world, guest);
      chooseActivity(world, guest, ledger, prng);
    }
    return;
  }
  releaseAndChoose(world, guest);
}

export function becomeAngry(world: WorldState, guest: Guest): void {
  if (guest.targetFurniture) releaseSeat(world, guest.targetFurniture, guest.id);
  guest.state = 'ANGRY';
  guest.stateTicks = 0;
  guest.anger = 100;
  guest.targetFurniture = 0;
  guest.bubble = 'Ich mach hier alles kaputt!';
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
