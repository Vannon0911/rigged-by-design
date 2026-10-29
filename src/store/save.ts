/** Spielstand v3: Ledger-Log, Floor und PRNG-Zustand. Aeltere Saves werden verworfen. */
import { ACCOUNTS, Ledger, type AccountId } from '../core/economy/ledger';
import type { VaCoinMicro } from '../core/economy/vacoin';
import type { CasinoFloor } from '../core/floor/floor';
import type { FloorSnapshot } from '../core/floor/types';

const SAVE_KEY = 'vcoin.casino.v3';
const LEGACY_KEY = 'vcoin.casino.v2';
const ACCOUNT_IDS: ReadonlySet<string> = new Set(ACCOUNTS);

export interface SavedTransfer {
  readonly tick: number;
  readonly from: AccountId;
  readonly to: AccountId;
  readonly amount: VaCoinMicro;
  readonly reason: string;
}

export interface SavedGame {
  readonly version: 3;
  readonly ledger: readonly SavedTransfer[];
  readonly floor: FloorSnapshot;
  readonly tick: number;
  readonly prngState: number;
}

function isTransfer(value: unknown): value is SavedTransfer {
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

export function replayLedger(entries: readonly SavedTransfer[]): Ledger | null {
  if (!entries.every(isTransfer)) return null;
  const ledger = new Ledger();
  try {
    for (const entry of entries) ledger.transfer(entry.from, entry.to, entry.amount, entry.reason, entry.tick);
    return ledger.verifyLedgerIntegrity() ? ledger : null;
  } catch {
    return null;
  }
}

export function loadSave(): SavedGame | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedGame>;
    if (parsed.version !== 3 || !Array.isArray(parsed.ledger) || !parsed.ledger.every(isTransfer)) return null;
    if (!parsed.floor || !Array.isArray(parsed.floor.items) || !Array.isArray(parsed.floor.visitors)) return null;
    if (!Number.isSafeInteger(parsed.tick) || !Number.isSafeInteger(parsed.prngState)) return null;
    return parsed as SavedGame;
  } catch {
    return null;
  }
}

export function saveGame(floor: CasinoFloor, ledger: Ledger, tick: number, prngState: number): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const save: SavedGame = {
      version: 3,
      ledger: ledger.entries.map(({ tick: entryTick, from, to, amount, reason }) => ({
        tick: entryTick, from, to, amount, reason,
      })),
      floor: floor.snapshot(),
      tick,
      prngState,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Quota voll oder Speicher blockiert: das Spiel läuft ohne Auto-Save weiter.
  }
}

export function clearSave(): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignorieren
  }
}

/** Raeumt den inkompatiblen v2-Stand weg und meldet, ob es einen gab. */
export function consumeLegacySave(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    const had = localStorage.getItem(LEGACY_KEY) !== null;
    if (had) localStorage.removeItem(LEGACY_KEY);
    return had;
  } catch {
    return false;
  }
}
