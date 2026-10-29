/** Roguelite-Loop: 180-Tick-Tribut, 1-aus-3-Perks und Syndikats-Pfaendung. */
import { addVC, fromVC, subVC, type VaCoinMicro } from '../economy/vacoin';
import type { Ledger } from '../economy/ledger';
import type { Prng } from '../rng/prng';
import {
  addRunRewards,
  applyTributeDiscount,
  buyMetaUnlock,
  EMPTY_META,
  getMetaUnlock,
  type MetaProgress,
  type MetaUnlockId,
} from './meta-progression';
import { getRunPerk, RUN_PERKS, type RunPerkId } from './run-perks';

export type { RunPerk, RunPerkId } from './run-perks';
export { RUN_PERKS } from './run-perks';

export const TRIBUTE_INTERVAL = 180;
export type RunStatus = 'ACTIVE' | 'TRIBUTE_DUE' | 'PERK_CHOICE' | 'RUN_OVER';

export interface RogueliteSnapshot {
  readonly cycle: number;
  readonly ticksIntoCycle: number;
  readonly status: RunStatus;
  readonly tributeDueVC: VaCoinMicro;
  readonly offeredPerks: readonly RunPerkId[];
  readonly chosenPerks: readonly RunPerkId[];
  readonly revenueVC: VaCoinMicro;
  readonly meta: MetaProgress;
  readonly runNumber: number;
}

const SCHEDULE = [fromVC(15), fromVC(45), fromVC(120)] as const;

export function tributeForCycle(cycle: number): VaCoinMicro {
  if (cycle < 1) throw new Error('tributeForCycle: Zyklus muss >= 1 sein');
  if (cycle <= SCHEDULE.length) return SCHEDULE[cycle - 1]!;
  let value: VaCoinMicro = SCHEDULE[SCHEDULE.length - 1]!;
  for (let index = SCHEDULE.length; index < cycle; index += 1) value = Math.round(value * 2.5) as VaCoinMicro;
  return value;
}

export class RogueliteLoop {
  readonly #ledger: Ledger;
  readonly #prng: Prng;
  #state: RogueliteSnapshot;

