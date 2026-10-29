/** Eigenes Casino: Grid, Maschinen, Deko, Walzen-Inventar, Gäste, Miete. */
import type { Ledger } from '../economy/ledger';
import { addVC, fromVC, ZERO_VC, type VaCoinMicro } from '../economy/vacoin';
import { getItem, type ItemId } from '../offer/catalog';
import { getMod, type ModId } from '../offer/mods';
import { getReel, type ReelId } from '../offer/reels';
import { reelSlotsOf, type MachineState } from '../machine/machine';
import { assertRtp } from '../machine/guard';
import type { Prng } from '../rng/prng';
import { getVenue, nextVenue, type VenueTier } from '../venues';
import type { FloorRoundEvent } from './events';
import { assertCell, freeCell } from './geometry';
import { machinesOf } from './items';
import { chargeRent } from './maintenance';
import type { FloorSnapshot, PlacedItem } from './types';
import { tickFloor } from '../visitors/tick';
import { payoutVisitor, releaseVisitor } from '../visitors/ledger';
import { getPersona } from '../visitors/persona';
import type { Visitor } from '../visitors/visitor';

export class CasinoFloor {
  readonly #ledger: Ledger;
  readonly #prng: Prng;
  #items: PlacedItem[] = [];
  #visitors: Visitor[] = [];
  #ownedReels: ReelId[] = [];
  #venueTier: VenueTier;
  #ticks = 0;
  #nextId = 1;
  #nextEventId = 1;
  #revenue: VaCoinMicro = ZERO_VC;

  constructor(ledger: Ledger, prng: Prng, options: { venueTier?: VenueTier } = {}) {
    this.#ledger = ledger;
    this.#prng = prng;
    this.#venueTier = options.venueTier ?? 1;
  }

