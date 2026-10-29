/** Reaktiver Spielzustand: persistenter Floor-Tick, CPU-Spins, Tresor und Baumarkt. */
import { useSyncExternalStore } from 'react';
import { reputationForBuild } from '../core/character/appearance';
import { Ledger } from '../core/economy/ledger';
import { fromVC, toVCString, type VaCoinMicro } from '../core/economy/vacoin';
import { Prng } from '../core/rng/prng';
import { getCpuCasino, type CpuCasinoId, type CpuSpinResult } from '../core/simulation/cpu-casinos';
import { playCpuTableRound, type CpuTableResult } from '../core/simulation/cpu-table-play';
import type { CpuTableGame } from '../core/simulation/cpu-tables';
import type { RouletteBetType } from '../core/games/roulette/roulette-types';
import { CasinoFloor } from '../core/simulation/casino-floor';
import { getBuildable, type BuildableId } from '../core/simulation/catalog';
import type { FloorRoundEvent } from '../core/simulation/floor-events';
import { canEnterCpuCasino } from '../core/simulation/progression';
import type { PlayerModId } from '../core/mods/player-mods';
import { buildGameSnapshot } from './game-snapshot';
import { restoreSavedGame } from './game-boot';
import { loadGameSave, replayLedger, saveGameState } from './game-save';
import { playerStore } from './player-store';
import { moveVault } from './vault-actions';
import { playOwnCardRound, playOwnSlotRound, playOwnTableRound, type OwnCardGame, type OwnCardResult } from './own-play';
import type { GameSnapshot, LastSpin } from './game-types';
const START_CASH = fromVC(5); const TICK_MS = 1000;
class GameStore {
  readonly #ledger: Ledger;
  readonly #prng: Prng;
  readonly #floor: CasinoFloor;
  #clock = 0;
  #tick = 0;
  #lastSpin: LastSpin | null = null;
  #lastTable: CpuTableResult | null = null;
  #floorEvents: readonly FloorRoundEvent[] = [];
  #notice = 'Nasse Straßenecke bezogen: Hütchenspieler-Karton steht, 5.0000 VC Startkapital.';
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
    this.#floor = new CasinoFloor(this.#ledger, this.#prng, { venueTier: 1, enforceVenue: true });
    if (saved && replayed) {
      const restored = restoreSavedGame(saved, this.#floor);
      if (restored) {
        this.#clock = restored.clock; this.#tick = restored.tick;
        this.#casinoId = restored.casinoId; this.#bet = restored.bet;
        this.#notice = restored.notice;
      } else {
        this.#notice = 'Spielstand beschaedigt - der Floor startet leer.';
      }
    }
    this.#floor.ensureStarterGame();
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
  get floorView(): CasinoFloor { return this.#floor; }
  get ledger(): Ledger { return this.#ledger; }
  get tickCount(): number { return this.#tick; }
  get prngState(): number { return this.#prng.getState(); }
  refresh(): void { this.#emit(); }
  buyPlayerMod(id: PlayerModId): boolean { const bought = playerStore.buy(id, this.#ledger, this.#tick); if (bought) this.#emit(); return bought; }
  spendOnVendor(amount: VaCoinMicro, reason: string): void { this.#ledger.transfer('PLAYER_CASH', 'SHOP_VENDOR', amount, reason, this.#tick); this.#emit(); }
  #guard(action: () => void): void {
    try { action(); this.#emit(); }
    catch (error) { this.#fail(error); }
  }
  payVisitor(id: number): void {
    this.#guard(() => {
      const paid = this.#floor.payVisitor(id);
      this.#notice = `${toVCString(paid)} an Gast #${id} ausgezahlt.`;
    });
  }
  spinCpu(): CpuSpinResult | null {
    try {
      if (this.#floor.games.length === 0) throw new Error('Baue zuerst ein Spiel auf.');
      const casino = getCpuCasino(this.#casinoId);
      if (!canEnterCpuCasino(this.#floor.venueTier, casino.venueTier)) {
        throw new Error(`${casino.name} braucht eigenen Casino-Rang ${casino.venueTier}.`);
      }
      const outcome = playerStore.spinCpu(this.#casinoId, this.#bet, this.#ledger, this.#prng, this.#tick);
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
  spinOwnSlot(config: import('../core/slot/slot-types').SlotConfig): import('../core/slot/slot-types').SpinResult | null {
    try { const spin = playOwnSlotRound(this.#ledger, this.#prng, this.#tick, config); this.#notice = spin.totalPayout > 0 ? `Eigener Slot: +${toVCString(spin.totalPayout)}.` : 'Eigener Slot: Niete.'; this.#emit(); return spin; }
    catch (error) { this.#fail(error); return null; }
  }
  playOwnTable(kind: 'SHELL' | 'DICE'): import('../core/simulation/floor-games').FloorGameOutcome | null {
    try { const outcome = playOwnTableRound(this.#ledger, this.#prng, this.#tick, this.#floor, kind, this.#bet); this.#notice = outcome.payout > 0 ? `Eigener Tisch: +${toVCString(outcome.payout)}.` : `Eigener Tisch: ${toVCString(outcome.totalBet)} verloren.`; this.#emit(); return outcome; }
    catch (error) { this.#fail(error); return null; }
  }
  playOwnCard(game: OwnCardGame, rouletteBet?: RouletteBetType, rouletteDozen?: 1 | 2 | 3): OwnCardResult | null {
    try { const result = playOwnCardRound(this.#ledger, this.#prng, this.#tick, this.#floor, game, this.#bet, { rouletteBet, rouletteDozen }); this.#notice = result.label; this.#emit(); return result; }
    catch (error) { this.#fail(error); return null; }
  }
  playCpuTable(game: CpuTableGame, rouletteBet?: RouletteBetType, rouletteDozen?: 1 | 2 | 3): CpuTableResult | null {
    try {
      const casino = getCpuCasino(this.#casinoId);
      if (!canEnterCpuCasino(this.#floor.venueTier, casino.venueTier)) {
        throw new Error(`${casino.name} braucht eigenen Casino-Rang ${casino.venueTier}.`);
      }
      const result = playCpuTableRound(this.#casinoId, game, this.#bet, this.#ledger, this.#prng, this.#tick, {
        rouletteBet,
        rouletteDozen,
        payoutBonusBps: playerStore.getSnapshot().profile.effects.payoutBonusBps,
        playerCardBonus: playerStore.getSnapshot().profile.effects.cardLookahead > 0,
      });
      this.#lastTable = result;
      this.#notice = playerStore.registerTableResult(this.#ledger, this.#tick, result.payout) ?? result.label;
      this.#emit();
      return result;
    } catch (error) {
      this.#fail(error);
      return null;
    }
  }
  selectCasino(id: CpuCasinoId): void {
    const casino = getCpuCasino(id);
    if (!canEnterCpuCasino(this.#floor.venueTier, casino.venueTier)) {
      this.#notice = `${casino.name} ist erst ab eigenem Casino-Rang ${casino.venueTier} offen.`;
      this.#emit();
      return;
    }
    this.#casinoId = id; this.#bet = casino.minBetVC;
    this.#notice = `${casino.name} gewaehlt.`; this.#emit();
  }
  setBet(bet: VaCoinMicro): void {
    const casino = getCpuCasino(this.#casinoId);
    if (!Number.isSafeInteger(bet) || bet < casino.minBetVC || bet > casino.maxBetVC) return;
    this.#bet = bet; this.#emit();
  }
  moveToVault(direction: 'IN' | 'OUT', amount: VaCoinMicro = fromVC(1)): void {
    this.#guard(() => { this.#notice = moveVault(this.#ledger, direction, amount, this.#tick); });
  }
  installOperatorMod(itemId: number, id: import('../core/simulation/catalog').OperatorModId): void {
    this.#guard(() => {
      this.#floor.installMod(itemId, id);
      this.#notice = 'Betreiber-Mod verbaut - wirkt nur im eigenen Casino.';
    });
  }
  build(id: BuildableId, x: number, y: number): void {
    this.#guard(() => {
      const item = getBuildable(id);
      this.#floor.placeItem(id, x, y);
      playerStore.awardReputation(reputationForBuild(item.priceVC));
      this.#notice = `${item.name} fuer ${toVCString(item.priceVC)} platziert.`;
    });
  }
  #advance(): void {
    this.#clock += 1; this.#tick += 1;
    this.#floorEvents = this.#floor.tickCasinoFloor().events; this.#emit();
  }
  #fail(error: unknown): void {
    this.#notice = error instanceof Error ? error.message : 'Unbekannter Fehler.'; this.#emit();
  }
  #emit(): void {
    this.#snapshot = this.#build(); this.#save();
    for (const listener of this.#listeners) listener();
  }
  #save(): void {
    saveGameState({
      ledger: this.#ledger, floor: this.#floor, clock: this.#clock, tick: this.#tick, casinoId: this.#casinoId,
      bet: this.#bet, prngState: this.#prng.getState(),
    });
  }
  #build(): GameSnapshot {
    return buildGameSnapshot({ ledger: this.#ledger, floor: this.#floor, clock: this.#clock,
      casinoId: this.#casinoId, bet: this.#bet, lastSpin: this.#lastSpin, lastTable: this.#lastTable,
      notice: this.#notice, floorEvents: this.#floorEvents });
  }
}
export const gameStore = new GameStore();
export function useGameStore(): GameSnapshot {
  return useSyncExternalStore(gameStore.subscribe, gameStore.getSnapshot, gameStore.getSnapshot);
}
