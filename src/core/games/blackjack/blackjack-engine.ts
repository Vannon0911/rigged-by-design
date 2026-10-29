/** Blackjack-Tisch: Deal, Hit, Stand, Double und Dealer-Bias mit peekDepth 2. */
import { mulVC, ZERO_VC, type VaCoinMicro } from '../../economy/vacoin';
import type { Prng } from '../../rng/prng';
import { Shoe, type Card } from '../deck-engine';
import { makeHand, threeCardBonusBps } from './blackjack-rules';
import type {
  BlackjackConfig,
  BlackjackOutcome,
  BlackjackState,
} from './blackjack-types';

const EVEN_MONEY_BPS = 20_000;

function assertBet(value: VaCoinMicro, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${label} muss eine positive Ganzzahl sein`);
}

export class BlackjackTable {
  readonly #config: BlackjackConfig;
  readonly #shoe: Shoe;
  #state: BlackjackState | null = null;

  constructor(config: BlackjackConfig, prng: Prng) {
    if (!Number.isInteger(config.decks) || config.decks < 1 || config.decks > 6) {
      throw new Error(`BlackjackConfig ${config.id}: 1 bis 6 Decks erlaubt`);
    }
    if (!Number.isSafeInteger(config.blackjackPayoutBps) || config.blackjackPayoutBps <= 0) {
      throw new Error(`BlackjackConfig ${config.id}: blackjackPayoutBps ungueltig`);
    }
    this.#config = config;
    this.#shoe = new Shoe(prng, config.decks, config.deckMods);
  }

  get config(): BlackjackConfig {
    return this.#config;
  }

  get state(): BlackjackState | null {
    return this.#state;
  }

  deal(bet: VaCoinMicro, bonusBet: VaCoinMicro = ZERO_VC): BlackjackState {
    assertBet(bet, 'BlackjackTable.deal: bet');
    if (bonusBet < 0 || !Number.isSafeInteger(bonusBet)) throw new Error('BlackjackTable.deal: bonusBet ungueltig');
    if (this.#shoe.remaining < 20) this.#shoe.reset();

    const player = [this.#draw(), this.#draw()];
    const dealer = [this.#draw(), this.#draw()];
    const base: BlackjackState = {
      phase: 'PLAYER',
      player: makeHand(player),
      dealer: makeHand(dealer),
      dealerHoleHidden: true,
      bet,
      totalBet: bet,
      bonusBet,
      bonusPayout: ZERO_VC,
      payout: ZERO_VC,
      outcome: null,
      dealerPush22Applied: false,
      dealerBiasUsed: false,
      canHit: true,
      canStand: true,
      canDouble: true,
      hits: 0,
    };

    if (base.player.blackjack && base.dealer.blackjack) return this.#finish(base, 'PUSH');
    if (base.player.blackjack) return this.#finish(base, 'PLAYER_BLACKJACK');
    if (base.dealer.blackjack) return this.#finish(base, 'DEALER_WIN');
    this.#state = base;
    return base;
  }

  hit(): BlackjackState {
    const state = this.#requirePlayerTurn('hit');
    const cards = [...state.player.cards, this.#draw()];
    const player = makeHand(cards);
    if (player.bust) {
      return this.#finish({ ...state, player, hits: state.hits + 1, canHit: false, canStand: false, canDouble: false }, 'PLAYER_BUST');
    }
    if (player.total === 21) return this.#standWith({ ...state, player, hits: state.hits + 1 });
    this.#state = { ...state, player, hits: state.hits + 1, canDouble: false };
    return this.#state;
  }

  stand(): BlackjackState {
    return this.#standWith(this.#requirePlayerTurn('stand'));
  }

  double(): BlackjackState {
    const state = this.#requirePlayerTurn('double');
    if (!state.canDouble) throw new Error('BlackjackTable.double: Double ist nicht mehr erlaubt');
    const doubled: BlackjackState = {
      ...state,
      totalBet: mulVC(state.bet, EVEN_MONEY_BPS),
      canHit: false,
      canStand: false,
      canDouble: false,
      hits: state.hits + 1,
    };
    const player = makeHand([...state.player.cards, this.#draw()]);
    if (player.bust) return this.#finish({ ...doubled, player }, 'PLAYER_BUST');
    return this.#dealerPlay({ ...doubled, player });
  }

  #requirePlayerTurn(action: string): BlackjackState {
    if (!this.#state || this.#state.phase !== 'PLAYER') {
      throw new Error(`BlackjackTable.${action}: keine laufende Spielerhand`);
    }
    return this.#state;
  }

  #standWith(state: BlackjackState): BlackjackState {
    if (state.player.bust) return this.#finish(state, 'PLAYER_BUST');
    return this.#dealerPlay({ ...state, canHit: false, canStand: false, canDouble: false });
  }

  #dealerPlay(state: BlackjackState): BlackjackState {
    const cards: Card[] = [...state.dealer.cards];
    let biasUsed = false;
    while (true) {
      const total = makeHand(cards).total;
      if (total >= 17) break;
      const useBias = this.#config.dealerBias && total >= 12 && total <= 16;
      cards.push(useBias ? this.#shoe.drawWithBias(total, this.#config.dealerBiasPeekDepth) : this.#draw());
      if (useBias) biasUsed = true;
    }
    const dealer = makeHand(cards);
    const playerTotal = state.player.total;
    let outcome: BlackjackOutcome;
    if (dealer.bust) outcome = 'DEALER_BUST';
    else if (playerTotal > dealer.total) outcome = 'PLAYER_WIN';
    else if (playerTotal === dealer.total) outcome = 'PUSH';
    else outcome = 'DEALER_WIN';
    return this.#finish({ ...state, dealer, dealerBiasUsed: biasUsed }, outcome);
  }

  #finish(state: BlackjackState, outcome: BlackjackOutcome): BlackjackState {
    const dealerTotal = state.dealer.total;
    const push22 = this.#config.dealerPush22 && dealerTotal === 22 && outcome !== 'PLAYER_BUST';
    const finalOutcome: BlackjackOutcome = push22 ? 'PUSH_22' : outcome;
    let payout = ZERO_VC;
    if (finalOutcome === 'PLAYER_BLACKJACK') payout = mulVC(state.bet, this.#config.blackjackPayoutBps);
    else if (finalOutcome === 'PLAYER_WIN' || finalOutcome === 'DEALER_BUST') {
      payout = mulVC(state.totalBet, EVEN_MONEY_BPS);
    } else if (finalOutcome === 'PUSH' || finalOutcome === 'PUSH_22') {
      payout = state.totalBet;
    }
    const bonusPayout = this.#config.threeCardBonus
      ? mulVC(state.bonusBet, threeCardBonusBps(state.player.cards))
      : ZERO_VC;
    const settled: BlackjackState = {
      ...state,
      phase: 'SETTLED',
      dealerHoleHidden: false,
      canHit: false,
      canStand: false,
      canDouble: false,
      outcome: finalOutcome,
      payout,
      bonusPayout,
      dealerPush22Applied: push22,
    };
    this.#state = settled;
    return settled;
  }

  #draw(): Card {
    return this.#shoe.draw();
  }
}
