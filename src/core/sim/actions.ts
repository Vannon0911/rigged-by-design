/** Commands, die nicht im Tick passieren: Spieler, Bauen, Preise, Personal, fremde Spiele. */
import type { Ledger } from '../economy/ledger';
import { fromVC, ZERO_VC, type VaCoinMicro } from '../economy/vacoin';
import { playRound, type RoundResult } from '../games/round';
import type { Prng } from '../rng/prng';
import { closeFiat, exchangeFromVc, foreignBet, foreignWin, guestAccount, HAUSKONTO, payPending, PORTEMONNAIE, SHOP, STAFF } from './money';
import { getBuildDef, getMod, type BuildId } from './offers';
import { blockedTiles, findPath, nearestWalkable } from './pathfinding';
import type { CarpetId, Furniture, GameId, ModId, Point, WorldState } from './types';
import { canPlace, furnitureById, guestById, interactionPoint } from './world';

/**
 * Vor einem Umbau: erst alle Ansprueruche buchen, dann die Gaeste entfernen.
 * Scheitert eine Buchung, bleibt die Welt unveraendert und der Fehler steigt auf.
 */
export function settleGuests(world: WorldState, ledger: Ledger): void {
  for (const guest of world.guests) {
    payPending(ledger, guest.id, world.tick);
    const balance = ledger.getBalance(guestAccount(guest.id));
    if (balance > ZERO_VC) exchangeFromVc(ledger, guest.id, balance, world.tick);
    closeFiat(ledger, guest.id, world.tick);
  }
  world.guests = [];
}

export function movePlayer(world: WorldState, target: Point): void {
  const walkable = nearestWalkable(world.size, blockedTiles(world.size, world.furniture), target);
  if (!walkable) return;
  world.player.path = findPath(world.size, blockedTiles(world.size, world.furniture), world.player.position, walkable);
  world.player.pathIndex = 0;
}

const near = (a: Point, b: Point, distance = 2): boolean => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) <= distance;

export function takeDrink(world: WorldState): void {
  if (world.player.carrying === 'DRINK') throw new Error('Du traegst schon einen Drink.');
  const bar = world.furniture.find((item) => item.kind === 'BAR');
  const spot = bar ? interactionPoint(world, bar) : null;
  if (!spot || !near(world.player.position, spot)) throw new Error('Geh erst zur Bar.');
  world.player.carrying = 'DRINK';
  world.lastEvent = 'Drink gezapft. Jetzt zum Gast bringen.';
}

export function serveDrink(world: WorldState, ledger: Ledger, guestId: number): void {
  if (world.player.carrying !== 'DRINK') throw new Error('Du hast keinen Drink dabei.');
  const guest = guestById(world, guestId);
  if (!guest) throw new Error('Gast nicht gefunden.');
  if (!near(world.player.position, guest.position, 3)) throw new Error('Geh erst zum Gast.');
  const price = world.prices.drinkPrice;
  if (ledger.getBalance(guestAccount(guest.id)) >= price) {
    ledger.transfer(guestAccount(guest.id), HAUSKONTO, price, `gast ${guest.id} drink`, world.tick);
  }
  guest.mood = Math.min(100, guest.mood + 13);
  guest.patience = Math.min(100, guest.patience + 12);
  // Nur wer schon gespielt hat, koppelt den Drink an den Kick; sonst wird niemand vom Zuschauen süchtig.
  if (guest.spins > 0) guest.addiction = Math.min(100, guest.addiction + 2);
  world.player.carrying = '';
  world.lastEvent = `${guest.name} hat einen Drink bekommen.`;
}

export function payGuest(world: WorldState, ledger: Ledger, guestId: number, tick: number): VaCoinMicro {
  const amount = ledger.getBalance(`PENDING_${guestId}`);
  if (amount <= ZERO_VC) return ZERO_VC;
  ledger.transfer(`PENDING_${guestId}`, `VISITOR_${guestId}`, amount, `gast ${guestId} auszahlung`, tick);
  const guest = guestById(world, guestId);
  if (guest) {
    guest.mood = Math.min(100, guest.mood + 6);
    guest.patience = Math.min(100, guest.patience + 5);
  }
  return amount;
}

export function cleanTile(world: WorldState, ledger: Ledger, tile: number): void {
  if (!world.dirty.has(tile)) return;
  ledger.transfer(HAUSKONTO, SHOP, world.prices.cleaningCost, 'reinigung', world.tick);
  world.dirty.delete(tile);
}

export function cleanAll(world: WorldState, ledger: Ledger): number {
  const count = world.dirty.size;
  if (count === 0) return 0;
  ledger.transfer(HAUSKONTO, SHOP, (world.prices.cleaningCost * count) as VaCoinMicro, 'grossreinigung', world.tick);
  world.dirty.clear();
  return count;
}

