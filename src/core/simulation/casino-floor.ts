/** Eigenes Casino: dynamisches Venue-Grid, Deko-Effekte, Besucher und Tresor-Deckung. */
import type { Ledger } from '../economy/ledger';
import { ZERO_VC, addVC, type VaCoinMicro } from '../economy/vacoin';
import type { Prng } from '../rng/prng';
import { getVenue, isBuildableAllowed, type VenueTier } from '../progression/venues-and-tiers';
import { getBuildable, getOperatorMod, type BuildableId, type OperatorModId } from './catalog';
import { tickFloor } from './floor-tick';
import type { FloorSnapshot, FloorTickResult, FloorView, PlacedItem } from './floor-types';
import { payoutVisitor, reconcileVisitorPool, releaseVisitor } from './visitor-ledger';
import type { Visitor } from './visitors';

export type { FloorSnapshot, FloorTickResult, FloorView, PlacedItem } from './floor-types';

const MAX_VISITORS = 10;

export interface CasinoFloorOptions {
  readonly venueTier?: VenueTier;
  readonly enforceVenue?: boolean;
}

export class CasinoFloor implements FloorView {
  readonly #ledger: Ledger;
  readonly #prng: Prng;
  readonly #items: PlacedItem[] = [];
  readonly #visitors: Visitor[] = [];
  #venueTier: VenueTier;
  #size: number;
  #enforceVenue: boolean;
  #ticks = 0;
  #nextId = 1;
  #nextEventId = 1;

  constructor(ledger: Ledger, prng: Prng, options: CasinoFloorOptions = {}) {
    this.#ledger = ledger;
    this.#prng = prng;
    this.#venueTier = options.venueTier ?? 3;
    this.#size = getVenue(this.#venueTier).gridSize;
    this.#enforceVenue = options.enforceVenue ?? false;
  }

