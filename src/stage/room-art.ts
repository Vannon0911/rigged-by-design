/** Raum, Wand und Boden: der Floor ist ein Ort, kein Formular. */
import { Container, Graphics } from 'pixi.js';

export const FLOOR_WIDTH = 960;
export const FLOOR_HEIGHT = 640;
export const FLOOR_TOP = 78;

export interface FloorLayout {
  readonly cell: number;
  readonly ox: number;
  readonly oy: number;
}

export function layoutFor(size: number): FloorLayout {
  const cell = Math.floor(Math.min((FLOOR_WIDTH - 96) / size, (FLOOR_HEIGHT - FLOOR_TOP - 52) / size));
  return {
    cell,
    ox: Math.round((FLOOR_WIDTH - cell * size) / 2),
    oy: FLOOR_TOP + Math.round((FLOOR_HEIGHT - FLOOR_TOP - cell * size) / 2),
  };
}

export function drawRoom(g: Graphics, layout: FloorLayout, size: number): void {
  const { cell, ox, oy } = layout;
  const gridRight = ox + cell * size;
  const gridBottom = oy + cell * size;
  g.clear();

  g.rect(0, 0, FLOOR_WIDTH, FLOOR_HEIGHT).fill(0x08050f);
  g.rect(0, 0, FLOOR_WIDTH, FLOOR_TOP).fill(0x130b23);
  g.rect(0, 18, FLOOR_WIDTH, 1).fill({ color: 0xffffff, alpha: 0.04 });
  for (let x = 0; x < FLOOR_WIDTH; x += 56) {
    g.rect(x, 0, 1, FLOOR_TOP).fill({ color: 0xffffff, alpha: 0.025 });
  }
  g.rect(0, FLOOR_TOP - 4, FLOOR_WIDTH, 4).fill({ color: 0xff2e88, alpha: 0.55 });
  g.roundRect(FLOOR_WIDTH - 214, 18, 190, 44, 8).fill({ color: 0x1b0d22, alpha: 0.8 }).stroke({ width: 1, color: 0xff2e88, alpha: 0.45 });
  g.rect(FLOOR_WIDTH - 204, 38, 170, 2).fill({ color: 0x00ffcc, alpha: 0.25 });
  g.rect(0, FLOOR_TOP, FLOOR_WIDTH, 2).fill({ color: 0x00ffcc, alpha: 0.18 });

  g.rect(0, FLOOR_TOP, FLOOR_WIDTH, FLOOR_HEIGHT - FLOOR_TOP).fill(0x09050f);
  for (let x = 0; x < FLOOR_WIDTH; x += 72) {
    g.rect(x, FLOOR_TOP, 1, FLOOR_HEIGHT - FLOOR_TOP).fill({ color: 0xffffff, alpha: 0.018 });
  }
  g.rect(0, gridBottom + 34, FLOOR_WIDTH, 1).fill({ color: 0xffffff, alpha: 0.025 });

  // Teppich unter dem Angebot.
  g.roundRect(ox - 34, oy - 34, cell * size + 68, cell * size + 68, 26)
    .fill(0x180a22)
    .stroke({ width: 2, color: 0x4a2148, alpha: 0.8 });
  g.roundRect(ox - 26, oy - 26, cell * size + 52, cell * size + 52, 20)
    .stroke({ width: 1, color: 0xff2e88, alpha: 0.22 });
  for (let step = 0; step < 5; step += 1) {
    const inset = 52 + step * 18;
    g.roundRect(ox - inset, oy - inset, cell * size + inset * 2, cell * size + inset * 2, 12)
      .stroke({ width: 1, color: step % 2 === 0 ? 0x581f4e : 0x1f5c5a, alpha: 0.1 });
  }

  // Deckenstrahler.
  for (const [x, color] of [[ox + 40, 0xff2e88], [FLOOR_WIDTH / 2, 0x00ffcc], [gridRight - 40, 0xffd166]] as const) {
    g.circle(x, FLOOR_TOP + 2, 26).fill({ color, alpha: 0.06 });
    g.circle(x, FLOOR_TOP + 2, 5).fill({ color, alpha: 0.5 });
    g.poly([x - 26, FLOOR_TOP, x + 26, FLOOR_TOP, x + 92, gridBottom, x - 92, gridBottom])
      .fill({ color, alpha: 0.025 });
  }

  if (ox > 120) drawEntrance(g, ox, oy, gridBottom);
  if (FLOOR_WIDTH - gridRight > 120) drawCashier(g);
  if (FLOOR_WIDTH - gridRight > 120) drawBar(g);
  if (ox > 150) drawPlant(g, 42, gridBottom - 64);

  g.rect(0, FLOOR_HEIGHT - 22, FLOOR_WIDTH, 22).fill({ color: 0x000000, alpha: 0.28 });
  g.rect(0, 0, 18, FLOOR_HEIGHT).fill({ color: 0x000000, alpha: 0.22 });
  g.rect(FLOOR_WIDTH - 18, 0, 18, FLOOR_HEIGHT).fill({ color: 0x000000, alpha: 0.22 });
}

