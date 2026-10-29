import { describe, expect, it } from 'vitest';
import { Ledger } from '../../core/economy/ledger';
import { fromVC } from '../../core/economy/vacoin';
import { Prng } from '../../core/rng/prng';
import { CasinoFloor } from '../../core/simulation/casino-floor';
import { buildGameSnapshot } from '../game-snapshot';

function snapshot(ledger: Ledger, floor: CasinoFloor) {
  return buildGameSnapshot({
    ledger,
    floor,
    clock: 0,
    casinoId: 'CPU_DIVE_BAR',
    bet: fromVC(0.1),
    lastSpin: null,
    lastTable: null,
    notice: '',
    floorEvents: [],
  });
}

describe('Startzustand', () => {
  it('startet mit 5 VC, ohne spontanes Spiel und ohne offene Auszahlungen', () => {
    const ledger = new Ledger({ PLAYER_CASH: fromVC(5) });
    const prng = new Prng(1);
    const floor = new CasinoFloor(ledger, prng);
    const state = snapshot(ledger, floor);

    expect(state.cash).toBe(fromVC(5));
    expect(state.vault).toBe(0);
    expect(state.hasGame).toBe(false);
    expect(state.hasSlot).toBe(false);
    expect(state.hasTable).toBe(false);
    expect(state.pendingPayouts).toBe(0);
    expect(state.ledgerOk).toBe(true);
  });

  it('schaltet Tische und Slots getrennt frei', () => {
    const ledger = new Ledger({ PLAYER_CASH: fromVC(100), CASINO_VAULT: fromVC(50) });
    const prng = new Prng(2);
    const floor = new CasinoFloor(ledger, prng);

    floor.placeItem('SHELL_CART', 0, 0);
    expect(snapshot(ledger, floor).hasTable).toBe(true);
    expect(snapshot(ledger, floor).hasSlot).toBe(false);

    floor.placeItem('SLOT_RUSTY', 1, 0);
    expect(snapshot(ledger, floor).hasSlot).toBe(true);
  });
});
