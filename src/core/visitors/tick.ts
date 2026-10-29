/** Ein vollständiger Floor-Tick: Spawn, Wahl, Spin, Buchung, Sucht, Geduld, Gehen. */
import type { Ledger } from '../economy/ledger';
import { addVC, ZERO_VC, type VaCoinMicro } from '../economy/vacoin';
import type { FloorRoundEvent } from '../floor/events';
import { makeFloorEvent } from '../floor/events';
import type { PlacedItem } from '../floor/types';
import type { MachineState } from '../machine/machine';
import { addictionBonusOf, operatingCostOf, patienceDeltaOf, slotConfigOf } from '../machine/machine';
import { getItem } from '../offer/catalog';
import type { Prng } from '../rng/prng';
import { spinSlot } from '../slot/slot-engine';
import type { VenueTier } from '../venues';
import { chooseMachine } from './choice';
import { placeVisitorBet, reserveVisitorWin } from './ledger';
import { getPersona } from './persona';
import { spawnVisitor } from './spawn';
import type { Visitor } from './visitor';

const SPAWN_BASE = 0.08;
const PATIENCE_LOSS = 4;

export interface FloorTickInput {
  readonly ledger: Ledger;
  readonly prng: Prng;
  readonly machines: readonly MachineState[];
  readonly decor: readonly PlacedItem[];
  readonly visitors: Visitor[];
  readonly ticks: number;
  readonly maxVisitors: number;
  readonly venueTier: VenueTier;
  readonly nextId: () => number;
  readonly nextEventId: () => number;
  readonly removeVisitor: (id: number) => boolean;
}

export interface FloorTickOutput {
  readonly spawned: number;
  readonly spins: number;
  readonly bets: VaCoinMicro;
  readonly payouts: VaCoinMicro;
  readonly left: number;
  readonly events: readonly FloorRoundEvent[];
}

function decorTotal(decor: readonly PlacedItem[], key: 'spawnBonusBps' | 'patienceBonus' | 'startingAddiction' | 'attractionBps'): number {
  return decor.reduce((sum, item) => sum + getItem(item.catalogId)[key], 0);
}

function spawnChanceFor(decor: readonly PlacedItem[]): number {
  const spawn = decorTotal(decor, 'spawnBonusBps');
  const attraction = decorTotal(decor, 'attractionBps');
  return Math.min(0.5, SPAWN_BASE * (1 + spawn / 10_000) + attraction / 20_000);
}

export function tickFloor(input: FloorTickInput): FloorTickOutput {
  let spawned = 0;
  if (input.visitors.length < input.maxVisitors && input.prng.nextFloat() < spawnChanceFor(input.decor)) {
    input.visitors.push(spawnVisitor({
      ledger: input.ledger,
      prng: input.prng,
      id: input.nextId(),
      venueTier: input.venueTier,
      startingAddiction: decorTotal(input.decor, 'startingAddiction'),
      patienceBonus: decorTotal(input.decor, 'patienceBonus'),
      tick: input.ticks,
    }));
    spawned = 1;
  }

  const events: FloorRoundEvent[] = [];
  let spins = 0;
  let bets = ZERO_VC;
  let payouts = ZERO_VC;
  let left = 0;

  for (const visitor of [...input.visitors]) {
    if (visitor.patience <= 0) {
      // Wer auf seinen Gewinn wartet, blockiert einen Platz, bis die Kasse zahlt.
      if (visitor.pendingPayout > ZERO_VC) continue;
      if (input.removeVisitor(visitor.id)) left += 1;
      continue;
    }
    if (input.machines.length === 0) {
      visitor.patience -= 12;
      if (visitor.patience <= 0 && visitor.pendingPayout === ZERO_VC && input.removeVisitor(visitor.id)) left += 1;
      continue;
    }

    const machine = chooseMachine(visitor, input.machines, input.prng);
    if (!machine) {
      visitor.patience -= 8;
      if (visitor.patience <= 0 && input.removeVisitor(visitor.id)) left += 1;
      continue;
    }

    const operatingCost = operatingCostOf(machine);
    if (operatingCost > ZERO_VC && input.ledger.getBalance('CASINO_VAULT') >= operatingCost) {
      input.ledger.transfer('CASINO_VAULT', 'EXTERNAL_WORK', operatingCost, `machine #${machine.id} operating cost`, input.ticks);
    }

    const spin = spinSlot(slotConfigOf(machine), input.prng);
    if (spin.totalBet > visitor.wallet) {
      visitor.patience -= 8;
      if (visitor.patience <= 0 && visitor.pendingPayout === ZERO_VC && input.removeVisitor(visitor.id)) left += 1;
      continue;
    }
    placeVisitorBet(input.ledger, visitor, spin.totalBet, input.ticks);

    let paid = ZERO_VC;
    if (spin.totalPayout > ZERO_VC) {
      const vault = input.ledger.getBalance('CASINO_VAULT');
      paid = (spin.totalPayout <= vault ? spin.totalPayout : vault) as VaCoinMicro;
      if (paid > ZERO_VC) reserveVisitorWin(input.ledger, visitor, paid, input.ticks);
    }

    const persona = getPersona(visitor.persona);
    const thrill = spin.isNearMiss ? 14 : spin.isLDW ? 10 : paid > 0 ? 6 : 2;
    const gain = Math.min(24, Math.round((thrill + 2 + addictionBonusOf(machine)) * persona.addictionRate));
    visitor.addiction = Math.min(100, visitor.addiction + gain);
    visitor.spins += 1;

    if (visitor.addiction >= 100) {
      visitor.patience = 100;
    } else {
      visitor.patience -= Math.max(1, PATIENCE_LOSS - patienceDeltaOf(machine));
    }

    events.push(makeFloorEvent({
      seq: input.nextEventId(),
      visitor,
      machineId: machine.id,
      x: machine.x,
      y: machine.y,
      bet: spin.totalBet,
      payout: paid,
      symbols: spin.grid.map((column) => column[1] ?? 'BLANK'),
      isNearMiss: spin.isNearMiss,
      isLDW: spin.isLDW,
    }));

    spins += 1;
    bets = addVC(bets, spin.totalBet);
    payouts = addVC(payouts, paid);

    if (visitor.patience <= 0 && visitor.pendingPayout === ZERO_VC && input.removeVisitor(visitor.id)) left += 1;
  }

  return { spawned, spins, bets, payouts, left, events };
}
