/** Baut den oeffentlichen GameSnapshot aus Ledger, Floor und Jobs. */
import type { Ledger } from '../core/economy/ledger';
import type { CasinoFloor } from '../core/simulation/casino-floor';
import type { CpuCasinoId } from '../core/simulation/cpu-casinos';
import { JOBS, type HustleWork, type JobId } from '../core/simulation/hustle-work';
import type { GameSnapshot, JobState, LastSpin } from './game-types';

const TICKER_ROWS = 12;

export interface GameSnapshotInput {
  readonly ledger: Ledger;
  readonly floor: CasinoFloor;
  readonly hustle: HustleWork;
  readonly clock: number;
  readonly casinoId: CpuCasinoId;
  readonly bet: GameSnapshot['bet'];
  readonly lastSpin: LastSpin | null;
  readonly notice: string;
}

export function buildGameSnapshot(input: GameSnapshotInput): GameSnapshot {
  const jobs = {} as Record<JobId, JobState>;
  for (const job of JOBS) {
    jobs[job.id] = {
      ready: input.hustle.isReady(job.id, input.clock),
      readyAt: input.hustle.readyAt(job.id),
      cooldown: Math.max(job.cooldownSeconds, job.durationSeconds),
    };
  }
  const visitors = input.floor.visitors;
  const avgAddiction = visitors.length === 0
    ? 0
    : visitors.reduce((sum, visitor) => sum + visitor.addiction, 0) / visitors.length;
  return {
    cash: input.ledger.getBalance('PLAYER_CASH'),
    vault: input.ledger.getBalance('CASINO_VAULT'),
    ledgerOk: input.ledger.verifyLedgerIntegrity(),
    visitors,
    avgAddiction,
    placements: input.floor.items,
    lastEntries: [...input.ledger.entries].slice(-TICKER_ROWS).reverse(),
    now: input.clock,
    jobs,
    casinoId: input.casinoId,
    bet: input.bet,
    lastSpin: input.lastSpin,
    notice: input.notice,
  };
}
