/** Suspicion, Pechserie und Rauswurf: eigenstaendiger, headless Meter. */
import { applyBouncerPenalty } from './bouncer';
import { ProfileError } from './profile-error';
import type { Ledger, LedgerEntry } from '../economy/ledger';
import { ZERO_VC, type VaCoinMicro } from '../economy/vacoin';

export const SUSPICION_MAX = 100;

export interface ModUseResult {
  readonly suspicion: number;
  readonly ejected: boolean;
  readonly penalty: VaCoinMicro;
  readonly lockoutUntilTick: number;
  readonly ledgerEntry: LedgerEntry | null;
}

export interface MeterState {
  readonly suspicion?: number;
  readonly lockoutUntilTick?: number;
  readonly lossStreak?: number;
}

export class SuspicionMeter {
  #suspicion = 0;
  #lockoutUntilTick = 0;
  #lossStreak = 0;

  get suspicion(): number {
    return this.#suspicion;
  }
  get lockoutUntilTick(): number {
    return this.#lockoutUntilTick;
  }
  get lossStreak(): number {
    return this.#lossStreak;
  }

  load(state: MeterState): void {
    const safe = (value: number | undefined): number =>
      Number.isFinite(value) ? Math.max(0, Math.floor(value!)) : 0;
    this.#suspicion = Math.min(SUSPICION_MAX, safe(state.suspicion));
    this.#lockoutUntilTick = safe(state.lockoutUntilTick);
    this.#lossStreak = safe(state.lossStreak);
  }

  addSuspicion(points: number): void {
    if (!Number.isSafeInteger(points) || points < 0) {
      throw new ProfileError('addSuspicion: Punkte muessen >= 0 sein');
    }
    this.#suspicion = Math.min(SUSPICION_MAX, this.#suspicion + points);
  }

  isLockedOut(tick: number): boolean {
    return tick < this.#lockoutUntilTick;
  }

  /** Heat verbuchen. Bei 100: Rauswurf, 15 % Bargeld weg, 60 s CPU-Casino-Sperre. */
  addHeat(points: number, ledger: Ledger, tick: number): ModUseResult {
    if (this.isLockedOut(tick)) {
      throw new ProfileError(`CPU-Casino gesperrt bis Tick ${this.#lockoutUntilTick}`);
    }
    this.addSuspicion(points);
    if (this.#suspicion < SUSPICION_MAX) {
      return {
        suspicion: this.#suspicion,
        ejected: false,
        penalty: ZERO_VC,
        lockoutUntilTick: this.#lockoutUntilTick,
        ledgerEntry: null,
      };
    }
    return this.#eject(ledger, tick);
  }

  /** Niete = payout 0, alles andere bricht die Pechserie. */
  recordSpin(payout: VaCoinMicro): void {
    this.#lossStreak = payout > 0 ? 0 : this.#lossStreak + 1;
  }

  #eject(ledger: Ledger, tick: number): ModUseResult {
    const { penalty, ledgerEntry, lockoutUntilTick } = applyBouncerPenalty(ledger, tick);
    this.#suspicion = 0;
    this.#lossStreak = 0;
    this.#lockoutUntilTick = lockoutUntilTick;
    return { suspicion: 0, ejected: true, penalty, lockoutUntilTick, ledgerEntry };
  }
}
