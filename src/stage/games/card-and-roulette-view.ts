// @loc-exception: Kombinierter PixiJS-v8-Renderer fuer rotierenden Roulette-Kessel und animierten Kartentisch.
import { Application, Container, Graphics, Text } from 'pixi.js';
import { toVCString } from '../../core/economy/vacoin';
import type { BlackjackRound } from '../../core/games/blackjack/blackjack-types';
import { colorOf, pocketLabel, type RouletteRound } from '../../core/games/roulette/roulette-types';
import type { PokerRound } from '../../core/games/poker/poker-types';
import { SUIT_SYMBOL, type Card } from '../../core/games/deck-engine';

const WIDTH = 440;
const HEIGHT = 620;
const WHEEL = { x: 220, y: 196, radius: 112 };
const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5,
  24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26, 37, 38,
];
function waitFrame(app: Application, duration: number, frame: (progress: number) => void): Promise<void> {
  return new Promise((resolve) => {
    const started = performance.now();
    const tick = (): void => {
      const progress = Math.min(1, (performance.now() - started) / duration);
      frame(progress);
      if (progress < 1) return;
      app.ticker.remove(tick);
      resolve();
    };
    app.ticker.add(tick);
  });
}

function rankText(card: Card): string {
  if (card.rank === 14) return 'A';
  if (card.rank === 13) return 'K';
  if (card.rank === 12) return 'Q';
  if (card.rank === 11) return 'J';
  return String(card.rank);
}
function createCard(card: Card, width = 44): Container {
  const box = new Container();
  const h = width * 1.4;
  const red = card.suit === 'HEARTS' || card.suit === 'DIAMONDS';
  const ink = red ? 0xd11f3d : 0x12121a;
  box.addChild(
    new Graphics().roundRect(0, 0, width, h, 4).fill(0xf5f1e6).stroke({ width: 1, color: 0x9e9a8c }),
  );
  const rank = new Text({
    text: rankText(card),
    style: { fontFamily: 'monospace', fontSize: width * 0.34, fontWeight: 'bold', fill: ink },
  });
  rank.position.set(3, 1);
  const suit = new Text({
    text: SUIT_SYMBOL[card.suit],
    style: { fontFamily: 'monospace', fontSize: width * 0.3, fill: ink },
  });
  suit.position.set(3, h - width * 0.36);
  const big = new Text({
    text: SUIT_SYMBOL[card.suit],
    style: { fontFamily: 'monospace', fontSize: width * 0.42, fill: ink, fontWeight: 'bold' },
  });
  big.anchor.set(0.5);
  big.position.set(width * 0.68, h * 0.48);
  box.addChild(rank, suit, big);
  return box;
}
export class CardAndRouletteView {
  readonly app: Application;
  readonly #wheel = new Container();
  readonly #wheelBase = new Graphics();
  readonly #ball = new Graphics();
  readonly #glow = new Graphics();
  readonly #cards = new Container();
  readonly #status: Text;
  readonly #result: Text;
  readonly #angles = new Map<number, number>();
  #destroyed = false;

