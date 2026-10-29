// @loc-exception: Komplexe Walzen-Animation, Near-Miss-Spannung und Gewinn-Laser in einer Pixi-v8-View.
/** Spielautomat im Sleazy-Neon-Gutter-Stil. Reines Rendering, die Spiellogik bleibt im Core. */
import { Application, Container, Graphics, Text } from 'pixi.js';
import { toVCString } from '../core/economy/vacoin';
import { PAYLINES, SLOT_SYMBOLS, type SlotSymbol, type SpinResult } from '../core/slot/slot-types';
import { SlotPayoutFx } from './slot-payout-fx';
import { createSymbolTile } from './symbol-graphics';

const WIDTH = 420;
const HEIGHT = 600;
const REEL = 64;
const WINDOW_X = 78;
const WINDOW_Y = 152;
const WINDOW_W = 192;
const WINDOW_H = 192;

export type SlotMode = 'CPU' | 'OWN';

export interface SlotMachineViewOptions {
  readonly mode?: SlotMode;
  readonly onSpinRequest?: () => void;
}

interface Reel {
  readonly container: Container;
  readonly content: Container;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomSymbol(): SlotSymbol {
  return SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)]!;
}

function isPremium(symbol: SlotSymbol): boolean {
  return symbol === 'VACOIN_DIAMOND' || symbol === 'SEVEN';
}

export class SlotMachineView {
  readonly app: Application;
  readonly #cabinet = new Container();
  readonly #frame = new Graphics();
  readonly #window = new Container();
  readonly #windowMask = new Graphics();
  readonly #winLayer = new Graphics();
  readonly #streaks = new Graphics();
  readonly #lamp = new Graphics();
  readonly #reels: Reel[] = [];
  readonly #marquee: Text;
  readonly #modeLabel: Text;
  readonly #status: Text;
  readonly #spinButton: Container;
  readonly #fx: SlotPayoutFx;
  readonly #onSpinRequest?: () => void;
  #mode: SlotMode;
  #accent: number;
  #spinning = false;
  #warning = false;
  #destroyed = false;

