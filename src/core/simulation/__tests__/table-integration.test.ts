import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { addVC, fromVC, subVC, ZERO_VC } from '../../economy/vacoin';
import { Prng } from '../../rng/prng';
import { playCpuTableRound } from '../cpu-table-play';
import { getCpuTableOffer, type CpuTableGame } from '../cpu-tables';
import { CasinoFloor } from '../casino-floor';

describe('CPU-Tische', () => {
  it('bucht alle drei Tischspiele korrekt durch das Ledger', () => {
    const ledger = new Ledger({ PLAYER_CASH: fromVC(200), CPU_CASINO_POOL: fromVC(1_000) });
    const prng = new Prng(2026);
    const games: readonly CpuTableGame[] = ['ROULETTE', 'BLACKJACK', 'POKER'];
    let bets = ZERO_VC;
    let payouts = ZERO_VC;

    for (const [index, game] of games.entries()) {
      const result = playCpuTableRound('CPU_DIVE_BAR', game, fromVC(0.5), ledger, prng, index + 1);
      expect(result.game).toBe(game);
      expect(result.betEntry.from).toBe('PLAYER_CASH');
      expect(result.betEntry.to).toBe('CPU_CASINO_POOL');
      expect(result.betEntry.amount).toBe(fromVC(0.5));
      expect(result.totalBet).toBe(fromVC(0.5));
      if (result.payout > ZERO_VC) {
        expect(result.payoutEntry?.to).toBe('PLAYER_CASH');
      }
      bets = addVC(bets, result.totalBet);
      payouts = addVC(payouts, result.payout);
      expect(ledger.verifyLedgerIntegrity()).toBe(true);
    }
    expect(ledger.getBalance('PLAYER_CASH')).toBe(subVC(addVC(fromVC(200), payouts), bets));
  });

  it('respektiert Limits, Freischaltung und Casino-Angebote', () => {
    const ledger = new Ledger({ PLAYER_CASH: fromVC(200), CPU_CASINO_POOL: fromVC(1_000) });
    const prng = new Prng(5);
    expect(getCpuTableOffer('CPU_DIVE_BAR', 'POKER').minBetVC).toBe(fromVC(0.1));
    expect(getCpuTableOffer('CPU_HIGH_ROLLER', 'BLACKJACK').maxBetVC).toBe(fromVC(10));
    expect(() => playCpuTableRound('CPU_DIVE_BAR', 'ROULETTE', fromVC(5), ledger, prng, 1)).toThrow(/Limits/);
    expect(() => playCpuTableRound('CPU_HIGH_ROLLER', 'POKER', fromVC(1), ledger, prng, 1)).not.toThrow();
    expect(() => playCpuTableRound('CPU_HIGH_ROLLER', 'POKER', fromVC(0.1), ledger, prng, 1)).toThrow(/Limits/);
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
  });
});

describe('Floor-Integration', () => {
  it('laesst Gaeste an allen fuenf Spielkategorien spielen und haelt die Bilanz', () => {
    const ledger = new Ledger({
      PLAYER_CASH: fromVC(1_000),
      CASINO_VAULT: fromVC(1_000),
      CPU_CASINO_POOL: fromVC(100),
    });
    const floor = new CasinoFloor(ledger, new Prng(12345));
    floor.placeItem('SHELL_CART', 0, 0);
    floor.placeItem('SLOT_RUSTY', 1, 0);
    floor.placeItem('DICE_TABLE', 2, 0);
    floor.placeItem('ROULETTE_TABLE', 3, 0);
    floor.placeItem('BLACKJACK_TABLE', 4, 0);
    floor.placeItem('POKER_TABLE', 5, 0);
    const vaultBefore = ledger.getBalance('CASINO_VAULT');
    const kinds = new Set<string>();
    let bets = ZERO_VC;
    let payouts = ZERO_VC;
    let spins = 0;

    for (let tick = 0; tick < 360; tick += 1) {
      const result = floor.tickCasinoFloor();
      // Der Spieler muss Gewinne manuell auszahlen, sonst blockieren sie den Floor.
      for (const guest of floor.visitors) {
        if (guest.pendingPayout > 0) floor.payVisitor(guest.id);
      }
      spins += result.spins;
      bets = addVC(bets, result.bets);
      payouts = addVC(payouts, result.payouts);
      for (const event of result.events) {
        kinds.add(event.visual.kind);
        expect(event.net).toBe(event.payout - event.bet);
      }
    }

    expect(spins).toBeGreaterThan(0);
    expect(kinds.has('SLOT')).toBe(true);
    expect(kinds.has('SHELL')).toBe(true);
    expect(kinds.has('DICE')).toBe(true);
    expect(kinds.has('ROULETTE')).toBe(true);
    expect(kinds.has('CARDS')).toBe(true);
    expect(ledger.getBalance('CASINO_VAULT')).toBe(subVC(addVC(vaultBefore, bets), payouts));
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
  });
});
