/** Baut den oeffentlichen GameSnapshot aus Ledger, Floor und Jobs. */
import type { Ledger } from '../core/economy/ledger';
import { addVC, ZERO_VC } from '../core/economy/vacoin';
import type { CasinoFloor } from '../core/simulation/casino-floor';
import type { CpuCasinoId } from '../core/simulation/cpu-casinos';
import type { CpuTableResult } from '../core/simulation/cpu-table-play';
import type { FloorRoundEvent } from '../core/simulation/floor-events';
import { getBuildable } from '../core/simulation/catalog';
import type { GameSnapshot, LastSpin } from './game-types';

const TICKER_ROWS = 12;

export interface GameSnapshotInput {
  readonly ledger: Ledger;
  readonly floor: CasinoFloor;
  readonly clock: number;
  readonly casinoId: CpuCasinoId;
  readonly bet: GameSnapshot['bet'];
  readonly floorEvents: readonly FloorRoundEvent[];
  readonly lastSpin: LastSpin | null;
  readonly lastTable: CpuTableResult | null;
  readonly notice: string;
}

export function buildGameSnapshot(input: GameSnapshotInput): GameSnapshot {
  const visitors = input.floor.visitors;
  const avgAddiction = visitors.length === 0
    ? 0
    : visitors.reduce((sum, visitor) => sum + visitor.addiction, 0) / visitors.length;
  const pendingPayouts = visitors.reduce((sum, visitor) => addVC(sum, visitor.pendingPayout), ZERO_VC);
  return {
    cash: input.ledger.getBalance('PLAYER_CASH'),
    vault: input.ledger.getBalance('CASINO_VAULT'),
    pendingPayouts,
    hasGame: input.floor.games.length > 0,
    hasSlot: input.floor.slots.length > 0,
    hasTable: input.floor.games.some((item) => {
      const kind = getBuildable(item.buildableId).kind;
      return kind === 'SHELL' || kind === 'DICE';
    }),
    ledgerOk: input.ledger.verifyLedgerIntegrity(),
    visitors,
    avgAddiction,
    floorSize: input.floor.size,
    venueTier: input.floor.venueTier,
    placements: input.floor.items,
    floorEvents: input.floorEvents,
    lastEntries: [...input.ledger.entries].slice(-TICKER_ROWS).reverse(),
    now: input.clock,
    casinoId: input.casinoId,
    bet: input.bet,
    lastSpin: input.lastSpin,
    lastTable: input.lastTable,
    notice: input.notice,
  };
}
