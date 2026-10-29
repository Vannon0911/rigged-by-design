/** Eigenes Casino: 8x8-Grid, Deko-Effekte, simulierte Besucher und Tresor-Deckung. */
import type { Ledger } from '../economy/ledger';
import { ZERO_VC, addVC, subVC, type VaCoinMicro } from '../economy/vacoin';
import type { Prng } from '../rng/prng';
import { pickWeightedIndex } from '../rng/weighted-pool';
import { getBuildable, getOperatorMod, type BuildableId, type OperatorModId } from './catalog';
import { playFloorGame } from './floor-games';
import { rollVisitor, type Visitor } from './visitors';

const GRID = 8;
const MAX_VISITORS = 10;
const SPAWN_CHANCE = 0.12;
const PATIENCE_LOSS = 4;

export interface PlacedItem {
  readonly id: number;
  readonly buildableId: BuildableId;
  readonly x: number;
  readonly y: number;
  mods: OperatorModId[];
}

export interface FloorTickResult {
  readonly spawned: number;
  readonly spins: number;
  readonly bets: VaCoinMicro;
  readonly payouts: VaCoinMicro;
  readonly left: number;
}

type DecoKey = 'spawnBonusBps' | 'patienceLossReductionBps' | 'startingAddiction';

export class CasinoFloor {
  readonly size = GRID;
  readonly #ledger: Ledger;
  readonly #prng: Prng;
  readonly #items: PlacedItem[] = [];
  readonly #visitors: Visitor[] = [];
  #ticks = 0;
  #nextId = 1;

  constructor(ledger: Ledger, prng: Prng) {
    this.#ledger = ledger;
    this.#prng = prng;
  }

  get tickCount(): number {
    return this.#ticks;
  }
  get items(): readonly PlacedItem[] {
    return [...this.#items];
  }
  get visitors(): readonly Visitor[] {
    return [...this.#visitors];
  }
  get slots(): readonly PlacedItem[] {
    return this.#items.filter((item) => getBuildable(item.buildableId).kind === 'SLOT');
  }
  get games(): readonly PlacedItem[] {
    return this.#items.filter((item) => getBuildable(item.buildableId).kind !== 'DECO');
  }
  get vaultBalance(): VaCoinMicro {
    return this.#ledger.getBalance('CASINO_VAULT');
  }

  placeItem(buildableId: BuildableId, x: number, y: number): PlacedItem {
    const buildable = getBuildable(buildableId);
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= GRID || y >= GRID) {
      throw new Error(`placeItem: (${x}, ${y}) liegt ausserhalb des ${GRID}x${GRID}-Grids`);
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
    if (buildable.kind !== 'SLOT') throw new Error('installMod: Mods passen nur an Slots');
    if (item.mods.includes(modId)) throw new Error(`installMod: ${modId} ist bereits installiert`);
    if (item.mods.length >= buildable.maxMods) throw new Error(`installMod: maximal ${buildable.maxMods} Mods`);
    const mod = getOperatorMod(modId);
    this.#ledger.transfer('PLAYER_CASH', 'SHOP_VENDOR', mod.priceVC, `operator mod ${modId}`, this.#ticks);
    item.mods.push(modId);
  }

  tickCasinoFloor(): FloorTickResult {
    this.#ticks += 1;
    let spawned = 0;
    const spawnChance = Math.min(0.9, SPAWN_CHANCE * (1 + this.#deco('spawnBonusBps') / 10_000));
    if (this.#visitors.length < MAX_VISITORS && this.#prng.nextFloat() < spawnChance) {
      this.#spawnVisitor(this.#deco('startingAddiction'));
      spawned = 1;
    }

    const games = this.games;
    let spins = 0;
    let bets = ZERO_VC;
    let payouts = ZERO_VC;
    let left = 0;

    for (const visitor of [...this.#visitors]) {
      if (games.length === 0) {
        visitor.patience -= 12;
        if (visitor.patience <= 0) {
          this.#removeVisitor(visitor.id);
          left += 1;
        }
        continue;
      }

      const game = this.#pickGame(games);
      const buildable = getBuildable(game.buildableId);
      const modPenalty = game.mods.reduce((sum, id) => sum + getOperatorMod(id).patiencePenalty, 0);
      visitor.patience -= PATIENCE_LOSS * (1 - this.#deco('patienceLossReductionBps') / 10_000) + modPenalty;

      const betPerLine = this.#betFor(visitor, buildable.minBetVC, buildable.maxBetVC, buildable.paylines);
      if (visitor.patience <= 0 || betPerLine === ZERO_VC) {
        this.#removeVisitor(visitor.id);
        left += 1;
        continue;
      }

      const round = playFloorGame(game.buildableId, game.mods, betPerLine, this.#prng);
      this.#ledger.transfer('EXTERNAL_WORK', 'CASINO_VAULT', round.totalBet, `visitor bet #${visitor.id}`, this.#ticks);
      visitor.wallet = subVC(visitor.wallet, round.totalBet);

      let paid = ZERO_VC;
      if (round.payout > ZERO_VC) {
        const vault = this.#ledger.getBalance('CASINO_VAULT');
        paid = round.payout <= vault ? round.payout : vault;
        if (paid > ZERO_VC) {
          this.#ledger.transfer('CASINO_VAULT', 'EXTERNAL_WORK', paid, `visitor win #${visitor.id}`, this.#ticks);
        }
        visitor.wallet = addVC(visitor.wallet, paid);
      }

      visitor.spins += 1;
      visitor.addiction = Math.min(
        100,
        visitor.addiction + (round.isNearMiss ? 18 : round.isLDW ? 12 : paid > 0 ? 6 : 3),
      );
      spins += 1;
      bets = addVC(bets, round.totalBet);
      payouts = addVC(payouts, paid);
    }

    return { spawned, spins, bets, payouts, left };
  }

  #deco(key: DecoKey): number {
    return this.#items.reduce((sum, item) => sum + getBuildable(item.buildableId)[key], 0);
  }

  #pickGame(games: readonly PlacedItem[]): PlacedItem {
    const entries = games.map((game) => ({
      value: game,
      weight: 100 + getBuildable(game.buildableId).attractionBps / 100,
    }));
    return entries[pickWeightedIndex(entries, this.#prng)]!.value;
  }

  #betFor(visitor: Visitor, min: VaCoinMicro, max: VaCoinMicro, lines: number): VaCoinMicro {
    const budget = Math.floor(visitor.wallet / lines);
    if (budget < min) return ZERO_VC;
    const wanted = visitor.addiction >= 100 ? max : Math.min(max, Math.max(min, budget));
    return Math.min(wanted, budget) as VaCoinMicro;
  }

  #spawnVisitor(startingAddiction: number): void {
    const visitor = rollVisitor(this.#nextId++, this.#prng, startingAddiction);
    const dispenser = this.#items.find((item) => getBuildable(item.buildableId).boozePatience > 0);
    if (dispenser) {
      const buildable = getBuildable(dispenser.buildableId);
      if (this.#ledger.getBalance('CASINO_VAULT') >= buildable.operatingCostVC) {
        this.#ledger.transfer('CASINO_VAULT', 'EXTERNAL_WORK', buildable.operatingCostVC, 'booze dispenser', this.#ticks);
        visitor.patience = Math.min(100, visitor.patience + buildable.boozePatience);
      }
    }
    this.#visitors.push(visitor);
  }

  #removeVisitor(id: number): void {
    const index = this.#visitors.findIndex((visitor) => visitor.id === id);
    if (index >= 0) this.#visitors.splice(index, 1);
  }
}