  private constructor(app: Application, options: SlotMachineViewOptions) {
    this.app = app;
    this.#mode = options.mode ?? 'OWN';
    this.#accent = this.#mode === 'CPU' ? 0x00ffcc : 0xff2e88;
    this.#onSpinRequest = options.onSpinRequest;

    app.stage.addChild(this.#cabinet);
    this.#drawCabinet();

    this.#marquee = new Text({
      text: 'SLEAZY NEON',
      style: { fontFamily: 'monospace', fontSize: 20, fill: this.#accent, fontWeight: 'bold', letterSpacing: 5 },
    });
    this.#marquee.anchor.set(0.5);
    this.#marquee.position.set(WIDTH / 2, 72);
    this.#modeLabel = new Text({
      text: this.#mode === 'CPU' ? 'CPU CASINO' : 'EIGENER SLOT',
      style: { fontFamily: 'monospace', fontSize: 11, fill: 0x9aa7c7, letterSpacing: 3 },
    });
    this.#modeLabel.anchor.set(0.5);
    this.#modeLabel.position.set(WIDTH / 2, 118);
    this.#cabinet.addChild(this.#marquee, this.#modeLabel);

    this.#buildReels();

    this.#status = new Text({
      text: 'BEREIT',
      style: { fontFamily: 'monospace', fontSize: 13, fill: 0xffd166, letterSpacing: 2 },
    });
    this.#status.anchor.set(0.5);
    this.#status.position.set(WIDTH / 2, 424);
    this.#cabinet.addChild(this.#status);

    this.#spinButton = this.#createButton();
    this.#cabinet.addChild(this.#spinButton);
    this.#cabinet.addChild(this.#lamp);
    this.#drawLamp();
    this.#fx = new SlotPayoutFx(app, this.#cabinet, WINDOW_X + WINDOW_W / 2, WINDOW_Y + WINDOW_H / 2);

    app.ticker.add(() => {
      if (this.#destroyed) return;
      this.#lamp.alpha = this.#warning ? 0.45 + 0.55 * Math.abs(Math.sin(performance.now() / 90)) : 0.3;
    });
  }

  static async create(host: HTMLElement, options: SlotMachineViewOptions = {}): Promise<SlotMachineView> {
    const app = new Application();
    await app.init({
      background: '#05050a',
      width: WIDTH,
      height: HEIGHT,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
    });
    host.appendChild(app.canvas);
    return new SlotMachineView(app, options);
  }

  setMode(mode: SlotMode): void {
    this.#mode = mode;
    this.#accent = mode === 'CPU' ? 0x00ffcc : 0xff2e88;
    this.#marquee.style.fill = this.#accent;
    this.#modeLabel.text = mode === 'CPU' ? 'CPU CASINO' : 'EIGENER SLOT';
    this.#drawCabinet();
  }

  async spin(result: SpinResult): Promise<void> {
    if (this.#spinning || this.#destroyed) return;
    this.#spinning = true;
    this.#warning = this.#isTension(result);
    this.#winLayer.clear();
    this.#status.text = 'ROLLING...';
    this.#setButtonEnabled(false);
    this.#streaks.visible = true;

    if (this.#warning) setTimeout(() => this.#fx.shake(this.#cabinet), 700);
    const animations = [0, 1, 2].map((index) => this.#runReel(index, result, this.#warning ? 400 : 0));
    await Promise.all(animations);

    this.#streaks.visible = false;
    this.#drawWinLines(result);
    if (result.totalPayout > 0) {
      this.#status.text = `WIN ${toVCString(result.totalPayout)}`;
      this.#fx.play(result.totalPayout);
    } else {
      this.#status.text = this.#warning ? 'SO CLOSE...' : 'KEIN GEWINN';
    }

    this.#spinning = false;
    this.#setButtonEnabled(true);
    if (this.#warning) setTimeout(() => { this.#warning = false; }, 1200);
  }

  destroy(): void {
    this.#destroyed = true;
    this.#fx.destroy();
    this.app.destroy(true, { children: true });
  }

  #drawCabinet(): void {
    const f = this.#frame;
    f.clear();
    f.roundRect(10, 10, 400, 580, 26).fill(0x090910).stroke({ width: 6, color: this.#accent, alpha: 0.85 });
    f.roundRect(20, 20, 380, 560, 20).stroke({ width: 1, color: 0x2a2a3d, alpha: 0.9 });
    f.roundRect(WINDOW_X - 12, WINDOW_Y - 12, WINDOW_W + 24, WINDOW_H + 24, 16)
      .fill(0x04040a)
      .stroke({ width: 2, color: this.#accent, alpha: 0.55 });
    f.roundRect(56, 46, 308, 54, 10).fill(0x120d18).stroke({ width: 2, color: this.#accent, alpha: 0.5 });
    f.rect(36, WINDOW_Y, 3, WINDOW_H).fill({ color: this.#accent, alpha: 0.35 });
    f.rect(WINDOW_X + WINDOW_W + 41, WINDOW_Y, 3, WINDOW_H).fill({ color: this.#accent, alpha: 0.35 });
    for (let y = 52; y < 560; y += 36) {
      f.circle(30, y, 2.5).fill(0x3a3545);
      f.circle(390, y, 2.5).fill(0x3a3545);
    }
    for (let index = 0; index < 5; index += 1) {
      f.rect(42, 366 + index * 10, 16, 4).fill(0x1d1a28);
    }
  }

  #buildReels(): void {
    this.#windowMask.rect(WINDOW_X, WINDOW_Y, WINDOW_W, WINDOW_H).fill(0xffffff);
    this.#cabinet.addChild(this.#windowMask);
    this.#window.mask = this.#windowMask;
    this.#cabinet.addChild(this.#window);

    const showcase: SlotSymbol[][] = [
      ['VACOIN_DIAMOND', 'SEVEN', 'CHERRY'],
      ['SEVEN', 'BELL', 'CHERRY'],
      ['BELL', 'CHERRY', 'BLANK'],
    ];
    for (let index = 0; index < 3; index += 1) {
      const container = new Container();
      container.position.set(WINDOW_X + index * REEL, WINDOW_Y);
      const content = new Container();
      container.addChild(content);
      this.#window.addChild(container);
      const reel: Reel = { container, content };
      this.#reels.push(reel);
      this.#fillReel(reel, showcase[index]!);
    }

    for (let x = WINDOW_X; x < WINDOW_X + WINDOW_W; x += 16) {
      this.#streaks.rect(x, WINDOW_Y, 2, WINDOW_H).fill({ color: 0xffffff, alpha: 0.05 });
    }
    this.#streaks.visible = false;
    this.#window.addChild(this.#streaks, this.#winLayer);
  }

  #fillReel(reel: Reel, symbols: readonly SlotSymbol[]): void {
    for (const child of reel.content.removeChildren()) child.destroy({ children: true });
    symbols.forEach((symbol, index) => {
      const tile = createSymbolTile(symbol);
      tile.y = index * REEL;
      reel.content.addChild(tile);
    });
  }

  #animateReel(index: number, column: readonly SlotSymbol[], duration: number): Promise<void> {
    return new Promise((resolve) => {
      const reel = this.#reels[index]!;
      this.#fillReel(reel, [...column, ...Array.from({ length: 6 }, () => randomSymbol())]);
      const startY = -6 * REEL;
      reel.content.y = startY;
      reel.content.scale.y = 1.2;
      const started = performance.now();

      const tick = (): void => {
        if (this.#destroyed) {
          this.app.ticker.remove(tick);
          resolve();
          return;
        }
        const progress = Math.min(1, (performance.now() - started) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        reel.content.y = startY * (1 - eased);
        reel.content.scale.y = 1 + 0.2 * (1 - eased);
        if (progress < 1) return;
        this.app.ticker.remove(tick);
        reel.content.y = 0;
        reel.content.scale.y = 1;
        this.#bounce(reel.content, resolve);
      };
      this.app.ticker.add(tick);
    });
  }

  #bounce(content: Container, done: () => void): void {
    const started = performance.now();
    const tick = (): void => {
      if (this.#destroyed) {
        this.app.ticker.remove(tick);
        done();
        return;
      }
      const progress = Math.min(1, (performance.now() - started) / 180);
      content.y = Math.sin(progress * Math.PI * 2) * 6 * (1 - progress);
      content.scale.y = 1 + Math.sin(progress * Math.PI) * 0.06;
      if (progress < 1) return;
      this.app.ticker.remove(tick);
      content.y = 0;
      content.scale.y = 1;
      done();
    };
    this.app.ticker.add(tick);
  }

  async #runReel(index: number, result: SpinResult, extraMs: number): Promise<void> {
    if (index > 0) await wait(index === 1 ? 200 : 250);
    const duration = 600 + (index === 2 ? extraMs : 0);
    await this.#animateReel(index, result.grid[index]!, duration);
  }

  #isTension(result: SpinResult): boolean {
    const first = result.grid[0]?.[0] ?? 'BLANK';
    const second = result.grid[1]?.[0] ?? 'BLANK';
    return result.isNearMiss || (isPremium(first) && first === second);
  }

  #drawWinLines(result: SpinResult): void {
    this.#winLayer.clear();
    for (const win of result.lineWins) {
      const rows = PAYLINES[win.payline];
      const xs = [0, 1, 2].map((reel) => WINDOW_X + reel * REEL + REEL / 2);
      const ys = [0, 1, 2].map((reel) => WINDOW_Y + rows[reel]! * REEL + REEL / 2);
      const trace = (g: Graphics): Graphics => g.moveTo(xs[0]!, ys[0]!).lineTo(xs[1]!, ys[1]!).lineTo(xs[2]!, ys[2]!);
      trace(this.#winLayer).stroke({ width: 14, color: 0xffcc00, alpha: 0.12 });
      trace(this.#winLayer).stroke({ width: 4, color: 0xfff2a8, alpha: 0.95 });
    }
  }

  #createButton(): Container {
    const button = new Container();
    const bg = new Graphics().roundRect(0, 0, 164, 54, 14).fill(0x1a0e18).stroke({ width: 2, color: this.#accent, alpha: 0.9 });
    const label = new Text({
      text: 'SPIN',
      style: { fontFamily: 'monospace', fontSize: 22, fill: 0xfff2f8, fontWeight: 'bold', letterSpacing: 6 },
    });
    label.anchor.set(0.5);
    label.position.set(82, 27);
    button.addChild(bg, label);
    button.position.set(128, 472);
    button.eventMode = 'static';
    button.cursor = 'pointer';
    button.on('pointertap', () => {
      if (!this.#spinning) this.#onSpinRequest?.();
    });
    return button;
  }

  #drawLamp(): void {
    this.#lamp.clear();
    this.#lamp.circle(352, 140, 12).fill(0x2a0a0a);
    this.#lamp.circle(352, 140, 6).fill(0xff3030);
    this.#lamp.circle(352, 140, 12).stroke({ width: 2, color: 0xff3030, alpha: 0.7 });
  }

  #setButtonEnabled(enabled: boolean): void {
    this.#spinButton.alpha = enabled ? 1 : 0.5;
    this.#spinButton.eventMode = enabled ? 'static' : 'none';
  }
}
