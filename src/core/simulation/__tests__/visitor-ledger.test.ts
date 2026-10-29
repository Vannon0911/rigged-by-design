import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC, toVCString, ZERO_VC } from '../../economy/vacoin';
import { visitorNetResult, type Visitor } from '../visitors';
import {
  admitVisitor,
  payoutVisitor,
  pendingPayoutTotal,
  placeVisitorBet,
  reconcileVisitorPool,
  releaseVisitor,
  reserveVisitorWin,
  visitorPoolTotal,
} from '../visitor-ledger';

function visitor(wallet: number): Visitor {
  return {
    id: 7,
    name: 'Testgast 7',
    outfitTier: 1,
    buyIn: fromVC(wallet),
    wallet: fromVC(wallet),
    pendingPayout: ZERO_VC,
    addiction: 0,
    patience: 100,
    spins: 0,
  };
}

describe('Visitor-Ledger', () => {
  it('reserviert Gewinne und zahlt sie erst auf Befehl des Spielers aus', () => {
    const ledger = new Ledger({ CASINO_VAULT: fromVC(100) });
    const guest = visitor(5);

    admitVisitor(ledger, guest, 1);
    expect(toVCString(ledger.getBalance('VISITOR_WALLET'))).toBe('5.0000 VC');
    expect(visitorPoolTotal([guest])).toBe(guest.wallet);
    expect(visitorNetResult(guest)).toBe(ZERO_VC);

    placeVisitorBet(ledger, guest, fromVC(2), 2);
    expect(ledger.getBalance('VISITOR_WALLET')).toBe(fromVC(3));
    expect(ledger.getBalance('CASINO_VAULT')).toBe(fromVC(102));
    expect(guest.wallet).toBe(fromVC(3));

    reserveVisitorWin(ledger, guest, fromVC(1), 3);
    expect(ledger.getBalance('PENDING_PAYOUT')).toBe(fromVC(1));
    expect(ledger.getBalance('VISITOR_WALLET')).toBe(fromVC(3));
    expect(guest.wallet).toBe(fromVC(3));
    expect(guest.pendingPayout).toBe(fromVC(1));
    expect(pendingPayoutTotal([guest])).toBe(fromVC(1));
    expect(() => placeVisitorBet(ledger, guest, fromVC(1), 4)).toThrow(/offene Auszahlung/);
    expect(() => releaseVisitor(ledger, guest, 4)).toThrow(/offene Auszahlung/);

    expect(payoutVisitor(ledger, guest, 5)).toBe(fromVC(1));
    expect(ledger.getBalance('PENDING_PAYOUT')).toBe(ZERO_VC);
    expect(ledger.getBalance('VISITOR_WALLET')).toBe(fromVC(4));
    expect(guest.wallet).toBe(fromVC(4));
    expect(guest.pendingPayout).toBe(ZERO_VC);
    expect(visitorNetResult(guest)).toBe(fromVC(-1));

    releaseVisitor(ledger, guest, 6);
    expect(ledger.getBalance('VISITOR_WALLET')).toBe(ZERO_VC);
    expect(guest.wallet).toBe(ZERO_VC);
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
  });

  it('heilt alte Saves ohne VISITOR_WALLET-Buchungen', () => {
    const ledger = new Ledger({ CASINO_VAULT: fromVC(50) });
    const guest = visitor(8);

    reconcileVisitorPool(ledger, [guest], 10);
    expect(ledger.getBalance('VISITOR_WALLET')).toBe(fromVC(8));
    expect(visitorPoolTotal([guest])).toBe(fromVC(8));
    expect(ledger.verifyLedgerIntegrity()).toBe(true);

    releaseVisitor(ledger, guest, 11);
    expect(ledger.getBalance('VISITOR_WALLET')).toBe(ZERO_VC);
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
  });

  it('verweigert Einsätze, die nicht zur Besucher-Wallet passen', () => {
    const ledger = new Ledger({ CASINO_VAULT: fromVC(10) });
    const guest = visitor(2);
    admitVisitor(ledger, guest, 1);

    expect(() => placeVisitorBet(ledger, guest, fromVC(3), 2)).toThrow(/Wallet/);
    expect(ledger.getBalance('VISITOR_WALLET')).toBe(fromVC(2));
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
  });
});
