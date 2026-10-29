/** Pro Gast-Spin: symbolisches Spiel-Popup, Cash-Tick und Gewinn-Burst. */
import { Application, Container, Graphics, Text } from 'pixi.js';
import { toVCString, type VaCoinMicro } from '../core/economy/vacoin';
import type { FloorRoundEvent } from '../core/simulation/floor-events';
import { buildRoundVisual, roundHeadline } from './visitor-round-visual';

function compact(value: VaCoinMicro): string {
  return toVCString(value).replace(' VC', '');
}

function signed(value: VaCoinMicro): string {
  const text = compact(value);
  return value > 0 ? `+${text}` : text;
}

export class VisitorEffectsLayer {
  readonly container = new Container();
  readonly #app: Application;
  #destroyed = false;

  constructor(app: Application) {
    this.#app = app;
  }

  destroy(): void {
    this.#destroyed = true;
  }

  showRound(event: FloorRoundEvent, x: number, y: number): void {
    if (this.#destroyed) return;
    const top = Math.max(22, y - 54);
    const card = new Container();
    card.position.set(x, top);
    const border = event.isWin ? 0xffd166 : event.isNearMiss ? 0xff4d6d : 0x2c3a55;
    const bg = new Graphics()
      .roundRect(-58, -24, 116, 38, 7)
      .fill({ color: 0x060a12, alpha: 0.95 })
      .stroke({ width: 1, color: border, alpha: 0.95 });
    const title = new Text({
      text: this.#headline(event),
      style: {
        fontFamily: 'monospace',
        fontSize: 8,
        fontWeight: 'bold',
        letterSpacing: 0.5,
        fill: event.isWin ? 0xffd166 : event.isNearMiss ? 0xff7f95 : 0xaebbd0,
      },
    });
    title.anchor.set(0.5, 0);
    title.position.set(0, -20);

    card.addChild(bg, title, buildRoundVisual(event.visual));
    this.container.addChild(card);
    this.#floatCash(event, x, y);
    if (event.isWin) this.#burst(x, top + 10);
    this.#animateCard(card, top, event.isWin);
  }
  #headline(event: FloorRoundEvent): string {
    const game = event.visual.kind === 'SLOT' ? 'SLOT'
      : event.visual.kind === 'SHELL' ? 'HÜTCHEN'
        : event.visual.kind === 'DICE' ? 'WÜRFEL'
          : event.visual.kind === 'ROULETTE' ? 'ROULETTE' : 'KARTEN';
    return roundHeadline(game, event.isNearMiss, event.isLDW, event.isWin);
  }

  #floatCash(event: FloorRoundEvent, x: number, y: number): void {
    const positive = event.net > 0;
    const tick = new Text({
      text: signed(event.net),
      style: {
        fontFamily: 'monospace',
        fontSize: 10,
        fontWeight: 'bold',
        fill: positive ? 0xff4d6d : event.net < 0 ? 0x4ade80 : 0x8a97b0,
      },
    });
    tick.anchor.set(0.5);
    tick.position.set(x, y - 12);
    this.container.addChild(tick);
    const start = performance.now();
    const startedAt = tick.y;

    const animate = (): void => {
      if (this.#destroyed) {
        this.#app.ticker.remove(animate);
        tick.destroy();
        return;
      }
      const progress = Math.min(1, (performance.now() - start) / 900);
      tick.y = startedAt - 30 * progress;
      tick.alpha = 1 - progress;
      if (progress >= 1) {
        this.#app.ticker.remove(animate);
        tick.destroy();
      }
    };
    this.#app.ticker.add(animate);
  }

  #animateCard(card: Container, startY: number, win: boolean): void {
    const start = performance.now();
    const animate = (): void => {
      if (this.#destroyed) {
        this.#app.ticker.remove(animate);
        card.destroy({ children: true });
        return;
      }
      const progress = Math.min(1, (performance.now() - start) / 1500);
      card.y = startY - 12 * progress;
      card.alpha = 1 - progress;
      if (win) card.scale.set(1 + Math.sin(progress * Math.PI * 4) * 0.08 * (1 - progress));
      if (progress >= 1) {
        this.#app.ticker.remove(animate);
        card.destroy({ children: true });
      }
    };
    this.#app.ticker.add(animate);
  }
  #burst(x: number, y: number): void {
    const coins = Array.from({ length: 8 }, (_, index) => {
      const coin = new Graphics().circle(0, 0, 2.2).fill(0xffd166);
      coin.position.set(x, y);
      this.container.addChild(coin);
      const angle = (Math.PI * 2 * index) / 8;
      return { coin, vx: Math.cos(angle) * 24, vy: Math.sin(angle) * 20 };
    });
    const start = performance.now();

    const animate = (): void => {
      if (this.#destroyed) {
        this.#app.ticker.remove(animate);
        for (const { coin } of coins) coin.destroy();
        return;
      }
      const progress = Math.min(1, (performance.now() - start) / 700);
      for (const { coin, vx, vy } of coins) {
        coin.x = x + vx * progress;
        coin.y = y + vy * progress + 14 * progress * progress;
        coin.alpha = 1 - progress;
      }
      if (progress >= 1) {
        this.#app.ticker.remove(animate);
        for (const { coin } of coins) coin.destroy();
      }
    };
    this.#app.ticker.add(animate);
  }
}
