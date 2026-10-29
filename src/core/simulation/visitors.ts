/** Besucher-Erzeugung: Outfit-Tier, Name, Wallet und Startwerte. */
import { addVC, fromVC, subVC, ZERO_VC, type VaCoinMicro } from '../economy/vacoin';
import type { Prng } from '../rng/prng';

export interface Visitor {
  readonly id: number;
  readonly name: string;
  readonly outfitTier: number;
  readonly buyIn: VaCoinMicro;
  wallet: VaCoinMicro;
  pendingPayout: VaCoinMicro;
  addiction: number;
  patience: number;
  spins: number;
}

const OUTFITS = [
  { tier: 0, label: 'Lumpen', min: fromVC(1), max: fromVC(4) },
  { tier: 1, label: 'Street', min: fromVC(4), max: fromVC(12) },
  { tier: 2, label: 'Business', min: fromVC(12), max: fromVC(40) },
  { tier: 3, label: 'High Roller', min: fromVC(40), max: fromVC(120) },
] as const;
const NAMES = ['Kai', 'Rita', 'Bruno', 'Nadja', 'Otis', 'Mira', 'Falk', 'Sina', 'Timo', 'Lena'];

function outfitForWallet(wallet: VaCoinMicro): number {
  if (wallet >= fromVC(500)) return 3;
  if (wallet >= fromVC(50)) return 2;
  if (wallet >= fromVC(10)) return 1;
  return 0;
}

export function rollVisitor(
  id: number,
  prng: Prng,
  startingAddiction: number,
  budget: { readonly min: VaCoinMicro; readonly max: VaCoinMicro } = { min: 0 as VaCoinMicro, max: 0 as VaCoinMicro },
): Visitor {
  const outfit = OUTFITS[prng.nextInt(0, OUTFITS.length - 1)]!;
  const min = Math.max(0, Math.floor(budget.min));
  const max = Math.max(min, Math.floor(budget.max));
  const wallet = (min === 0 && max === 0 ? prng.nextInt(outfit.min, outfit.max) : prng.nextInt(min, max)) as VaCoinMicro;
  return {
    id,
    name: `${NAMES[prng.nextInt(0, NAMES.length - 1)]!} ${id}`,
    outfitTier: min === 0 && max === 0 ? outfit.tier : outfitForWallet(wallet),
    buyIn: wallet,
    wallet,
    pendingPayout: ZERO_VC,
    addiction: startingAddiction,
    patience: 100,
    spins: 0,
  };
}

/** Gesamtbilanz gegen den Buy-in, inklusive noch nicht ausgezahlter Gewinne. */
export function visitorNetResult(visitor: Visitor): VaCoinMicro {
  return subVC(addVC(visitor.wallet, visitor.pendingPayout), visitor.buyIn);
}
