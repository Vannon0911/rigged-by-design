import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC, type VaCoinMicro } from '../../economy/vacoin';
import { Prng } from '../../rng/prng';
import { CasinoFloor } from '../casino-floor';
import { getBuildable } from '../catalog';
import { playCpuCasinoSpin } from '../cpu-casinos';
import { HustleWork } from '../hustle-work';

describe('Simulations-Loop', () => {
  it('Katalogpreise und Grid-Regeln stimmen', () => {
    expect(getBuildable('SLOT_RUSTY').priceVC).toBe(fromVC(15));
    expect(getBuildable('SLOT_RUSTY').maxMods).toBe(2);
    expect(getBuildable('SLOT_NEON').paylines).toBe(3);
    expect(getBuildable('DECO_BOOZE').operatingCostVC).toBe(fromVC(0.05));
    expect(getBuildable('DECO_NEON_SIGN').spawnBonusBps).toBe(2500);

    const ledger = new Ledger({ PLAYER_CASH: fromVC(100), CASINO_VAULT: fromVC(100) });
    const floor = new CasinoFloor(ledger, new Prng(7));
    expect(() => floor.placeItem('SLOT_RUSTY', 8, 0)).toThrow(/ausserhalb/);
    floor.placeItem('SLOT_RUSTY', 0, 0);
    expect(() => floor.placeItem('SLOT_NEON', 0, 0)).toThrow(/belegt/);
  });

  it('Arbeiten -> CPU-Casino verdoppeln -> Slot kaufen -> Besucher zocken lassen', () => {
    const ledger = new Ledger({
      CPU_CASINO_POOL: fromVC(500),
      CASINO_VAULT: fromVC(200),
    });
    const prng = new Prng(20261029);
    const hustle = new HustleWork(ledger, prng);
    let now = 0;

    // 1) Arbeiten, bis 25 VC in der Tasche sind.
    while (ledger.getBalance('PLAYER_CASH') < fromVC(25)) {
      hustle.work('BOTTLE_COLLECT', now);
      now += 1.5;
    }
    expect(() => hustle.work('BOTTLE_COLLECT', now - 1)).toThrow(/Cooldown/);
    const afterWork = ledger.getBalance('PLAYER_CASH');
    expect(afterWork).toBeGreaterThanOrEqual(fromVC(25));

    // 2) Im CPU-Casino verdoppeln (bei Ebbe wird wieder gearbeitet).
    const target = (afterWork * 2) as VaCoinMicro;
    let cpuSpins = 0;
    let cpuWins = 0;
    let guard = 0;
    while (ledger.getBalance('PLAYER_CASH') < target && guard < 5_000) {
      guard += 1;
      if (ledger.getBalance('PLAYER_CASH') < fromVC(3)) {
        hustle.work('BOTTLE_COLLECT', now);
        now += 1.5;
        continue;
      }
      const spin = playCpuCasinoSpin('CPU_DIVE_BAR', fromVC(1), ledger, prng, Math.floor(now));
      cpuSpins += 1;
      if (spin.payout > 0) cpuWins += 1;
      now += 1;
    }
    expect(cpuSpins).toBeGreaterThan(0);
    expect(cpuWins).toBeGreaterThan(0);
    expect(ledger.getBalance('PLAYER_CASH')).toBeGreaterThanOrEqual(target);

    // 3) Eigenen Slot kaufen und einen Sucht-Mod installieren.
    const floor = new CasinoFloor(ledger, prng);
    const slot = floor.placeItem('SLOT_RUSTY', 2, 3);
    floor.installMod(slot.id, 'MOD_NEAR_MISS');
    expect(floor.slots).toHaveLength(1);
    expect(() => floor.installMod(slot.id, 'MOD_NEAR_MISS')).toThrow(/bereits installiert/);

    // 4) Besucher simulieren und Tresor-Bilanz pruefen.
    const vaultBefore = ledger.getBalance('CASINO_VAULT');
    let simulatedSpins = 0;
    let bets = 0;
    let payouts = 0;
    let maxVisitors = 0;
    for (let tick = 0; tick < 400; tick += 1) {
      const result = floor.tickCasinoFloor();
      simulatedSpins += result.spins;
      bets += result.bets;
      payouts += result.payouts;
      maxVisitors = Math.max(maxVisitors, floor.visitors.length);
    }
    expect(maxVisitors).toBeGreaterThan(0);
    expect(simulatedSpins).toBeGreaterThan(0);
    expect(floor.tickCount).toBe(400);
    expect(ledger.getBalance('CASINO_VAULT')).toBe(vaultBefore + bets - payouts);
    expect(ledger.verifyLedgerIntegrity()).toBe(true);

    const balances = ledger.snapshot();
    const net = Object.values(balances).reduce((sum, value) => sum + value, 0);
    expect(net).toBe(0);
  });

  it('Huetchenspiel und Wuerfeltisch fuettern das eigene Casino', () => {
    const ledger = new Ledger({ PLAYER_CASH: fromVC(100), CASINO_VAULT: fromVC(500) });
    const floor = new CasinoFloor(ledger, new Prng(31));
    const shell = floor.placeItem('SHELL_CART', 1, 1);
    const dice = floor.placeItem('DICE_TABLE', 2, 2);
    expect(shell.buildableId).toBe('SHELL_CART');
    expect(dice.buildableId).toBe('DICE_TABLE');
    expect(floor.slots).toHaveLength(0);
    expect(floor.games).toHaveLength(2);

    let spins = 0;
    for (let tick = 0; tick < 300; tick += 1) spins += floor.tickCasinoFloor().spins;
    expect(spins).toBeGreaterThan(0);
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
    expect(ledger.getBalance('CASINO_VAULT')).toBeGreaterThan(0);
  });

  it('Schlaegerei beim Tuersteher zahlt nur den Netto-Notgroschen', () => {
    let brawlSeen = false;
    for (let seed = 1; seed <= 200 && !brawlSeen; seed += 1) {
      const ledger = new Ledger();
      const hustle = new HustleWork(ledger, new Prng(seed));
      const result = hustle.work('BOUNCER_SHIFT', 0);
      if (result.brawl) {
        brawlSeen = true;
        expect(result.net).toBe(fromVC(0.2));
        expect(result.gross).toBe(fromVC(1.2));
        expect(ledger.getBalance('PLAYER_CASH')).toBe(fromVC(0.2));
      }
    }
    expect(brawlSeen).toBe(true);
  });
});
