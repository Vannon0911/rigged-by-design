import { describe, expect, it } from 'vitest';
import {
  ACCOUNTS,
  InsufficientFundsError,
  Ledger,
  MINTING_ACCOUNTS,
  type AccountId,
} from '../ledger';
import { Prng } from '../../rng/prng';
import { addVC, fromVC, mulVC, toVCString, type VaCoinMicro } from '../vacoin';

const COVERED_ACCOUNTS = ACCOUNTS.filter((account) => !MINTING_ACCOUNTS.includes(account));

describe('vacoin (Mikro-Geld)', () => {
  it('0.1 + 0.2 ergibt exakt 0.3000 VC', () => {
    const sum = addVC(fromVC(0.1), fromVC(0.2));
    expect(sum).toBe(3000);
    expect(toVCString(sum)).toBe('0.3000 VC');
    expect(toVCString(fromVC(0.1 + 0.2))).toBe('0.3000 VC');
  });

  it('formatiert immer 4 Nachkommastellen', () => {
    expect(toVCString(fromVC(12.34))).toBe('12.3400 VC');
    expect(toVCString(fromVC(1))).toBe('1.0000 VC');
    expect(toVCString(fromVC(0))).toBe('0.0000 VC');
    expect(toVCString(fromVC(-12.34))).toBe('-12.3400 VC');
    expect(toVCString(fromVC(0.0001))).toBe('0.0001 VC');
  });

  it('mulVC rechnet in Basispunkten mit Floor zugunsten der Bank', () => {
    expect(mulVC(fromVC(1), 5000)).toBe(5000);
    expect(mulVC(fromVC(100), 15000)).toBe(1_500_000);
    expect(mulVC(3 as VaCoinMicro, 3333)).toBe(0);
    expect(mulVC(-3 as VaCoinMicro, 3333)).toBe(-1);
  });
});

describe('ledger (doppelte Buchfuehrung)', () => {
  it('verweigert Buchungen ohne Deckung und laesst kein Konto ins Minus', () => {
    const ledger = new Ledger({ PLAYER_CASH: fromVC(100), CASINO_VAULT: fromVC(50) });
    const before = ledger.snapshot();
    const logLength = ledger.entries.length;

    expect(() =>
      ledger.transfer('PLAYER_CASH', 'CASINO_VAULT', fromVC(100.0001), 'bet', 1),
    ).toThrow(InsufficientFundsError);
    expect(() =>
      ledger.transfer('PLAYER_CASH', 'CASINO_VAULT', fromVC(100.0001), 'bet', 1),
    ).toThrow(/Unterdeckung auf PLAYER_CASH/);

    expect(ledger.snapshot()).toEqual(before);
    expect(ledger.entries.length).toBe(logLength);
    expect(ledger.getBalance('PLAYER_CASH')).toBe(fromVC(100));

    // Konto ohne Guthaben kann gar nichts abgeben.
    expect(() =>
      ledger.transfer('SHOP_VENDOR', 'PLAYER_CASH', fromVC(0.0001), 'payout', 2),
    ).toThrow(/Unterdeckung auf SHOP_VENDOR/);
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
  });

  it('loggt unveraenderliche Buchungssaetze und haelt die Summe bei 0', () => {
    const ledger = new Ledger({ PLAYER_CASH: fromVC(250), CASINO_VAULT: fromVC(1000) });
    const entry = ledger.transfer('PLAYER_CASH', 'CASINO_VAULT', fromVC(25), 'bet', 7);

    expect(Object.isFrozen(entry)).toBe(true);
    expect(Object.isFrozen(entry.balancesAfter)).toBe(true);
    expect(() => {
      (entry as { reason: string }).reason = 'manipuliert';
    }).toThrow(TypeError);
    expect(entry.reason).toBe('bet');
    expect(toVCString(ledger.getBalance('PLAYER_CASH'))).toBe('225.0000 VC');
    expect(toVCString(ledger.circulating)).toBe('1250.0000 VC');
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
  });

  it('bleibt nach 1.000 zufaelligen Buchungen integer und integer (Integritaet)', () => {
    const random = new Prng(0x5eed1e55);
    const ledger = new Ledger({
      PLAYER_CASH: fromVC(1000),
      CASINO_VAULT: fromVC(5000),
      SHOP_VENDOR: fromVC(500),
    });
    let booked = 0;

    for (let i = 0; i < 1000; i += 1) {
      const from = COVERED_ACCOUNTS[Math.floor(random.nextFloat() * COVERED_ACCOUNTS.length)] as AccountId;
      const to = COVERED_ACCOUNTS[Math.floor(random.nextFloat() * COVERED_ACCOUNTS.length)] as AccountId;
      if (from === to) continue;
      const balance = ledger.getBalance(from);
      if (balance <= 0) continue;

      const amount = (Math.floor(random.nextFloat() * balance) + 1) as VaCoinMicro;
      ledger.transfer(from, to, amount, `fuzz #${i}`, i);
      booked += 1;
      expect(ledger.verifyLedgerIntegrity()).toBe(true);
    }

    expect(booked).toBeGreaterThan(500);
    expect(ledger.verifyLedgerIntegrity()).toBe(true);

    const balances = ledger.snapshot();
    const net = ACCOUNTS.reduce((sum, account) => sum + balances[account], 0);
    expect(net).toBe(0);
    for (const account of COVERED_ACCOUNTS) {
      expect(balances[account]).toBeGreaterThanOrEqual(0);
      expect(Number.isSafeInteger(balances[account])).toBe(true);
    }
    expect(toVCString(ledger.circulating)).toBe('6500.0000 VC');
  });
});
