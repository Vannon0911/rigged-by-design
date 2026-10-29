import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { addVC, fromVC, subVC, ZERO_VC } from '../../economy/vacoin';
import { Prng } from '../../rng/prng';
import { CasinoFloor } from '../casino-floor';
import { getBuildable } from '../catalog';
import { playCpuCasinoSpin } from '../cpu-casinos';
import { canEnterCpuCasino, canUpgradeVenue, growthFrom, upgradeBlockers } from '../progression';
import type { Visitor } from '../visitors';

function guest(wallet: number, addiction: number, patience = 100): Visitor {
  return {
    id: 1,
    name: 'Testgast 1',
    outfitTier: 0,
    buyIn: fromVC(wallet),
    wallet: fromVC(wallet),
    pendingPayout: ZERO_VC,
    addiction,
    patience,
    spins: 0,
  };
}

describe('Simulations-Loop ohne künstliche Arbeit', () => {
  it('Katalogpreise und Grid-Regeln stimmen', () => {
    expect(getBuildable('SHELL_CART').priceVC).toBe(fromVC(5));
    expect(getBuildable('SLOT_RUSTY').priceVC).toBe(fromVC(15));
    expect(getBuildable('SLOT_RUSTY').maxMods).toBe(2);
    expect(getBuildable('SLOT_NEON').paylines).toBe(3);
    expect(getBuildable('DECO_BOOZE').operatingCostVC).toBe(fromVC(0.05));

    const ledger = new Ledger({ PLAYER_CASH: fromVC(100), CASINO_VAULT: fromVC(100) });
    const floor = new CasinoFloor(ledger, new Prng(7));
    expect(() => floor.placeItem('SLOT_RUSTY', 8, 0)).toThrow(/ausserhalb/);
    floor.placeItem('SLOT_RUSTY', 0, 0);
    expect(() => floor.placeItem('SLOT_NEON', 0, 0)).toThrow(/belegt/);
  });

  it('startet mit 5 VC und einem kostenlosen Hütchenspieler-Karton, der echte Einnahmen erzeugt', () => {
    const ledger = new Ledger({ PLAYER_CASH: fromVC(5) });
    const floor = new CasinoFloor(ledger, new Prng(20261029), { venueTier: 1, enforceVenue: true });
    const starter = floor.ensureStarterGame();

    expect(starter?.buildableId).toBe('SHELL_CART');
    expect(floor.games).toHaveLength(1);
    expect(ledger.getBalance('PLAYER_CASH')).toBe(fromVC(5));
    expect(floor.ensureStarterGame()).toBeNull();

    const vaultBefore = ledger.getBalance('CASINO_VAULT');
    let spins = 0;
    let bets = ZERO_VC;
    let payouts = ZERO_VC;
    for (let tick = 0; tick < 500; tick += 1) {
      const result = floor.tickCasinoFloor();
      spins += result.spins;
      bets = addVC(bets, result.bets);
      payouts = addVC(payouts, result.payouts);
    }

    expect(spins).toBeGreaterThan(0);
    expect(bets).toBeGreaterThan(ZERO_VC);
    expect(ledger.getBalance('CASINO_VAULT')).toBe(subVC(addVC(vaultBefore, bets), payouts));
    expect(ledger.getBalance('VISITOR_WALLET')).toBe(
      floor.visitors.reduce((sum, visitor) => sum + visitor.wallet, 0),
    );
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
  });

  it('riskiert Startkapital im Standard-CPU-Casino, ohne Geld zu drucken', () => {
    const ledger = new Ledger({
      PLAYER_CASH: fromVC(5),
      CPU_CASINO_POOL: fromVC(500),
    });
    const prng = new Prng(4242);
    const start = ledger.getBalance('PLAYER_CASH');
    let bets = ZERO_VC;
    let payouts = ZERO_VC;
    let rounds = 0;

    while (ledger.getBalance('PLAYER_CASH') >= fromVC(0.3) && rounds < 80) {
      const spin = playCpuCasinoSpin('CPU_DIVE_BAR', fromVC(0.1), ledger, prng, rounds);
      bets = addVC(bets, spin.totalBet);
      payouts = addVC(payouts, spin.payout);
      rounds += 1;
    }

    expect(rounds).toBeGreaterThan(0);
    expect(ledger.getBalance('PLAYER_CASH')).toBe(subVC(addVC(start, payouts), bets));
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
  });

  it('verlangt für den nächsten Standort Umsatz, mehrere Spiele und Bargeld', () => {
    const items = [
      { buildableId: 'SHELL_CART' as const },
      { buildableId: 'SLOT_RUSTY' as const },
      { buildableId: 'DECO_CARPET' as const },
    ];
    const growth = growthFrom(items, fromVC(10), 1);
    expect(growth.gameCount).toBe(2);
    expect(growth.uniqueKinds).toBe(2);
    expect(growth.buildValueVC).toBe(fromVC(28));

    expect(canUpgradeVenue(1, growth, fromVC(49))).toBe(false);
    expect(upgradeBlockers(1, growth, fromVC(49)).length).toBe(1);
    expect(canUpgradeVenue(1, growth, fromVC(50))).toBe(true);
    expect(upgradeBlockers(1, growth, fromVC(50))).toEqual([]);
    expect(canEnterCpuCasino(1, 1)).toBe(true);
    expect(canEnterCpuCasino(1, 2)).toBe(false);
    expect(canEnterCpuCasino(3, 2)).toBe(true);
  });

  it('süchtige Gäste setzen maximal und bleiben bis zum Bankrott', () => {
    const ledger = new Ledger({ CASINO_VAULT: fromVC(1) });
    const floor = new CasinoFloor(ledger, new Prng(77), { venueTier: 1, enforceVenue: true });
    const shell = floor.ensureStarterGame()!;
    floor.restore({
      ticks: 0,
      nextId: 2,
      items: [shell],
      visitors: [guest(0.3, 100, 1)],
      venueTier: 1,
      size: 4,
    });

    const locked = floor.tickCasinoFloor();
    expect(locked.spins).toBe(1);
    expect(locked.bets).toBe(fromVC(0.3));
    expect(floor.visitors[0]?.patience).toBe(100);

    const brokeLedger = new Ledger({ CASINO_VAULT: fromVC(1) });
    const brokeFloor = new CasinoFloor(brokeLedger, new Prng(78), { venueTier: 1, enforceVenue: true });
    const brokeShell = brokeFloor.ensureStarterGame()!;
    brokeFloor.restore({
      ticks: 0,
      nextId: 2,
      items: [brokeShell],
      visitors: [guest(0.04, 100, 100)],
      venueTier: 1,
      size: 4,
    });
    const broke = brokeFloor.tickCasinoFloor();
    expect(broke.spins).toBe(0);
    expect(broke.left).toBe(1);
    expect(brokeFloor.visitors).toHaveLength(0);
    expect(brokeLedger.verifyLedgerIntegrity()).toBe(true);
  });

  it('ohne gebautes Spiel gibt es keine Floor-Spins', () => {
    const ledger = new Ledger({ CASINO_VAULT: fromVC(100) });
    const floor = new CasinoFloor(ledger, new Prng(11));
    let spins = 0;
    for (let tick = 0; tick < 120; tick += 1) spins += floor.tickCasinoFloor().spins;

    expect(spins).toBe(0);
    expect(floor.games).toHaveLength(0);
    expect(ledger.getBalance('CASINO_VAULT')).toBe(fromVC(100));
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
  });
});
