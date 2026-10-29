/** Beweist: eigene Kessel- und Kartentische buchen über den Tresor und wenden Betreiber-Mods an. */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../core/economy/ledger';
import { fromVC } from '../../core/economy/vacoin';
import { Prng } from '../../core/rng/prng';
import { CasinoFloor } from '../../core/simulation/casino-floor';
import { playOwnCardRound } from '../own-play';

function setup() {
  const ledger = new Ledger({ PLAYER_CASH: fromVC(1000), CASINO_VAULT: fromVC(1000) });
  const prng = new Prng(1337);
  const floor = new CasinoFloor(ledger, prng, { venueTier: 4, enforceVenue: true });
  floor.placeItem('ROULETTE_TABLE', 0, 0);
  floor.placeItem('BLACKJACK_TABLE', 1, 0);
  const poker = floor.placeItem('POKER_TABLE', 2, 0);
  floor.installMod(poker.id, 'MOD_SIX_CARD_POKER');
  return { ledger, prng, floor };
}

describe('eigene Kessel- und Kartentische', () => {
  it('spielt Roulette aus dem Tresor und hält die Buchhaltung exakt', () => {
    const { ledger, prng, floor } = setup();
    const beforeVault = ledger.getBalance('CASINO_VAULT');
    const result = playOwnCardRound(ledger, prng, 0, floor, 'ROULETTE', fromVC(0.5), { rouletteBet: 'RED' });
    expect(result.roulette).not.toBeNull();
    expect(result.roulette!.pocket).toBeGreaterThanOrEqual(0);
    expect(result.roulette!.pocket).toBeLessThanOrEqual(36);
    expect(result.totalBet).toBe(fromVC(0.5));
    expect(ledger.getBalance('CASINO_VAULT')).toBe(beforeVault + result.totalBet - result.payout);
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
  });

  it('spielt Blackjack inklusive Double über den eigenen Tresor', () => {
    const { ledger, prng, floor } = setup();
    const beforeVault = ledger.getBalance('CASINO_VAULT');
    const result = playOwnCardRound(ledger, prng, 0, floor, 'BLACKJACK', fromVC(0.5));
    expect(result.blackjack).not.toBeNull();
    expect(result.blackjack!.playerCards.length).toBeGreaterThanOrEqual(2);
    expect(result.blackjack!.dealerCards.length).toBeGreaterThanOrEqual(2);
    expect(result.totalBet).toBeGreaterThanOrEqual(fromVC(0.5));
    expect(ledger.getBalance('CASINO_VAULT')).toBe(beforeVault + result.totalBet - result.payout);
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
  });

  it('gibt dem eigenen Pokertisch den installierten Sechskarten-Deal', () => {
    const { ledger, prng, floor } = setup();
    const beforeVault = ledger.getBalance('CASINO_VAULT');
    const result = playOwnCardRound(ledger, prng, 0, floor, 'POKER', fromVC(1));
    expect(result.poker).not.toBeNull();
    expect(result.poker!.playerCards).toHaveLength(6);
    expect(result.poker!.dealerCards).toHaveLength(5);
    expect(result.poker!.sixCard).toBe(true);
    expect(ledger.getBalance('CASINO_VAULT')).toBe(beforeVault + result.totalBet - result.payout);
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
  });

  it('verweigert eine Runde ohne aufgebauten Tisch', () => {
    const ledger = new Ledger({ PLAYER_CASH: fromVC(10), CASINO_VAULT: fromVC(10) });
    const prng = new Prng(7);
    const empty = new CasinoFloor(ledger, prng, { venueTier: 4, enforceVenue: true });
    expect(() => playOwnCardRound(ledger, prng, 0, empty, 'POKER', fromVC(1))).toThrow(/Baue zuerst/);
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
  });
});
