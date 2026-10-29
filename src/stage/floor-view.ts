/** Die Bühne: ein Raum, Automaten, Gäste, Events. Keine Tabs, keine Spalten. */
import { Application, Container, Graphics, Rectangle, Text, type FederatedPointerEvent } from 'pixi.js';
import { getItem } from '../core/offer/catalog';
import type { GameSnapshot } from '../store/types';
import { createDecorSprite } from './decor-art';
import { FxLayer } from './fx';
import { createMachineSprite, drawModPips, type MachineSprite } from './machine-art';
import { drawGrid, drawPlayer, drawRoom, FLOOR_HEIGHT, FLOOR_TOP, FLOOR_WIDTH, layoutFor, type FloorLayout } from './room-art';
import { VisitorLayer } from './visitor-layer';

export interface FloorCallbacks {
  readonly onMachine: (id: number) => void;
  readonly onEmpty: (x: number, y: number) => void;
}

export interface CellPos { readonly x: number; readonly y: number; }

const padFor = (cell: number): number => Math.max(4, cell * 0.07);

export class FloorView {
  readonly container = new Container();
  readonly #app: Application;
  readonly #callbacks: FloorCallbacks;
  readonly #room = new Graphics();
  readonly #glow = new Graphics();
  readonly #grid = new Graphics();
  readonly #decor = new Container();
  readonly #items = new Container();
  readonly #visitors = new VisitorLayer();
  readonly #fx = new FxLayer();
  readonly #player = drawPlayer();
  readonly #title = new Text({ text: '', style: { fontFamily: 'ui-monospace, monospace', fontSize: 22, fill: 0xffd166, fontWeight: 'bold', letterSpacing: 4 } });
  readonly #subtitle = new Text({ text: '', style: { fontFamily: 'ui-monospace, monospace', fontSize: 11, fill: 0x9a86b8, letterSpacing: 1.5 } });
  readonly #signDoor = new Text({ text: 'EINGANG', style: { fontFamily: 'ui-monospace, monospace', fontSize: 9, fill: 0x9a86b8, letterSpacing: 2 } });
  readonly #signCash = new Text({ text: 'KASSE', style: { fontFamily: 'ui-monospace, monospace', fontSize: 9, fill: 0xffd166, letterSpacing: 2 } });
  readonly #signBar = new Text({ text: 'BAR', style: { fontFamily: 'ui-monospace, monospace', fontSize: 9, fill: 0xff2e88, letterSpacing: 2 } });
  readonly #signOpen = new Text({ text: 'OPEN 24/7', style: { fontFamily: 'ui-monospace, monospace', fontSize: 14, fill: 0xff2e88, fontWeight: 'bold', letterSpacing: 3 } });
  readonly #machineSprites = new Map<number, MachineSprite>();
  readonly #machineCells = new Map<string, number>();
  readonly #occupied = new Set<string>();
  #layout: FloorLayout = layoutFor(4);
  #size = 4;
  #hover: CellPos | null = null;
  #lastSeq = 0;
  #signature = '';
  #destroyed = false;

