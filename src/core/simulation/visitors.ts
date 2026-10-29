/** Besucher-Erzeugung: Outfit-Tier, Name, Wallet und Startwerte. */
import { fromVC, type VaCoinMicro } from '../economy/vacoin';
import type { Prng } from '../rng/prng';

export interface Visitor {
  readonly id: number;
  readonly name: string;
  readonly outfitTier: number;
  wallet: VaCoinMicro;
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

export function rollVisitor(id: number, prng: Prng, startingAddiction: number): Visitor {
  const outfit = OUTFITS[prng.nextInt(0, OUTFITS.length - 1)]!;
  const wallet = prng.nextInt(outfit.min, outfit.max) as VaCoinMicro;
  return {
    id,
    name: `${NAMES[prng.nextInt(0, NAMES.length - 1)]!} ${id}`,
    outfitTier: outfit.tier,
    wallet,
    addiction: startingAddiction,
    patience: 100,
    spins: 0,
  };
}
