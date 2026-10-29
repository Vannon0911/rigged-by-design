/** Poker-Fassade: nutzt den rollNumber-basierten CardShoe aus card-shoe.ts. */
export * from '../poker/poker-types';
export { playPokerRound } from '../poker/poker-engine';
export { evaluatePokerConfig } from '../poker/poker-math';
export {
  HAND_CATEGORY_NAMES,
  compareHands,
  evaluateHand,
  handCategoryOf,
} from '../poker/poker-evaluator';