export function repair(world: WorldState, ledger: Ledger, itemId: number): void {
  const item = furnitureById(world, itemId);
  if (!item || (item.condition >= 100 && !item.damaged)) return;
  ledger.transfer(HAUSKONTO, SHOP, world.prices.repairCost, 'reparatur', world.tick);
  item.condition = 100;
  item.damaged = false;
}

export function hire(world: WorldState, ledger: Ledger, role: 'guard' | 'cleaner' | 'bartender'): void {
  if (world.staff[role]) return;
  const cost = role === 'guard' ? world.prices.guardWage : world.prices.staffWage;
  ledger.transfer(HAUSKONTO, STAFF, cost, 'einstellung', world.tick);
  world.staff[role] = true;
  if (role === 'guard') world.guardsHired += 1;
  world.lastEvent = `${role === 'guard' ? 'Guard' : role === 'cleaner' ? 'Reinigungskraft' : 'Barkeeper'} eingestellt.`;
}

export function fire(world: WorldState, role: 'guard' | 'cleaner' | 'bartender'): void {
  world.staff[role] = false;
  world.lastEvent = 'Personal entlassen.';
}

export function setPrice(world: WorldState, key: 'drinkPrice' | 'slotMinBet', value: VaCoinMicro): void {
  if (value < 0) return;
  world.prices[key] = value;
}

export function setCarpet(world: WorldState, carpet: CarpetId): void {
  world.carpet = carpet;
}

export function build(world: WorldState, ledger: Ledger, buildId: BuildId, x: number, y: number): Furniture {
  const def = getBuildDef(buildId);
  if (!canPlace(world, x, y, def.w, def.h, def.seats > 0)) throw new Error('Da ist kein Platz.');
  ledger.transfer(HAUSKONTO, SHOP, def.cost, `kauf ${def.name}`, world.tick);
  const zone = world.zones.find((entry) =>
    x >= entry.x && y >= entry.y && x < entry.x + entry.w && y < entry.y + entry.h);
  const item: Furniture = {
    id: world.nextFurnitureId++, kind: def.kind, gameId: def.gameId, x, y, w: def.w, h: def.h,
    seats: def.seats, label: def.name, price: def.cost, quality: def.quality, condition: 100, damaged: false,
    dirt: 0, zoneId: zone?.id ?? 'gaming', occupants: [], mods: [], reels: def.reels, baseBet: def.baseBet,
  };
  world.furniture.push(item);
  return item;
}

export function installMod(world: WorldState, ledger: Ledger, itemId: number, modId: ModId): void {
  const item = furnitureById(world, itemId);
  if (!item || !item.gameId) throw new Error('Kein Spielautomat.');
  if (item.mods.includes(modId)) throw new Error('Mod ist schon verbaut.');
  if (item.mods.length >= 3) throw new Error('Maximal drei Mods pro Automat.');
  if (modId === 'EXTRA_REEL' && item.kind !== 'SLOT') throw new Error('Die vierte Walze passt nur in Slots.');
  const mod = getMod(modId);
  ledger.transfer(HAUSKONTO, SHOP, mod.cost, `mod ${mod.name}`, world.tick);
  item.mods.push(modId);
}

export function upgradeReels(world: WorldState, ledger: Ledger, itemId: number): void {
  const item = furnitureById(world, itemId);
  if (!item || item.kind !== 'SLOT') throw new Error('Nur Slots haben Walzen.');
  if (item.reels >= 5) throw new Error('Mehr Walzen passen nicht hinein.');
  ledger.transfer(HAUSKONTO, SHOP, fromVC(4 + item.reels * 2), 'walze erweitern', world.tick);
  item.reels += 1;
}

export function setBaseBet(world: WorldState, itemId: number, bet: VaCoinMicro): void {
  const item = furnitureById(world, itemId);
  if (!item || bet < ZERO_VC) return;
  item.baseBet = bet;
}

export function testSpin(item: Furniture, prng: Prng): RoundResult {
  return playRound(item.gameId ?? 'SLOT', prng);
}

export function foreignRound(
  ledger: Ledger,
  game: GameId,
  bet: VaCoinMicro,
  prng: Prng,
  tick: number,
  houseEdgeBps = 250,
): { payout: VaCoinMicro; label: string; detail: readonly string[]; game: GameId } {
  if (ledger.getBalance(PORTEMONNAIE) < bet) throw new Error('Nicht genug Bargeld. Hebe am Hauskonto ab.');
  foreignBet(ledger, bet, tick);
  const result = playRound(game, prng);
  const adjusted = Math.max(0, result.multiplierBps - (result.multiplierBps > 0 ? houseEdgeBps : 0));
  const payout = Math.round((bet * adjusted) / 10_000) as VaCoinMicro;
  if (payout > 0) foreignWin(ledger, payout, tick);
  return { payout, label: result.label, detail: result.detail, game };
}