  constructor(app: Application, callbacks: FloorCallbacks) {
    this.#app = app;
    this.#callbacks = callbacks;
    drawRoom(this.#room, this.#layout, this.#size);
    this.#title.position.set(28, 20);
    this.#subtitle.position.set(30, 52);
    this.#visitors.setLayout(this.#layout.ox, this.#layout.oy, this.#layout.cell);
    this.container.addChild(
      this.#room, this.#glow, this.#grid, this.#decor, this.#items, this.#visitors.container,
      this.#fx.container, this.#player, this.#title, this.#subtitle,
      this.#signDoor, this.#signCash, this.#signBar, this.#signOpen,
    );
    this.#signOpen.position.set(FLOOR_WIDTH - 186, 30); this.#placeSigns();
    this.container.eventMode = 'static';
    this.container.hitArea = new Rectangle(0, 0, FLOOR_WIDTH, FLOOR_HEIGHT);
    this.container.on('pointertap', this.#tap);
    this.container.on('pointermove', this.#move);
    this.container.on('pointerleave', () => { this.#hover = null; this.#drawGrid(); });
    app.ticker.add(this.#animate);
    app.stage.addChild(this.container);
  }

  update(snapshot: GameSnapshot): void {
    if (this.#destroyed) return;
    if (snapshot.gridSize !== this.#size) {
      this.#size = snapshot.gridSize;
      this.#layout = layoutFor(this.#size);
      drawRoom(this.#room, this.#layout, this.#size);
      this.#placeSigns();
      this.#visitors.setLayout(this.#layout.ox, this.#layout.oy, this.#layout.cell);
    }
    this.#title.text = snapshot.venueName.toUpperCase();
    this.#subtitle.text = `${snapshot.gridSize}×${snapshot.gridSize} · ${snapshot.visitors.length} GÄSTE · ${snapshot.machines.length} AUTOMATEN · UMSATZ ${(snapshot.revenue / 10_000).toFixed(2)} VC · TRESOR ${(snapshot.vault / 10_000).toFixed(2)} VC`;
    this.#drawGrid();
    this.#syncItems(snapshot);
    const machineCell = (id: number): CellPos | null => {
      const machine = snapshot.machines.find((entry) => entry.id === id);
      return machine ? { x: machine.x, y: machine.y } : null;
    };
    this.#visitors.update(snapshot.visitors, machineCell);
    const { ox, oy, cell } = this.#layout;
    this.#player.position.set(Math.max(46, ox - 48), Math.min(FLOOR_HEIGHT - 26, oy + this.#size * cell + 12));
    this.#showEvents(snapshot);
  }

  cellAt(clientX: number, clientY: number): CellPos | null {
    const rect = this.#app.canvas.getBoundingClientRect();
    if (rect.width === 0) return null;
    const scale = rect.width / FLOOR_WIDTH;
    return this.#localCell((clientX - rect.left) / scale, (clientY - rect.top) / scale);
  }

  destroy(): void {
    this.#destroyed = true;
    this.#app.ticker.remove(this.#animate);
    this.container.destroy({ children: true });
  }

  #localCell(x: number, y: number): CellPos | null {
    const { ox, oy, cell } = this.#layout;
    const gx = Math.floor((x - ox) / cell);
    const gy = Math.floor((y - oy) / cell);
    if (gx < 0 || gy < 0 || gx >= this.#size || gy >= this.#size) return null;
    return { x: gx, y: gy };
  }

  #drawGrid(): void {
    drawGrid(this.#grid, this.#size, this.#layout, this.#hover);
  }
  #placeSigns(): void {
    const { cell, ox, oy } = this.#layout;
    const gridRight = ox + cell * this.#size;
    this.#signDoor.position.set(30, oy + 236);
    this.#signCash.position.set(FLOOR_WIDTH - 166, FLOOR_TOP + 6);    this.#signBar.position.set(FLOOR_WIDTH - 166, FLOOR_TOP + 420);
    this.#signDoor.visible = ox > 120;
    this.#signCash.visible = this.#signBar.visible = FLOOR_WIDTH - gridRight > 120;
    this.#glow.clear();
    this.#glow.ellipse(FLOOR_WIDTH / 2, oy + (cell * this.#size) / 2, cell * this.#size * 0.6, cell * this.#size * 0.48).fill({ color: 0xff2e88, alpha: 0.035 });
  }

  #syncItems(snapshot: GameSnapshot): void {
    const signature = snapshot.items.map((item) => `${item.id}:${item.catalogId}:${item.x}:${item.y}:${item.reels.join(',')}:${item.mods.join(',')}:${item.baseBet}`).join('|');
    if (signature === this.#signature) return;
    this.#signature = signature;
    for (const sprite of this.#machineSprites.values()) sprite.container.destroy({ children: true });
    this.#machineSprites.clear(); this.#machineCells.clear(); this.#occupied.clear();
    for (const child of this.#decor.removeChildren()) child.destroy({ children: true });
    const { ox, oy, cell } = this.#layout;
    const pad = padFor(cell);
    for (const item of snapshot.items) {
      this.#occupied.add(`${item.x},${item.y}`);
      if (getItem(item.catalogId).kind === 'DECO') {
        const deco = createDecorSprite(item.catalogId, cell);
        deco.position.set(ox + item.x * cell + pad, oy + item.y * cell + pad);
        this.#decor.addChild(deco);
        continue;
      }
      const machine = snapshot.machines.find((entry) => entry.id === item.id);
      if (!machine) continue;
      const sprite = createMachineSprite(machine, cell);
      drawModPips(sprite.container, machine, cell);
      sprite.container.position.set(ox + machine.x * cell + pad, oy + machine.y * cell + pad);
      this.#machineSprites.set(machine.id, sprite); this.#machineCells.set(`${machine.x},${machine.y}`, machine.id);
      this.#items.addChild(sprite.container);
    }
  }

  #showEvents(snapshot: GameSnapshot): void {
    const { ox, oy, cell } = this.#layout;
    for (const event of snapshot.events) {
      if (event.seq <= this.#lastSeq) continue;
      this.#lastSeq = event.seq;
      const x = ox + event.x * cell + cell / 2;
      const y = oy + event.y * cell + cell / 2;
      const color = event.isWin ? 0xffd166 : event.isNearMiss ? 0xff2e88 : 0x8a7aa8;
      this.#fx.burst(x, y, color, event.isWin ? 22 : 8, event.isWin ? 1.6 : 0.7);
      const label = `${event.net >= 0 ? '+' : ''}${(event.net / 10_000).toFixed(2)}`;
      this.#fx.float(label, x, y - 24, color);
    }
  }

  #tap = (event: FederatedPointerEvent): void => {
    const local = event.getLocalPosition(this.container);
    const cell = this.#localCell(local.x, local.y);
    if (!cell) return;
    const machine = this.#machineCells.get(`${cell.x},${cell.y}`) ?? null;
    if (machine !== null) this.#callbacks.onMachine(machine);
    else if (!this.#occupied.has(`${cell.x},${cell.y}`)) this.#callbacks.onEmpty(cell.x, cell.y);
  };

  #move = (event: FederatedPointerEvent): void => {
    const local = event.getLocalPosition(this.container);
    const cell = this.#localCell(local.x, local.y);
    const changed = cell?.x !== this.#hover?.x || cell?.y !== this.#hover?.y;
    if (!changed) return;
    this.#hover = cell;
    this.#drawGrid();
  };

  #animate = (): void => {
    if (this.#destroyed) return;
    const now = performance.now();
    this.#visitors.animate(now);
    this.#fx.update(this.#app.ticker.deltaTime);
    for (const sprite of this.#machineSprites.values()) {
      sprite.lamp.alpha = 0.4 + 0.6 * Math.abs(Math.sin(now / 300));
    }
    this.#glow.alpha = 0.65 + 0.35 * Math.sin(now / 900);
    this.#signCash.alpha = 0.72 + 0.28 * Math.sin(now / 640);
    const shake = this.#fx.shake;
    this.container.position.set(shake === 0 ? 0 : (Math.random() - 0.5) * shake, shake === 0 ? 0 : (Math.random() - 0.5) * shake);
  };
}