  get venueTier(): VenueTier { return this.#venueTier; }
  get size(): number { return this.#size; }
  get tickCount(): number { return this.#ticks; }
  get items(): readonly PlacedItem[] { return [...this.#items]; }
  get visitors(): readonly Visitor[] { return [...this.#visitors]; }
  get slots(): readonly PlacedItem[] {
    return this.#items.filter((item) => getBuildable(item.buildableId).kind === 'SLOT');
  }
  get games(): readonly PlacedItem[] {
    return this.#items.filter((item) => getBuildable(item.buildableId).kind !== 'DECO');
  }
  get vaultBalance(): VaCoinMicro { return this.#ledger.getBalance('CASINO_VAULT'); }

  /** Kostenloses Startgeschaeft: die erste Hütchenspieler-Kiste im 4x4-Hinterhof. */
  ensureStarterGame(): PlacedItem | null {
    if (this.games.length > 0 || this.#items.length >= this.#size * this.#size) return null;
    const occupied = new Set(this.#items.map((item) => `${item.x},${item.y}`));
    let x = 0;
    let y = 0;
    while (occupied.has(`${x},${y}`) && y < this.#size) {
      x += 1;
      if (x >= this.#size) { x = 0; y += 1; }
    }
    if (y >= this.#size) return null;
    const starter: PlacedItem = { id: this.#nextId++, buildableId: 'SHELL_CART', x, y, mods: [] };
    this.#items.push(starter);
    return starter;
  }

  setVenueTier(tier: VenueTier): void {
    const venue = getVenue(tier);
    this.#venueTier = venue.tier;
    this.#size = venue.gridSize;
  }

  payVisitor(id: number): VaCoinMicro {
    const visitor = this.#visitors.find((entry) => entry.id === id);
    if (!visitor) throw new Error(`payVisitor: Besucher ${id} nicht gefunden`);
    if (visitor.pendingPayout <= ZERO_VC) throw new Error('payVisitor: keine offene Auszahlung');
    return payoutVisitor(this.#ledger, visitor, this.#ticks);
  }

  snapshot(): FloorSnapshot {
    return {
      ticks: this.#ticks,
      nextId: this.#nextId,
      items: this.#items.map((item) => ({ ...item, mods: [...item.mods] })),
      visitors: this.#visitors.map((visitor) => ({ ...visitor })),
      venueTier: this.#venueTier,
      size: this.#size,
    };
  }

  restore(state: FloorSnapshot): void {
    if (!Number.isInteger(state.ticks) || state.ticks < 0) throw new Error('restore: ungueltige Tick-Zahl');
    if (!Number.isInteger(state.nextId) || state.nextId < 1) throw new Error('restore: ungueltige ID');
    if (!Array.isArray(state.items) || !Array.isArray(state.visitors)) throw new Error('restore: ungueltiger Floor');
    this.#ticks = state.ticks;
    this.#nextId = state.nextId;
    if (state.venueTier) {
      this.#venueTier = getVenue(state.venueTier).tier;
      this.#size = getVenue(state.venueTier).gridSize;
    }
    this.#items.splice(0, this.#items.length, ...state.items.map((item) => ({ ...item, mods: [...item.mods] })));
    this.#visitors.splice(0, this.#visitors.length, ...state.visitors.map((visitor) => ({
      ...visitor,
      pendingPayout: visitor.pendingPayout ?? ZERO_VC,
      buyIn: visitor.buyIn ?? addVC(visitor.wallet, visitor.pendingPayout ?? ZERO_VC),
    })));
    reconcileVisitorPool(this.#ledger, this.#visitors, this.#ticks);
  }

  placeItem(buildableId: BuildableId, x: number, y: number): PlacedItem {
    const buildable = getBuildable(buildableId);
    if (this.#enforceVenue && !isBuildableAllowed(this.#venueTier, buildableId)) {
      throw new Error(`${buildable.name} ist in ${getVenue(this.#venueTier).name} nicht freigeschaltet`);
    }
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= this.#size || y >= this.#size) {
      throw new Error(`placeItem: (${x}, ${y}) liegt ausserhalb des ${this.#size}x${this.#size}-Grids`);
    }
    if (this.#items.some((item) => item.x === x && item.y === y)) {
      throw new Error(`placeItem: (${x}, ${y}) ist bereits belegt`);
    }
    this.#ledger.transfer('PLAYER_CASH', 'SHOP_VENDOR', buildable.priceVC, `build ${buildableId}`, this.#ticks);
    const item: PlacedItem = { id: this.#nextId++, buildableId, x, y, mods: [] };
    this.#items.push(item);
    return item;
  }

  installMod(itemId: number, modId: OperatorModId): void {
    const item = this.#items.find((candidate) => candidate.id === itemId);
    if (!item) throw new Error(`installMod: Bauobjekt ${itemId} nicht gefunden`);
    const buildable = getBuildable(item.buildableId);
    const mod = getOperatorMod(modId);
    if (buildable.kind === 'DECO' || !mod.appliesTo.includes(buildable.kind)) {
      throw new Error(`installMod: ${mod.name} passt nicht an ${buildable.name}`);
    }
    if (mod.minVenueTier > this.#venueTier) {
      throw new Error(`installMod: ${mod.name} braucht Venue-Stufe ${mod.minVenueTier}`);
    }
    if (item.mods.includes(modId)) throw new Error(`installMod: ${modId} ist bereits installiert`);
    if (item.mods.length >= buildable.maxMods) throw new Error(`installMod: maximal ${buildable.maxMods} Mods`);
    this.#ledger.transfer('PLAYER_CASH', 'SHOP_VENDOR', mod.priceVC, `operator mod ${modId}`, this.#ticks);
    item.mods.push(modId);
  }

  tickCasinoFloor(): FloorTickResult {
    this.#ticks += 1;
    return tickFloor({
      ledger: this.#ledger,
      prng: this.#prng,
      items: this.#items,
      games: this.games,
      visitors: this.#visitors,
      ticks: this.#ticks,
      maxVisitors: MAX_VISITORS,
      venueTier: this.#venueTier,
      nextId: () => this.#nextId++,
      nextEventId: () => this.#nextEventId++,
      removeVisitor: (id) => this.#removeVisitor(id),
    });
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
}
