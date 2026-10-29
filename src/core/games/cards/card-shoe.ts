/** Kartenstiefel: Ziehen ohne Zuruecklegen, Extra-Karten, Lookahead-Bias und Zahlen-RNG. */
import type { Prng } from '../../rng/prng';
import { rollNumber } from '../../rng/number-rng';
import {
  buildDeck,
  cardKey,
  cardValue,
  type Card,
  type DeckModId,
} from '../../rng/deck-cards';

export * from '../../rng/deck-cards';

function blackjackScore(total: number, card: Card): number {
  let next = total + cardValue(card);
  if (next > 21 && card.rank === 14) next -= 10;
  return next > 21 ? 100 - next : 1_000 + next;
}

function clampBias(value: number): number {
  if (!Number.isFinite(value)) throw new Error('drawWithBias: biasFactor muss endlich sein');
  return Math.min(1, Math.max(0, value));
}

export class CardShoe {
  readonly #prng: Prng;
  readonly #decks: number;
  readonly #mods: readonly DeckModId[];
  readonly #extraCards: readonly Card[];
  #cards: Card[] = [];
  #drawn: Card[] = [];
  #initial: Card[] = [];

  constructor(prng: Prng, decks = 6, mods: readonly DeckModId[] = [], extraCards: readonly Card[] = []) {
    if (!Number.isInteger(decks) || decks < 1 || decks > 6) throw new Error('Shoe: 1 bis 6 Decks erlaubt');
    this.#prng = prng;
    this.#decks = decks;
    this.#mods = [...mods];
    this.#extraCards = extraCards.map((card, index) => ({
      ...card,
      id: card.id ?? `extra-${index}-${card.suit}-${card.rank}`,
    }));
    this.reset();
  }

  get remaining(): number { return this.#cards.length; }
  get remainingCards(): readonly Card[] { return [...this.#cards]; }
  get drawnCards(): readonly Card[] { return [...this.#drawn]; }
  get initialCards(): readonly Card[] { return [...this.#initial]; }
  get initialDeckSize(): number { return this.#initial.length; }
  get majors(): number { return this.#cards.filter((card) => card.rank >= 10).length; }

  reset(): void {
    this.#initial = [...buildDeck(this.#decks, this.#mods), ...this.#extraCards];
    this.#cards = [...this.#initial];
    this.#drawn = [];
    // Fisher-Yates ueber rollNumber: jede Position ist eine Ganzzahl.
    for (let index = this.#cards.length - 1; index > 0; index -= 1) {
      const swap = rollNumber(0, index, {}, this.#prng).finalNumber;
      const left = this.#cards[index]!;
      this.#cards[index] = this.#cards[swap]!;
      this.#cards[swap] = left;
    }
  }

  draw(): Card {
    if (this.#cards.length === 0) this.reset();
    const card = this.#cards.pop()!;
    this.#drawn.push(card);
    return card;
  }

  /** Lookahead: betrachtet die obersten peekDepth Karten und zieht die vorteilhaftere. */
  drawBiased(
    prng: Prng,
    biasFactor: number,
    evaluatorFn: (card: Card) => number,
    peekDepth = 2,
  ): Card {
    const factor = clampBias(biasFactor);
    if (factor === 0 || peekDepth < 2) return this.draw();
    if (this.#cards.length === 0) this.reset();
    const depth = Math.min(Math.max(2, Math.floor(peekDepth)), this.#cards.length);
    if (depth < 2) return this.draw();
    const peek = this.#cards.slice(-depth).reverse();
    let bestIndex = 0;
    let bestScore = Number.NEGATIVE_INFINITY;
    peek.forEach((card, index) => {
      const score = evaluatorFn(card);
      if (score > bestScore) { bestScore = score; bestIndex = index; }
    });
    const chance = rollNumber(0, 9_999, {}, prng).finalNumber / 10_000;
    const chosen = peek.splice(chance < factor ? bestIndex : 0, 1)[0]!;
    const chosenIndex = this.#cards.lastIndexOf(chosen);
    if (chosenIndex >= 0) this.#cards.splice(chosenIndex, 1);
    this.#drawn.push(chosen);
    return chosen;
  }

  /** Dealer-Bias: nimmt die beste Karte, die nicht ueberkauft. */
  drawWithBias(currentTotal: number, peekDepth = 2): Card {
    if (peekDepth < 2) return this.draw();
    if (this.#cards.length === 0) this.reset();
    const depth = Math.min(peekDepth, this.#cards.length);
    const peek = this.#cards.slice(-depth).reverse();
    let bestIndex = 0;
    let bestScore = Number.NEGATIVE_INFINITY;
    peek.forEach((card, index) => {
      const score = blackjackScore(currentTotal, card);
      if (score > bestScore) { bestScore = score; bestIndex = index; }
    });
    const chosen = peek[bestIndex]!;
    const chosenIndex = this.#cards.lastIndexOf(chosen);
    if (chosenIndex >= 0) this.#cards.splice(chosenIndex, 1);
    this.#drawn.push(chosen);
    return chosen;
  }

  verifyIntegrity(): boolean {
    if (this.#drawn.length + this.#cards.length !== this.#initial.length) return false;
    const expected = new Map<string, number>();
    for (const card of this.#initial) expected.set(cardKey(card), (expected.get(cardKey(card)) ?? 0) + 1);
    for (const card of [...this.#drawn, ...this.#cards]) {
      const key = cardKey(card);
      const count = expected.get(key) ?? 0;
      if (count <= 0) return false;
      expected.set(key, count - 1);
    }
    for (const count of expected.values()) if (count !== 0) return false;
    return true;
  }
}

/** Kompatibilitaetsname fuer bestehende Tische und Tests. */
export class Shoe extends CardShoe {}

export function drawWithBias(
  shoe: CardShoe,
  prng: Prng,
  biasFactor: number,
  evaluatorFn: (card: Card) => number,
  peekDepth = 2,
): Card {
  return shoe.drawBiased(prng, biasFactor, evaluatorFn, peekDepth);
}

export function verifyShoeIntegrity(shoe: CardShoe): boolean {
  return shoe.verifyIntegrity();
}
