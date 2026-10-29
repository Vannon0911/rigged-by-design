/** Deko als prozedurale Objekte: Teppich, Neon, Fusel-Spender, Samtvorhang. */
import { Container, Graphics } from 'pixi.js';
import type { ItemId } from '../core/offer/catalog';

const ACCENT: Record<string, number> = {
  DECO_CARPET: 0xff2e88,
  DECO_NEON_SIGN: 0x00ffcc,
  DECO_BOOZE: 0xffd166,
  DECO_VELVET: 0xb06bff,
};

export function createDecorSprite(catalogId: ItemId, cell: number): Container {
  const container = new Container();
  const pad = Math.max(4, cell * 0.07);
  const size = cell - pad * 2;
  const accent = ACCENT[catalogId] ?? 0x00ffcc;
  if (catalogId === 'DECO_CARPET') drawCarpet(container, size, accent);
  else if (catalogId === 'DECO_NEON_SIGN') drawNeonSign(container, size, accent);
  else if (catalogId === 'DECO_BOOZE') drawBooze(container, size, accent);
  else drawVelvet(container, size, accent);
  return container;
}

function drawCarpet(container: Container, size: number, accent: number): void {
  const g = new Graphics();
  g.roundRect(0, 0, size, size, 10).fill(0x3a0d24).stroke({ width: 2, color: accent, alpha: 0.55 });
  g.roundRect(8, 8, size - 16, size - 16, 6).stroke({ width: 1, color: 0xffd166, alpha: 0.28 });
  g.poly([size / 2, 16, size - 16, size / 2, size / 2, size - 16, 16, size / 2])
    .stroke({ width: 1, color: 0xffd166, alpha: 0.22 });
  for (let stripe = 0; stripe < 4; stripe += 1) {
    g.rect(14 + stripe * (size - 28) / 4, 4, 3, 4).fill({ color: 0xffd166, alpha: 0.3 });
    g.rect(14 + stripe * (size - 28) / 4, size - 8, 3, 4).fill({ color: 0xffd166, alpha: 0.3 });
  }
  container.addChild(g);
}

function drawNeonSign(container: Container, size: number, accent: number): void {
  const g = new Graphics();
  g.ellipse(size / 2, size * 0.88, size * 0.34, size * 0.08).fill({ color: accent, alpha: 0.12 });
  g.rect(size * 0.46, size * 0.48, size * 0.08, size * 0.38).fill(0x241733);
  g.roundRect(size * 0.08, size * 0.12, size * 0.84, size * 0.42, 6)
    .fill(0x08050e)
    .stroke({ width: 2, color: accent, alpha: 0.8 });
  g.roundRect(size * 0.16, size * 0.2, size * 0.3, size * 0.08, 2).fill({ color: accent, alpha: 0.9 });
  g.roundRect(size * 0.52, size * 0.2, size * 0.24, size * 0.08, 2).fill({ color: 0xff2e88, alpha: 0.9 });
  g.roundRect(size * 0.16, size * 0.34, size * 0.6, size * 0.06, 2).fill({ color: 0xffd166, alpha: 0.55 });
  g.roundRect(size * 0.2, size * 0.86, size * 0.6, size * 0.05, 2).fill({ color: 0x241733 });
  container.addChild(g);
}

function drawBooze(container: Container, size: number, accent: number): void {
  const g = new Graphics();
  g.ellipse(size / 2, size * 0.9, size * 0.36, size * 0.06).fill({ color: 0x000000, alpha: 0.4 });
  g.roundRect(size * 0.12, size * 0.34, size * 0.76, size * 0.48, 5).fill(0x24102c).stroke({ width: 1, color: 0x4a2148 });
  g.rect(size * 0.18, size * 0.62, size * 0.64, size * 0.03).fill({ color: 0xffd166, alpha: 0.25 });
  const colors = [0x00ffcc, 0xff2e88, 0xffd166, 0xb06bff];
  colors.forEach((color, index) => {
    const x = size * (0.2 + index * 0.15);
    g.roundRect(x, size * 0.42, size * 0.08, size * 0.16, 2).fill({ color, alpha: 0.8 });
    g.rect(x + size * 0.025, size * 0.36, size * 0.03, size * 0.06).fill({ color, alpha: 0.55 });
  });
  g.circle(size * 0.24, size * 0.87, size * 0.06).fill(accent).stroke({ width: 1, color: 0x1a1020 });
  g.circle(size * 0.76, size * 0.87, size * 0.06).fill(accent).stroke({ width: 1, color: 0x1a1020 });
  container.addChild(g);
}

function drawVelvet(container: Container, size: number, accent: number): void {
  const g = new Graphics();
  g.roundRect(size * 0.1, size * 0.08, size * 0.8, size * 0.82, 6).fill(0x1c0a26);
  for (let fold = 0; fold < 5; fold += 1) {
    const x = size * (0.16 + fold * 0.16);
    g.roundRect(x, size * 0.12, size * 0.09, size * 0.7, 4).fill({ color: accent, alpha: 0.18 + fold * 0.03 });
    g.rect(x + size * 0.035, size * 0.12, 1, size * 0.7).fill({ color: 0xffffff, alpha: 0.05 });
  }
  g.roundRect(size * 0.06, size * 0.06, size * 0.88, size * 0.08, 3).fill(0x2a1430);
  g.roundRect(size * 0.12, size * 0.72, size * 0.76, size * 0.04, 2).fill({ color: 0xffd166, alpha: 0.35 });
  g.circle(size * 0.14, size * 0.74, size * 0.05).fill(0xffd166);
  g.circle(size * 0.86, size * 0.74, size * 0.05).fill(0xffd166);
  container.addChild(g);
}
