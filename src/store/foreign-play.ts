/** Fremde Haeuser: Spiel und Besuch an einer Stelle, damit der Store schlank bleibt. */
import type { Ledger } from '../core/economy/ledger';
import type { GameResult } from '../core/games/contracts';
import type { Prng } from '../core/rng/prng';
import { foreignRound } from '../core/sim/actions';
import { fromVC, toVCString, type VaCoinMicro } from '../core/economy/vacoin';
import { visitRival, type RivalId } from '../core/sim/rivals';
import type { GameId } from '../core/sim/types';

export interface ForeignOutcome {
  readonly result: GameResult;
  readonly notice: string;
}

const payoutText = (payout: VaCoinMicro): string =>
  payout > 0 ? `${toVCString(payout)} zurück.` : 'Verloren.';

export function playForeignGame(
  ledger: Ledger, game: GameId, betVC: number, prng: Prng, tick: number, houseEdgeBps = 250,
): ForeignOutcome {
  const result = foreignRound(ledger, game, fromVC(betVC), prng, tick, houseEdgeBps);
  return { result, notice: `${result.label}: ${payoutText(result.payout)}` };
}

export function playRivalGame(
  ledger: Ledger, rivalId: RivalId, machineIndex: number, betVC: number, prng: Prng, tick: number,
): ForeignOutcome {
  const visit = visitRival(ledger, rivalId, machineIndex, fromVC(betVC), prng, tick);
  return { result: visit.result, notice: `${visit.rival.name} (${visit.machine.label}): ${payoutText(visit.result.payout)}` };
}
