/** Moebel als prozedurale Pixi-Grafik: Kabinett, Tisch, Bar, Klo, Kasse, Deko. */
import { Container, Graphics, Text } from 'pixi.js';
import type { Furniture } from '../core/sim/types';

export interface FurnitureArt {
  readonly root: Container;
  readonly screen: Text;
  readonly setResult: (value: string) => void;
  readonly refresh: (item: Furniture) => void;
}

const COLORS: Record<string, number> = {
  SLOT: 0x2b163d, TABLE: 0x2f3a24, BAR: 0x421d2e, TOILET: 0x203349,
  EXCHANGE: 0x3a2b18, DECOR: 0x1e3324, STORAGE: 0x24202d,
};

function drawSlot(g: Graphics, w: number, h: number): void {
  g.roundRect(w * 0.12, h * 0.1, w * 0.64, h * 0.45, 3).fill(0x07040d).stroke({ width: 1, color: 0xffd166, alpha: 0.65 });
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      g.circle(w * 0.23 + col * w * 0.17, h * 0.2 + row * h * 0.12, 2.8)
        .fill(row === 1 ? (col === 1 ? 0xff2e88 : 0xffd166) : 0x8a7aa8);
    }
  }
  g.circle(w * 0.87, h * 0.28, 4).fill(0xffd166);
  g.rect(w * 0.855, h * 0.28, 2.4, h * 0.2).fill(0xffd166);
  g.roundRect(w * 0.1, h * 0.76, w * 0.68, h * 0.12, 3).fill(0x1a102c);
  g.roundRect(w * 0.1, h * 0.6, w * 0.25, h * 0.1, 2).fill(0x120a1e);
}

function drawTable(g: Graphics, w: number, h: number, seats: number): void {
  g.circle(w / 2, h / 2, Math.min(w, h) * 0.34).fill(0x1d2a1a).stroke({ width: 2, color: 0x8a9a64, alpha: 0.6 });
  for (let seat = 0; seat < seats; seat += 1) {
    const angle = (seat / Math.max(1, seats)) * Math.PI * 2;
    g.circle(w / 2 + Math.cos(angle) * w * 0.42, h / 2 + Math.sin(angle) * h * 0.42, 4).fill(0x5a4a3a);
  }
  g.rect(w * 0.2, h * 0.48, w * 0.6, 2).fill(0x8a6a4a);
}

function drawBar(g: Graphics, w: number, h: number): void {
  g.roundRect(4, h * 0.2, w - 8, h * 0.42, 5).fill(0x5b2838);
  g.roundRect(8, h * 0.64, w - 16, h * 0.24, 4).fill(0x2c1420);
  for (let bottle = 0; bottle < 6; bottle += 1) {
    g.roundRect(10 + bottle * (w / 7), h * 0.26, 3, 10, 1)
      .fill([0x00ffcc, 0xff2e88, 0xffd166, 0xb06bff, 0xff8a3d, 0x00ffcc][bottle]!);
  }
}

function drawToilet(g: Graphics, w: number, h: number, seats: number): void {
  for (let stall = 0; stall < seats; stall += 1) {
    const x = 3 + stall * ((w - 6) / Math.max(1, seats));
    const cell = (w - 6) / Math.max(1, seats);
    g.roundRect(x, 3, cell - 2, h - 6, 3).fill(0x101c2a).stroke({ width: 1, color: 0x5a87a8, alpha: 0.5 });
    g.circle(x + cell / 2, h * 0.58, 4).fill(0xd8e8f0).stroke({ width: 1, color: 0x5a87a8 });
  }
}

function drawExchange(g: Graphics, w: number, h: number): void {
  g.roundRect(4, h * 0.45, w - 8, h * 0.32, 3).fill(0x6b4a22);
  g.rect(8, h * 0.4, w - 16, 2).fill(0xffd166);
  g.circle(w * 0.35, h * 0.77, 3).fill(0x00ffcc);
  for (let bar = 0; bar < 4; bar += 1) g.rect(10 + bar * 9, h * 0.12, 1, h * 0.24).fill({ color: 0xffd166, alpha: 0.3 });
}

function drawDecor(g: Graphics, w: number, h: number, label: string): void {
  if (label.toLowerCase().includes('sofa')) {
    g.roundRect(2, h * 0.22, w - 4, h * 0.56, 6).fill(0x4a2040);
    g.roundRect(4, h * 0.34, w - 8, h * 0.34, 4).fill(0x74305e);
    g.rect(w * 0.06, h * 0.76, 4, h * 0.16).fill(0x2a1424);
    g.rect(w * 0.9, h * 0.76, 4, h * 0.16).fill(0x2a1424);
    return;
  }
  g.circle(w * 0.5, h * 0.55, w * 0.35).fill(0x2dd4a0);
  g.circle(w * 0.35, h * 0.35, w * 0.22).fill(0x3f8a6a);
  g.rect(w * 0.43, h * 0.7, w * 0.14, h * 0.25).fill(0x5a3a2a);
}

export function createFurnitureArt(item: Furniture, tile: number): FurnitureArt {
  const root = new Container();
  const w = item.w * tile;
  const h = item.h * tile;
  const color = COLORS[item.kind] ?? 0x2a2034;
  const g = new Graphics();
  g.roundRect(0, 0, w, h, 6).fill(color).stroke({ width: 1, color: 0x6a4a86, alpha: 0.8 });
  g.roundRect(3, 3, w - 6, h - 6, 4).fill({ color: 0x09050f, alpha: 0.32 });
  if (item.kind === 'SLOT') drawSlot(g, w, h);
  else if (item.kind === 'TABLE') drawTable(g, w, h, item.seats);
  else if (item.kind === 'BAR') drawBar(g, w, h);
  else if (item.kind === 'TOILET') drawToilet(g, w, h, item.seats);
  else if (item.kind === 'EXCHANGE') drawExchange(g, w, h);
  else if (item.kind === 'DECOR') drawDecor(g, w, h, item.label);
  const status = new Graphics();
  const screen = new Text({
    text: item.kind === 'SLOT' ? 'BEREIT' : item.gameId ?? '',
    style: { fontFamily: 'ui-monospace, monospace', fontSize: 7, fill: 0xffd166, letterSpacing: 1 },
  });
  screen.anchor.set(0.5, 0.5);
  screen.position.set(w / 2, h * 0.68);
  const label = new Text({
    text: item.label,
    style: { fontFamily: 'ui-monospace, monospace', fontSize: 7, fill: 0xcdbfd9, stroke: { color: 0x07040d, width: 2 } },
  });
  label.anchor.set(0.5, 0);
  label.position.set(w / 2, h + 2);
  root.addChild(g, status, screen, label);

  return {
    root,
    screen,
    setResult: (value) => { screen.text = value.toUpperCase().slice(0, 11); },
    refresh: (next) => {
      label.text = next.label;
      status.clear();
      if (next.condition < 55) {
        status.rect(w * 0.22, h * 0.14, 2, h * 0.5).fill({ color: 0xff2e88, alpha: 0.7 });
        status.rect(w * 0.35, h * 0.28, 1.5, h * 0.22).fill({ color: 0xff2e88, alpha: 0.5 });
      }
      const seats = Math.min(6, next.seats);
      for (let seat = 0; seat < seats; seat += 1) {
        const occupied = next.occupants.length > seat;
        status.circle(6 + seat * 7, h - 6, 2.2).fill(occupied ? 0x00ffcc : 0x3a2a50);
      }
      for (let mod = 0; mod < next.mods.length; mod += 1) {
        status.circle(w - 6 - mod * 7, 6, 2.2).fill(0xb06bff);
      }
    },
  };
}
