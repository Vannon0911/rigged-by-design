// @loc-exception: Der eine Store buendelt alle Commands auf denselben Weltzustand; Aufteilen wuerde die Eigentumsgarantie verwischen.
/** Ein Besitzer: Welt, Ledger, PRNG, Uhr und Save. */
import { Ledger } from '../core/economy/ledger';
import { fromVC, toVCString, ZERO_VC, type VaCoinMicro } from '../core/economy/vacoin';
import type { GameResult } from '../core/games/contracts';
import {
  cleanAll, cleanTile, foreignRound, installMod,
  payGuest, repair, setBaseBet, setCarpet, setPrice,
  testSpin, upgradeReels,
} from '../core/sim/actions';
import {
  deployHeldCrate, movePlayer, pickupCrate, serveDesk, serveDrink,
  setNeonColor, setWallColor, storeHeldCrate, takeDrink, upgradeBar, upgradeWc,
} from '../core/sim/player';
import { buyCrate, orderDrinks, orderParts } from '../core/sim/deliveries';
import { calmDispute } from '../core/sim/disputes';
import { HAUSKONTO, HOUSE_FLOAT, playerTakeHome } from '../core/sim/money';
import { fireAgent, hireAgent } from '../core/sim/staff';
import type { BuildId } from '../core/sim/offers';
import { remodel } from '../core/sim/remodel';
import { createWorld, ensureStarter } from '../core/sim/templates';
import { tickWorld } from '../core/sim/tick';
import type { CarpetId, GameId, ModId, Point, StaffRole, TemplateId, WorldState } from '../core/sim/types';
import { Prng } from '../core/rng/prng';
import { buildView } from './snapshot';
import { clearOldSave, loadWorld, saveWorld } from './save';
import type { GameView } from './types';

const TICK_MS = 520;

class WorldStore {
  #ledger = new Ledger();
  #prng = new Prng(Date.now() >>> 0); // @seed-initializer
  #world: WorldState = createWorld('SMALL');
  #view: GameView;
  #notice = '0,00 VC im Hauskonto. Dein erster Automat steht gratis. Gäste kommen zum Eingang.';
  #listeners = new Set<() => void>();
  #timer: ReturnType<typeof setInterval> | null = null;
  #savedTick = 0;

  constructor() {
    const hadOld = clearOldSave();
    const loaded = loadWorld();
    if (loaded) {
      this.#world = loaded.world;
      this.#ledger = loaded.ledger;
      this.#prng = new Prng(loaded.prngState);
      this.#notice = 'Spielstand geladen.';
    } else {
      ensureStarter(this.#world);
      this.#notice = hadOld
        ? 'Alter Spielstand verworfen. Neues Casino, neuer Gratis-Automat.'
        : this.#notice;
    }
    this.#view = buildView(this.#world, this.#ledger, this.#notice);
  }

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    if (this.#timer === null) this.#timer = setInterval(this.#advance, TICK_MS);
    return () => {
      this.#listeners.delete(listener);
      if (this.#listeners.size === 0 && this.#timer !== null) {
        clearInterval(this.#timer);
        this.#timer = null;
      }
    };
  };

  getSnapshot = (): GameView => this.#view;

  newGame(template: TemplateId = 'SMALL'): void {
    this.#world = createWorld(template);
    this.#ledger = new Ledger();
    this.#prng = new Prng((Date.now() ^ 0x9e3779b9) >>> 0); // @seed-initializer
    this.#notice = 'Neues Casino. Ein Automat steht gratis.';
    this.#emit();
  }

  setTemplate(template: TemplateId): void {
    if (template === this.#world.template) return;
    try {
      this.#world = remodel(this.#world, this.#ledger, template, this.#world.tick);
      this.#notice = `${template === 'SMALL' ? 'Kleine' : template === 'MEDIUM' ? 'Mittlere' : 'Große'} Bude eröffnet.`;
    } catch (error) {
      this.#notice = error instanceof Error ? error.message : 'Umbau fehlgeschlagen.';
    }
    this.#emit();
  }

  buy(id: BuildId): void {
    this.#guard(() => {
      buyCrate(this.#world, this.#ledger, id);
      this.#notice = this.#world.lastEvent;
    });
  }

  orderDrinks(count: number): void {
    this.#guard(() => {
      orderDrinks(this.#world, this.#ledger, count);
      this.#notice = this.#world.lastEvent;
    });
  }

  orderParts(count: number): void {
    this.#guard(() => {
      orderParts(this.#world, this.#ledger, count);
      this.#notice = this.#world.lastEvent;
    });
  }