  private constructor(app: Application) {
    this.app = app;
    this.#drawTable();
    this.#status = new Text({
      text: 'SETZE DEINEN EINSATZ',
      style: { fontFamily: 'monospace', fontSize: 12, fill: 0xffd166, letterSpacing: 1.5 },
    });
    this.#status.anchor.set(0.5);
    this.#status.position.set(WIDTH / 2, 334);
    this.#result = new Text({
      text: '',
      style: { fontFamily: 'monospace', fontSize: 16, fill: 0xe8edf7, fontWeight: 'bold' },
    });
    this.#result.anchor.set(0.5);
    this.#result.position.set(WIDTH / 2, 594);
    app.stage.addChild(this.#wheel, this.#ball, this.#cards, this.#status, this.#result);
    this.#buildWheel();
  }

  static async create(host: HTMLElement): Promise<CardAndRouletteView> {
    const app = new Application();
    await app.init({
      background: '#05070d',
      width: WIDTH,
      height: HEIGHT,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
    });
    host.appendChild(app.canvas);
    const view = new CardAndRouletteView(app);
    view.showIdle();
    return view;
  }

  showIdle(): void {
    this.#wheel.visible = true;
    this.#cards.visible = false;
    this.#status.text = 'ROULETTE · BLACKJACK · POKER';
    this.#result.text = 'Wähle ein Spiel und drücke den Knopf.';
  }

  async showRoulette(round: RouletteRound): Promise<void> {
    this.#cards.visible = false;
    this.#wheel.visible = true;
    this.#glow.clear();
    this.#status.text = 'KUGEL LÄUFT...';
    this.#result.text = '';
    const local = this.#angles.get(round.pocket) ?? 0;
    const target = Math.PI * 4 + (Math.PI * 1.5 - local);
    this.#wheel.rotation = 0;
    this.#ball.visible = true;
    await waitFrame(this.app, 1150, (progress) => {
      if (this.#destroyed) return;
      const eased = 1 - Math.pow(1 - progress, 3);
      this.#wheel.rotation = target * eased;
      const orbit = -Math.PI / 2 + (1 - eased) * Math.PI * 6;
      this.#ball.position.set(WHEEL.x + Math.cos(orbit) * 84, WHEEL.y + Math.sin(orbit) * 84);
    });
    this.#ball.position.set(WHEEL.x, WHEEL.y - 84);
    this.#wheel.rotation = target;
    const span = (Math.PI * 2) / WHEEL_ORDER.length;
    this.#glow.clear().moveTo(0, 0).arc(0, 0, WHEEL.radius, local - span / 2, local + span / 2).lineTo(0, 0)
      .fill({ color: 0xffd166, alpha: 0.5 });
    const lightning = round.lightningMultiplierBps ? ` · BLITZ ${round.lightningMultiplierBps / 10_000}x` : '';
    this.#status.text = `${round.pocketLabel} ${round.color}${lightning}`;
    this.#result.text = round.win ? `GEWINN +${toVCString(round.payout)}` : `EINSATZ WEG · ${toVCString(round.totalBet)}`;
    this.#result.style.fill = round.win ? 0xffd166 : 0xff7f95;
  }

  async showBlackjack(round: BlackjackRound): Promise<void> {
    this.#wheel.visible = false;
    this.#ball.visible = false;
    this.#cards.visible = true;
    this.#clearCards();
    this.#status.text = round.outcome.replaceAll('_', ' ');
    this.#result.text = round.payout > 0
      ? `${toVCString(round.payout)} zurück${round.bonusPayout > 0 ? ` + Bonus ${toVCString(round.bonusPayout)}` : ''}`
      : `EINSATZ WEG · ${toVCString(round.totalBet)}`;
    this.#result.style.fill = round.payout > round.totalBet ? 0xffd166 : 0xaebbd0;
    this.#addRow('DEALER', round.dealerCards, `${round.dealerTotal}`, 364);
    this.#addRow('DU', round.playerCards, `${round.playerTotal}`, 462);
    await this.#flipIn();
  }

  async showPoker(round: PokerRound): Promise<void> {
    this.#wheel.visible = false;
    this.#ball.visible = false;
    this.#cards.visible = true;
    this.#clearCards();
    this.#status.text = round.outcome === 'PLAYER_WIN' ? 'DEINE HAND GEWINNT' : round.outcome.replaceAll('_', ' ');
    this.#result.text = round.payout > 0 ? `${toVCString(round.payout)} zurück` : `POT WEG · ${toVCString(round.totalBet)}`;
    this.#result.style.fill = round.payout > round.totalBet ? 0xffd166 : 0xaebbd0;
    this.#addRow(`DEALER · ${round.dealerRank.categoryName}`, round.dealerCards, '', 352);
    this.#addRow(`DU · ${round.playerRank.categoryName}`, round.playerCards, '', 452);
    await this.#flipIn();
  }

  destroy(): void {
    this.#destroyed = true;
    this.app.destroy(true, { children: true });
  }

  #drawTable(): void {
    const g = new Graphics();
    g.rect(0, 0, WIDTH, HEIGHT).fill(0x05070d);
    g.roundRect(12, 12, WIDTH - 24, 330, 16).fill(0x0a2418).stroke({ width: 2, color: 0x1e5c3a });
    g.roundRect(12, 344, WIDTH - 24, 248, 16).fill(0x0a2418).stroke({ width: 2, color: 0x1e5c3a });
    for (let x = 26; x < WIDTH - 20; x += 26) g.rect(x, 344, 1, 248).fill({ color: 0x123722, alpha: 0.6 });
    g.roundRect(118, 366, 204, 44, 8).fill(0x06150e).stroke({ width: 1, color: 0x2c7a4e, alpha: 0.8 });
    this.app.stage.addChild(g);
  }

  #buildWheel(): void {
    this.#wheel.position.set(WHEEL.x, WHEEL.y);
    this.#wheel.addChild(new Graphics().circle(0, 0, WHEEL.radius + 12).fill(0x120d08).stroke({ width: 4, color: 0xd4af37 }));
    this.#wheel.addChild(this.#wheelBase, this.#glow);
    const angle = (Math.PI * 2) / WHEEL_ORDER.length;
    WHEEL_ORDER.forEach((pocket, index) => {
      const start = -Math.PI / 2 + index * angle;
      this.#angles.set(pocket, start + angle / 2);
      this.#wheelBase
        .moveTo(0, 0)
        .arc(0, 0, WHEEL.radius, start, start + angle)
        .lineTo(0, 0)
        .fill(colorOf(pocket) === 'RED' ? 0xa4162f : colorOf(pocket) === 'GREEN' ? 0x187a45 : 0x111118)
        .stroke({ width: 0.6, color: 0xd4af37, alpha: 0.35 });
      const label = new Text({
        text: pocketLabel(pocket),
        style: { fontFamily: 'monospace', fontSize: 7, fill: 0xf3efe3, fontWeight: 'bold' },
      });
      label.anchor.set(0.5);
      label.position.set(Math.cos(start + angle / 2) * 96, Math.sin(start + angle / 2) * 96);
      this.#wheelBase.addChild(label);
    });
    this.#wheel.addChild(new Graphics().circle(0, 0, 54).fill(0x1a140c).stroke({ width: 2, color: 0xd4af37 }));
    this.#wheel.addChild(new Graphics().circle(0, 0, 40).fill(0x2a1d10));
    this.#ball.circle(0, 0, 6).fill(0xf7f2e4).stroke({ width: 1, color: 0x8a8068 });
    this.#ball.position.set(WHEEL.x, WHEEL.y - 84);
  }

  #addRow(label: string, cards: readonly Card[], total: string, y: number): void {
    const title = new Text({
      text: `${label}${total ? ` · ${total}` : ''}`,
      style: { fontFamily: 'monospace', fontSize: 10, fill: 0xffd166, letterSpacing: 1.4 },
    });
    title.position.set(26, y);
    this.#cards.addChild(title);
    const width = cards.length > 5 ? 36 : 44;
    const gap = width + 5;
    const start = 26;
    cards.forEach((card, index) => {
      const box = createCard(card, width);
      box.position.set(start + index * gap, y + 16);
      box.alpha = 0;
      this.#cards.addChild(box);
    });
  }

  async #flipIn(): Promise<void> {
    const boxes = this.#cards.children.filter((child) => child instanceof Container && child.children.length > 0);
    await waitFrame(this.app, 520, (progress) => {
      boxes.forEach((box, index) => {
        const local = Math.max(0, Math.min(1, progress * 1.8 - index * 0.08));
        box.alpha = local;
        box.scale.x = 0.15 + 0.85 * local;
      });
    });
  }

  #clearCards(): void {
    for (const child of this.#cards.removeChildren()) child.destroy({ children: true });
  }
}
