/** Werkstatt-Zustand: eigener Automat und Betreiber-Mods, persistent in localStorage. */
import { useSyncExternalStore } from 'react';
import { canAfford } from '../core/economy/vacoin';
import { getOperatorMod, type OperatorModId } from '../core/simulation/catalog';
import { OWN_SLOT_BASE, OWN_SLOT_MAX_MODS } from '../core/simulation/own-slot';
import type { SlotConfig } from '../core/slot/slot-types';
import { gameStore } from './use-game-store';

const SAVE_KEY = 'vcoin.workshop.v1';

export interface WorkshopSnapshot {
  readonly ownSlot: SlotConfig;
  readonly ownedMods: readonly OperatorModId[];
  readonly notice: string;
}

interface WorkshopSave {
  readonly version: 1;
  readonly ownSlot: SlotConfig;
  readonly owned: readonly OperatorModId[];
}

class WorkshopStore {
  #ownSlot: SlotConfig = { ...OWN_SLOT_BASE };
  #owned: OperatorModId[] = [];
  #notice = 'Eigener Automat: Gewichte schrauben, Mods kaufen, dann im Labor beweisen.';
  #listeners = new Set<() => void>();
  #snapshot: WorkshopSnapshot;

  constructor() {
    this.#load();
    this.#snapshot = this.#build();
  }

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
    if (!canAfford(gameStore.getSnapshot().cash, mod.priceVC)) {
      this.#notice = `Zu wenig Bargeld fuer ${mod.name}.`;
      this.#emit();
      return;
    }
    try {
      gameStore.spendOnVendor(mod.priceVC, `operator-mod purchase: ${id}`);
    } catch (error) {
      this.#notice = error instanceof Error ? error.message : 'Kauf fehlgeschlagen.';
      this.#emit();
      return;
    }
    this.#owned = [...this.#owned, id];
    this.#notice = `${mod.name} gekauft - jetzt im eigenen Slot einbaubar.`;
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

  #load(): void {
    try {
      if (typeof localStorage === 'undefined') return;
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<WorkshopSave>;
      if (Array.isArray(parsed.owned)) {
        this.#owned = parsed.owned.filter((id): id is OperatorModId => {
          try {
            getOperatorMod(id);
            return true;
          } catch {
            return false;
          }
        });
      }
      const slot = parsed.ownSlot;
      if (slot && Number.isSafeInteger(slot.baseBet) && Array.isArray(slot.paylines) && slot.paylines.length > 0 && Array.isArray(slot.mods)) {
        this.#ownSlot = { ...slot, id: 'own-slot' };
      }
    } catch {
      this.#notice = 'Werkstatt-Spielstand unlesbar - Standardautomat aktiv.';
    }
  }

  #save(): void {
    try {
      if (typeof localStorage === 'undefined') return;
      const save: WorkshopSave = { version: 1, ownSlot: this.#ownSlot, owned: this.#owned };
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    } catch {
      // Speicher voll oder blockiert: Werkstatt bleibt nutzbar, ohne Auto-Save.
    }
  }

  #build(): WorkshopSnapshot {
    return { ownSlot: this.#ownSlot, ownedMods: [...this.#owned], notice: this.#notice };
  }

  #emit(): void {
    this.#snapshot = this.#build();
    this.#save();
    for (const listener of this.#listeners) listener();
  }
}

export const workshopStore = new WorkshopStore();

export function useWorkshopStore(): WorkshopSnapshot {
  return useSyncExternalStore(workshopStore.subscribe, workshopStore.getSnapshot, workshopStore.getSnapshot);
}
