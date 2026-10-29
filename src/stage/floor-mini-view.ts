/** Top-down Mini-Ansicht des 8x8-Casino-Floors mit Deko, Slots und Besuchern. */
import { Application, Container, Graphics, Text } from 'pixi.js';
import type { FloorView, PlacedItem } from '../core/simulation/floor-types';
import { getBuildable } from '../core/simulation/catalog';
import { VisitorLayer } from './visitor-layer';

const OX = 12;
const OY = 32;

export class FloorMiniView {
  readonly container = new Container();
  readonly #app: Application;
  readonly #cell: number;
  readonly #grid = new Graphics();
  readonly #items = new Graphics();
  readonly #lights = new Graphics();
  readonly #popups = new Container();
  readonly #visitorLayer: VisitorLayer;
  readonly #count: Text;
  readonly #spun = new Map<number, number>();
  #lastItems: readonly PlacedItem[] = [];
  #destroyed = false;

  constructor(app: Application, cellSize = 34) {
    this.#app = app;
    this.#cell = cellSize;
    const width = cellSize * 8 + 24;
    const height = cellSize * 8 + 44;

    const bg = new Graphics()
      .roundRect(0, 0, width, height, 12)
      .fill(0x070a11)
      .stroke({ width: 1, color: 0x1e2636 });

    const title = new Text({
      text: 'DEIN CASINO',
      style: { fontFamily: 'monospace', fontSize: 12, fill: 0xffd166, fontWeight: 'bold', letterSpacing: 2 },
    });
    title.position.set(OX, 10);
    this.#count = new Text({
      text: '0/10',
      style: { fontFamily: 'monospace', fontSize: 10, fill: 0x8a97b0 },
    });
    this.#count.anchor.set(1, 0);
    this.#count.position.set(width - OX, 11);

    this.#visitorLayer = new VisitorLayer(cellSize);
    this.#visitorLayer.container.position.set(OX, OY);
    this.container.addChild(
      bg,
      this.#grid,
      this.#items,
      this.#visitorLayer.container,
      this.#lights,
      this.#popups,
      title,
      this.#count,
    );
    this.#app.ticker.add(this.#blink);
  }

  update(floor: FloorView): void {
    if (this.#destroyed) return;
    this.#lastItems = floor.items;
    this.#count.text = `${floor.visitors.length}/10`;
    this.#drawGrid();
    this.#drawItems(floor.items);
    const blocked = new Set(floor.items.map((item) => item.y * 8 + item.x));
    this.#visitorLayer.update(floor.visitors, blocked);
    this.#spawnPopups(floor);
  }

  destroy(): void {
    this.#destroyed = true;
    this.#app.ticker.remove(this.#blink);
    this.container.destroy({ children: true });
  }

  #drawGrid(): void {
    const g = this.#grid;
    g.clear();
    for (let y = 0; y < 8; y += 1) {
      for (let x = 0; x < 8; x += 1) {
        const px = OX + x * this.#cell;
        const py = OY + y * this.#cell;
        g.rect(px, py, this.#cell, this.#cell)
          .fill((x + y) % 2 === 0 ? 0x0b0e16 : 0x0a0c13)
          .stroke({ width: 1, color: 0x172033 });
      }
    }
  }

  #drawItems(items: readonly PlacedItem[]): void {
    const g = this.#items;
    const c = this.#cell;
    g.clear();
    for (const item of items) {
      const px = OX + item.x * c;
      const py = OY + item.y * c;
      const buildable = getBuildable(item.buildableId);
      if (buildable.id === 'DECO_CARPET') {
        g.rect(px + 1, py + 1, c - 2, c - 2).fill(0x3b0e18);
        g.rect(px + 6, py + 6, c - 12, 1).fill({ color: 0x8a1c2e, alpha: 0.8 });
        g.rect(px + 6, py + c - 10, c - 12, 1).fill({ color: 0x8a1c2e, alpha: 0.8 });
      } else if (buildable.kind === 'SLOT') {
        const neon = buildable.id === 'SLOT_NEON' ? 0xff2e88 : 0x00ffcc;
        g.roundRect(px + 4, py + 4, c - 8, c - 8, 4).fill(0x11101c).stroke({ width: 2, color: neon, alpha: 0.8 });
        g.roundRect(px + 8, py + 8, c - 16, c - 19, 2).fill(0x05050a);
        g.rect(px + 8, py + c - 11, c - 16, 2).fill({ color: 0xffd166, alpha: 0.5 });
      } else if (buildable.kind === 'SHELL') {
        g.roundRect(px + 5, py + c - 18, c - 10, 12, 2).fill(0x2b1b10).stroke({ width: 1, color: 0xd4a24a, alpha: 0.8 });
        for (let cup = 0; cup < 3; cup += 1) {
          const cx = px + c / 2 + (cup - 1) * 6;
          g.poly([cx - 4, py + c - 18, cx + 4, py + c - 18, cx, py + c - 26]).fill(0xb07a3c);
        }
      } else if (buildable.kind === 'DICE') {
        g.roundRect(px + 4, py + 8, c - 8, c - 16, 3).fill(0x0d2a1a).stroke({ width: 1, color: 0x00ffcc, alpha: 0.7 });
        g.circle(px + c / 2, py + c / 2, 4).fill(0xe8e2d0);
        g.circle(px + c / 2, py + c / 2, 1.5).fill(0x1a1a1a);
      } else if (buildable.id === 'DECO_NEON_SIGN') {
        g.roundRect(px + 5, py + 7, c - 10, c - 14, 2).fill(0x073b3b).stroke({ width: 1, color: 0x00ffcc, alpha: 0.9 });
        g.rect(px + 9, py + c / 2 - 1, c - 18, 2).fill({ color: 0x00ffcc, alpha: 0.7 });
      } else if (buildable.id === 'DECO_BOOZE') {
        g.roundRect(px + 9, py + 6, c - 18, c - 12, 4).fill(0x3a1d4f).stroke({ width: 1, color: 0xb06bff });
        g.circle(px + c / 2, py + 11, 2.5).fill({ color: 0xe0b3ff, alpha: 0.9 });
      }
    }
  }

  #spawnPopups(floor: FloorView): void {
    for (const visitor of floor.visitors) {
      const position = this.#visitorLayer.positionOf(visitor.id);
      if (!position) continue;
      const previous = this.#spun.get(visitor.id) ?? 0;
      this.#spun.set(visitor.id, visitor.spins);
      if (visitor.spins > previous) this.#popup(OX + position.x, OY + position.y - 12);
    }
  }

  #popup(x: number, y: number): void {
    const label = new Text({
      text: '+VC',
      style: { fontFamily: 'monospace', fontSize: 10, fill: 0xffd166, fontWeight: 'bold' },
    });
    label.anchor.set(0.5);
    label.position.set(x, y);
    this.#popups.addChild(label);
    const started = performance.now();

    const tick = (): void => {
      if (this.#destroyed) {
        this.#app.ticker.remove(tick);
        label.destroy();
        return;
      }
      const progress = Math.min(1, (performance.now() - started) / 700);
      label.y = y - 18 * progress;
      label.alpha = 1 - progress;
      if (progress >= 1) {
        this.#app.ticker.remove(tick);
        label.destroy();
      }
    };
    this.#app.ticker.add(tick);
  }

  #blink = (): void => {
    if (this.#destroyed) return;
    this.#lights.clear();
    const now = performance.now();
    for (const item of this.#lastItems) {
      if (getBuildable(item.buildableId).kind !== 'SLOT') continue;
      const px = OX + item.x * this.#cell + this.#cell / 2;
      const py = OY + item.y * this.#cell + 8;
      const alpha = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(now / 260 + item.id));
      this.#lights.circle(px, py, 2.5).fill({ color: 0x00ffcc, alpha });
    }
  };
}
