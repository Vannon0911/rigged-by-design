/** Öffentliche Snapshot-Typen des Game-Stores. */
import type { LedgerEntry } from '../core/economy/ledger';
import type { VaCoinMicro } from '../core/economy/vacoin';
import type { PlacedItem } from '../core/simulation/casino-floor';
import type { CpuCasinoId } from '../core/simulation/cpu-casinos';
import type { JobId } from '../core/simulation/hustle-work';
import type { Visitor } from '../core/simulation/visitors';
import type { SpinResult } from '../core/slot/slot-types';

export interface JobState {
  readonly ready: boolean;
  readonly readyAt: number;
  readonly cooldown: number;
}

export interface LastSpin {
  readonly casinoId: CpuCasinoId;
  readonly bet: VaCoinMicro;
  readonly payout: VaCoinMicro;
  readonly spin: SpinResult;
}

export interface GameSnapshot {
  readonly cash: VaCoinMicro;
  readonly vault: VaCoinMicro;
  readonly ledgerOk: boolean;
  readonly visitors: readonly Visitor[];
  readonly avgAddiction: number;
  readonly placements: readonly PlacedItem[];
  readonly lastEntries: readonly LedgerEntry[];
  readonly now: number;
  readonly jobs: Readonly<Record<JobId, JobState>>;
  readonly casinoId: CpuCasinoId;
  readonly bet: VaCoinMicro;
  readonly lastSpin: LastSpin | null;
  readonly notice: string;
}
