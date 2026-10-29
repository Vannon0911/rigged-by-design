import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { Prng } from '../../rng/prng';
import { CasinoFloor } from '../../simulation/casino-floor';
import { buildLedgerEntries, parseSave, replaySavedLedger, serializeSave, type FullSave } from '../../persistence/save-manager';
import { RogueliteLoop, tributeForCycle } from '../roguelite-loop';
import { getVenue } from '../venues-and-tiers';

function playableFloor(ledger: Ledger, prng: Prng): CasinoFloor {
  return new CasinoFloor(ledger, prng, { venueTier: 1, enforceVenue: true });
}

describe('Roguelite-Bogen', () => {
  it('eskaliert den Tribut exakt nach Zyklus', () => {
    expect(tributeForCycle(1)).toBe(fromVC(15));
    expect(tributeForCycle(2)).toBe(fromVC(45));
    expect(tributeForCycle(3)).toBe(fromVC(120));
    expect(tributeForCycle(4)).toBe(fromVC(300));
  });

  it('steigt von Venue 1 auf Venue 2 auf, zahlt Tribut und stellt den Save wieder her', () => {
    const ledger = new Ledger({ PLAYER_CASH: fromVC(100), CASINO_VAULT: fromVC(50) });
    const prng = new Prng(4242);
    const floor = playableFloor(ledger, prng);
    const loop = new RogueliteLoop(ledger, prng);
    const venueOne = getVenue(1);
    const venueTwo = getVenue(2);

    expect(venueOne.gridSize).toBe(4);
    expect(() => floor.placeItem('DICE_TABLE', 0, 1)).toThrow(/nicht freigeschaltet/);

    loop.tick(180);
    expect(loop.snapshot.status).toBe('TRIBUTE_DUE');
    expect(loop.snapshot.tributeDueVC).toBe(fromVC(15));

    expect(loop.payTribute(180)).toBe(true);
    expect(loop.snapshot.status).toBe('PERK_CHOICE');
    expect(loop.snapshot.offeredPerks).toHaveLength(3);
    loop.choosePerk(loop.snapshot.offeredPerks[0]!);
    expect(loop.snapshot.cycle).toBe(2);
    expect(loop.snapshot.status).toBe('ACTIVE');

    ledger.transfer('PLAYER_CASH', 'SHOP_VENDOR', venueTwo.unlockCostVC, 'venue upgrade', 200);
    floor.setVenueTier(2);
    expect(floor.size).toBe(6);
    floor.placeItem('DICE_TABLE', 4, 5);
    expect(ledger.getBalance('PLAYER_CASH')).toBe(fromVC(7));

    const saved: FullSave = {
      schemaVersion: 1,
      savedAt: Date.now(),
      ledger: buildLedgerEntries(ledger),
      floor: floor.snapshot(),
      meta: loop.meta,
      progression: loop.snapshot,
      venueTier: 2,
      clock: 201,
      tick: 201,
      casinoId: 'CPU_DIVE_BAR',
      bet: fromVC(0.1),
      prngState: prng.getState(),
    };
    const restored = parseSave(serializeSave(saved));
    expect(restored).not.toBeNull();
    expect(restored!.venueTier).toBe(2);
    expect(restored!.progression.cycle).toBe(2);

    const replayed = replaySavedLedger(restored!.ledger);
    expect(replayed).not.toBeNull();
    expect(replayed!.verifyLedgerIntegrity()).toBe(true);
    const restoredFloor = new CasinoFloor(replayed!, new Prng(1));
    restoredFloor.restore(restored!.floor);
    expect(restoredFloor.size).toBe(6);
    expect(restoredFloor.items).toHaveLength(1);
    expect(restoredFloor.items[0]!.buildableId).toBe('DICE_TABLE');
  });

  it('beendet einen Run ohne Deckung und zahlt Syndikat-Siegel nach Umsatz', () => {
    const ledger = new Ledger({ PLAYER_CASH: fromVC(10) });
    const loop = new RogueliteLoop(ledger, new Prng(7));
    loop.addRevenue(fromVC(25));
    loop.tick(180);
    expect(loop.snapshot.status).toBe('RUN_OVER');
    expect(loop.snapshot.meta.tokens).toBe(2);
    expect(loop.snapshot.meta.runs).toBe(1);
    expect(ledger.getBalance('PLAYER_CASH')).toBe(fromVC(10));
  });

  it('lehnt manipulierte Ledger-Eintraege beim Laden ab', () => {
    const ledger = new Ledger({ PLAYER_CASH: fromVC(50) });
    const floor = new CasinoFloor(ledger, new Prng(1));
    const loop = new RogueliteLoop(ledger, new Prng(3));
    const saved: FullSave = {
      schemaVersion: 1,
      savedAt: Date.now(),
      ledger: buildLedgerEntries(ledger),
      floor: floor.snapshot(),
      meta: loop.meta,
      progression: loop.snapshot,
      venueTier: 1,
      clock: 0,
      tick: 0,
      casinoId: 'CPU_DIVE_BAR',
      bet: fromVC(0.1),
      prngState: 1,
    };
    const corrupt = { ...saved, ledger: [{ ...saved.ledger[0]!, amount: -1 }] };
    expect(parseSave(JSON.stringify(corrupt))).toBeNull();
  });
});
