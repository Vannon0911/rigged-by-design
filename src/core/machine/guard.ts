/** EV-Guard: schätzt den RTP einer Maschine und blockt offensichtliche Gelddrucker. */
import { Prng } from '../rng/prng';
import { spinSlot } from '../slot/slot-engine';
import { getVenue, type VenueTier } from '../venues';
import { slotConfigOf, type MachineState } from './machine';

export interface RtpEstimate {
  readonly rtp: number;
  readonly spins: number;
  readonly totalBet: number;
  readonly totalPayout: number;
}

export interface MachineGuard extends RtpEstimate {
  readonly ceiling: number;
  readonly ok: boolean;
  readonly greedy: boolean;
  readonly reason: string;
}

/** Deterministische Stichprobe: gleicher Seed, gleiche Maschine, gleiche Zahl. */
export function estimateRtp(machine: MachineState, spins = 6000, seed = 20261029): RtpEstimate {
  if (!Number.isSafeInteger(spins) || spins <= 0) throw new Error('estimateRtp: spins muss positiv sein');
  const prng = new Prng(seed);
  const config = slotConfigOf(machine);
  let totalBet = 0;
  let totalPayout = 0;
  for (let index = 0; index < spins; index += 1) {
    const spin = spinSlot(config, prng);
    totalBet += spin.totalBet;
    totalPayout += spin.totalPayout;
  }
  return { rtp: totalBet === 0 ? 0 : totalPayout / totalBet, spins, totalBet, totalPayout };
}

export function guardMachine(machine: MachineState, venueTier: VenueTier): MachineGuard {
  const ceiling = getVenue(venueTier).rtpCeilingBps / 10_000;
  const estimate = estimateRtp(machine);
  if (machine.reels.length < 3) {
    return { ...estimate, ceiling, ok: false, greedy: false, reason: 'Mindestens drei Walzen nötig.' };
  }
  if (estimate.rtp > ceiling) {
    return {
      ...estimate,
      ceiling,
      ok: false,
      greedy: false,
      reason: `Auszahlung ${(estimate.rtp * 100).toFixed(1)} % über dem Deckel ${(ceiling * 100).toFixed(0)} %: offensichtlicher Gelddrucker.`,
    };
  }
  const greedy = estimate.rtp < 0.6;
  return {
    ...estimate,
    ceiling,
    ok: true,
    greedy,
    reason: greedy
      ? `Sehr gierig: nur ${(estimate.rtp * 100).toFixed(1)} % Auszahlung. Gäste merken das schneller, als dir lieb ist.`
      : `Im Rahmen: ${(estimate.rtp * 100).toFixed(1)} % Auszahlung.`,
  };
}

export function assertRtp(machine: MachineState, venueTier: VenueTier): void {
  const guard = guardMachine(machine, venueTier);
  if (!guard.ok) throw new Error(guard.reason);
}
