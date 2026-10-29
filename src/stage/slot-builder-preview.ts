/** PixiJS-v8-Livegehaeuse fuer den Slot-Baukasten: 3 bis 6 Rollen pro Entwurf. */
import { Application, Container, Graphics, Text } from 'pixi.js';
import { resolveReels } from '../core/slot/slot-engine';
import type { SlotConfig, SlotSymbol } from '../core/slot/slot-types';
import { createSymbolTile } from './symbol-graphics';

const WIDTH = 440;
const HEIGHT = 238;
const WINDOW_Y = 48;

export class SlotBuilderPreview {
  readonly app: Application;
  readonly #layer = new Container();
  readonly #host: HTMLElement;

  private constructor(app: Application, host: HTMLElement) {
    this.app = app;
    this.#host = host;
    app.stage.addChild(this.#layer);
  }

  static async create(host: HTMLElement): Promise<SlotBuilderPreview> {
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
    return new SlotBuilderPreview(app, host);
  }

  setConfig(config: SlotConfig): void {
    this.#clear();
    const frame = new Graphics();
    frame.roundRect(1, 1, WIDTH - 2, HEIGHT - 2, 14).fill(0x080810).stroke({ width: 2, color: 0xff2e88, alpha: 0.55 });
    frame.roundRect(12, 12, WIDTH - 24, 20, 6).fill(0x160b18);
    this.#layer.addChild(frame);

    const label = new Text({
      text: `LIVE-GEHAEUSE · ${config.id.toUpperCase()}`,
      style: { fontFamily: 'monospace', fontSize: 10, fill: 0xff8fc4, letterSpacing: 2 },
    });
    label.position.set(20, 17);
    this.#layer.addChild(label);

    let strips: readonly SlotSymbol[][];
    try {
      strips = resolveReels(config).map((reel) =>
        Array.isArray(reel) ? [...(reel as readonly SlotSymbol[])] : [...(reel as { symbols: readonly SlotSymbol[] }).symbols],
      );
    } catch (error) {
      const message = new Text({
        text: error instanceof Error ? error.message : 'Konfiguration ungueltig',
        style: { fontFamily: 'monospace', fontSize: 10, fill: 0xff6b8a, wordWrap: true, wordWrapWidth: 360 },
      });
      message.position.set(28, 92);
      this.#layer.addChild(message);
      return;
    }

    const tile = Math.min(58, Math.floor(390 / Math.max(3, strips.length)));
    const totalWidth = strips.length * tile;
    const startX = (WIDTH - totalWidth) / 2;
    const window = new Graphics();
    window.roundRect(startX - 7, WINDOW_Y - 7, totalWidth + 14, tile * 3 + 14, 10)
      .fill(0x030308)
      .stroke({ width: 2, color: 0xff2e88, alpha: 0.5 });
    this.#layer.addChild(window);

    strips.forEach((strip, reelIndex) => {
      if (strip.length === 0) return;
      for (let row = 0; row < 3; row += 1) {
        const symbol = strip[row % strip.length]!;
        const tileView = createSymbolTile(symbol, tile);
        tileView.position.set(startX + reelIndex * tile, WINDOW_Y + row * tile);
        this.#layer.addChild(tileView);
      }
      const divider = new Graphics()
        .rect(startX + reelIndex * tile, WINDOW_Y, 1, tile * 3)
        .fill({ color: 0xffffff, alpha: 0.05 });
      this.#layer.addChild(divider);
    });

    const footer = new Text({
      text: `${strips.length} ROLLEN · ${typeof config.paylines === 'number' ? config.paylines : config.paylines.length} LINIEN`,
      style: { fontFamily: 'monospace', fontSize: 9, fill: 0x9aa7c7, letterSpacing: 1 },
    });
    footer.anchor.set(0.5);
    footer.position.set(WIDTH / 2, HEIGHT - 17);
    this.#layer.addChild(footer);
  }

  destroy(): void {
    this.app.destroy(true, { children: true });
    this.#host.replaceChildren();
  }

  #clear(): void {
    for (const child of this.#layer.removeChildren()) child.destroy({ children: true });
  }
}
