/** Ein CPU-Spin inklusive Player-Mod-Boni, Suspicion und Rauswurf. */
import type { Ledger } from '../core/economy/ledger';
import { toVCString, ZERO_VC, type VaCoinMicro } from '../core/economy/vacoin';
import type { PlayerProfile } from '../core/character/player-profile';
import { suspicionForUse } from '../core/mods/player-mods';
import type { Prng } from '../core/rng/prng';
import { playCpuCasinoSpin, type CpuCasinoId, type CpuSpinResult } from '../core/simulation/cpu-casinos';

export interface CpuSpinOutcome {
  readonly result: CpuSpinResult;
  readonly notice: string;
}

export function performCpuSpin(
  casinoId: CpuCasinoId,
  bet: VaCoinMicro,
  ledger: Ledger,
  prng: Prng,
  tick: number,
  profile: PlayerProfile,
): CpuSpinOutcome {
  if (profile.isLockedOut(tick)) {
    throw new Error(`CPU-Casino gesperrt: noch ${profile.lockoutUntilTick - tick} s.`);
  }
  const result = playCpuCasinoSpin(casinoId, bet, ledger, prng, tick, {
    mediumWeightBonusBps: profile.effects.mediumWeightBonusBps,
    payoutBonusBps: profile.effects.payoutBonusBps,
    luckBiasBps: profile.luckBiasBps,
  });
  let notice = result.payout > ZERO_VC
    ? `Gewinn: +${toVCString(result.payout)} bei ${toVCString(result.totalBet)} Einsatz.`
    : result.spin.isNearMiss
      ? 'Near Miss! Zwei Diamanten - und Walze 3 versagt.'
      : 'Niete. Der Automat behaelt den Einsatz.';

  const equipped = profile.equippedPlayerMods;
  const heat = equipped.reduce((sum, id) => sum + suspicionForUse(equipped, id), 0);
  if (heat > 0) {
    const use = profile.addHeat(heat, ledger, tick);
    if (use.ejected) notice = `Rauswurf! ${toVCString(use.penalty)} weg - 60 s CPU-Sperre.`;
  }
  profile.recordSpin(result.payout);
  return { result, notice };
}
