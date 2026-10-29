/** Progression-Store: verbindet den headless Roguelite-Loop mit Ledger, Floor und UI. */
import { useSyncExternalStore } from 'react';
import { Prng } from '../core/rng/prng';
import type { MetaUnlockId } from '../core/progression/meta-progression';
import { RogueliteLoop, TRIBUTE_INTERVAL, type RunPerkId } from '../core/progression/roguelite-loop';
import { nextVenue, type VenueTier } from '../core/progression/venues-and-tiers';
import { buildLedgerEntries, loadFromStorage, parseSave } from '../core/persistence/save-manager';
import { getCpuCasino } from '../core/simulation/cpu-casinos';
import { canUpgradeVenue, growthFrom, upgradeBlockers } from '../core/simulation/progression';
import { playerStore } from './player-store';
import { gameStore } from './use-game-store';
import { buildProgressionSnapshot, type ProgressionSnapshot } from './progression-view';
import { applyFullSave, exportFull, persistNewRun, saveFull } from './progression-save';
class ProgressionStore {
  #loop: RogueliteLoop;
  #venueTier: VenueTier;
  #lastTick: number;
  #entryCursor: number;
  #notice = 'Nasse Straße, 4×4 Karton. Das Syndikat wartet nicht ewig.';
  #listeners = new Set<() => void>();
  #snapshot: ProgressionSnapshot;
  constructor() {
    const saved = loadFromStorage();
    this.#venueTier = saved?.venueTier ?? 1;
    gameStore.floorView.setVenueTier(this.#venueTier);
    this.#loop = new RogueliteLoop(
      gameStore.ledger,
      new Prng(gameStore.prngState ^ 0x9e3779b9),
      saved?.progression,
    );
    const activeCasino = getCpuCasino(gameStore.getSnapshot().casinoId);
    if (activeCasino.venueTier > this.#venueTier) gameStore.selectCasino('CPU_DIVE_BAR');
    this.#lastTick = gameStore.tickCount;
    this.#entryCursor = gameStore.ledger.entries.length;
    this.#snapshot = this.#build();
    gameStore.subscribe(this.#onGameTick);
    gameStore.refresh();
  }
  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };
  getSnapshot = (): ProgressionSnapshot => this.#snapshot;
  upgradeVenue(): void {
    try {
      const next = nextVenue(this.#venueTier);
      if (!next) throw new Error('Maximaler Standort bereits erreicht.');
      if (this.#loop.snapshot.status === 'RUN_OVER') throw new Error('Run ist vorbei - starte zuerst einen neuen.');
      const growth = this.#growth();
      const cash = gameStore.ledger.getBalance('PLAYER_CASH');
      const blockers = upgradeBlockers(this.#venueTier, growth, cash);
      if (!canUpgradeVenue(this.#venueTier, growth, cash)) {
        throw new Error(`Ausbau blockiert: ${blockers.join(' · ')}.`);
      }
      gameStore.ledger.transfer('PLAYER_CASH', 'SHOP_VENDOR', next.unlockCostVC, `venue upgrade ${next.id}`, gameStore.tickCount);
      this.#venueTier = next.tier;
      gameStore.floorView.setVenueTier(next.tier);
      playerStore.awardReputation(next.tier * 100);
      this.#notice = `${next.name} eröffnet: ${next.gridSize}×${next.gridSize} Grid.`;
      gameStore.refresh();
      this.#saveFull();
      this.#publish();
    } catch (error) {
      this.#fail(error);
    }
  }
  payTribute(): void {
    try {
      const paid = this.#loop.payTribute(gameStore.tickCount);
      this.#notice = paid ? 'Tribut bezahlt. Wähle eine von drei Blaupausen.' : 'Tribut nicht bezahlbar - das Syndikat pfändet den Run.';
      gameStore.refresh();
      this.#saveFull();
      this.#publish();
    } catch (error) {
      this.#fail(error);
    }
  }
  choosePerk(id: RunPerkId): void {
    try {
      this.#loop.choosePerk(id, gameStore.tickCount);
      this.#notice = `Blaupause mitgenommen. Nächster Tribut in ${TRIBUTE_INTERVAL} Ticks.`;
      gameStore.refresh();
      this.#saveFull();
      this.#publish();
    } catch (error) {
      this.#fail(error);
    }
  }
  buyMeta(id: MetaUnlockId): void {
    try {
      this.#loop.buyUnlock(id);
      this.#notice = 'Syndikat-Siegel investiert. Der nächste Run startet besser.';
      this.#saveFull();
      this.#publish();
    } catch (error) {
      this.#fail(error);
    }
  }
  abandonRun(): void {
    this.#loop.failRun();
    this.#notice = 'Run aufgegeben. Siegel bleiben, der Rest gehört dem Syndikat.';
    this.#saveFull();
    this.#publish();
  }
  newRun(): void {
    try {
      persistNewRun(this.#loop.meta, playerStore.saveState);
      this.#notice = 'Neuer Run. Startkapital, neue Straßenecke, alte Narben.';
      this.#reload();
    } catch (error) {
      this.#fail(error);
    }
  }
  exportSave(): string {
    return exportFull({ game: this.#gameSave(), progression: this.#loop.snapshot, venueTier: this.#venueTier, player: playerStore.saveState });
  }
  importSave(text: string): boolean {
    const full = parseSave(text);
    if (!full) {
      this.#fail(new Error('Import abgelehnt: Ledger oder Schema ungültig.'));
      return false;
    }
    applyFullSave(full);
    this.#notice = 'Spielstand importiert - Neustart mit vollständigem Ledger.';
    this.#reload();
    return true;
  }
  #onGameTick = (): void => {
    const statusBefore = this.#loop.snapshot.status;
    this.#syncRevenue();
    const tick = gameStore.tickCount;
    if (tick > this.#lastTick) this.#loop.tick(tick - this.#lastTick);
    this.#lastTick = tick;
    this.#publish((tick > 0 && tick % 5 === 0) || this.#loop.snapshot.status !== statusBefore);
  };
  #syncRevenue(): void {
    const entries = gameStore.ledger.entries;
    for (let index = this.#entryCursor; index < entries.length; index += 1) {
      const entry = entries[index]!;
      if (entry.from === 'VISITOR_WALLET' && entry.to === 'CASINO_VAULT') {
        this.#loop.addRevenue(entry.amount);
      }
    }
    this.#entryCursor = entries.length;
  }
  #gameSave(): import('./game-save').GameSave {
    const state = gameStore.getSnapshot();
    return {
      version: 1,
      ledger: buildLedgerEntries(gameStore.ledger),
      floor: gameStore.floorView.snapshot(),
      clock: state.now,
      tick: gameStore.tickCount,
      casinoId: state.casinoId,
      bet: state.bet,
      prngState: gameStore.prngState,
    };
  }
  #saveFull(): void { saveFull({ game: this.#gameSave(), progression: this.#loop.snapshot, venueTier: this.#venueTier, player: playerStore.saveState }); }
  #publish(save = false): void {
    this.#snapshot = this.#build();
    if (save) this.#saveFull();
    for (const listener of this.#listeners) listener();
  }
  #build(): ProgressionSnapshot {
    return buildProgressionSnapshot({
      venueTier: this.#venueTier,
      run: this.#loop.snapshot,
      notice: this.#notice,
      cash: gameStore.ledger.getBalance('PLAYER_CASH'),
      vault: gameStore.ledger.getBalance('CASINO_VAULT'),
      growth: this.#growth(),
    });
  }
  #growth() {
    return growthFrom(
      gameStore.floorView.items,
      this.#loop.snapshot.revenueVC,
      this.#venueTier,
    );
  }
  #fail(error: unknown): void {
    this.#notice = error instanceof Error ? error.message : 'Progression-Aktion fehlgeschlagen.';
    this.#publish();
  }
  #reload(): void { if (typeof window !== 'undefined') window.location.reload(); }
}
export const progressionStore = new ProgressionStore();
export function useProgressionStore(): ProgressionSnapshot {
  return useSyncExternalStore(progressionStore.subscribe, progressionStore.getSnapshot, progressionStore.getSnapshot);
}
