/** Rauswurf-Engine: 15 % Bargeld an den CPU-Pool, 60 s Sperre. Bucht ueber das Ledger. */
import type { Ledger, LedgerEntry } from '../economy/ledger';
import { mulVC, type VaCoinMicro } from '../economy/vacoin';

export const BOUNCER_PENALTY_BPS = 1500;
export const CPU_CASINO_LOCKOUT_SECONDS = 60;

export interface BouncerPenalty {
  readonly penalty: VaCoinMicro;
  readonly ledgerEntry: LedgerEntry | null;
  readonly lockoutUntilTick: number;
}

export function applyBouncerPenalty(ledger: Ledger, tick: number): BouncerPenalty {
  const penalty = mulVC(ledger.getBalance('PLAYER_CASH'), BOUNCER_PENALTY_BPS);
  const ledgerEntry =
    penalty > 0
      ? ledger.transfer('PLAYER_CASH', 'CPU_CASINO_POOL', penalty, 'bouncer: 15% cash confiscated', tick)
      : null;
  return { penalty, ledgerEntry, lockoutUntilTick: tick + CPU_CASINO_LOCKOUT_SECONDS };
}
