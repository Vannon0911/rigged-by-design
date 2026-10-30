/** Geldwege: jeder Cent ist eine Ledger-Buchung, nie ein direkter Zähler. */
import type { Ledger } from '../economy/ledger';
import { fromVC, ZERO_VC, type VaCoinMicro } from '../economy/vacoin';

export const HAUSKONTO = 'HAUSKONTO';
export const PORTEMONNAIE = 'PORTEMONNAIE';
export const WECHSELKASSE = 'WECHSELKASSE';
const EXTERNAL = 'EXTERNAL_WORLD';
export const SHOP = 'SHOP';
export const STAFF = 'STAFF';
export const UTILITIES = 'UTILITIES';

/** Betriebsreserve, die beim Abheben im Hauskonto bleibt. */
export const HOUSE_FLOAT = fromVC(5);

export const guestAccount = (id: number): string => `VISITOR_${id}`;
export const pendingAccount = (id: number): string => `PENDING_${id}`;

/** Fiat kommt mit dem Gast herein; erst an der Wechselkasse wird es VC. */
export function admitFiat(ledger: Ledger, guestId: number, fiat: VaCoinMicro, tick: number): void {
  if (fiat <= ZERO_VC) return;
  ledger.transfer(EXTERNAL, WECHSELKASSE, fiat, `gast ${guestId} fiat`, tick);
}

export function exchangeToVc(ledger: Ledger, guestId: number, amount: VaCoinMicro, tick: number): void {
  if (amount <= ZERO_VC) return;
  ledger.transfer(WECHSELKASSE, guestAccount(guestId), amount, `gast ${guestId} wechseln`, tick);
}

export function exchangeFromVc(ledger: Ledger, guestId: number, amount: VaCoinMicro, tick: number): VaCoinMicro {
  if (amount <= ZERO_VC) return ZERO_VC;
  ledger.transfer(guestAccount(guestId), WECHSELKASSE, amount, `gast ${guestId} auszahlen`, tick);
  ledger.transfer(WECHSELKASSE, EXTERNAL, amount, `gast ${guestId} cash out`, tick);
  return amount;
}

export function placeBet(ledger: Ledger, guestId: number, amount: VaCoinMicro, tick: number): void {
  ledger.transfer(guestAccount(guestId), HAUSKONTO, amount, `gast ${guestId} einsatz`, tick);
}

export function winToPending(ledger: Ledger, guestId: number, amount: VaCoinMicro, tick: number): void {
  if (amount <= ZERO_VC) return;
  ledger.transfer(HAUSKONTO, pendingAccount(guestId), amount, `gast ${guestId} gewinn`, tick);
}

export function payPending(ledger: Ledger, guestId: number, tick: number): VaCoinMicro {
  const amount = ledger.getBalance(pendingAccount(guestId));
  if (amount <= ZERO_VC) return ZERO_VC;
  ledger.transfer(pendingAccount(guestId), guestAccount(guestId), amount, `gast ${guestId} auszahlung`, tick);
  return amount;
}

export function playerTakeHome(ledger: Ledger, amount: VaCoinMicro, tick: number): void {
  if (amount <= ZERO_VC) return;
  ledger.transfer(HAUSKONTO, PORTEMONNAIE, amount, 'betreiber entnahme', tick);
}

export function foreignBet(ledger: Ledger, amount: VaCoinMicro, tick: number): void {
  ledger.transfer(PORTEMONNAIE, EXTERNAL, amount, 'fremdes haus einsatz', tick);
}

export function foreignWin(ledger: Ledger, amount: VaCoinMicro, tick: number): void {
  if (amount <= ZERO_VC) return;
  ledger.transfer(EXTERNAL, PORTEMONNAIE, amount, 'fremdes haus gewinn', tick);
}
