/** Ein Store, ein Besitzer: Ledger, Floor, PRNG, Tick, Save. */
import { Ledger } from '../core/economy/ledger';
import { toVCString, type VaCoinMicro } from '../core/economy/vacoin';
import type { FloorRoundEvent } from '../core/floor/events';
import { CasinoFloor } from '../core/floor/floor';
import type { FloorTickResult } from '../core/floor/types';
import type { ItemId } from '../core/offer/catalog';
import type { ModId } from '../core/offer/mods';
import type { ReelId } from '../core/offer/reels';
import { Prng } from '../core/rng/prng';
import type { HouseSpinResult } from '../core/visit/houses';
import { gameplayHouse } from './visit';
import { consumeLegacySave, loadSave, replayLedger, saveGame } from './save';
import { buildSnapshot } from './snapshot';
import type { GameSnapshot } from './types';

const TICK_MS = 1000;
const EVENT_BUFFER = 8;

class GameStore {
  readonly #prng: Prng;
  #ledger: Ledger;
  #floor: CasinoFloor;
  #tick = 0;
  #notice = '0.0000 VC. Dein erster Automat steht.';
  #events: FloorRoundEvent[] = [];
  #lastHouse: HouseSpinResult | null = null;
  #listeners = new Set<() => void>();
  #timer: ReturnType<typeof setInterval> | null = null;
  #snapshot: GameSnapshot;

  constructor() {
    const legacy = consumeLegacySave();
    const saved = loadSave();
    const replayed = saved ? replayLedger(saved.ledger) : null;
    this.#prng = new Prng(saved?.prngState ?? (Date.now() >>> 0));
    if (saved && replayed) {
      try {
        this.#ledger = replayed;
        this.#floor = new CasinoFloor(replayed, this.#prng, { venueTier: saved.floor.venueTier });
        this.#floor.restore(saved.floor);
        if (this.#floor.machines.length === 0) this.#floor.ensureStarterMachine();
        this.#tick = saved.tick;
        this.#notice = 'Spielstand geladen.';
      } catch {
        this.#ledger = new Ledger();
        this.#floor = new CasinoFloor(this.#ledger, this.#prng);
        this.#floor.ensureStarterMachine();
        this.#notice = 'Spielstand unlesbar. Neuanfang mit einem Automaten.';
      }
    } else {
      this.#ledger = new Ledger();
      this.#floor = new CasinoFloor(this.#ledger, this.#prng);
      this.#floor.ensureStarterMachine();
      this.#notice = legacy
        ? 'Alter Spielstand verworfen. Dein neuer Automat steht gratis.'
        : 'Bargeld 0. Dein Automat steht gratis. Gäste zahlen in den Tresor.';
    }
    this.#snapshot = this.#build();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    if (this.#timer === null) this.#timer = setInterval(() => this.#advance(), TICK_MS);
    return () => {
      this.#listeners.delete(listener);
      if (this.#listeners.size === 0 && this.#timer !== null) {
        clearInterval(this.#timer);
        this.#timer = null;
      }
    };
  };

  getSnapshot = (): GameSnapshot => this.#snapshot;
  get ledger(): Ledger { return this.#ledger; }
  get floor(): CasinoFloor { return this.#floor; }
  get tick(): number { return this.#tick; }
  get prng(): Prng { return this.#prng; }

  placeItem(itemId: ItemId, x: number, y: number): void {
    this.#guard(() => {
      const item = this.#floor.place(itemId, x, y);
      this.#notice = `${item.catalogId} platziert.`;
    });
  }

  buyReel(reelId: ReelId): void {
    this.#guard(() => { this.#floor.buyReel(reelId); this.#notice = 'Walze gekauft und im Inventar.'; });
  }

  swapReel(machineId: number, slot: number, reelId: ReelId): void {
    this.#guard(() => { this.#floor.swapReel(machineId, slot, reelId); this.#notice = 'Walze getauscht.'; });
  }

  addReelSlot(machineId: number): void {
    this.#guard(() => { this.#floor.addReelSlot(machineId); this.#notice = 'Walze eingebaut.'; });
  }

  removeReel(machineId: number, slot: number): void {
    this.#guard(() => { this.#floor.removeReel(machineId, slot); this.#notice = 'Walze ausgebaut.'; });
  }

  installMod(machineId: number, modId: ModId): void {
    this.#guard(() => { this.#floor.installMod(machineId, modId); this.#notice = 'Mod verbaut.'; });
  }

  setBaseBet(machineId: number, bet: VaCoinMicro): void {
    this.#guard(() => { this.#floor.setBaseBet(machineId, bet); this.#notice = `Einsatz auf ${toVCString(bet)} gesetzt.`; });
  }

  upgradeVenue(): void {
    this.#guard(() => { this.#floor.upgradeVenue(); this.#notice = 'Neue Venue-Stufe freigeschaltet.'; });
  }

  withdrawVault(): void {
    this.#guard(() => {
      const amount = this.#ledger.getBalance('CASINO_VAULT');
      if (amount <= 0) throw new Error('Der Tresor ist leer.');
      this.#ledger.transfer('CASINO_VAULT', 'PLAYER_CASH', amount, 'vault withdraw', this.#tick);
      this.#notice = `${toVCString(amount)} aus dem Tresor in die Kasse.`;
    });
  }

  payAllVisitors(): void {
    this.#guard(() => {
      const paid = this.#floor.payAllVisitors();
      if (paid <= 0) throw new Error('Keine offenen Gewinne.');
      this.#notice = `${toVCString(paid)} an wartende Gäste ausgezahlt.`;
    });
  }

  payVisitor(id: number): void {
    this.#guard(() => {
      const paid = this.#floor.payVisitor(id);
      this.#notice = `${toVCString(paid)} an Gast #${id} ausgezahlt.`;
    });
  }

  visit(houseId: Parameters<typeof gameplayHouse>[0], bet: VaCoinMicro): void {
    this.#guard(() => {
      this.#lastHouse = gameplayHouse(houseId, bet, this.#ledger, this.#prng, this.#tick);
      this.#notice = this.#lastHouse.payout > 0
        ? `Gewinn im fremden Haus: ${toVCString(this.#lastHouse.payout)}.`
        : `Niete im fremden Haus. ${toVCString(this.#lastHouse.totalBet)} weg.`;
    });
  }

  dismissNotice(): void {
    this.#notice = '';
    this.#emit(false);
  }

  #advance(): void {
    this.#tick += 1;
    const result: FloorTickResult = this.#floor.tick();
    if (result.events.length > 0) {
      this.#events = [...this.#events, ...result.events].slice(-EVENT_BUFFER);
    }
    this.#emit(this.#tick % 5 === 0);
  }

  #guard(action: () => void): void {
    try {
      action();
      this.#emit();
    } catch (error) {
      this.#notice = error instanceof Error ? error.message : 'Unbekannter Fehler.';
      this.#emit();
    }
  }

  #emit(save = true): void {
    this.#snapshot = this.#build();
    if (save) saveGame(this.#floor, this.#ledger, this.#tick, this.#prng.getState());
    for (const listener of this.#listeners) listener();
  }

  #build(): GameSnapshot {
    return buildSnapshot({
      ledger: this.#ledger,
      floor: this.#floor,
      tick: this.#tick,
      notice: this.#notice,
      events: this.#events,
      lastHouse: this.#lastHouse,
    });
  }
}

export const gameStore = new GameStore();
