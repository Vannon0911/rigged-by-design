/** Physik-RTP-Gate: Paytable aus den Taschenbreiten, Rueckmeldung aus echter Physik. */
import { Prng } from '../rng/prng';
import { createPlinkoBoard, MAX_POCKETS, MIN_POCKETS, type PlinkoConfig } from './plinko-board';

/** Nominal-RTP, den der Editor anstrebt, bevor die Physik davon abweicht. */
export const NOMINAL_RTP = 0.9;
/** Untere Grenze: darunter ist das Brett zu knausrig und das Gate blockiert. */
export const MIN_MEASURED_RTP = 0.85;
/** Haus-Deckel: darueber zahlt das Brett zu grosszuegig und das Gate blockiert. */
export const HOUSE_RTP_CAP = 0.98;
/** Gleicher Startpunkt fuer jede Messung, damit identische Bretter identisch messen. */
const SAMPLE_SEED = 0x51ca5e;
const DEFAULT_SAMPLES = 400;

export type GateResult = {
  readonly ok: boolean;
  readonly measuredRTP: number;
  readonly reason: string;
  readonly paytable: readonly number[];
};

/**
 * Paytable in bps: enge Faecher zahlen mehr, breite weniger. Bei exakt gleichen
 * Breiten ergibt das 0,9x auf jede Tasche, unabhaengig von der Physik.
 */
export function pocketPaytable(config: PlinkoConfig): readonly number[] {
  const total = config.weights.reduce((sum, weight) => sum + weight, 0);
  if (!(total > 0)) return [];
  return config.weights.map((weight) => Math.round((NOMINAL_RTP * 10_000) / (config.pockets * (weight / total))));
}

/** Schnelle deterministische Stichprobe ueber das gebaute Brett inklusive Mehrball-Wuerfen. */
export function measureRTP(config: PlinkoConfig, samples: number): number {
  const built = createPlinkoBoard(config);
  const paytable = pocketPaytable(config);
  const prng = new Prng(SAMPLE_SEED);
  let returned = 0;
  for (let index = 0; index < samples; index += 1) {
    const drop = built.drop(prng);
    for (const pocket of drop.pockets) returned += paytable[pocket] ?? 0;
  }
  return returned / samples / 10_000;
}

const percent = (value: number): string => `${(value * 100).toFixed(1).replace('.', ',')} %`;

/** Das Gate: blockiert unter 85 % und ueber dem Haus-Deckel mit klarer Meldung. */
export function boardGate(config: PlinkoConfig, samples = DEFAULT_SAMPLES): GateResult {
  const valid = Number.isInteger(config.pockets)
    && config.pockets >= MIN_POCKETS && config.pockets <= MAX_POCKETS
    && config.weights.length === config.pockets;
  if (!valid) {
    return {
      ok: false,
      measuredRTP: 0,
      reason: `Ungueltige Taschenzahl ${config.pockets}; erlaubt sind ${MIN_POCKETS} bis ${MAX_POCKETS}`,
      paytable: [],
    };
  }
  const paytable = pocketPaytable(config);
  const measuredRTP = measureRTP(config, samples);
  if (measuredRTP < MIN_MEASURED_RTP) {
    return { ok: false, measuredRTP, reason: `RTP ${percent(measuredRTP)} liegt unter der 85-%-Untergrenze`, paytable };
  }
  if (measuredRTP > HOUSE_RTP_CAP) {
    return { ok: false, measuredRTP, reason: `RTP ${percent(measuredRTP)} liegt ueber dem Haus-Deckel von 98 %`, paytable };
  }
  return { ok: true, measuredRTP, reason: `RTP ${percent(measuredRTP)} liegt zwischen 85 % und 98 %`, paytable };
}
