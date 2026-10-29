/** Werkstatt-Zustand: eigener Automat und Betreiber-Mods, gebucht ueber das Haupt-Ledger. */
import { useSyncExternalStore } from 'react';
import { canAfford } from '../core/economy/vacoin';
import { getOperatorMod, type OperatorModId } from '../core/simulation/catalog';
import { OWN_SLOT_BASE, OWN_SLOT_MAX_MODS } from '../core/simulation/own-slot';
import type { SlotConfig } from '../core/slot/slot-types';
import { gameStore } from './use-game-store';

export interface WorkshopSnapshot {
  readonly ownSlot: SlotConfig;
  readonly ownedMods: readonly OperatorModId[];
  readonly notice: string;
}

class WorkshopStore {
  #ownSlot: SlotConfig = { ...OWN_SLOT_BASE };
  #owned: OperatorModId[] = [];
  #notice = 'Eigener Automat: Gewichte schrauben, Mods kaufen, dann im Labor beweisen.';
  #listeners = new Set<() => void>();
  #snapshot: WorkshopSnapshot = this.#build();

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  getSnapshot = (): WorkshopSnapshot => this.#snapshot;

  setConfig = (config: SlotConfig): void => {
    this.#ownSlot = { ...config, id: 'own-slot' };
    this.#notice = 'Slot-Konfiguration uebernommen - Beweis im Labor neu starten.';
    this.#emit();
  };

  buy = (id: OperatorModId): void => {
    if (this.#owned.includes(id)) return;
    const mod = getOperatorMod(id);
    if (!canAfford(gameStore.ledger.getBalance('PLAYER_CASH'), mod.priceVC)) {
      this.#notice = `Zu wenig Bargeld fuer ${mod.name}.`;
      this.#emit();
      return;
    }
    gameStore.ledger.transfer('PLAYER_CASH', 'SHOP_VENDOR', mod.priceVC, `operator-mod purchase: ${id}`, gameStore.tick);
    this.#owned = [...this.#owned, id];
    this.#notice = `${mod.name} gekauft - jetzt im eigenen Slot einbaubar.`;
    gameStore.refresh();
    this.#emit();
  };

  toggle = (id: OperatorModId): void => {
    const mod = getOperatorMod(id);
    if (!this.#owned.includes(id)) {
      this.#notice = `${mod.name} muss zuerst gekauft werden.`;
      this.#emit();
      return;
    }
    if (this.#ownSlot.mods.some((contract) => contract.id === id)) {
      this.#ownSlot = { ...this.#ownSlot, mods: this.#ownSlot.mods.filter((contract) => contract.id !== id) };
      this.#notice = `${mod.name} ausgebaut.`;
    } else if (this.#ownSlot.mods.length >= OWN_SLOT_MAX_MODS) {
      this.#notice = `Nur ${OWN_SLOT_MAX_MODS} Betreiber-Mods pro Automat.`;
    } else {
      this.#ownSlot = { ...this.#ownSlot, mods: [...this.#ownSlot.mods, ...mod.contracts] };
      this.#notice = `${mod.name} eingebaut - der Automat rechnet jetzt anders.`;
    }
    this.#emit();
  };

  #build(): WorkshopSnapshot {
    return { ownSlot: this.#ownSlot, ownedMods: [...this.#owned], notice: this.#notice };
  }

  #emit(): void {
    this.#snapshot = this.#build();
    for (const listener of this.#listeners) listener();
  }
}

export const workshopStore = new WorkshopStore();

export function useWorkshopStore(): WorkshopSnapshot {
  return useSyncExternalStore(workshopStore.subscribe, workshopStore.getSnapshot, workshopStore.getSnapshot);
}