function drawEntrance(g: Graphics, ox: number, oy: number, gridBottom: number): void {
  const x = 26;
  const y = oy + 48;
  const w = 88;
  const h = 176;
  g.roundRect(x, y, w, h, 10).fill(0x1a102c).stroke({ width: 2, color: 0x4a3564 });
  g.roundRect(x + 8, y + 8, w - 16, h - 16, 6).fill(0x05030a);
  g.rect(x + w / 2, y + 12, 2, h - 24).fill({ color: 0xffffff, alpha: 0.06 });
  g.circle(x + 20, y + h / 2, 3).fill(0xffd166);
  g.poly([x + w, y + 18, ox - 4, gridBottom + 18, ox - 4, gridBottom + 46, x + w, y + h - 18])
    .fill({ color: 0xffb347, alpha: 0.05 });
  g.rect(x, y - 16, w, 3).fill({ color: 0xff2e88, alpha: 0.5 });
  // Türsteher-Silhouette.
  g.circle(x + w + 26, y + 74, 12).fill(0x241733);
  g.roundRect(x + w + 10, y + 88, 32, 56, 10).fill(0x1c1228);
  g.rect(x + w + 6, y + 150, 40, 26).fill(0x120b1c);
}

function drawCashier(g: Graphics): void {
  const x = FLOOR_WIDTH - 178;
  const y = FLOOR_TOP + 26;
  g.roundRect(x, y, 146, 152, 12).fill(0x120b1e).stroke({ width: 2, color: 0x3f2b5e });
  g.roundRect(x + 10, y + 10, 126, 78, 8).fill(0x05030a).stroke({ width: 1, color: 0xffd166, alpha: 0.55 });
  for (let bar = 0; bar < 7; bar += 1) {
    g.rect(x + 22 + bar * 17, y + 12, 2, 74).fill({ color: 0xffd166, alpha: 0.18 });
  }
  g.rect(x + 10, y + 92, 126, 4).fill({ color: 0xffd166, alpha: 0.5 });
  g.roundRect(x + 12, y + 100, 122, 40, 6).fill(0x1a102c).stroke({ width: 1, color: 0x3f2b5e });
  g.circle(x + 32, y + 120, 5).fill(0x00ffcc);
  g.rect(x + 48, y + 116, 60, 3).fill({ color: 0xffffff, alpha: 0.14 });
  g.rect(x + 48, y + 124, 38, 3).fill({ color: 0xffffff, alpha: 0.08 });
}

