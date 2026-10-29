/** Bucht Besuchergeld explizit zwischen EXTERNAL_WORK, VISITOR_WALLET, PENDING_PAYOUT und Tresor. */
import type { Ledger } from '../economy/ledger';
import { addVC, subVC, ZERO_VC, type VaCoinMicro } from '../economy/vacoin';
import type { Visitor } from './visitors';

export function admitVisitor(ledger: Ledger, visitor: Visitor, tick: number): void {
  ledger.transfer('EXTERNAL_WORK', 'VISITOR_WALLET', visitor.wallet, `visitor buy-in #${visitor.id}`, tick);
}

export function placeVisitorBet(
  ledger: Ledger,
  visitor: Visitor,
  amount: VaCoinMicro,
  tick: number,
): void {
  if (visitor.pendingPayout > ZERO_VC) throw new Error(`visitor #${visitor.id}: offene Auszahlung blockiert`);
  if (amount <= ZERO_VC || amount > visitor.wallet) {
    throw new Error(`visitor bet #${visitor.id}: Betrag ${amount} passt nicht zur Wallet ${visitor.wallet}`);
  }
  ledger.transfer('VISITOR_WALLET', 'CASINO_VAULT', amount, `visitor bet #${visitor.id}`, tick);
  visitor.wallet = subVC(visitor.wallet, amount);
}

/** Reserve a win in the vault; the guest only gets it when the player pays out. */
export function reserveVisitorWin(
  ledger: Ledger,
  visitor: Visitor,
  amount: VaCoinMicro,
  tick: number,
): void {
  if (amount <= ZERO_VC) return;
  ledger.transfer('CASINO_VAULT', 'PENDING_PAYOUT', amount, `visitor win #${visitor.id}`, tick);
  visitor.pendingPayout = addVC(visitor.pendingPayout, amount);
}

/** Explicit cashier action. Returns the amount that moved to the guest. */
export function payoutVisitor(ledger: Ledger, visitor: Visitor, tick: number): VaCoinMicro {
  const amount = visitor.pendingPayout;
  if (amount <= ZERO_VC) return ZERO_VC;
  ledger.transfer('PENDING_PAYOUT', 'VISITOR_WALLET', amount, `visitor payout #${visitor.id}`, tick);
  visitor.wallet = addVC(visitor.wallet, amount);
  visitor.pendingPayout = ZERO_VC;
  return amount;
}

export function releaseVisitor(ledger: Ledger, visitor: Visitor, tick: number): void {
  if (visitor.pendingPayout > ZERO_VC) throw new Error(`visitor #${visitor.id}: offene Auszahlung`);
  if (visitor.wallet <= ZERO_VC) return;
  ledger.transfer('VISITOR_WALLET', 'EXTERNAL_WORK', visitor.wallet, `visitor cash-out #${visitor.id}`, tick);
  visitor.wallet = ZERO_VC;
}

export function visitorPoolTotal(visitors: readonly Visitor[]): VaCoinMicro {
  let total = ZERO_VC;
  for (const visitor of visitors) total = addVC(total, visitor.wallet);
  return total;
}

export function pendingPayoutTotal(visitors: readonly Visitor[]): VaCoinMicro {
  let total = ZERO_VC;
  for (const visitor of visitors) total = addVC(total, visitor.pendingPayout);
  return total;
}

/** Heilt alte Saves, in denen Besucher-Wallets noch nicht im Ledger lagen. */
export function reconcileVisitorPool(ledger: Ledger, visitors: readonly Visitor[], tick: number): void {
  const total = visitorPoolTotal(visitors);
  const pool = ledger.getBalance('VISITOR_WALLET');
  if (total > pool) {
    ledger.transfer('EXTERNAL_WORK', 'VISITOR_WALLET', subVC(total, pool), 'visitor wallet migration', tick);
  } else if (pool > total) {
    ledger.transfer('VISITOR_WALLET', 'EXTERNAL_WORK', subVC(pool, total), 'visitor wallet migration', tick);
  }
}
