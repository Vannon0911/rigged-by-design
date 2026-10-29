// @loc-exception: Grosse Pixi-v8-Slot-Buehne mit 3-6 dynamischen Walzen, Stagger-Stop und Gewinnlasern.
/** Grosse Slot-Buehne mit 3 bis 6 sichtbaren Walzen, Stagger-Stop und Gewinnlasern. */
import { Application, Container, Graphics, Text } from 'pixi.js';
import { toVCString } from '../core/economy/vacoin';
import { resolveReels } from '../core/slot/slot-engine';
import { DEFAULT_SLOT_CONFIG, SLOT_SYMBOLS, type SlotConfig, type SlotSymbol, type SpinResult } from '../core/slot/slot-types';
import { SlotPayoutFx } from './slot-payout-fx';
import { createSymbolTile } from './symbol-graphics';

const WIDTH = 760;
const HEIGHT = 620;
const TOP = 150;
const TILE = 68;
const VISIBLE = 3;

interface Reel {
  readonly container: Container;
  readonly content: Container;
}

function randomSymbol(): SlotSymbol {
  return SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)]!;
}

function reelSymbols(reel: import('../core/slot/slot-types').ReelStrip): readonly SlotSymbol[] {
  return Array.isArray(reel) ? (reel as readonly SlotSymbol[]) : (reel as { symbols: readonly SlotSymbol[] }).symbols;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class SlotStageView {
  readonly app: Application;
  readonly #cabinet = new Container();
  readonly #frame = new Graphics();
  readonly #window = new Container();
  readonly #mask = new Graphics();
  readonly #win = new Graphics();
  readonly #streaks = new Graphics();
  readonly #title = new Text({
    text: 'SLEAZY NEON',
    style: { fontFamily: 'monospace', fontSize: 24, fill: 0xff2e88, fontWeight: 'bold', letterSpacing: 7 },
  });
  readonly #subtitle = new Text({
    text: 'EIGENER AUTOMAT · 3 ROLLEN',
    style: { fontFamily: 'monospace', fontSize: 10, fill: 0x9aa7c7, letterSpacing: 3 },
  });
  readonly #status = new Text({
    text: 'BEREIT',
    style: { fontFamily: 'monospace', fontSize: 14, fill: 0xffd166, letterSpacing: 2 },
  });
  readonly #spin = new Container();
  readonly #fx: SlotPayoutFx;
  readonly #onSpin: () => void;
  readonly #reels: Reel[] = [];
  #reelCount = 3;
  #windowX = (WIDTH - 3 * TILE) / 2;
  #accent = 0xff2e88;
  #spinning = false;
  #destroyed = false;

  private constructor(app: Application, onSpin: () => void) {
    this.app = app;
    this.#onSpin = onSpin;
    app.stage.addChild(this.#cabinet);
    this.#title.anchor.set(0.5);
    this.#title.position.set(WIDTH / 2, 38);
    this.#subtitle.anchor.set(0.5);
    this.#subtitle.position.set(WIDTH / 2, 76);
    this.#cabinet.addChild(this.#frame, this.#mask, this.#window, this.#streaks, this.#win, this.#title, this.#subtitle);
    this.#window.mask = this.#mask;
    this.#status.anchor.set(0.5);
    this.#status.position.set(WIDTH / 2, 394);
    this.#cabinet.addChild(this.#status);
    this.#buildSpinButton();
    this.#fx = new SlotPayoutFx(app, this.#cabinet, WIDTH / 2, TOP + (VISIBLE * TILE) / 2);
    this.setConfig(DEFAULT_SLOT_CONFIG);
  }

  static async create(host: HTMLElement, onSpin: () => void): Promise<SlotStageView> {
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
    return new SlotStageView(app, onSpin);
  }

  setConfig(config: SlotConfig): void {
    const reels = resolveReels(config);
    this.#accent = config.id.startsWith('cpu-') ? 0x00ffcc : 0xff2e88;
    this.#title.style.fill = this.#accent;
    const lines = typeof config.paylines === 'number' ? config.paylines : config.paylines.length;
    this.#subtitle.text = `${config.id.startsWith('cpu-') ? 'CPU-CASINO' : 'EIGENER AUTOMAT'} · ${reels.length} ROLLEN · ${lines} LINIEN`;
    this.#build(reels.map((reel) => reelSymbols(reel).slice(0, 3)));
  }

  async spin(result: SpinResult): Promise<void> {
    if (this.#spinning || this.#destroyed) return;
    if (result.grid.length !== this.#reelCount) this.#build(result.grid.map((column) => column.slice(0, 3)));
    this.#spinning = true;
    this.#win.clear();
    this.#status.text = 'ROLLING...';
    this.#spin.alpha = 0.45;
    this.#streaks.visible = true;
    await Promise.all(result.grid.map((column, index) => wait(index * 170).then(() => this.#animateReel(index, column, 560))));
    this.#streaks.visible = false;
    this.#drawWin(result);
    if (result.totalPayout > 0) {
      this.#status.text = `GEWINN +${toVCString(result.totalPayout)}`;
      this.#fx.play(result.totalPayout);
    } else {
      this.#status.text = result.isNearMiss ? 'SO CLOSE...' : 'KEIN GEWINN';
    }
    this.#spinning = false;
    this.#spin.alpha = 1;
  }

  destroy(): void {
    this.#destroyed = true;
    this.#fx.destroy();
    this.app.destroy(true, { children: true });
  }

  #build(strips: readonly (readonly SlotSymbol[])[]): void {
    this.#reelCount = Math.max(3, Math.min(6, strips.length));
    this.#windowX = (WIDTH - this.#reelCount * TILE) / 2;
    this.#drawFrame();
    this.#mask.clear().rect(this.#windowX, TOP, this.#reelCount * TILE, VISIBLE * TILE).fill(0xffffff);
    this.#window.removeChildren().forEach((child) => child.destroy({ children: true }));
    this.#reels.length = 0;
    for (let index = 0; index < this.#reelCount; index += 1) {
      const container = new Container();
      container.position.set(this.#windowX + index * TILE, TOP);
      const content = new Container();
      container.addChild(content);
      this.#window.addChild(container);
      const reel = { container, content };
      this.#reels.push(reel);
      const strip = strips[index] ?? ['BLANK'];
      this.#fillReel(reel, strip.length > 0 ? [...strip, ...Array.from({ length: 8 }, randomSymbol)] : ['BLANK']);
    }
    this.#streaks.clear();
    for (let x = this.#windowX; x < this.#windowX + this.#reelCount * TILE; x += 17) {
      this.#streaks.rect(x, TOP, 2, VISIBLE * TILE).fill({ color: 0xffffff, alpha: 0.06 });
    }
    this.#streaks.visible = false;
  }

  #drawFrame(): void {
    const f = this.#frame;
    const width = this.#reelCount * TILE;
    f.clear();
    f.roundRect(14, 14, WIDTH - 28, HEIGHT - 28, 28).fill(0x090910).stroke({ width: 5, color: this.#accent, alpha: 0.8 });
    f.roundRect(28, 28, WIDTH - 56, HEIGHT - 56, 20).stroke({ width: 1, color: 0x2a2a3d });
    f.roundRect(this.#windowX - 14, TOP - 14, width + 28, VISIBLE * TILE + 28, 14).fill(0x030308)
      .stroke({ width: 2, color: this.#accent, alpha: 0.55 });
    f.roundRect(52, 18, WIDTH - 104, 58, 10).fill(0x120d18).stroke({ width: 2, color: this.#accent, alpha: 0.45 });
    for (let y = 46; y < HEIGHT - 40; y += 38) {
      f.circle(42, y, 2.5).fill({ color: this.#accent, alpha: 0.35 });
      f.circle(WIDTH - 42, y, 2.5).fill({ color: this.#accent, alpha: 0.35 });
    }
    f.rect(WIDTH / 2 - 110, 432, 220, 2).fill({ color: this.#accent, alpha: 0.25 });
  }

  #buildSpinButton(): void {
    const bg = new Graphics().roundRect(0, 0, 190, 56, 14).fill(0x1a0e18).stroke({ width: 2, color: 0xff2e88, alpha: 0.9 });
    const label = new Text({
      text: 'SPIN',
      style: { fontFamily: 'monospace', fontSize: 23, fill: 0xfff2f8, fontWeight: 'bold', letterSpacing: 7 },
    });
    label.anchor.set(0.5);
    label.position.set(95, 28);
    this.#spin.addChild(bg, label);
    this.#spin.position.set(WIDTH / 2 - 95, 448);
    this.#spin.eventMode = 'static';
    this.#spin.cursor = 'pointer';
    this.#spin.on('pointertap', () => { if (!this.#spinning) this.#onSpin(); });
    this.#cabinet.addChild(this.#spin);
  }

  #fillReel(reel: Reel, symbols: readonly SlotSymbol[]): void {
    for (const child of reel.content.removeChildren()) child.destroy({ children: true });
    symbols.forEach((symbol, index) => {
      const tile = createSymbolTile(symbol, TILE);
      tile.y = index * TILE;
      reel.content.addChild(tile);
    });
  }

  #animateReel(index: number, column: readonly SlotSymbol[], duration: number): Promise<void> {
    return new Promise((resolve) => {
      const reel = this.#reels[index];
      if (!reel) { resolve(); return; }
      this.#fillReel(reel, [...column, ...Array.from({ length: 8 }, randomSymbol)]);
      const start = -6 * TILE;
      reel.content.y = start;
      reel.content.scale.y = 1.18;
      const started = performance.now();
      const tick = (): void => {
        if (this.#destroyed) { this.app.ticker.remove(tick); resolve(); return; }
        const progress = Math.min(1, (performance.now() - started) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        reel.content.y = start * (1 - eased);
        reel.content.scale.y = 1 + 0.18 * (1 - eased);
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
      if (this.#destroyed) { this.app.ticker.remove(tick); done(); return; }
      const progress = Math.min(1, (performance.now() - started) / 180);
      content.y = Math.sin(progress * Math.PI * 2) * 7 * (1 - progress);
      content.scale.y = 1 + Math.sin(progress * Math.PI) * 0.05;
      if (progress < 1) return;
      this.app.ticker.remove(tick);
      content.y = 0;
      content.scale.y = 1;
      done();
    };
    this.app.ticker.add(tick);
  }

  #drawWin(result: SpinResult): void {
    this.#win.clear();
    for (const win of result.lineWins) {
      const points = win.rows.slice(0, this.#reelCount).map((row, index) => ({
        x: this.#windowX + index * TILE + TILE / 2,
        y: TOP + row * TILE + TILE / 2,
      }));
      if (points.length < 2) continue;
      const trace = (g: Graphics): Graphics => {
        g.moveTo(points[0]!.x, points[0]!.y);
        for (const point of points.slice(1)) g.lineTo(point.x, point.y);
        return g;
      };
      trace(this.#win).stroke({ width: 18, color: 0xffcc00, alpha: 0.12 });
      trace(this.#win).stroke({ width: 4, color: 0xfff2a8, alpha: 0.95 });
    }
  }
}

/** Demo-Konfiguration fuer die Vorschau im leeren Zustand. */
export const SLOT_STAGE_DEMO = DEFAULT_SLOT_CONFIG;
