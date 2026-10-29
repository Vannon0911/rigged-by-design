import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import type { MachineState } from '../../machine/machine';
import { Prng } from '../../rng/prng';
import { makeVisitor } from '../spawn';
import { tickFloor } from '../tick';
import type { Visitor } from '../visitor';

const MACHINE: MachineState = {
  id: 1,
  catalogId: 'SLOT_RUSTY',
  x: 0,
  y: 0,
  reels: ['REEL_MIXED', 'REEL_MIXED', 'REEL_MIXED'],
  mods: [],
  baseBet: fromVC(0.05),
};

function play(visitor: Visitor) {
  const ledger = new Ledger({ VISITOR_WALLET: fromVC(20), CASINO_VAULT: fromVC(20) });
  let removed = 0;
  const result = tickFloor({
    ledger,
    prng: new Prng(7),
    machines: [MACHINE],
    decor: [],
    visitors: [visitor],
    ticks: 1,
    maxVisitors: 1,
    venueTier: 1,
    nextId: () => 99,
    nextEventId: () => 1,
    removeVisitor: () => {
      removed += 1;
      return true;
    },
  });
  return { result, removed };
}

describe('Gäste-Fluss', () => {
  it('ein offener Gewinn blockiert den laufenden Gast nicht', () => {
    const visitor = makeVisitor('STREET', 5, 1);
    visitor.pendingPayout = fromVC(0.5);
    const { result } = play(visitor);
    expect(result.spins).toBe(1);
  });

  it('ein Gast mit 0 Geduld und offenem Gewinn wartet an der Kasse', () => {
    const visitor = makeVisitor('STREET', 5, 1);
    visitor.pendingPayout = fromVC(0.5);
    visitor.patience = 0;
    const { result, removed } = play(visitor);
    expect(result.spins).toBe(0);
    expect(removed).toBe(0);
  });
});