function drawBar(g: Graphics): void {
  const x = FLOOR_WIDTH - 198;
  const y = FLOOR_TOP + 278;
  g.roundRect(x, y, 172, 118, 12).fill(0x1b0d1d).stroke({ width: 1, color: 0x4a2148, alpha: 0.8 });
  g.rect(x + 8, y + 10, 156, 42).fill(0x0a050f);
  const bottleColors = [0x00ffcc, 0xff2e88, 0xffd166, 0xb06bff, 0xff8a3d];
  bottleColors.forEach((color, index) => {
    const bx = x + 22 + index * 30;
    g.roundRect(bx, y + 50, 9, 20, 3).fill({ color, alpha: 0.7 });
    g.rect(bx + 3, y + 44, 3, 8).fill({ color, alpha: 0.5 });
  });
  g.roundRect(x - 6, y + 76, 184, 14, 6).fill(0x2a1430).stroke({ width: 1, color: 0xff2e88, alpha: 0.35 });
  g.roundRect(x + 22, y + 90, 128, 22, 5).fill(0x150d20);
  for (const stool of [42, 128]) {
    g.roundRect(x + stool - 14, y + 112, 28, 5, 2).fill(0x3a2440);
    g.rect(x + stool - 2, y + 117, 4, 18).fill(0x2a1830);
  }
  g.rect(x + 10, y + 4, 150, 2).fill({ color: 0xff2e88, alpha: 0.35 });
}

function drawPlant(g: Graphics, x: number, y: number): void {
  g.roundRect(x, y, 34, 30, 6).fill(0x241636);
  g.rect(x + 5, y - 8, 24, 12).fill(0x2f1c44);
  for (let leaf = 0; leaf < 6; leaf += 1) {
    const angle = -Math.PI / 2 + (leaf - 2.5) * 0.42;
    g.ellipse(x + 17 + Math.cos(angle) * 18, y - 18 + Math.sin(angle) * 22, 7, 15).fill({
      color: 0x2dd4a0,
      alpha: 0.5,
    });
  }
}

export function drawGrid(
  g: Graphics,
  size: number,
  layout: FloorLayout,
  hover: { x: number; y: number } | null,
): void {
  const { cell, ox, oy } = layout;
  g.clear();
  g.roundRect(ox - 10, oy - 10, cell * size + 20, cell * size + 20, 18)
    .fill({ color: 0x0b0616, alpha: 0.72 })
    .stroke({ width: 2, color: 0x3a2450, alpha: 0.9 });
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const cx = ox + x * cell + cell / 2;
      const cy = oy + y * cell + cell / 2;
      g.roundRect(ox + x * cell + 3, oy + y * cell + 3, cell - 6, cell - 6, 7)
        .fill({ color: (x + y) % 2 === 0 ? 0x130d23 : 0x0e091a, alpha: 0.82 })
        .stroke({ width: 1, color: 0x2b1d42, alpha: 0.8 });
      g.rect(cx - cell * 0.05, cy - 0.7, cell * 0.1, 1.4).fill({ color: 0x9a86b8, alpha: 0.09 });
      g.rect(cx - 0.7, cy - cell * 0.05, 1.4, cell * 0.1).fill({ color: 0x9a86b8, alpha: 0.09 });
      g.circle(ox + x * cell + cell - 13, oy + y * cell + 13, 1.5)
        .fill({ color: 0xffd166, alpha: 0.18 });
    }
  }
  if (hover) {
    g.roundRect(ox + hover.x * cell + 3, oy + hover.y * cell + 3, cell - 6, cell - 6, 7)
      .stroke({ width: 2, color: 0xffd166, alpha: 0.95 });
  }
}

export function drawPlayer(): Container {
  const container = new Container();
  const g = new Graphics();
  g.ellipse(0, 16, 14, 4).fill({ color: 0x000000, alpha: 0.5 });
  g.circle(0, -22, 9).fill(0xe0b089);
  g.roundRect(-10, -13, 20, 24, 6).fill(0x00ffcc);
  g.roundRect(-7, -34, 14, 7, 3).fill(0xff2e88);
  g.circle(-4, -23, 1.4).fill(0x1a1020);
  g.circle(4, -23, 1.4).fill(0x1a1020);
  g.roundRect(-10, 9, 20, 4, 2).fill(0x0d0819);
  g.circle(0, 1, 2).fill(0xffd166);
  container.addChild(g);
  return container;
}