  pickup(crateId: number): void {
    this.#guard(() => {
      pickupCrate(this.#world, crateId);
      this.#notice = this.#world.lastEvent;
    });
  }

  deploy(x: number, y: number): void {
    this.#guard(() => {
      deployHeldCrate(this.#world, x, y);
      this.#notice = this.#world.lastEvent;
    });
  }

  unloadHere(): void {
    this.#guard(() => {
      const pos = this.#world.player.position;
      const bar = this.#world.furniture.find((item) => item.kind === 'BAR'
        && Math.abs(item.x - pos.x) + Math.abs(item.y - pos.y) <= 3);
      storeHeldCrate(this.#world, pos.x, pos.y, bar?.id);
      this.#notice = this.#world.lastEvent;
    });
  }

  storeDeposit(x: number, y: number, barId?: number): void {
    this.#guard(() => {
      storeHeldCrate(this.#world, x, y, barId);
      this.#notice = this.#world.lastEvent;
    });
  }

  calm(disputeId: number): void {
    this.#guard(() => {
      if (!calmDispute(this.#world, disputeId)) throw new Error('Zu weit weg. Geh zum Streit.');
      this.#notice = this.#world.lastEvent;
    });
  }

  serveDesk(): void {
    this.#guard(() => {
      const served = serveDesk(this.#world, this.#ledger, this.#prng);
      this.#notice = served ? 'Gast gewechselt.' : 'Niemand wartet an der Kasse.';
    });
  }

  setWall(color: string): void {
    this.#guard(() => {
      setWallColor(this.#world, color);
      this.#notice = 'Wand gestrichen.';
    });
  }

  setNeon(color: string): void {
    this.#guard(() => {
      setNeonColor(this.#world, color);
      this.#notice = 'Neon neu gefärbt.';
    });
  }

  upgradeBar(): void {
    this.#guard(() => {
      upgradeBar(this.#world, this.#ledger);
      this.#notice = this.#world.lastEvent;
    });
  }

  upgradeWc(): void {
    this.#guard(() => {
      upgradeWc(this.#world, this.#ledger);
      this.#notice = this.#world.lastEvent;
    });
  }

  repair(itemId: number): void {
    this.#guard(() => {
      repair(this.#world, this.#ledger, itemId);
      this.#notice = 'Reparatur bezahlt.';
    });
  }

  clean(tile?: number): void {
    this.#guard(() => {
      if (tile === undefined) {
        const count = cleanAll(this.#world, this.#ledger);
        this.#notice = count ? `${count} Flecken weg.` : 'Alles sauber.';
      } else {
        cleanTile(this.#world, this.#ledger, tile);
        this.#notice = 'Fleck weg.';
      }
    });
  }

  hire(role: StaffRole): void {
    this.#guard(() => {
      hireAgent(this.#world, this.#ledger, role);
      this.#notice = this.#world.lastEvent;
    });
  }

  fire(role: StaffRole): void {
    this.#guard(() => {
      fireAgent(this.#world, role);
      this.#notice = 'Personal entlassen.';
    });
  }

  setPrice(key: 'drinkPrice' | 'slotMinBet', vc: number): void {
    this.#guard(() => {
      setPrice(this.#world, key, fromVC(vc));
      this.#notice = 'Preis geändert.';
    });
  }

  setCarpet(carpet: CarpetId): void {
    setCarpet(this.#world, carpet);
    this.#notice = 'Teppich verlegt.';
    this.#emit();
  }

  installMod(itemId: number, mod: ModId): void {
    this.#guard(() => {
      installMod(this.#world, this.#ledger, itemId, mod);
      this.#notice = 'Mod verbaut.';
    });
  }

  addReel(itemId: number): void {
    this.#guard(() => {
      upgradeReels(this.#world, this.#ledger, itemId);
      this.#notice = 'Walze eingebaut.';
    });
  }

  setBet(itemId: number, vc: number): void {
    this.#guard(() => {
      setBaseBet(this.#world, itemId, fromVC(vc));
      this.#notice = 'Mindesteinsatz geändert.';
    });
  }

  takeHome(amountVC = 5): void {
    this.#guard(() => {
      const available = (this.#ledger.getBalance(HAUSKONTO) - HOUSE_FLOAT) as VaCoinMicro;
      const amount = Math.min(fromVC(amountVC), available) as VaCoinMicro;
      if (amount <= ZERO_VC) throw new Error('5 VC bleiben als Betriebsreserve im Hauskonto.');
      playerTakeHome(this.#ledger, amount, this.#world.tick);
      this.#notice = `${toVCString(amount)} ins Portemonnaie.`;
    });
  }

  pay(guestId: number): void {
    this.#guard(() => {
      const paid = payGuest(this.#world, this.#ledger, guestId, this.#world.tick);
      this.#notice = paid > 0 ? `${toVCString(paid)} an Gast ausgezahlt.` : 'Keine offene Auszahlung.';
    });
  }

  takeDrink(): void {
    this.#guard(() => {
      takeDrink(this.#world);
      this.#notice = this.#world.lastEvent;
    });
  }

  serveDrink(guestId: number): void {
    this.#guard(() => {
      serveDrink(this.#world, this.#ledger, guestId);
      this.#notice = this.#world.lastEvent;
    });
  }

  moveTo(point: Point): void {
    movePlayer(this.#world, point);
    this.#emit(false);
  }

  playForeign(game: GameId, betVC: number, houseEdgeBps = 250): GameResult | null {
    try {
      const result = foreignRound(this.#ledger, game, fromVC(betVC), this.#prng, this.#world.tick, houseEdgeBps);
      this.#notice = result.payout > 0
        ? `${result.label}: ${toVCString(result.payout)} zurück.`
        : `${result.label}. ${toVCString(fromVC(betVC))} verloren.`;
      this.#emit();
      return result;
    } catch (error) {
      this.#notice = error instanceof Error ? error.message : 'Fremdes Spiel fehlgeschlagen.';
      this.#emit();
      return null;
    }
  }

  spinTest(itemId: number): GameResult | null {
    const item = this.#world.furniture.find((entry) => entry.id === itemId);
    if (!item) return null;
    return testSpin(item, this.#prng);
  }

  dismiss(): void {
    this.#notice = '';
    this.#emit(false);
  }

  #advance = (): void => {
    tickWorld(this.#world, this.#ledger, this.#prng);
    this.#savedTick += 1;
    this.#emit(this.#savedTick % 6 === 0);
  };

  #guard(action: () => void): void {
    try {
      action();
      this.#emit();
    } catch (error) {
      this.#notice = error instanceof Error ? error.message : 'Aktion fehlgeschlagen.';
      this.#emit(false);
    }
  }

  #emit(save = true): void {
    this.#view = buildView(this.#world, this.#ledger, this.#notice);
    if (save) saveWorld(this.#world, this.#ledger, this.#prng.getState());
    for (const listener of this.#listeners) listener();
  }
}

export const worldStore = new WorldStore();
