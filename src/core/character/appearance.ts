/** Aussehen und Standort-Progression des Spielers. Headless, ohne Pixi. */
import type { VaCoinMicro } from '../economy/vacoin';
export type BodyTone = 'PALE' | 'TAN' | 'OLIVE' | 'DEEP';
export type OutfitId = 'RAGS' | 'STREET' | 'SUIT' | 'MOGUL';
export type FaceId = 'PLAIN' | 'SCAR' | 'GRIN';
export type HeadgearId = 'NONE' | 'CAP' | 'FEDORA';
export type HandItemId = 'NONE' | 'CHIPS' | 'CIGAR';

export interface Appearance {
  bodyTone: BodyTone;
  outfitId: OutfitId;
  faceId: FaceId;
  headgearId: HeadgearId;
  handItemId: HandItemId;
}

export const DEFAULT_APPEARANCE: Appearance = {
  bodyTone: 'OLIVE',
  outfitId: 'RAGS',
  faceId: 'PLAIN',
  headgearId: 'NONE',
  handItemId: 'NONE',
};

/** Optionen fuer den Charakter-Editor (UI) und spaetere Unlocks. */
export const APPEARANCE_OPTIONS = {
  bodyTone: ['PALE', 'TAN', 'OLIVE', 'DEEP'],
  outfitId: ['RAGS', 'STREET', 'SUIT', 'MOGUL'],
  faceId: ['PLAIN', 'SCAR', 'GRIN'],
  headgearId: ['NONE', 'CAP', 'FEDORA'],
  handItemId: ['NONE', 'CHIPS', 'CIGAR'],
} as const satisfies Record<keyof Appearance, readonly string[]>;

/** Reputation schaltet groessere Standorte frei. */
export const VENUES = [
  { id: 'BACKROOM', minReputation: 0 },
  { id: 'CLUB', minReputation: 250 },
  { id: 'HIGH_ROLLER', minReputation: 750 },
  { id: 'MOGUL_SKY', minReputation: 1500 },
] as const;

export type VenueId = (typeof VENUES)[number]['id'];

export function resolveVenue(reputation: number): VenueId {
  let venue: VenueId = 'BACKROOM';
  for (const candidate of VENUES) if (reputation >= candidate.minReputation) venue = candidate.id;
  return venue;
}

/** Ausbau-Reputation: jeder investierte VC bringt zehn Rufpunkte, mindestens zehn. */
export function reputationForBuild(priceVC: VaCoinMicro): number {
  return Math.max(10, Math.round(priceVC / 1_000));
}
