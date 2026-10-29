/** Besuch im fremden Haus: nur die Hausregeln gelten. */
import type { Ledger } from '../core/economy/ledger';
import type { VaCoinMicro } from '../core/economy/vacoin';
import type { Prng } from '../core/rng/prng';
import { playHouseSpin, type HouseId, type HouseSpinResult } from '../core/visit/houses';

export function gameplayHouse(
  houseId: HouseId,
  bet: VaCoinMicro,
  ledger: Ledger,
  prng: Prng,
  tick: number,
): HouseSpinResult {
  return playHouseSpin(houseId, bet, ledger, prng, tick);
}