  get venueTier(): VenueTier { return this.#venueTier; }
  get size(): number { return getVenue(this.#venueTier).gridSize; }
  get ticks(): number { return this.#ticks; }
  get items(): readonly PlacedItem[] { return [...this.#items]; }
  get visitors(): readonly Visitor[] { return [...this.#visitors]; }
  get ownedReels(): readonly ReelId[] { return [...this.#ownedReels]; }
  get machines(): readonly MachineState[] { return machinesOf(this.#items); }
  get revenueVC(): VaCoinMicro { return this.#revenue; }

  ensureStarterMachine(): PlacedItem | null {
    if (this.machines.length > 0) return null;
    const free = freeCell(this.#items, this.size);
    if (!free) return null;
    const def = getItem('SLOT_RUSTY');
    const item: PlacedItem = { id: this.#nextId++, catalogId: def.id, x: free.x, y: free.y, reels: def.starterReels, mods: [], baseBet: fromVC(0.08) };
    this.#items.push(item);
    // Startpaket: eine Gratis-Walze, damit der erste Umbau sofort moeglich ist.
    this.#ownedReels.push('REEL_CHERRY');
    return item;
  }

  place(catalogId: ItemId, x: number, y: number): PlacedItem {
    const def = getItem(catalogId);
    if (def.minVenueTier > this.#venueTier) throw new Error(`${def.name} braucht Venue-Stufe ${def.minVenueTier}.`);
    assertCell(this.#items, this.size, x, y);
    this.#ledger.transfer('PLAYER_CASH', 'SHOP_VENDOR', def.priceVC, `buy ${catalogId}`, this.#ticks);
    const item: PlacedItem = { id: this.#nextId++, catalogId, x, y, reels: def.kind === 'MACHINE' ? def.starterReels : [], mods: [], baseBet: def.kind === 'MACHINE' ? def.minBetVC : ZERO_VC };
    this.#items.push(item);
    return item;
  }

  buyReel(reelId: ReelId): void {
    const reel = getReel(reelId);
    this.#ledger.transfer('PLAYER_CASH', 'SHOP_VENDOR', reel.priceVC, `buy reel ${reelId}`, this.#ticks);
    this.#ownedReels.push(reelId);
  }

  swapReel(machineId: number, slot: number, reelId: ReelId): void {
    const machine = this.#machine(machineId);
    if (slot < 0 || slot >= machine.reels.length) throw new Error(`Slot ${slot} existiert nicht.`);
    const owned = this.#ownedReels.indexOf(reelId);
    if (owned < 0) throw new Error(`Walze ${reelId} ist nicht im Inventar.`);
    const reels = [...machine.reels];
    const old = reels[slot]!;
    reels[slot] = reelId;
    const next = { ...machine, reels };
    assertRtp(next, this.#venueTier);
    this.#ownedReels.splice(owned, 1);
    this.#write(machine.id, next);
    this.#ownedReels.push(old);
  }

  addReelSlot(machineId: number): void {
    const machine = this.#machine(machineId);
    if (machine.reels.length >= reelSlotsOf(machine)) throw new Error('Erst einen Mod für mehr Walzen kaufen.');
    if (machine.reels.length >= 6) throw new Error('Maximal sechs Walzen.');
    const owned = this.#ownedReels.shift();
    if (!owned) throw new Error('Keine Walze im Inventar.');
    const next = { ...machine, reels: [...machine.reels, owned] };
    assertRtp(next, this.#venueTier);
    this.#write(machine.id, next);
  }
  removeReel(machineId: number, slot: number): void {
    const machine = this.#machine(machineId);
    if (machine.reels.length <= 3) throw new Error('Mindestens drei Walzen.');
    const reel = machine.reels[slot];
    if (!reel) throw new Error(`Slot ${slot} existiert nicht.`);
    this.#ownedReels.push(reel);
    this.#write(machine.id, { ...machine, reels: machine.reels.filter((_, index) => index !== slot) });
  }
  installMod(machineId: number, modId: ModId): void {
    const machine = this.#machine(machineId);
    const mod = getMod(modId);
    const def = getItem(machine.catalogId);
    if (mod.minVenueTier > this.#venueTier) throw new Error(`${mod.name} braucht Venue-Stufe ${mod.minVenueTier}.`);
    if (machine.mods.includes(modId)) throw new Error(`${mod.name} ist schon verbaut.`);
    if (machine.mods.length >= def.maxMods) throw new Error(`Maximal ${def.maxMods} Mods pro Maschine.`);
    const next = { ...machine, mods: [...machine.mods, modId] };
    assertRtp(next, this.#venueTier);
    this.#ledger.transfer('PLAYER_CASH', 'SHOP_VENDOR', mod.priceVC, `mod ${modId}`, this.#ticks);
    this.#write(machine.id, next);
  }

  setBaseBet(machineId: number, bet: VaCoinMicro): void {
    const machine = this.#machine(machineId);
    const def = getItem(machine.catalogId);
    if (!Number.isSafeInteger(bet) || bet < def.minBetVC || bet > def.maxBetVC) throw new Error(`Einsatz zwischen ${def.minBetVC} und ${def.maxBetVC} nötig.`);
    this.#write(machine.id, { ...machine, baseBet: bet });
  }
  upgradeVenue(): VenueTier {
    const next = nextVenue(this.#venueTier);
    if (!next) throw new Error('Maximale Venue-Stufe erreicht.');
    if (this.machines.length < next.tier - 1) throw new Error(`Für ${next.name} brauchst du ${next.tier - 1} Automaten.`);
    for (const machine of this.machines) assertRtp(machine, next.tier);
    this.#ledger.transfer('PLAYER_CASH', 'SHOP_VENDOR', next.upgradeCostVC, `venue upgrade ${next.tier}`, this.#ticks);
    this.#venueTier = next.tier;
    return next.tier;
  }
  tick(): { events: readonly FloorRoundEvent[]; spawned: number; spins: number; bets: VaCoinMicro; payouts: VaCoinMicro; left: number } {
    this.#ticks += 1;
    chargeRent(this.#ledger, this.#venueTier, this.#ticks);
    const result = tickFloor({
      ledger: this.#ledger, prng: this.#prng, machines: this.machines, visitors: this.#visitors, ticks: this.#ticks,
      decor: this.#items.filter((item) => getItem(item.catalogId).kind === 'DECO'),
      maxVisitors: getVenue(this.#venueTier).maxVisitors, venueTier: this.#venueTier,
      nextId: () => this.#nextId++, nextEventId: () => this.#nextEventId++, removeVisitor: (id) => this.#removeVisitor(id),
    });
    this.#revenue = (this.#revenue + result.bets - result.payouts) as VaCoinMicro;
    return result;
  }

  payVisitor(id: number): VaCoinMicro {
    const visitor = this.#visitors.find((entry) => entry.id === id);
    if (!visitor) throw new Error(`Gast ${id} nicht gefunden.`);
    if (visitor.pendingPayout <= ZERO_VC) throw new Error('Keine offene Auszahlung.');
    return payoutVisitor(this.#ledger, visitor, this.#ticks);
  }
  payAllVisitors(): VaCoinMicro {
    let total = ZERO_VC;
    for (const visitor of this.#visitors) if (visitor.pendingPayout > ZERO_VC) total = addVC(total, payoutVisitor(this.#ledger, visitor, this.#ticks));
    return total;
  }
  snapshot(): FloorSnapshot {
    return {
      ticks: this.#ticks, nextId: this.#nextId, venueTier: this.#venueTier, ownedReels: [...this.#ownedReels], totalRevenueVC: this.#revenue,
      items: this.#items.map((item) => ({ ...item, reels: [...item.reels], mods: [...item.mods] })),
      visitors: this.#visitors.map((visitor) => ({ ...visitor })),
    };
  }

  restore(state: FloorSnapshot): void {
    if (!Number.isInteger(state.ticks) || state.ticks < 0) throw new Error('Ungültige Ticks.');
    this.#ticks = state.ticks;
    this.#nextId = state.nextId;
    this.#venueTier = getVenue(state.venueTier).tier;
    this.#ownedReels = [...state.ownedReels];
    this.#revenue = state.totalRevenueVC;
    this.#items = state.items.map((item) => ({ ...item, reels: [...item.reels], mods: [...item.mods] }));
    this.#visitors = state.visitors.map((visitor) => ({ ...visitor, pendingPayout: visitor.pendingPayout ?? ZERO_VC, buyIn: visitor.buyIn ?? visitor.wallet, target: visitor.target ?? 0, patience: visitor.patience ?? getPersona(visitor.persona).patience }));
  }

  #removeVisitor(id: number): boolean {
    const index = this.#visitors.findIndex((visitor) => visitor.id === id);
    if (index < 0) return false;
    const visitor = this.#visitors[index]!;
    if (visitor.pendingPayout > ZERO_VC) return false;
    releaseVisitor(this.#ledger, visitor, this.#ticks);
    this.#visitors.splice(index, 1);
    return true;
  }

  #machine(id: number): MachineState {
    const machine = this.machines.find((entry) => entry.id === id);
    if (!machine) throw new Error(`Maschine ${id} nicht gefunden.`);
    return machine;
  }

  #write(id: number, next: MachineState): void {
    const index = this.#items.findIndex((entry) => entry.id === id);
    this.#items[index] = { ...this.#items[index]!, reels: [...next.reels], mods: [...next.mods], baseBet: next.baseBet };
  }
}
