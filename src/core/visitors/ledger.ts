/** Bucht Besuchergeld zwischen EXTERNAL_WORK, VISITOR_WALLET, PENDING_PAYOUT und Tresor. */
import type { Ledger } from '../economy/ledger';
import { addVC, subVC, ZERO_VC, type VaCoinMicro } from '../economy/vacoin';
import type { Visitor } from './visitor';

export function admitVisitor(ledger: Ledger, visitor: Visitor, tick: number): void {
  ledger.transfer('EXTERNAL_WORK', 'VISITOR_WALLET', visitor.wallet, `visitor buy-in #${visitor.id}`, tick);
}

export function placeVisitorBet(ledger: Ledger, visitor: Visitor, amount: VaCoinMicro, tick: number): void {
  if (amount <= ZERO_VC || amount > visitor.wallet) {
    throw new Error(`visitor bet #${visitor.id}: ${amount} passt nicht zur Wallet ${visitor.wallet}`);
  }
  ledger.transfer('VISITOR_WALLET', 'CASINO_VAULT', amount, `visitor bet #${visitor.id}`, tick);
  visitor.wallet = subVC(visitor.wallet, amount);
}

/** Gewinn wird im Tresor reserviert; der Gast bekommt ihn erst durch die Auszahlung. */
export function reserveVisitorWin(ledger: Ledger, visitor: Visitor, amount: VaCoinMicro, tick: number): void {
  if (amount <= ZERO_VC) return;
  ledger.transfer('CASINO_VAULT', 'PENDING_PAYOUT', amount, `visitor win #${visitor.id}`, tick);
  visitor.pendingPayout = addVC(visitor.pendingPayout, amount);
}

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

export function pendingPayoutTotal(visitors: readonly Visitor[]): VaCoinMicro {
  let total = ZERO_VC;
  for (const visitor of visitors) total = addVC(total, visitor.pendingPayout);
  return total;
}
