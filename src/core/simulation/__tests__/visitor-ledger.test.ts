import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC, toVCString, ZERO_VC } from '../../economy/vacoin';
import type { Visitor } from '../visitors';
import {
  admitVisitor,
  payVisitorWin,
  placeVisitorBet,
  reconcileVisitorPool,
  releaseVisitor,
  visitorPoolTotal,
} from '../visitor-ledger';

function visitor(wallet: number): Visitor {
  return {
    id: 7,
    name: 'Testgast 7',
    outfitTier: 1,
    wallet: fromVC(wallet),
    addiction: 0,
    patience: 100,
    spins: 0,
  };
}

describe('Visitor-Ledger', () => {
  it('bucht Buy-in, Einsatz, Gewinn und Cash-out vollständig über VISITOR_WALLET', () => {
    const ledger = new Ledger({ CASINO_VAULT: fromVC(100) });
    const guest = visitor(5);

    admitVisitor(ledger, guest, 1);
    expect(toVCString(ledger.getBalance('VISITOR_WALLET'))).toBe('5.0000 VC');
    expect(visitorPoolTotal([guest])).toBe(guest.wallet);

    placeVisitorBet(ledger, guest, fromVC(2), 2);
    expect(ledger.getBalance('VISITOR_WALLET')).toBe(fromVC(3));
    expect(ledger.getBalance('CASINO_VAULT')).toBe(fromVC(102));
    expect(guest.wallet).toBe(fromVC(3));

    payVisitorWin(ledger, guest, fromVC(1), 3);
    expect(ledger.getBalance('VISITOR_WALLET')).toBe(fromVC(4));
    expect(ledger.getBalance('CASINO_VAULT')).toBe(fromVC(101));
    expect(guest.wallet).toBe(fromVC(4));

    releaseVisitor(ledger, guest, 4);
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
