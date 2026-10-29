// @loc-exception: Interaktive Casino-Floor-Buehne mit Grid-Hit-Testing, Besucher-Layern und Pixi-Animation.
/** Grosse, klickbare Floor-Ansicht: freies Feld bauen, eigenes Gerät auswaehlen. */
import { Container, Graphics, Rectangle, Text, type Application, type FederatedPointerEvent } from 'pixi.js';
import { getVenue } from '../core/progression/venues-and-tiers';
import { getBuildable } from '../core/simulation/catalog';
import type { FloorRoundEvent } from '../core/simulation/floor-events';
import type { FloorView, PlacedItem } from '../core/simulation/floor-types';
import { drawFloorItem } from './floor-item-art';
import { PlayerAvatarView, type AvatarViewState } from './player-avatar-view';
import { VisitorEffectsLayer } from './visitor-effects-layer';
import { VisitorLayer } from './visitor-layer';

const WIDTH = 780;
const HEIGHT = 620;
const TOP = 112;

export interface CasinoFloorCallbacks {
  readonly onEmptyCell: (x: number, y: number) => void;
  readonly onItem: (item: PlacedItem) => void;
}

export class CasinoFloorView {
  readonly container = new Container();
  readonly #app: Application;
  readonly #callbacks: CasinoFloorCallbacks;
  readonly #grid = new Graphics();
  readonly #items = new Graphics();
  readonly #lights = new Graphics();
  readonly #hover = new Graphics();
  readonly #visitorLayer = new VisitorLayer(48);
  readonly #effects: VisitorEffectsLayer;
  readonly #player: PlayerAvatarView;
  readonly #title = new Text({
    text: 'DEIN CASINO',
    style: { fontFamily: 'monospace', fontSize: 22, fill: 0xffd166, fontWeight: 'bold', letterSpacing: 7 },
  });
  readonly #subtitle = new Text({
    text: '',
    style: { fontFamily: 'monospace', fontSize: 10, fill: 0x8a97b0, letterSpacing: 2 },
  });
  readonly #hint = new Text({
    text: 'FREIES FELD = BAUEN   ·   GERÄT = WERKSTATT ODER SPIELEN',
    style: { fontFamily: 'monospace', fontSize: 9, fill: 0x00ffcc, letterSpacing: 1.5 },
  });
  #floor: FloorView | null = null;
  #cell = 48;
  #ox = 0;
  #oy = TOP;
  #size = 8;
  #lastItems: readonly PlacedItem[] = [];
  #lastEventSeq = 0;
  #hoverIndex = -1;
  #destroyed = false;

  constructor(app: Application, avatar: AvatarViewState, callbacks: CasinoFloorCallbacks) {
    this.#app = app;
    this.#callbacks = callbacks;
    this.#effects = new VisitorEffectsLayer(app);
    this.#player = new PlayerAvatarView(avatar);
    this.#player.setScale(0.11);

    const room = new Graphics()
      .rect(0, 0, WIDTH, HEIGHT).fill(0x05070d)
      .rect(0, 0, WIDTH, 86).fill(0x090c15)
      .rect(0, 84, WIDTH, 2).fill({ color: 0xff2e88, alpha: 0.45 })
      .rect(0, 86, WIDTH, HEIGHT - 86).fill(0x070a11);
    for (let x = 16; x < WIDTH; x += 64) {
      room.rect(x, 0, 1, HEIGHT).fill({ color: 0xffffff, alpha: 0.018 });
    }
    room.circle(WIDTH / 2, 84, 210).fill({ color: 0xff2e88, alpha: 0.035 });
    room.circle(WIDTH / 2, 84, 120).fill({ color: 0x00ffcc, alpha: 0.03 });
    room.roundRect(14, 104, WIDTH - 28, HEIGHT - 120, 16).stroke({ width: 1, color: 0x2a3852, alpha: 0.55 });
    this.#title.position.set(28, 22);
    this.#subtitle.position.set(30, 54);
    this.#hint.anchor.set(1, 0);
    this.#hint.position.set(WIDTH - 28, 52);

    this.container.addChild(
      room,
      this.#grid,
      this.#visitorLayer.container,
      this.#items,
      this.#lights,
      this.#effects.container,
      this.#player.container,
      this.#hover,
      this.#title,
      this.#subtitle,
      this.#hint,
    );
    this.container.eventMode = 'static';
    this.container.cursor = 'pointer';
    this.container.hitArea = new Rectangle(0, 0, WIDTH, HEIGHT);
    this.container.on('pointertap', this.#tap);
    this.container.on('pointermove', this.#move);
    this.container.on('pointerleave', () => { this.#hoverIndex = -1; this.#hover.clear(); });
    app.ticker.add(this.#animate);
  }

  update(floor: FloorView, events: readonly FloorRoundEvent[] = [], avatar?: AvatarViewState): void {
    if (this.#destroyed) return;
    this.#floor = floor;
    this.#size = floor.size;
    this.#cell = Math.min(70, Math.floor(500 / Math.max(4, floor.size)));
    const gridW = this.#cell * floor.size;
    this.#ox = Math.round((WIDTH - gridW) / 2);
    this.#oy = TOP + Math.round((HEIGHT - TOP - gridW) / 2);
    this.#lastItems = floor.items;
    const venue = getVenue(floor.venueTier);
    this.#subtitle.text = `${venue.name.toUpperCase()} · ${floor.size}×${floor.size} · ${floor.visitors.length} GÄSTE · ${floor.items.length} OBJEKTE`;
    this.#drawGrid();
    this.#drawItems();
    const blocked = new Set(floor.items.map((entry) => entry.y * floor.size + entry.x));
    this.#visitorLayer.container.position.set(this.#ox, this.#oy);
    this.#visitorLayer.update(floor.visitors, blocked, floor.size);
    this.#player.container.position.set(this.#ox + 4, this.#oy + gridW - 6);
    if (avatar) this.#player.update(avatar);
    this.#drawLights();
    this.#showEvents(events);
  }

  destroy(): void {
    this.#destroyed = true;
    this.#app.ticker.remove(this.#animate);
    this.#effects.destroy();
    this.#player.destroy();
    this.container.destroy({ children: true });
  }

  #drawGrid(): void {
    const g = this.#grid;
    g.clear();
    for (let y = 0; y < this.#size; y += 1) {
      for (let x = 0; x < this.#size; x += 1) {
        const px = this.#ox + x * this.#cell;
        const py = this.#oy + y * this.#cell;
        g.roundRect(px + 1, py + 1, this.#cell - 2, this.#cell - 2, 3)
          .fill((x + y) % 2 === 0 ? 0x0d1320 : 0x0a0f1a)
          .stroke({ width: 1, color: 0x1b2940, alpha: 0.8 });
      }
    }
    g.roundRect(this.#ox - 4, this.#oy - 4, this.#cell * this.#size + 8, this.#cell * this.#size + 8, 8)
      .stroke({ width: 2, color: 0x32435f, alpha: 0.8 });
  }

  #drawItems(): void {
    const g = this.#items;
    g.clear();
    for (const item of this.#lastItems) {
      if (item.x >= this.#size || item.y >= this.#size) continue;
      const px = this.#ox + item.x * this.#cell;
      const py = this.#oy + item.y * this.#cell;
      g.roundRect(px + 2, py + 2, this.#cell - 4, this.#cell - 4, 4).fill({ color: 0x000000, alpha: 0.35 });
      drawFloorItem(g, item.buildableId, px, py, this.#cell);
    }
  }

  #drawLights(): void {
    const g = this.#lights;
    g.clear();
    const now = performance.now();
    for (const item of this.#lastItems) {
      if (getBuildable(item.buildableId).kind !== 'SLOT') continue;
      const px = this.#ox + item.x * this.#cell + this.#cell / 2;
      const py = this.#oy + item.y * this.#cell + 8;
      const alpha = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(now / 280 + item.id));
      g.circle(px, py, 3).fill({ color: 0x00ffcc, alpha });
    }
  }

  #drawHover(): void {
    const g = this.#hover;
    g.clear();
    if (this.#hoverIndex < 0 || !this.#floor) return;
    const x = this.#hoverIndex % this.#size;
    const y = Math.floor(this.#hoverIndex / this.#size);
    g.roundRect(this.#ox + x * this.#cell + 1, this.#oy + y * this.#cell + 1, this.#cell - 2, this.#cell - 2, 3)
      .stroke({ width: 2, color: 0xffd166, alpha: 0.9 });
  }

  #cellAt(localX: number, localY: number): { x: number; y: number } | null {
    const x = Math.floor((localX - this.#ox) / this.#cell);
    const y = Math.floor((localY - this.#oy) / this.#cell);
    if (x < 0 || y < 0 || x >= this.#size || y >= this.#size) return null;
    return { x, y };
  }

  #tap = (event: FederatedPointerEvent): void => {
    const local = event.getLocalPosition(this.container);
    const cell = this.#cellAt(local.x, local.y);
    if (!cell) return;
    const item = this.#lastItems.find((entry) => entry.x === cell.x && entry.y === cell.y);
    if (item) this.#callbacks.onItem(item);
    else this.#callbacks.onEmptyCell(cell.x, cell.y);
  };

  #move = (event: FederatedPointerEvent): void => {
    const local = event.getLocalPosition(this.container);
    const cell = this.#cellAt(local.x, local.y);
    this.#hoverIndex = cell ? cell.y * this.#size + cell.x : -1;
    this.#drawHover();
  };

  #showEvents(events: readonly FloorRoundEvent[]): void {
    for (const event of events) {
      if (event.seq <= this.#lastEventSeq) continue;
      this.#lastEventSeq = event.seq;
      const position = this.#visitorLayer.positionOf(event.visitorId) ?? {
        x: event.gameX * this.#cell + this.#cell / 2,
        y: event.gameY * this.#cell + this.#cell / 2,
      };
      this.#effects.showRound(event, this.#ox + position.x, this.#oy + position.y);
    }
  }

  #animate = (): void => {
    if (this.#destroyed) return;
    this.#drawLights();
    this.#visitorLayer.animate(performance.now());
  };
}
