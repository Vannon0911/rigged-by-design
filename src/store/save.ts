/** Save v6: Welt + Ledger-Log + PRNG. Nichts anderes besitzt Geld. */
import { Ledger } from '../core/economy/ledger';
import { ZERO_VC, type VaCoinMicro } from '../core/economy/vacoin';
import { GAME_FOOTPRINT, SERVICE_FOOTPRINT } from '../core/sim/grid-zones';
import { admitFiat, DEBT_ACCOUNT } from '../core/sim/money';
import { createWorld, ensureStarter } from '../core/sim/templates';
import type { CarpetId, Furniture, Guest, Player, PriceBook, StaffState, TemplateId, WorldState } from '../core/sim/types';

const KEY = 'vcoin.casino.v6';
/** v5 trug das Fiat noch im Gastobjekt; dieser Stand wird beim Laden migriert. */
const LEGACY_KEY = 'vcoin.casino.v5';
const OLD_KEYS = ['vcoin.casino.v3', 'vcoin.casino.v4'];

function footprintOf(item: Furniture): { w: number; h: number; seats: number } | null {
  if (item.gameId) return GAME_FOOTPRINT[item.gameId] ?? null;
  if (item.kind === 'EXCHANGE' || item.kind === 'BAR' || item.kind === 'TOILET' || item.kind === 'STORAGE') {
    return SERVICE_FOOTPRINT[item.kind];
  }
  return null;
}

interface SavedEntry {
  readonly tick: number;
  readonly from: string;
  readonly to: string;
  readonly amount: VaCoinMicro;
  readonly reason: string;
}

/** v5-Gaeste konnten noch ein Fiat-Feld tragen; ab v6 liegt es im Ledger. */
type SavedGuest = Guest & { readonly fiat?: VaCoinMicro };

interface SavedGame {
  readonly version: 5 | 6;
  readonly template: TemplateId;
  readonly carpet: CarpetId;
  readonly furniture: Furniture[];
  readonly guests: SavedGuest[];
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

interface LoadedSave {
  readonly world: WorldState;
  readonly ledger: Ledger;
  readonly prngState: number;
}

export function saveWorld(world: WorldState, ledger: Ledger, prngState: number): void {
  try {
    const save: SavedGame = {
      version: 6,
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

/** Baut Welt und Ledger aus einem gespeicherten Stand; v5 wird dabei auf v6 gehoben. */
export function replaySave(raw: unknown): LoadedSave | null {
  try {
    const saved = raw as Partial<SavedGame> | null;
    if (!saved || (saved.version !== 5 && saved.version !== 6)) return null;
    if (!saved.template || !Array.isArray(saved.guests) || !Array.isArray(saved.furniture)) return null;
    const world = createWorld(saved.template, saved.carpet ?? 'VIOLET');
    world.furniture = saved.furniture.map((item) => {
      const fp = footprintOf(item);
      return {
        ...item,
        w: fp?.w ?? item.w, h: fp?.h ?? item.h, seats: fp?.seats ?? item.seats,
        damaged: item.damaged ?? false,
        occupants: [...(item.occupants ?? [])],
        mods: [...(item.mods ?? [])],
        reels: item.reels ?? 3,
      };
    });
    const legacyFiat: { id: number; amount: VaCoinMicro }[] = [];
    world.guests = saved.guests.map((guest) => {
      const { fiat, ...rest } = guest;
      if (fiat && fiat > ZERO_VC) legacyFiat.push({ id: guest.id, amount: fiat });
      return { ...rest, path: [...(guest.path ?? [])] };
    });
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
    // Schuldbuchungen duerfen beim Replay nicht als Unterdeckung gelten.
    ledger.openLiability(DEBT_ACCOUNT);
    for (const entry of saved.entries ?? []) {
      ledger.transfer(entry.from, entry.to, entry.amount, entry.reason, entry.tick);
    }
    for (const claim of legacyFiat) admitFiat(ledger, claim.id, claim.amount, world.tick);
    if (!ledger.verifyLedgerIntegrity()) return null;
    return { world, ledger, prngState: saved.prngState ?? 1 };
  } catch {
    return null;
  }
}

export function loadWorld(): LoadedSave | null {
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    return replaySave(JSON.parse(raw));
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