  constructor(ledger: Ledger, prng: Prng, initial?: Partial<RogueliteSnapshot>) {
    this.#ledger = ledger;
    this.#prng = prng;
    const meta = initial?.meta ? { ...EMPTY_META, ...initial.meta } : EMPTY_META;
    this.#state = {
      cycle: initial?.cycle ?? 1,
      ticksIntoCycle: initial?.ticksIntoCycle ?? 0,
      status: initial?.status ?? 'ACTIVE',
      tributeDueVC: initial?.tributeDueVC ?? applyTributeDiscount(tributeForCycle(initial?.cycle ?? 1), meta),
      offeredPerks: initial?.offeredPerks ? [...initial.offeredPerks] : [],
      chosenPerks: initial?.chosenPerks ? [...initial.chosenPerks] : [],
      revenueVC: initial?.revenueVC ?? (0 as VaCoinMicro),
      meta,
      runNumber: initial?.runNumber ?? 1,
    };
  }

  get snapshot(): RogueliteSnapshot {
    return {
      ...this.#state,
      offeredPerks: [...this.#state.offeredPerks],
      chosenPerks: [...this.#state.chosenPerks],
      meta: {
        ...this.#state.meta,
        unlocks: [...this.#state.meta.unlocks],
        blueprints: [...this.#state.meta.blueprints],
      },
    };
  }

  get meta(): MetaProgress { return this.snapshot.meta; }
  get ticksUntilTribute(): number { return Math.max(0, TRIBUTE_INTERVAL - this.#state.ticksIntoCycle); }

  addRevenue(amount: VaCoinMicro): void {
    if (amount > 0) this.#state = { ...this.#state, revenueVC: addVC(this.#state.revenueVC, amount) };
  }

  tick(count = 1): void {
    if (this.#state.status !== 'ACTIVE') return;
    for (let step = 0; step < count; step += 1) {
      if (this.#state.ticksIntoCycle < TRIBUTE_INTERVAL) {
        this.#state = { ...this.#state, ticksIntoCycle: this.#state.ticksIntoCycle + 1 };
      }
      if (this.#state.ticksIntoCycle < TRIBUTE_INTERVAL) continue;
      const due = applyTributeDiscount(tributeForCycle(this.#state.cycle), this.#state.meta);
      if (this.#canPay(due)) this.#state = { ...this.#state, status: 'TRIBUTE_DUE', tributeDueVC: due };
      else this.#runOver();
      break;
    }
  }

  payTribute(tick = 0): boolean {
    if (this.#state.status !== 'TRIBUTE_DUE') throw new Error('payTribute: kein Tribut faellig');
    const due = this.#state.tributeDueVC;
    if (!this.#canPay(due)) {
      this.#runOver();
      return false;
    }
    const cash = this.#ledger.getBalance('PLAYER_CASH');
    const fromCash = (cash >= due ? due : cash) as VaCoinMicro;
    if (fromCash > 0) this.#ledger.transfer('PLAYER_CASH', 'EXTERNAL_WORK', fromCash, `syndicate tribute cycle ${this.#state.cycle}`, tick);
    const rest = subVC(due, fromCash);
    if (rest > 0) this.#ledger.transfer('CASINO_VAULT', 'EXTERNAL_WORK', rest, `syndicate tribute cycle ${this.#state.cycle}`, tick);
    this.#state = { ...this.#state, status: 'PERK_CHOICE', offeredPerks: this.#rollPerks() };
    return true;
  }

  choosePerk(id: RunPerkId, tick = 0): void {
    if (this.#state.status !== 'PERK_CHOICE') throw new Error('choosePerk: keine Perk-Auswahl offen');
    if (!this.#state.offeredPerks.includes(id)) throw new Error(`choosePerk: ${id} wurde nicht angeboten`);
    const perk = getRunPerk(id);
    if (perk.id === 'PERK_VAULT_CUSHION') {
      this.#ledger.transfer('EXTERNAL_WORK', 'CASINO_VAULT', fromVC(10), 'run perk vault cushion', tick);
    }
    const blueprints = perk.blueprint && !this.#state.meta.blueprints.includes(id)
      ? [...this.#state.meta.blueprints, id]
      : this.#state.meta.blueprints;
    const cycle = this.#state.cycle + 1;
    const meta: MetaProgress = { ...this.#state.meta, blueprints };
    this.#state = {
      ...this.#state,
      cycle,
      ticksIntoCycle: 0,
      status: 'ACTIVE',
      tributeDueVC: applyTributeDiscount(tributeForCycle(cycle), meta),
      offeredPerks: [],
      chosenPerks: [...this.#state.chosenPerks, id],
      meta,
    };
  }

  buyUnlock(id: MetaUnlockId): void {
    this.#state = { ...this.#state, meta: buyMetaUnlock(this.#state.meta, getMetaUnlock(id).id) };
  }

  failRun(): void {
    if (this.#state.status !== 'RUN_OVER') this.#runOver();
  }

  #rollPerks(): RunPerkId[] {
    const pool = [...RUN_PERKS];
    const offered: RunPerkId[] = [];
    for (let index = 0; index < 3 && pool.length > 0; index += 1) {
      offered.push(pool.splice(this.#prng.nextInt(0, pool.length - 1), 1)[0]!.id);
    }
    return offered;
  }

  #canPay(amount: VaCoinMicro): boolean {
    return addVC(this.#ledger.getBalance('PLAYER_CASH'), this.#ledger.getBalance('CASINO_VAULT')) >= amount;
  }

  #runOver(): void {
    this.#state = {
      ...this.#state,
      status: 'RUN_OVER',
      offeredPerks: [],
      meta: addRunRewards(this.#state.meta, this.#state.revenueVC, this.#state.chosenPerks),
    };
  }
}
