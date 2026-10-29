/** Versionierter Spielstand: Full-Save als JSON mit Ledger-Replay und Integritaetscheck. */
import { ACCOUNTS, Ledger, type AccountId } from '../economy/ledger';
import type { VaCoinMicro } from '../economy/vacoin';
import type { PlayerProfileState } from '../character/player-profile';
import type { FloorSnapshot } from '../simulation/floor-types';
import type { MetaProgress } from '../progression/meta-progression';
import type { RogueliteSnapshot } from '../progression/roguelite-loop';
import type { VenueTier } from '../progression/venues-and-tiers';

const SAVE_KEY = 'vcoin.full.v1';
const ACCOUNT_IDS: ReadonlySet<string> = new Set(ACCOUNTS);

export interface PersistedTransfer {
  readonly tick: number;
  readonly from: AccountId;
  readonly to: AccountId;
  readonly amount: VaCoinMicro;
  readonly reason: string;
}

export interface PersistedPlayer {
  readonly owned: readonly string[];
  readonly profile: PlayerProfileState;
}

export interface FullSave {
  readonly schemaVersion: 1;
  readonly savedAt: number;
  readonly ledger: readonly PersistedTransfer[];
  readonly floor: FloorSnapshot;
  readonly meta: MetaProgress;
  readonly progression: RogueliteSnapshot;
  readonly venueTier: VenueTier;
  readonly player?: PersistedPlayer;
  readonly clock: number;
  readonly tick: number;
  readonly casinoId: string;
  readonly bet: VaCoinMicro;
  readonly prngState: number;
}

export function isPersistedTransfer(value: unknown): value is PersistedTransfer {
  if (typeof value !== 'object' || value === null) return false;
  const { tick, from, to, amount, reason } = value as Record<string, unknown>;
  return (
    typeof tick === 'number' && Number.isSafeInteger(tick) && tick >= 0 &&
    typeof from === 'string' && ACCOUNT_IDS.has(from) &&
    typeof to === 'string' && ACCOUNT_IDS.has(to) && from !== to &&
    typeof amount === 'number' && Number.isSafeInteger(amount) && amount > 0 &&
    typeof reason === 'string' && reason.trim().length > 0
  );
}

export function replaySavedLedger(entries: readonly PersistedTransfer[]): Ledger | null {
  if (!entries.every(isPersistedTransfer)) return null;
  const ledger = new Ledger();
  try {
    for (const entry of entries) {
      ledger.transfer(entry.from, entry.to, entry.amount, entry.reason, entry.tick);
    }
    return ledger.verifyLedgerIntegrity() ? ledger : null;
  } catch {
    return null;
  }
}

export function buildLedgerEntries(ledger: Ledger): PersistedTransfer[] {
  return ledger.entries.map(({ tick, from, to, amount, reason }) => ({ tick, from, to, amount, reason }));
}

export function serializeSave(save: FullSave): string {
  return JSON.stringify(save);
}

export function parseSave(json: string): FullSave | null {
  try {
    const parsed = JSON.parse(json) as Partial<FullSave>;
    if (parsed.schemaVersion !== 1 || !Number.isSafeInteger(parsed.savedAt)) return null;
    if (!Array.isArray(parsed.ledger) || !parsed.ledger.every(isPersistedTransfer)) return null;
    if (!replaySavedLedger(parsed.ledger)) return null;
    if (!parsed.floor || !Array.isArray(parsed.floor.items) || !Array.isArray(parsed.floor.visitors)) return null;
    if (!parsed.meta || typeof parsed.meta !== 'object') return null;
    if (!parsed.progression || typeof parsed.progression !== 'object') return null;
    if (parsed.venueTier !== 1 && parsed.venueTier !== 2 && parsed.venueTier !== 3 && parsed.venueTier !== 4) return null;
    if (!Number.isSafeInteger(parsed.clock) || !Number.isSafeInteger(parsed.tick) || !Number.isSafeInteger(parsed.bet)) return null;
    if (!Number.isSafeInteger(parsed.prngState) || typeof parsed.casinoId !== 'string') return null;
    if (parsed.player && (!Array.isArray(parsed.player.owned) || typeof parsed.player.profile !== 'object')) return null;
    return parsed as FullSave;
  } catch {
    return null;
  }
}

export function saveToStorage(save: FullSave): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(SAVE_KEY, serializeSave(save));
  } catch {
    // Quota oder blockierter Speicher: Das Spiel läuft ohne Full-Save weiter.
  }
}

export function loadFromStorage(): FullSave | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? parseSave(raw) : null;
  } catch {
    return null;
  }
}

export { SAVE_KEY as FULL_SAVE_KEY };
