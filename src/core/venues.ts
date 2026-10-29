/** Venues: vier Standorte vom 4x4-Hinterhof zum 10x10-Palast. */
import { fromVC, type VaCoinMicro } from './economy/vacoin';

export type VenueTier = 1 | 2 | 3 | 4;

export interface Venue {
  readonly tier: VenueTier;
  readonly name: string;
  readonly tagline: string;
  readonly gridSize: number;
  /** Preis, um diese Stufe zu erreichen (0 = Start). */
  readonly upgradeCostVC: VaCoinMicro;
  readonly budgetMinVC: VaCoinMicro;
  readonly budgetMaxVC: VaCoinMicro;
  readonly maxVisitors: number;
  /** Miete alle 60 Ticks, aus dem Tresor. */
  readonly rentVC: VaCoinMicro;
  /** Obergrenze fuer den erwarteten RTP einer Maschine in Basispunkten. */
  readonly rtpCeilingBps: number;
}

export const VENUES: readonly Venue[] = [
  {
    tier: 1,
    name: 'Nasse Straßenecke',
    tagline: 'Ein Karton, ein Automat, keine Gnade.',
    gridSize: 4,
    upgradeCostVC: 0 as VaCoinMicro,
    budgetMinVC: fromVC(0.3),
    budgetMaxVC: fromVC(3),
    maxVisitors: 8,
    rentVC: fromVC(0.05),
    rtpCeilingBps: 11_000,
  },
  {
    tier: 2,
    name: 'Hinterhof-Spelunke',
    tagline: 'Mehr Platz, mehr Neon, mehr Laufkundschaft.',
    gridSize: 6,
    upgradeCostVC: fromVC(60),
    budgetMinVC: fromVC(2),
    budgetMaxVC: fromVC(20),
    maxVisitors: 12,
    rentVC: fromVC(0.6),
    rtpCeilingBps: 10_500,
  },
  {
    tier: 3,
    name: 'Neon-Spielhalle',
    tagline: 'Teppich, der den Ausgang verschluckt.',
    gridSize: 8,
    upgradeCostVC: fromVC(260),
    budgetMinVC: fromVC(20),
    budgetMaxVC: fromVC(150),
    maxVisitors: 18,
    rentVC: fromVC(4),
    rtpCeilingBps: 10_000,
  },
  {
    tier: 4,
    name: 'Grand VaCoin Palast',
    tagline: 'High Roller, VIP-Lounge, ein Tresor mit Meinung.',
    gridSize: 10,
    upgradeCostVC: fromVC(1_200),
    budgetMinVC: fromVC(150),
    budgetMaxVC: fromVC(2_500),
    maxVisitors: 24,
    rentVC: fromVC(30),
    rtpCeilingBps: 9_500,
  },
];

const VENUE_INDEX = new Map(VENUES.map((venue) => [venue.tier, venue]));

export function getVenue(tier: number): Venue {
  const venue = VENUE_INDEX.get(tier as VenueTier);
  if (!venue) throw new Error(`Unbekannte Venue-Stufe: ${tier}`);
  return venue;
}

export function nextVenue(tier: VenueTier): Venue | null {
  return VENUE_INDEX.get((tier + 1) as VenueTier) ?? null;
}
