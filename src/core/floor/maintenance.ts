/** Betriebskosten: Miete alle 60 Ticks, nur wenn der Tresor sie deckt. */
import type { Ledger } from '../economy/ledger';
import { ZERO_VC } from '../economy/vacoin';
import { getVenue, type VenueTier } from '../venues';

export const RENT_INTERVAL = 60;

export function chargeRent(ledger: Ledger, tier: VenueTier, ticks: number): void {
  if (ticks % RENT_INTERVAL !== 0) return;
  const rent = getVenue(tier).rentVC;
  if (rent > ZERO_VC && ledger.getBalance('CASINO_VAULT') >= rent) {
    ledger.transfer('CASINO_VAULT', 'EXTERNAL_WORK', rent, 'venue rent', ticks);
  }
}
