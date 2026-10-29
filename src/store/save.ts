/** Save v5: Welt + Ledger-Log + PRNG. Nichts anderes besitzt Geld. */
import { Ledger } from '../core/economy/ledger';
import type { VaCoinMicro } from '../core/economy/vacoin';
import { createWorld, ensureStarter } from '../core/sim/templates';
import type { CarpetId, Furniture, Guest, Player, PriceBook, StaffState, TemplateId, WorldState } from '../core/sim/types';

const KEY = 'vcoin.casino.v5';
const OLD_KEYS = ['vcoin.casino.v3', 'vcoin.casino.v4'];

interface SavedEntry {
  readonly tick: number;
  readonly from: string;
  readonly to: string;
  readonly amount: VaCoinMicro;
  readonly reason: string;
}

export interface SavedGame {
  readonly version: 5;
  readonly template: TemplateId;
  readonly carpet: CarpetId;
  readonly furniture: Furniture[];
  readonly guests: Guest[];
  readonly player: Player;
  readonly dirty: number[];
  readonly prices: PriceBook;
  readonly staff: StaffState;
  readonly tick: number;
  readonly day: number;
  readonly nextGuestId: number;
  readonly nextFurnitureId: number;
  readonly guardsHired: number;
  readonly lastEvent: string;
  readonly entries: readonly SavedEntry[];
  readonly prngState: number;
}

export function saveWorld(world: WorldState, ledger: Ledger, prngState: number): void {
  try {
    const save: SavedGame = {
      version: 5,
      template: world.template,
      carpet: world.carpet,
      furniture: world.furniture,
      guests: world.guests,
      player: world.player,
      dirty: [...world.dirty],
      prices: world.prices,
      staff: world.staff,
      tick: world.tick,
      day: world.day,
      nextGuestId: world.nextGuestId,
      nextFurnitureId: world.nextFurnitureId,
      guardsHired: world.guardsHired,
      lastEvent: world.lastEvent,
      entries: ledger.entries.map(({ tick, from, to, amount, reason }) => ({ tick, from, to, amount, reason })),
      prngState,
    };
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch { /* quota oder storage blocked */ }
}

export function loadWorld(): { world: WorldState; ledger: Ledger; prngState: number } | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Partial<SavedGame>;
    if (saved.version !== 5 || !saved.template || !Array.isArray(saved.guests) || !Array.isArray(saved.furniture)) return null;
    const world = createWorld(saved.template, saved.carpet ?? 'VIOLET');
    world.furniture = saved.furniture.map((item) => ({
      ...item,
      occupants: [...(item.occupants ?? [])],
      mods: [...(item.mods ?? [])],
      reels: item.reels ?? 3,
    }));
    world.guests = saved.guests.map((guest) => ({ ...guest, path: [...(guest.path ?? [])] }));
    world.player = { ...world.player, ...saved.player, path: [...(saved.player?.path ?? [])] };
    world.dirty = new Set(saved.dirty ?? []);
    world.prices = { ...world.prices, ...(saved.prices ?? {}) };
    world.staff = { ...world.staff, ...(saved.staff ?? {}) };
    world.tick = saved.tick ?? 0;
    world.day = saved.day ?? 1;
    world.nextGuestId = saved.nextGuestId ?? 1;
    world.nextFurnitureId = saved.nextFurnitureId ?? 100;
    world.guardsHired = saved.guardsHired ?? 0;
    world.lastEvent = saved.lastEvent ?? 'Spielstand geladen.';
    ensureStarter(world);
    const ledger = new Ledger();
    for (const entry of saved.entries ?? []) {
      ledger.transfer(entry.from, entry.to, entry.amount, entry.reason, entry.tick);
    }
    if (!ledger.verifyLedgerIntegrity()) return null;
    return { world, ledger, prngState: saved.prngState ?? 1 };
  } catch {
    return null;
  }
}

export function clearOldSave(): boolean {
  try {
    let had = false;
    for (const key of OLD_KEYS) {
      had = had || localStorage.getItem(key) !== null;
      localStorage.removeItem(key);
    }
    return had;
  } catch { return false; }
}
