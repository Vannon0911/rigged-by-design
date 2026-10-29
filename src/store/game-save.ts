/** Spielstand v1: Ledger-Log, Floor, Jobs und PRNG-Zustand in localStorage. */
import { ACCOUNTS, Ledger, type AccountId } from '../core/economy/ledger';
import type { VaCoinMicro } from '../core/economy/vacoin';
import type { CasinoFloor } from '../core/simulation/casino-floor';
import type { FloorSnapshot } from '../core/simulation/casino-floor';
import type { CpuCasinoId } from '../core/simulation/cpu-casinos';
import type { HustleWork, HustleSnapshot } from '../core/simulation/hustle-work';

const SAVE_KEY = 'vcoin.game.v1';
const ACCOUNT_IDS: ReadonlySet<string> = new Set(ACCOUNTS);

export interface SavedTransfer {
  readonly tick: number;
  readonly from: AccountId;
  readonly to: AccountId;
  readonly amount: VaCoinMicro;
  readonly reason: string;
}

export function isSavedTransfer(value: unknown): value is SavedTransfer {
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

export interface GameSave {
  readonly version: 1;
  readonly ledger: readonly SavedTransfer[];
  readonly floor: FloorSnapshot;
  readonly hustle: HustleSnapshot;
  readonly clock: number;
  readonly tick: number;
  readonly casinoId: CpuCasinoId;
  readonly bet: VaCoinMicro;
  readonly prngState: number;
}

export function loadGameSave(): GameSave | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GameSave>;
    if (parsed.version !== 1 || !Array.isArray(parsed.ledger) || !parsed.ledger.every(isSavedTransfer)) return null;
    if (!parsed.floor || !Array.isArray(parsed.floor.items) || !Array.isArray(parsed.floor.visitors)) return null;
    if (!parsed.hustle || typeof parsed.hustle !== 'object') return null;
    if (!Number.isSafeInteger(parsed.clock) || !Number.isSafeInteger(parsed.tick)) return null;
    if (!Number.isSafeInteger(parsed.bet) || !Number.isSafeInteger(parsed.prngState)) return null;
    if (typeof parsed.casinoId !== 'string') return null;
    return parsed as GameSave;
  } catch {
    return null;
  }
}

export function saveGameSave(save: GameSave): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Quota voll oder Speicher blockiert: Spiel bleibt spielbar, ohne Auto-Save.
  }
}

export interface GameStateSave {
  readonly ledger: Ledger;
  readonly floor: CasinoFloor;
  readonly hustle: HustleWork;
  readonly clock: number;
  readonly tick: number;
  readonly casinoId: CpuCasinoId;
  readonly bet: VaCoinMicro;
  readonly prngState: number;
}

export function saveGameState(input: GameStateSave): void {
  saveGameSave({
    version: 1,
    ledger: input.ledger.entries.map(({ tick, from, to, amount, reason }) => ({ tick, from, to, amount, reason })),
    floor: input.floor.snapshot(),
    hustle: input.hustle.snapshot(),
    clock: input.clock,
    tick: input.tick,
    casinoId: input.casinoId,
    bet: input.bet,
    prngState: input.prngState,
  });
}

/** Replays a compact ledger log. Returns null for any corrupted transaction. */
export function replayLedger(entries: readonly SavedTransfer[]): Ledger | null {
  if (!entries.every(isSavedTransfer)) return null;
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
