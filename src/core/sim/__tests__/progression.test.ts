/**
 * @test-target: src/core/sim/progression.ts
 * @error-code: ERR-2001
 *
 * Unternehmensstufen nennen echte Bedingungen; gesperrte Ware sagt, was fehlt.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { buyCrate } from '../deliveries';
import { companyStatus, companyTier, isUnlocked, requiredTier, revenueOf } from '../progression';
import { createWorld, ensureStarter } from '../templates';
import { HAUSKONTO } from '../money';

function start() {
  const world = createWorld('SMALL');
  ensureStarter(world);
  return { world, ledger: new Ledger() };
}

/** Echte Gastbuchungen: Fiat kommt herein, dann spielt der Gast ins Hauskonto. */
function earn(ledger: Ledger, vc: number, from = 'VISITOR_1') {
  ledger.transfer('EXTERNAL_WORLD', from, fromVC(vc), 'test fiat', 0);
  ledger.transfer(from, HAUSKONTO, fromVC(vc), 'test umsatz', 0);
}

describe('Unternehmensstufen', () => {
  it('startet als Bude und nennt die naechste Stufe mit Ist und Soll', () => {
    const { world, ledger } = start();
    const status = companyStatus(world, ledger);
    expect(status.tier).toBe('BUDE');
    expect(status.next?.id).toBe('KASSE');
    const ids = status.open.map((metric) => metric.id);
    expect(ids).toContain('day');
    expect(ids).toContain('revenue');
    expect(status.open.every((metric) => metric.current < metric.need)).toBe(true);
  });

  it('steigt mit Tagen, Umsatz und bedienten Gaesten', () => {
    const { world, ledger } = start();
    world.day = 3;
    world.guestsServed = 15;
    earn(ledger, 25);
    expect(revenueOf(ledger)).toBe(25);
    expect(companyTier(world, ledger)).toBe('KASSE');
  });

  it('zaehlt Zuschuesse von aussen nicht als Umsatz', () => {
    const { ledger } = start();
    ledger.transfer('EXTERNAL_WORLD', HAUSKONTO, fromVC(500), 'baukapital', 0);
    expect(revenueOf(ledger)).toBe(0);
  });

  it('schaltet Ware stufenweise frei und benennt die Sperre', () => {
    const { world, ledger } = start();
    earn(ledger, 40);
    expect(requiredTier('ROULETTE')).toBe('KONZERN');
    expect(isUnlocked(world, ledger, 'SLOT')).toBe(true);
    expect(isUnlocked(world, ledger, 'BLACKJACK')).toBe(false);
    expect(companyStatus(world, ledger).locked.map((entry) => entry.id)).toContain('BLACKJACK');
    expect(() => buyCrate(world, ledger, 'BLACKJACK')).toThrow(/Spielsaal/);
    expect(world.crates).toHaveLength(0);
  });

  it('laesst freigeschaltete Ware durch', () => {
    const { world, ledger } = start();
    world.day = 3;
    world.guestsServed = 15;
    earn(ledger, 40);
    const crate = buyCrate(world, ledger, 'PLINKO');
    expect(crate.payload).toEqual({ kind: 'FURNITURE', buildId: 'PLINKO' });
  });

  it('verlangt fuer den Spielsaal echte Ausstattung, nicht nur Geld', () => {
    const { world, ledger } = start();
    world.day = 30;
    world.guestsServed = 400;
    world.reputation = 90;
    earn(ledger, 500);
    // Ruf, Umsatz und Kapital reichen, die Ausstattung nicht.
    expect(companyTier(world, ledger)).toBe('KASSE');
    expect(companyStatus(world, ledger).open.map((metric) => metric.id)).toEqual(['games']);

    const slot = world.furniture.find((item) => item.gameId)!;
    for (let index = 0; index < 5; index += 1) world.furniture.push({ ...slot, id: 900 + index });
    const status = companyStatus(world, ledger);
    expect(status.tier).toBe('SAAL');
    expect(status.next?.id).toBe('KONZERN');
    expect(status.open.map((metric) => metric.id)).toContain('games');
  });
});
