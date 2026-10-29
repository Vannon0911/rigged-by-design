/** Arbeiten gegen die Pleite: zwei Jobs mit Cooldown, Dauer und Schlaegerei-Risiko. */
import type { Ledger, LedgerEntry } from '../economy/ledger';
import { fromVC, toVCString, type VaCoinMicro } from '../economy/vacoin';
import type { Prng } from '../rng/prng';

export type JobId = 'BOTTLE_COLLECT' | 'BOUNCER_SHIFT';

export interface JobDefinition {
  readonly id: JobId;
  readonly name: string;
  readonly description: string;
  readonly payVC: VaCoinMicro;
  readonly cooldownSeconds: number;
  readonly durationSeconds: number;
  readonly brawlChanceBps: number;
  readonly brawlPayVC: VaCoinMicro;
}

export const JOBS: readonly JobDefinition[] = [
  {
    id: 'BOTTLE_COLLECT',
    name: 'Pfand & Flyer sammeln',
    description: 'Sofortgeld fuer den naechsten Einsatz.',
    payVC: fromVC(0.25),
    cooldownSeconds: 1.5,
    durationSeconds: 0,
    brawlChanceBps: 0,
    brawlPayVC: fromVC(0.25),
  },
  {
    id: 'BOUNCER_SHIFT',
    name: 'Hinterhof-Tuersteher',
    description: '4 Sekunden Schicht, 15 % Schlaegerei-Risiko.',
    payVC: fromVC(1.2),
    cooldownSeconds: 4,
    durationSeconds: 4,
    brawlChanceBps: 1500,
    brawlPayVC: fromVC(0.2),
  },
];

const JOB_INDEX = new Map(JOBS.map((job) => [job.id, job]));

export function getJob(id: JobId): JobDefinition {
  const job = JOB_INDEX.get(id);
  if (!job) throw new Error(`Unbekannter Job: ${id}`);
  return job;
}

export interface WorkResult {
  readonly job: JobId;
  readonly gross: VaCoinMicro;
  readonly net: VaCoinMicro;
  readonly brawl: boolean;
  readonly readyAt: number;
  readonly ledgerEntry: LedgerEntry;
}

export type HustleSnapshot = Readonly<Record<JobId, number>>;

export class HustleWork {
  readonly #ledger: Ledger;
  readonly #prng: Prng;
  readonly #readyAt: Record<JobId, number> = { BOTTLE_COLLECT: 0, BOUNCER_SHIFT: 0 };

  constructor(ledger: Ledger, prng: Prng) {
    this.#ledger = ledger;
    this.#prng = prng;
  }

  readyAt(jobId: JobId): number {
    return this.#readyAt[jobId];
  }

  isReady(jobId: JobId, nowSeconds: number): boolean {
    return nowSeconds >= this.#readyAt[jobId];
  }

  snapshot(): HustleSnapshot {
    return { ...this.#readyAt };
  }

  restore(state: Partial<Record<JobId, number>>): void {
    for (const job of JOBS) {
      const value = state[job.id];
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0) this.#readyAt[job.id] = value;
    }
  }

  work(jobId: JobId, nowSeconds: number): WorkResult {
    const job = getJob(jobId);
    if (!Number.isFinite(nowSeconds) || nowSeconds < 0) throw new Error('work: nowSeconds muss >= 0 sein');
    if (!this.isReady(jobId, nowSeconds)) {
      throw new Error(`work: ${job.name} ist im Cooldown bis ${this.#readyAt[jobId]}s`);
    }

    const brawl = job.brawlChanceBps > 0 && this.#prng.nextFloat() * 10_000 < job.brawlChanceBps;
    const net = brawl ? job.brawlPayVC : job.payVC;
    const ledgerEntry = this.#ledger.transfer(
      'EXTERNAL_WORK',
      'PLAYER_CASH',
      net,
      brawl ? `job ${jobId} (brawl)` : `job ${jobId}`,
      Math.floor(nowSeconds),
    );
    const readyAt = nowSeconds + Math.max(job.cooldownSeconds, job.durationSeconds);
    this.#readyAt[jobId] = readyAt;
    return { job: jobId, gross: job.payVC, net, brawl, readyAt, ledgerEntry };
  }
}

/** UI-taugliche Meldung, damit der GameStore keine Job-Texte duplizieren muss. */
export function workWithNotice(hustle: HustleWork, jobId: JobId, clock: number): string {
  const job = getJob(jobId);
  const result = hustle.work(jobId, clock);
  return result.brawl
    ? `${job.name}: Schlaegerei! Nur ${toVCString(result.net)} netto.`
    : `${job.name}: +${toVCString(result.net)} verdient.`;
}
