/** Reaktiver Spielzustand: 1-Sekunden-Floor-Tick, Jobs, CPU-Spins, Tresor und Baumarkt. */
import { useSyncExternalStore } from 'react';
import { Ledger } from '../core/economy/ledger';
import { canAfford, fromVC, toVCString, ZERO_VC, type VaCoinMicro } from '../core/economy/vacoin';
import { Prng } from '../core/rng/prng';
import { CasinoFloor } from '../core/simulation/casino-floor';
import { JOBS, HustleWork, type JobId } from '../core/simulation/hustle-work';
import { getCpuCasino, playCpuCasinoSpin, type CpuCasinoId, type CpuSpinResult } from '../core/simulation/cpu-casinos';
import { getBuildable, type BuildableId } from '../core/simulation/catalog';
import type { GameSnapshot, JobState, LastSpin } from './game-types';

const START_CASH = fromVC(5);
const TICK_MS = 1000;
const TICKER_ROWS = 12;

class GameStore {
  readonly ledger = new Ledger({ PLAYER_CASH: START_CASH });
  readonly prng = new Prng(Date.now() >>> 0);
  readonly floor: CasinoFloor;
  readonly hustle: HustleWork;
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
    this.floor = new CasinoFloor(this.ledger, this.prng);
    this.hustle = new HustleWork(this.ledger, this.prng);
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

  get tick(): number {
    return this.#tick;
  }

  refresh(): void {
    this.#emit();
  }

  work(id: JobId): void {
    const job = JOBS.find((entry) => entry.id === id);
    try {
      const result = this.hustle.work(id, this.#clock);
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
      const result = playCpuCasinoSpin(this.#casinoId, this.#bet, this.ledger, this.prng, this.#tick);
      this.#lastSpin = { casinoId: this.#casinoId, bet: result.totalBet, payout: result.payout, spin: result.spin };
      this.#notice = result.payout > ZERO_VC
        ? `Gewinn: +${toVCString(result.payout)} bei ${toVCString(result.totalBet)} Einsatz.`
        : result.spin.isNearMiss
          ? 'Near Miss! Zwei Diamanten - und Walze 3 versagt.'
          : 'Niete. Der Automat behaelt den Einsatz.';
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
      if (direction === 'IN') {
        if (!canAfford(this.ledger.getBalance('PLAYER_CASH'), amount)) {
          throw new Error('Nicht genug Bargeld fuer die Einzahlung.');
        }
        this.ledger.transfer('PLAYER_CASH', 'CASINO_VAULT', amount, 'vault deposit', this.#tick);
        this.#notice = `${toVCString(amount)} in den Tresor gelegt.`;
      } else {
        if (!canAfford(this.ledger.getBalance('CASINO_VAULT'), amount)) throw new Error('Der Tresor ist leer.');
        this.ledger.transfer('CASINO_VAULT', 'PLAYER_CASH', amount, 'vault withdraw', this.#tick);
        this.#notice = `${toVCString(amount)} aus dem Tresor geholt.`;
      }
      this.#emit();
    } catch (error) {
      this.#fail(error);
    }
  }

  build(id: BuildableId, x: number, y: number): void {
    try {
      const item = getBuildable(id);
      this.floor.placeItem(id, x, y);
      this.#notice = `${item.name} fuer ${toVCString(item.priceVC)} platziert.`;
      this.#emit();
    } catch (error) {
      this.#fail(error);
    }
  }

  #advance(): void {
    this.#clock += 1;
    this.#tick += 1;
    this.floor.tickCasinoFloor();
    this.#emit();
  }

  #fail(error: unknown): void {
    this.#notice = error instanceof Error ? error.message : 'Unbekannter Fehler.';
    this.#emit();
  }

  #emit(): void {
    this.#snapshot = this.#build();
    for (const listener of this.#listeners) listener();
  }

  #build(): GameSnapshot {
    const jobs = {} as Record<JobId, JobState>;
    for (const job of JOBS) {
      jobs[job.id] = {
        ready: this.hustle.isReady(job.id, this.#clock),
        readyAt: this.hustle.readyAt(job.id),
        cooldown: Math.max(job.cooldownSeconds, job.durationSeconds),
      };
    }
    const visitors = this.floor.visitors;
    const avgAddiction = visitors.length === 0
      ? 0
      : visitors.reduce((sum, visitor) => sum + visitor.addiction, 0) / visitors.length;
    return {
      cash: this.ledger.getBalance('PLAYER_CASH'),
      vault: this.ledger.getBalance('CASINO_VAULT'),
      ledgerOk: this.ledger.verifyLedgerIntegrity(),
      visitors,
      avgAddiction,
      placements: this.floor.items,
      lastEntries: [...this.ledger.entries].slice(-TICKER_ROWS).reverse(),
      now: this.#clock,
      jobs,
      casinoId: this.#casinoId,
      bet: this.#bet,
      lastSpin: this.#lastSpin,
      notice: this.#notice,
    };
  }
}

export const gameStore = new GameStore();

export function useGameStore(): GameSnapshot {
  return useSyncExternalStore(gameStore.subscribe, gameStore.getSnapshot, gameStore.getSnapshot);
}
