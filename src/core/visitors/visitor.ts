/** Ein Gast: Brieftasche, Geduld, Sucht, Ziel. Alles serialisierbar. */
import { addVC, subVC, type VaCoinMicro } from '../economy/vacoin';
import type { PersonaId } from './persona';

export interface Visitor {
  readonly id: number;
  readonly name: string;
  readonly persona: PersonaId;
  readonly buyIn: VaCoinMicro;
  wallet: VaCoinMicro;
  pendingPayout: VaCoinMicro;
  patience: number;
  addiction: number;
  spins: number;
  /** Maschinen-ID, an der der Gast gerade steht (0 = noch unterwegs). */
  target: number;
}

/** Gesamtbilanz gegen den Buy-in, inklusive noch nicht ausgezahlter Gewinne. */
export function visitorNetResult(visitor: Visitor): VaCoinMicro {
  return subVC(addVC(visitor.wallet, visitor.pendingPayout), visitor.buyIn);
}
