/** Kartenmodell und legal gebaute Decks - ohne Zieh-Logik, damit der Schuh schlank bleibt. */
import type { Prng } from './prng';

export const SUITS = ['SPADES', 'HEARTS', 'DIAMONDS', 'CLUBS'] as const;
export type Suit = (typeof SUITS)[number];
export type CardSpecial = 'DEATH';

export interface Card {
  readonly rank: number;
  readonly suit: Suit;
  /** Eindeutige physische Karte, damit auch 6 Decks und Zusatzkarten unterscheidbar bleiben. */
  readonly id?: string;
  readonly special?: CardSpecial;
}

export const SUIT_SYMBOL: Readonly<Record<Suit, string>> = {
  SPADES: '♠',
  HEARTS: '♥',
  DIAMONDS: '♦',
  CLUBS: '♣',
};

export type DeckModId =
  | 'DECK_GREEDY_TENS'
  | 'DECK_FAT_FIVES'
  | 'DECK_FIFTH_ACE'
  | 'DECK_DEATH_CARD';

export function rankLabel(rank: number): string {
  if (rank === 14) return 'A';
  if (rank === 13) return 'K';
  if (rank === 12) return 'Q';
  if (rank === 11) return 'J';
  if (rank === 0) return '☠';
  return String(rank);
}

export function cardLabel(card: Card): string {
  if (card.special === 'DEATH') return '☠';
  return `${rankLabel(card.rank)}${SUIT_SYMBOL[card.suit]}`;
}

export function cardValue(card: Card): number {
  if (card.special === 'DEATH') return 0;
  if (card.rank === 14) return 11;
  return Math.min(10, card.rank);
}

/** Beste Summe: Ass zaehlt 11, solange die Hand nicht ueberkauft. */
export function handValue(cards: readonly Card[]): number {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    if (card.rank === 14) {
      aces += 1;
      total += 11;
    } else {
      total += Math.min(10, card.rank);
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return total;
}

export function isSoftHand(cards: readonly Card[]): boolean {
  const hard = cards.reduce((sum, card) => sum + Math.min(10, card.rank), 0);
  return handValue(cards) !== hard;
}

export function cardKey(card: Card): string {
  return card.id ?? `${card.special ?? 'STANDARD'}:${card.suit}:${card.rank}`;
}

/** Baut ein physisches Deck inklusive legal eingefuegter Mod-Karten. */
export function buildDeck(decks: number, mods: readonly DeckModId[]): Card[] {
  if (!Number.isInteger(decks) || decks < 1 || decks > 6) throw new Error('Deck: 1 bis 6 Decks erlaubt');
  const all: Card[] = [];
  for (let deck = 0; deck < decks; deck += 1) {
    const cards: Card[] = [];
    for (const suit of SUITS) {
      for (let rank = 2; rank <= 14; rank += 1) {
        cards.push({ rank, suit, id: `d${deck}-${suit}-${rank}` });
      }
    }
    if (mods.includes('DECK_GREEDY_TENS')) {
      let removed = 0;
      for (let index = cards.length - 1; index >= 0 && removed < 2; index -= 1) {
        if (cards[index]!.rank === 10) {
          cards.splice(index, 1);
          removed += 1;
        }
      }
    }
    if (mods.includes('DECK_FAT_FIVES')) {
      cards.push(
        { rank: 5, suit: 'SPADES', id: `d${deck}-FAT-5S` },
        { rank: 5, suit: 'HEARTS', id: `d${deck}-FAT-5H` },
      );
    }
    if (mods.includes('DECK_FIFTH_ACE')) {
      cards.push({ rank: 14, suit: 'SPADES', id: `d${deck}-FIFTH-ACE` });
    }
    if (mods.includes('DECK_DEATH_CARD')) {
      cards.push({ rank: 0, suit: 'SPADES', id: `d${deck}-DEATH`, special: 'DEATH' });
    }
    all.push(...cards);
  }
  return all;
}

export function shuffleCards(cards: Card[], prng: Prng): void {
  for (let index = cards.length - 1; index > 0; index -= 1) {
    const swap = prng.nextInt(0, index);
    const value = cards[index]!;
    cards[index] = cards[swap]!;
    cards[swap] = value;
  }
}
