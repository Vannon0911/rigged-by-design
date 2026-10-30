/** Save v7: Welt + Ledger-Log + PRNG. Nichts anderes besitzt Geld. */
import { Ledger } from '../core/economy/ledger';
import { admitFiat, DEBT_ACCOUNT } from '../core/sim/money';
import { createWorld, ensureStarter } from '../core/sim/templates';
import type { WorldState } from '../core/sim/types';
import { hydrateWorld, type SavedGame } from './migrate';

const KEY = 'vcoin.casino.v7';
/** v6 kennt weder Kisten noch Agenten; v5 trug das Fiat noch im Gastobjekt. */
const LEGACY_KEY = 'vcoin.casino.v6';
const OLD_KEYS = ['vcoin.casino.v3', 'vcoin.casino.v4', 'vcoin.casino.v5'];

interface LoadedSave {
  readonly world: WorldState;
  readonly ledger: Ledger;
  readonly prngState: number;
}

export function saveWorld(world: WorldState, ledger: Ledger, prngState: number): void {
  try {
    const save: SavedGame = {
      version: 7,
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
      crates: world.crates,
      agents: world.agents,
      disputes: world.disputes,
      parts: world.parts,
      guestsServed: world.guestsServed,
      reputation: world.reputation,
      wallColor: world.wallColor,
      neonColor: world.neonColor,
      barLevel: world.barLevel,
      wcLevel: world.wcLevel,
      nextCrateId: world.nextCrateId,
      nextAgentId: world.nextAgentId,
      nextDisputeId: world.nextDisputeId,
      activePenalties: world.activePenalties,
      visitors: world.visitors,
      nextVisitorId: world.nextVisitorId,
      lastEvent: world.lastEvent,
      entries: ledger.entries.map(({ tick, from, to, amount, reason }) => ({ tick, from, to, amount, reason })),
      prngState,
    };
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch { /* quota oder storage blocked */ }
}

/** Baut Welt und Ledger aus einem gespeicherten Stand; v5/v6 werden dabei gehoben. */
export function replaySave(raw: unknown): LoadedSave | null {
  try {
    const saved = raw as Partial<SavedGame> | null;
    if (!saved || (saved.version !== 5 && saved.version !== 6 && saved.version !== 7)) return null;
    if (!saved.template || !Array.isArray(saved.guests) || !Array.isArray(saved.furniture)) return null;
    const world = createWorld(saved.template, saved.carpet ?? 'VIOLET');
    const legacyFiat = hydrateWorld(world, saved as SavedGame);
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
