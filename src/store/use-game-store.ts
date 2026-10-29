/** Reaktiver Spielzustand: persistenter Floor-Tick, Jobs, CPU-Spins, Tresor und Baumarkt. */
import { useSyncExternalStore } from 'react';
import { Ledger } from '../core/economy/ledger';
import { fromVC, toVCString, type VaCoinMicro } from '../core/economy/vacoin';
import { Prng } from '../core/rng/prng';
import { CPU_CASINOS, getCpuCasino, type CpuCasinoId, type CpuSpinResult } from '../core/simulation/cpu-casinos';
import { CasinoFloor } from '../core/simulation/casino-floor';
import { getBuildable, type BuildableId } from '../core/simulation/catalog';
import type { FloorView } from '../core/simulation/floor-types';
import { JOBS, HustleWork, type JobId } from '../core/simulation/hustle-work';
import type { PlayerModId } from '../core/mods/player-mods';
import { performCpuSpin } from './cpu-spin';
import { buildGameSnapshot } from './game-snapshot';
import { loadGameSave, replayLedger, saveGameState } from './game-save';
import { playerStore } from './player-store';
import { moveVault } from './vault-actions';
import type { GameSnapshot, LastSpin } from './game-types';

const START_CASH = fromVC(5);
const TICK_MS = 1000;

class GameStore {
  readonly #ledger: Ledger;
  readonly #prng: Prng;
  readonly #floor: CasinoFloor;
  readonly #hustle: HustleWork;
  #clock = 0;
  #tick = 0;
  #lastSpin: LastSpin | null = null;
  #notice = 'Hinterhof-Parzelle bezogen. 5.0000 VC Startkapital - jetzt arbeiten gehen.';
  #casinoId: CpuCasinoId = 'CPU_DIVE_BAR';
  #bet: VaCoinMicro = getCpuCasino('CPU_DIVE_BAR').minBetVC;
  #listeners = new Set<() => void>();
  #timer: ReturnType<typeof setInterval> | null = null;
  #snapshot: GameSnapshot;

  constructor() {
    const saved = loadGameSave();
    const replayed = saved ? replayLedger(saved.ledger) : null;
    this.#ledger = replayed ?? new Ledger({ PLAYER_CASH: START_CASH });
    this.#prng = new Prng(saved?.prngState ?? (Date.now() >>> 0));
    if (saved) this.#prng.setState(saved.prngState);
    this.#floor = new CasinoFloor(this.#ledger, this.#prng);
    this.#hustle = new HustleWork(this.#ledger, this.#prng);
    if (saved && replayed) {
      try {
        this.#floor.restore(saved.floor);
        this.#hustle.restore(saved.hustle);
        this.#clock = saved.clock;
        this.#tick = saved.tick;
        const casino = CPU_CASINOS.find((entry) => entry.id === saved.casinoId);
        if (casino) {
          this.#casinoId = casino.id;
          this.#bet = saved.bet >= casino.minBetVC && saved.bet <= casino.maxBetVC
            ? saved.bet
            : casino.minBetVC;
        }
        this.#notice = 'Spielstand geladen.';
      } catch {
        this.#notice = 'Spielstand beschaedigt - der Floor startet leer.';
      }
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
  get floorView(): FloorView { return this.#floor; }
  buyPlayerMod(id: PlayerModId): boolean {
    const bought = playerStore.buy(id, this.#ledger, this.#tick);
    if (bought) this.#emit();
    return bought;
  }

  spendOnVendor(amount: VaCoinMicro, reason: string): void {
    this.#ledger.transfer('PLAYER_CASH', 'SHOP_VENDOR', amount, reason, this.#tick);
    this.#emit();
  }

  work(id: JobId): void {
    const job = JOBS.find((entry) => entry.id === id);
    try {
      const result = this.#hustle.work(id, this.#clock);
      this.#notice = result.brawl
        ? `${job?.name ?? id}: Schlaegerei! Nur ${toVCString(result.net)} netto.`
        : `${job?.name ?? id}: +${toVCString(result.net)} verdient.`;
      this.#emit();
    } catch (error) {
      this.#fail(error);
    }
  }

  spinCpu(): CpuSpinResult | null {
    try {
      const outcome = performCpuSpin(
        this.#casinoId, this.#bet, this.#ledger, this.#prng, this.#tick, playerStore.profile,
      );
      const result = outcome.result;
      this.#lastSpin = { casinoId: this.#casinoId, bet: result.totalBet, payout: result.payout, spin: result.spin };
      this.#notice = outcome.notice;
      playerStore.refresh();
      this.#emit();
      return result;
    } catch (error) {
      this.#fail(error);
      return null;
    }
  }

  selectCasino(id: CpuCasinoId): void {
    const casino = getCpuCasino(id);
    this.#casinoId = id;
    this.#bet = casino.minBetVC;
    this.#notice = `${casino.name} gewaehlt.`;
    this.#emit();
  }

  setBet(bet: VaCoinMicro): void {
    const casino = getCpuCasino(this.#casinoId);
    if (!Number.isSafeInteger(bet) || bet < casino.minBetVC || bet > casino.maxBetVC) return;
    this.#bet = bet;
    this.#emit();
  }

  moveToVault(direction: 'IN' | 'OUT', amount: VaCoinMicro = fromVC(1)): void {
    try {
      this.#notice = moveVault(this.#ledger, direction, amount, this.#tick);
      this.#emit();
    } catch (error) {
      this.#fail(error);
    }
  }

  build(id: BuildableId, x: number, y: number): void {
    try {
      const item = getBuildable(id);
      this.#floor.placeItem(id, x, y);
      this.#notice = `${item.name} fuer ${toVCString(item.priceVC)} platziert.`;
      this.#emit();
    } catch (error) {
      this.#fail(error);
    }
  }

  #advance(): void {
    this.#clock += 1;
    this.#tick += 1;
    this.#floor.tickCasinoFloor();
    this.#emit();
  }

  #fail(error: unknown): void {
    this.#notice = error instanceof Error ? error.message : 'Unbekannter Fehler.';
    this.#emit();
  }

  #emit(): void {
    this.#snapshot = this.#build();
    this.#save();
    for (const listener of this.#listeners) listener();
  }

  #save(): void {
    saveGameState({
      ledger: this.#ledger, floor: this.#floor, hustle: this.#hustle,
      clock: this.#clock, tick: this.#tick, casinoId: this.#casinoId,
      bet: this.#bet, prngState: this.#prng.getState(),
    });
  }

  #build(): GameSnapshot {
    return buildGameSnapshot({
      ledger: this.#ledger,
      floor: this.#floor,
      hustle: this.#hustle,
      clock: this.#clock,
      casinoId: this.#casinoId,
      bet: this.#bet,
      lastSpin: this.#lastSpin,
      notice: this.#notice,
    });
  }
}

export const gameStore = new GameStore();

export function useGameStore(): GameSnapshot {
  return useSyncExternalStore(gameStore.subscribe, gameStore.getSnapshot, gameStore.getSnapshot);
}
