/** Persistenter Spieler-Zustand: Profil, Besitz und ausgeruestete Player-Mods. */
import { useSyncExternalStore } from 'react';
import type { Appearance } from '../core/character/appearance';
import {
  PlayerProfile,
  type PlayerProfileState,
  type PlayerProfileView,
} from '../core/character/player-profile';
import type { Ledger } from '../core/economy/ledger';
import { canAfford, type VaCoinMicro } from '../core/economy/vacoin';
import { PLAYER_MODS, getPlayerMod, type PlayerModId } from '../core/mods/player-mods';
import type { Prng } from '../core/rng/prng';
import type { CpuCasinoId } from '../core/simulation/cpu-casinos';
import { performCpuSpin, type CpuSpinOutcome } from './cpu-spin';

const SAVE_KEY = 'vcoin.player.v1';

export interface PlayerSnapshot {
  readonly profile: PlayerProfileView;
  readonly ownedMods: readonly PlayerModId[];
  readonly revision: number;
  readonly notice: string;
}

interface PlayerSave {
  readonly version: 1;
  readonly owned: readonly PlayerModId[];
  readonly profile: PlayerProfileState;
}

class PlayerStore {
  readonly #profile = new PlayerProfile();
  #owned: PlayerModId[] = [];
  #notice = 'Charakter anpassen, Mods kaufen und ausruesten - sichtbar sofort.';
  #revision = 0;
  #listeners = new Set<() => void>();
  #snapshot: PlayerSnapshot;

  constructor() {
    this.#load();
    this.#snapshot = this.#build();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  getSnapshot = (): PlayerSnapshot => this.#snapshot;

  buy(id: PlayerModId, ledger: Ledger, tick: number): boolean {
    try {
      const mod = getPlayerMod(id);
      if (this.#owned.includes(id)) throw new Error(`${mod.name} ist bereits im Besitz.`);
      if (!canAfford(ledger.getBalance('PLAYER_CASH'), mod.priceVC)) {
        throw new Error(`Zu wenig Bargeld fuer ${mod.name}.`);
      }
      ledger.transfer('PLAYER_CASH', 'SHOP_VENDOR', mod.priceVC, `player-mod purchase: ${id}`, tick);
      this.#owned = [...this.#owned, id];
      this.#notice = `${mod.name} gekauft - jetzt ausruesten.`;
      this.#commit();
      return true;
    } catch (error) {
      this.#notice = error instanceof Error ? error.message : 'Kauf fehlgeschlagen.';
      this.#commit();
      return false;
    }
  }

  toggleEquip(id: PlayerModId): void {
    try {
      const mod = getPlayerMod(id);
      if (this.#profile.isEquipped(id)) {
        this.#profile.unequipMod(id);
        this.#notice = `${mod.name} abgelegt.`;
      } else {
        this.#profile.equipMod(id, this.#owned);
        this.#notice = `${mod.name} ausgeruestet - Kosmetik und Effekt aktiv.`;
      }
    } catch (error) {
      this.#notice = error instanceof Error ? error.message : 'Ausrüsten fehlgeschlagen.';
    }
    this.#commit();
  }

  setAppearance(appearance: Appearance): void {
    this.#profile.setAppearance(appearance);
    this.#commit();
  }

  spinCpu(
    casinoId: CpuCasinoId,
    bet: VaCoinMicro,
    ledger: Ledger,
    prng: Prng,
    tick: number,
  ): CpuSpinOutcome {
    return performCpuSpin(casinoId, bet, ledger, prng, tick, this.#profile);
  }

  /** Nach direkten Profil-Aenderungen (Suspicion) speichern und rendern. */
  refresh(): void {
    this.#commit();
  }

  #load(): void {
    try {
      if (typeof localStorage === 'undefined') return;
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<PlayerSave>;
      if (Array.isArray(parsed.owned)) {
        this.#owned = parsed.owned.filter((id): id is PlayerModId => PLAYER_MODS.some((mod) => mod.id === id));
      }
      if (parsed.profile) {
        const equipped = (parsed.profile.equipped ?? []).filter((id) => this.#owned.includes(id));
        this.#profile.loadState({ ...parsed.profile, equipped });
      }
    } catch {
      this.#notice = 'Spieler-Spielstand unlesbar - Standardprofil aktiv.';
    }
  }

  #save(): void {
    try {
      if (typeof localStorage === 'undefined') return;
      const save: PlayerSave = { version: 1, owned: this.#owned, profile: this.#profile.toState() };
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    } catch {
      // Speicher voll oder blockiert: Das Spiel laeuft weiter, nur ohne Persistenz.
    }
  }

  #build(): PlayerSnapshot {
    const profile = this.#profile;
    return {
      profile: {
        appearance: profile.appearance,
        cosmetics: profile.cosmetics,
        equippedPlayerMods: profile.equippedPlayerMods,
        suspicion: profile.suspicion,
        effects: profile.effects,
        luckBiasBps: profile.luckBiasBps,
      },
      ownedMods: [...this.#owned],
      revision: this.#revision,
      notice: this.#notice,
    };
  }

  #commit(): void {
    this.#revision += 1;
    this.#snapshot = this.#build();
    this.#save();
    for (const listener of this.#listeners) listener();
  }
}

export const playerStore = new PlayerStore();

export function usePlayerStore(): PlayerSnapshot {
  return useSyncExternalStore(playerStore.subscribe, playerStore.getSnapshot, playerStore.getSnapshot);
}
