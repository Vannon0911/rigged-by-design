/** Fremde CPU-Casinos: Einsatz buchen, Spin ausfuehren, Gewinn zurueckbuchen. */
import type { Ledger, LedgerEntry } from '../economy/ledger';
import { fromVC, mulVC, type VaCoinMicro } from '../economy/vacoin';
import type { Prng } from '../rng/prng';
import { resolvePaylines, spinSlot } from '../slot/slot-engine';
import { BASE_WEIGHTS, type SlotConfig, type SlotSymbol, type SpinResult } from '../slot/slot-types';
import { CPU_TABLE_OFFERS, type CpuTableOffer } from './cpu-tables';

export type CpuCasinoId = 'CPU_DIVE_BAR' | 'CPU_BACKROOM_CLUB' | 'CPU_NEON_SPIRE' | 'CPU_HIGH_ROLLER';

export interface CpuCasino {
  readonly id: CpuCasinoId;
  readonly venueTier: 1 | 2 | 3 | 4;
  readonly name: string;
  readonly description: string;
  readonly minBetVC: VaCoinMicro;
  readonly maxBetVC: VaCoinMicro;
  readonly targetRtp: number;
  readonly slot: SlotConfig;
  readonly tables: readonly CpuTableOffer[];
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
    venueTier: 1,
    name: 'Straßen-Spelunke',
    description: 'Standard-CPU-Casino: faire Gewichte, ~94 % RTP, Einsaetze ab 0.1000 VC.',
    minBetVC: fromVC(0.1),
    maxBetVC: fromVC(1),
    targetRtp: 0.94,
    tables: CPU_TABLE_OFFERS.CPU_DIVE_BAR,
    slot: {
      id: 'cpu-dive-bar',
      baseBet: fromVC(0.1),
      paylines: ['MIDDLE', 'TOP', 'BOTTOM'],
      mods: [],
      weights: FAIR_WEIGHTS,
    },
  },
  {
    id: 'CPU_BACKROOM_CLUB',
    venueTier: 2,
    name: 'Hinterhof-Club',
    description: 'Mittelklasse: mehr Filz, mehr Neon, ~90 % RTP. Ab eigener Stufe 2.',
    minBetVC: fromVC(0.25),
    maxBetVC: fromVC(2.5),
    targetRtp: 0.9,
    tables: CPU_TABLE_OFFERS.CPU_BACKROOM_CLUB,
    slot: {
      id: 'cpu-backroom-club',
      baseBet: fromVC(0.25),
      paylines: ['MIDDLE', 'TOP', 'BOTTOM'],
      mods: [],
      weights: { BLANK: 22, CHERRY: 22, BELL: 21, SEVEN: 20, VACOIN_DIAMOND: 15 },
    },
  },
  {
    id: 'CPU_NEON_SPIRE',
    venueTier: 3,
    name: 'Neon-Spire',
    description: 'High-Roller: drei Linien, hohe Volatilitaet, ~85 % RTP. Ab eigener Stufe 3.',
    minBetVC: fromVC(0.5),
    maxBetVC: fromVC(5),
    targetRtp: 0.85,
    tables: CPU_TABLE_OFFERS.CPU_NEON_SPIRE,
    slot: {
      id: 'cpu-neon-spire',
      baseBet: fromVC(0.5),
      paylines: ['MIDDLE', 'TOP', 'BOTTOM'],
      mods: [],
      weights: { BLANK: 26, CHERRY: 22, BELL: 20, SEVEN: 19, VACOIN_DIAMOND: 13 },
    },
  },
  {
    id: 'CPU_HIGH_ROLLER',
    venueTier: 4,
    name: 'Mogul-Lounge',
    description: 'VIP-Mogul: hohe Volatilitaet, Jackpot bis 50x, 1.0000 bis 10.0000 VC. Ab Stufe 4.',
    minBetVC: fromVC(1),
    maxBetVC: fromVC(10),
    targetRtp: 0.58,
    tables: CPU_TABLE_OFFERS.CPU_HIGH_ROLLER,
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
  const lines = resolvePaylines(casino.slot).length;
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
