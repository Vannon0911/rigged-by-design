/** Fremde CPU-Casinos: Einsatz buchen, Spin ausfuehren, Gewinn zurueckbuchen. */
import type { Ledger, LedgerEntry } from '../economy/ledger';
import { fromVC, mulVC, type VaCoinMicro } from '../economy/vacoin';
import type { Prng } from '../rng/prng';
import { spinSlot } from '../slot/slot-engine';
import { BASE_WEIGHTS, type SlotConfig, type SlotSymbol, type SpinResult } from '../slot/slot-types';

export type CpuCasinoId = 'CPU_DIVE_BAR' | 'CPU_HIGH_ROLLER';

export interface CpuCasino {
  readonly id: CpuCasinoId;
  readonly name: string;
  readonly description: string;
  readonly unlockBalanceVC: VaCoinMicro;
  readonly minBetVC: VaCoinMicro;
  readonly maxBetVC: VaCoinMicro;
  readonly targetRtp: number;
  readonly slot: SlotConfig;
}

/** Nur Spieler-Boni: werden nie an Besucher im eigenen Casino angewendet. */
export interface CpuPlayerBonus {
  readonly mediumWeightBonusBps?: number;
  readonly payoutBonusBps?: number;
  readonly luckBiasBps?: number;
}

const FAIR_WEIGHTS = { BLANK: 20, CHERRY: 20, BELL: 20, SEVEN: 20, VACOIN_DIAMOND: 20 } as const;
const HIGH_VOL_WEIGHTS = { BLANK: 25, CHERRY: 20, BELL: 20, SEVEN: 20, VACOIN_DIAMOND: 15 } as const;

export const CPU_CASINOS: readonly CpuCasino[] = [
  {
    id: 'CPU_DIVE_BAR',
    name: 'Rostige Spelunke',
    description: 'Faire Gewichte, ~94 % RTP, Einsaetze von 0.1000 bis 1.0000 VC pro Linie.',
    unlockBalanceVC: fromVC(0),
    minBetVC: fromVC(0.1),
    maxBetVC: fromVC(1),
    targetRtp: 0.94,
    slot: {
      id: 'cpu-dive-bar',
      baseBet: fromVC(0.1),
      paylines: ['MIDDLE', 'TOP', 'BOTTOM'],
      mods: [],
      weights: FAIR_WEIGHTS,
    },
  },
  {
    id: 'CPU_HIGH_ROLLER',
    name: 'Syndikat-Lounge',
    description: 'Ab 10.0000 VC Besitz, hohe Volatilitaet, Jackpot bis 50x, 1.0000 bis 10.0000 VC.',
    unlockBalanceVC: fromVC(10),
    minBetVC: fromVC(1),
    maxBetVC: fromVC(10),
    targetRtp: 0.58,
    slot: {
      id: 'cpu-high-roller',
      baseBet: fromVC(1),
      paylines: ['MIDDLE', 'TOP'],
      mods: [],
      weights: HIGH_VOL_WEIGHTS,
    },
  },
];

const CASINO_INDEX = new Map(CPU_CASINOS.map((casino) => [casino.id, casino]));

export function getCpuCasino(id: CpuCasinoId): CpuCasino {
  const casino = CASINO_INDEX.get(id);
  if (!casino) throw new Error(`Unbekanntes CPU-Casino: ${id}`);
  return casino;
}

export interface CpuSpinResult {
  readonly casinoId: CpuCasinoId;
  readonly betPerLine: VaCoinMicro;
  readonly totalBet: VaCoinMicro;
  readonly spin: SpinResult;
  readonly payout: VaCoinMicro;
  readonly betEntry: LedgerEntry;
  readonly payoutEntry: LedgerEntry | null;
}

/** betPerLine ist der Einsatz pro Linie; Gesamteinsatz = betPerLine * aktive Linien. */
export function playCpuCasinoSpin(
  casinoId: CpuCasinoId,
  betPerLine: VaCoinMicro,
  ledger: Ledger,
  prng: Prng,
  tick: number,
  bonus: CpuPlayerBonus = {},
): CpuSpinResult {
  const casino = getCpuCasino(casinoId);
  if (!Number.isSafeInteger(betPerLine)) throw new Error('playCpuCasinoSpin: Einsatz muss eine Ganzzahl sein');
  if (betPerLine < casino.minBetVC || betPerLine > casino.maxBetVC) {
    throw new Error(`${casino.name}: Einsatz ${betPerLine} ausserhalb ${casino.minBetVC}..${casino.maxBetVC}`);
  }
  if (ledger.getBalance('PLAYER_CASH') < casino.unlockBalanceVC) {
    throw new Error(`${casino.name} ist erst ab ${casino.unlockBalanceVC} Mikro-VC freigeschaltet`);
  }

  const lines = casino.slot.paylines.length;
  const totalBet = (betPerLine * lines) as VaCoinMicro;
  if (!Number.isSafeInteger(totalBet)) throw new Error('playCpuCasinoSpin: Gesamteinsatz zu gross');

  const betEntry = ledger.transfer('PLAYER_CASH', 'CPU_CASINO_POOL', totalBet, `cpu spin ${casinoId}`, tick);
  const weights: Partial<Record<SlotSymbol, number>> = { ...(casino.slot.weights ?? {}) };
  const mediumBias = (bonus.mediumWeightBonusBps ?? 0) + (bonus.luckBiasBps ?? 0);
  if (mediumBias > 0) {
    for (const symbol of ['CHERRY', 'BELL', 'SEVEN'] as const) {
      weights[symbol] = Math.round(((weights[symbol] ?? BASE_WEIGHTS[symbol]) * (10_000 + mediumBias)) / 10_000);
    }
  }
  const spin = spinSlot({ ...casino.slot, baseBet: betPerLine, weights }, prng, 10_000);
  const payout = mulVC(spin.totalPayout, 10_000 + Math.max(0, bonus.payoutBonusBps ?? 0));
  const adjustedSpin: SpinResult = { ...spin, totalPayout: payout };
  const payoutEntry =
    payout > 0
      ? ledger.transfer('CPU_CASINO_POOL', 'PLAYER_CASH', payout, `cpu win ${casinoId}`, tick)
      : null;

  return { casinoId, betPerLine, totalBet, spin: adjustedSpin, payout, betEntry, payoutEntry };
}
