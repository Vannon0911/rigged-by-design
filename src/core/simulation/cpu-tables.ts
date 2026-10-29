/** Tisch-Angebote der CPU-Casinos: Roulette, Blackjack und Poker mit eigenen Limits. */
import { fromVC, type VaCoinMicro } from '../economy/vacoin';
import type { CpuCasinoId } from './cpu-casinos';

export type CpuTableGame = 'ROULETTE' | 'BLACKJACK' | 'POKER';

export interface CpuTableOffer {
  readonly game: CpuTableGame;
  readonly minBetVC: VaCoinMicro;
  readonly maxBetVC: VaCoinMicro;
  readonly note: string;
}

export const TABLE_GAME_NAMES: Readonly<Record<CpuTableGame, string>> = {
  ROULETTE: 'Roulette-Kessel',
  BLACKJACK: 'Blackjack-Filz',
  POKER: 'Casino Hold’em',
};

export const CPU_TABLE_OFFERS: Readonly<Record<CpuCasinoId, readonly CpuTableOffer[]>> = {
  CPU_DIVE_BAR: [
    { game: 'ROULETTE', minBetVC: fromVC(0.1), maxBetVC: fromVC(1), note: 'Krummer Kessel, Rot/Schwarz 1:1.' },
    { game: 'BLACKJACK', minBetVC: fromVC(0.1), maxBetVC: fromVC(1), note: '6 Decks, Dealer steht auf 17.' },
    { game: 'POKER', minBetVC: fromVC(0.1), maxBetVC: fromVC(1), note: '5 Karten, Dealer braucht ein Paar.' },
  ],
  CPU_BACKROOM_CLUB: [
    { game: 'ROULETTE', minBetVC: fromVC(0.25), maxBetVC: fromVC(2.5), note: 'Dutzend-Wetten und 00 im Kessel.' },
    { game: 'BLACKJACK', minBetVC: fromVC(0.25), maxBetVC: fromVC(2.5), note: '6 Decks, 3:2, Dealer steht auf 17.' },
    { game: 'POKER', minBetVC: fromVC(0.25), maxBetVC: fromVC(2.5), note: '5 Karten gegen den Dealer.' },
  ],
  CPU_NEON_SPIRE: [
    { game: 'ROULETTE', minBetVC: fromVC(0.5), maxBetVC: fromVC(5), note: 'Lightning-Kessel mit 00/000 und Blitz-Pockets.' },
    { game: 'BLACKJACK', minBetVC: fromVC(0.5), maxBetVC: fromVC(5), note: '6:5-Blackjack mit Bonusfeld.' },
    { game: 'POKER', minBetVC: fromVC(0.5), maxBetVC: fromVC(5), note: '6-Karten-Deal fuer mehr Treffer.' },
  ],
  CPU_HIGH_ROLLER: [
    { game: 'ROULETTE', minBetVC: fromVC(1), maxBetVC: fromVC(10), note: 'High-Limit-Kessel mit Straight-Wette.' },
    { game: 'BLACKJACK', minBetVC: fromVC(1), maxBetVC: fromVC(10), note: '6:5-Blackjack mit 3-Card-Bonusfeld.' },
    { game: 'POKER', minBetVC: fromVC(1), maxBetVC: fromVC(10), note: '6-Karten-Luxus-Deal - mehr Treffer, kleinere Paar-Payouts.' },
  ],
};

export function getCpuTableOffer(casinoId: CpuCasinoId, game: CpuTableGame): CpuTableOffer {
  const offer = CPU_TABLE_OFFERS[casinoId].find((entry) => entry.game === game);
  if (!offer) throw new Error(`CPU-Casino ${casinoId} bietet ${game} nicht an`);
  return offer;
}
