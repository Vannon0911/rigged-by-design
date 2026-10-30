/**
 * @test-target: src/core/sim/remodel.ts
 * @error-code: ERR-2001
 *
 * Kein Gast und kein Anspruch verschwindet, solange die Buchung nicht vollstaendig ist.
 */
import { describe, expect, it, vi } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { Prng } from '../../rng/prng';
import { settleGuests } from '../actions';
import { fiatAccount, guestAccount, HAUSKONTO, pendingAccount } from '../money';
import { remodel } from '../remodel';
import { spawnGuest } from '../spawn';
import { createWorld, ensureStarter } from '../templates';

function setup() {
  const world = createWorld('SMALL');
  ensureStarter(world);
  return { world, ledger: new Ledger(), prng: new Prng(0xabc12345) };
}

function fundedGuest(world = createWorld('SMALL'), ledger = new Ledger()) {
  const guest = spawnGuest(world, new Prng(77), ledger)!;
  ledger.transfer('EXTERNAL_WORLD', guestAccount(guest.id), fromVC(5), 'test chips', 0);
  ledger.transfer('EXTERNAL_WORLD', pendingAccount(guest.id), fromVC(2), 'test win', 0);
  return { world, ledger, guest };
}

describe('Abrechnung', () => {
  it('entfernt keinen Gast und keinen Anspruch, wenn eine Buchung scheitert', () => {
    const { world, ledger, guest } = fundedGuest(setup().world);
    const spy = vi.spyOn(ledger, 'transfer').mockImplementation(() => { throw new Error('Kasse klemmt'); });
    expect(() => settleGuests(world, ledger)).toThrow();
    spy.mockRestore();
    expect(world.guests.some((entry) => entry.id === guest.id)).toBe(true);
    expect(ledger.getBalance(pendingAccount(guest.id))).toBe(fromVC(2));
    expect(ledger.getBalance(guestAccount(guest.id))).toBe(fromVC(5));
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
  });

  it('schliesst bei erfolgreicher Abrechnung Fiat, Chips und Gewinn vollstaendig', () => {
    const { world, ledger, guest } = fundedGuest();
    const fiat = ledger.getBalance(fiatAccount(guest.id));
    expect(fiat).toBeGreaterThan(0);
    settleGuests(world, ledger);
    expect(world.guests).toHaveLength(0);
    expect(ledger.getBalance(guestAccount(guest.id))).toBe(0);
    expect(ledger.getBalance(pendingAccount(guest.id))).toBe(0);
    expect(ledger.getBalance(fiatAccount(guest.id))).toBe(0);
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
  });
});

describe('Umbau', () => {
  it('laesst beim Template-Wechsel kein verwaistes Konto und kein Restgeld zurueck', () => {
    const { world, ledger, guest } = fundedGuest();
    ledger.transfer('EXTERNAL_WORLD', HAUSKONTO, fromVC(200), 'baukapital', 0);
    world.day = 4;
    world.reputation = 40;
    world.guestsServed = 30;
    const before = ledger.getBalance(HAUSKONTO);
    const next = remodel(world, ledger, 'MEDIUM', 5);
    expect(next.template).toBe('MEDIUM');
    expect(ledger.getBalance(HAUSKONTO)).toBe(before - fromVC(120));
    expect(ledger.getBalance(guestAccount(guest.id))).toBe(0);
    expect(ledger.getBalance(pendingAccount(guest.id))).toBe(0);
    expect(ledger.getBalance(fiatAccount(guest.id))).toBe(0);
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
  });

  it('bricht den Umbau ab, wenn die Abrechnung scheitert, und laesst das Hauskonto unberuehrt', () => {
    const { world, ledger, guest } = fundedGuest();
    ledger.transfer('EXTERNAL_WORLD', HAUSKONTO, fromVC(200), 'baukapital', 0);
    world.day = 4;
    world.reputation = 40;
    world.guestsServed = 30;
    const before = ledger.getBalance(HAUSKONTO);
    const spy = vi.spyOn(ledger, 'transfer').mockImplementation(() => { throw new Error('Kasse klemmt'); });
    expect(() => remodel(world, ledger, 'MEDIUM', 5)).toThrow();
    spy.mockRestore();
    expect(world.template).toBe('SMALL');
    expect(world.guests.some((entry) => entry.id === guest.id)).toBe(true);
    expect(ledger.getBalance(HAUSKONTO)).toBe(before);
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
  });
});
