/** Prozedurale 64x64-Slot-Symbole im Neon-Arcade-Look. Keine externen Assets. */
import { Container, Graphics } from 'pixi.js';
import type { SlotSymbol } from '../core/slot/slot-types';

export const SYMBOL_TILE_SIZE = 64;

const C = {
  blank: 0x3a3545,
  blankEdge: 0x6f687f,
  cherry: 0xff0055,
  cherryGlow: 0xff6b9a,
  leaf: 0x35e08a,
  bell: 0xffcc00,
  bellGlow: 0xfff2a8,
  seven: 0xff2e88,
  sevenShadow: 0xff7a00,
  diamond: 0x00ffcc,
  diamondGlow: 0xbafff2,
} as const;

export function createSymbolTile(symbol: SlotSymbol, size = SYMBOL_TILE_SIZE): Container {
  const tile = new Container();
  const bg = new Graphics();
  bg.roundRect(1, 1, size - 2, size - 2, 8).fill(0x10101a);
  bg.roundRect(3.5, 3.5, size - 7, size - 7, 6).stroke({ width: 1, color: 0x2c2c3f, alpha: 0.9 });
  bg.rect(6, 6, size - 12, 2).fill({ color: 0xffffff, alpha: 0.05 });
  tile.addChild(bg);

  const art = new Graphics();
  art.scale.set(size / SYMBOL_TILE_SIZE);
  drawSymbol(art, symbol);
  tile.addChild(art);
  return tile;
}

function drawSymbol(g: Graphics, symbol: SlotSymbol): void {
  if (symbol === 'BLANK') return drawBlank(g);
  if (symbol === 'CHERRY') return drawCherry(g);
  if (symbol === 'BELL') return drawBell(g);
  if (symbol === 'SEVEN') return drawSeven(g);
  return drawDiamond(g);
}

function drawBlank(g: Graphics): void {
  const cross = [26, 10, 38, 10, 38, 26, 54, 26, 54, 38, 38, 38, 38, 54, 26, 54, 26, 38, 10, 38, 10, 26, 26, 26];
  g.poly(cross).fill(C.blank);
  g.poly(cross).stroke({ width: 2, color: C.blankEdge, alpha: 0.8 });
  for (const [x, y] of [[16, 16], [48, 16], [16, 48], [48, 48], [32, 32]] as const) {
    g.circle(x, y, 2.4).fill({ color: 0x1a1722, alpha: 0.9 });
  }
}

function drawCherry(g: Graphics): void {
  g.moveTo(26, 42).quadraticCurveTo(28, 20, 44, 16).stroke({ width: 3, color: C.leaf });
  g.moveTo(40, 40).quadraticCurveTo(40, 22, 44, 16).stroke({ width: 3, color: C.leaf });
  g.ellipse(49, 14, 7, 4).fill(C.leaf);

  g.circle(22, 44, 11).fill(C.cherry);
  g.circle(42, 42, 11).fill(C.cherry);
  g.circle(22, 44, 13).stroke({ width: 2, color: C.cherryGlow, alpha: 0.5 });
  g.circle(42, 42, 13).stroke({ width: 2, color: C.cherryGlow, alpha: 0.5 });
  g.circle(18, 40, 3).fill({ color: 0xffffff, alpha: 0.85 });
  g.circle(38, 38, 2.4).fill({ color: 0xffffff, alpha: 0.65 });
}

function drawBell(g: Graphics): void {
  const bell = [16, 40, 22, 22, 32, 12, 42, 22, 48, 40];
  g.poly(bell).fill(C.bell);
  g.roundRect(14, 40, 36, 6, 3).fill(C.bell);
  g.circle(32, 50, 4.5).fill(C.bellGlow);
  g.poly(bell).stroke({ width: 2, color: C.bellGlow, alpha: 0.9 });
  g.roundRect(26, 18, 12, 4, 2).fill({ color: 0xfff6cc, alpha: 0.85 });
  g.rect(18, 34, 28, 3).fill({ color: 0xb8860b, alpha: 0.6 });
  g.circle(32, 26, 16).stroke({ width: 2, color: C.bell, alpha: 0.2 });
}

function drawSeven(g: Graphics): void {
  const seven = [18, 12, 50, 12, 50, 24, 34, 54, 22, 54, 38, 24, 18, 24];
  const shifted = (dx: number, dy: number): number[] => seven.map((value, index) => value + (index % 2 === 0 ? dx : dy));
  g.poly(shifted(5, 5)).fill(C.sevenShadow);
  g.poly(shifted(2, 2)).fill(0x7a0f3d);
  g.poly(seven).fill(C.seven);
  g.poly(seven).stroke({ width: 2, color: 0xffb3d9, alpha: 0.85 });
  g.poly([18, 12, 50, 12, 50, 17, 18, 17]).fill({ color: 0xfff0f6, alpha: 0.25 });
}

function drawDiamond(g: Graphics): void {
  g.poly([32, 8, 54, 32, 32, 56, 10, 32]).fill(C.diamond);
  g.poly([32, 16, 46, 32, 32, 48, 18, 32]).fill(0x0a5f55);
  g.poly([32, 16, 46, 32, 32, 48, 18, 32]).stroke({ width: 1.5, color: C.diamondGlow, alpha: 0.95 });
  g.moveTo(32, 8).lineTo(32, 56).stroke({ width: 1, color: 0xffffff, alpha: 0.25 });
  g.moveTo(10, 32).lineTo(54, 32).stroke({ width: 1, color: 0xffffff, alpha: 0.25 });
  g.circle(32, 32, 26).stroke({ width: 2, color: C.diamond, alpha: 0.2 });

  const sparkle = (x: number, y: number, radius: number): void => {
    g.poly([
      x, y - radius,
      x + radius * 0.3, y - radius * 0.3,
      x + radius, y,
      x + radius * 0.3, y + radius * 0.3,
      x, y + radius,
      x - radius * 0.3, y + radius * 0.3,
      x - radius, y,
      x - radius * 0.3, y - radius * 0.3,
    ]).fill({ color: 0xffffff, alpha: 0.9 });
  };
  sparkle(12, 12, 4);
  sparkle(52, 12, 3);
  sparkle(12, 52, 3);
  sparkle(52, 52, 4);
}
