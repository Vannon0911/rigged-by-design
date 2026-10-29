/** Automaten als Kabinett: Rahmen, Marquee, Walzenfenster, Hebel, Lämpchen. */
import { Container, Graphics } from 'pixi.js';
import type { MachineState } from '../core/machine/machine';
import { getReel } from '../core/offer/reels';
import { createSymbolTile } from './symbol-graphics';

const ACCENT: Record<string, number> = {
  SLOT_RUSTY: 0xff8a3d,
  SLOT_NEON: 0x00ffcc,
  SLOT_MIRROR: 0xff2e88,
};

export interface MachineSprite {
  readonly container: Container;
  readonly lamp: Graphics;
  readonly accent: number;
}

/** Baut das Kabinett einmal; Lampen werden vom Ticker gepulst. */
export function createMachineSprite(machine: MachineState, cell: number): MachineSprite {
  const accent = ACCENT[machine.catalogId] ?? 0x00ffcc;
  const container = new Container();
  const pad = Math.max(4, cell * 0.07);
  const w = cell - pad * 2;
  const h = cell - pad * 2;
  const bodyTop = h * 0.08;
  const bodyHeight = h * 0.92;

  const shadow = new Graphics();
  shadow.ellipse(w / 2, h * 0.99, w * 0.42, Math.max(2, h * 0.035)).fill({ color: 0x000000, alpha: 0.55 });
  container.addChild(shadow);

  const glow = new Graphics();
  glow.ellipse(w / 2, h * 0.6, w * 0.56, h * 0.46).fill({ color: accent, alpha: 0.055 });
  container.addChild(glow);

  const body = new Graphics();
  body.roundRect(0, bodyTop, w, bodyHeight, Math.max(4, w * 0.08))
    .fill(0x120c1d)
    .stroke({ width: Math.max(1, w * 0.018), color: accent, alpha: 0.85 });
  body.roundRect(0, bodyTop, w, h * 0.13, Math.max(3, w * 0.06)).fill({ color: accent, alpha: 0.16 });
  body.rect(w * 0.08, bodyTop + h * 0.15, w * 0.84, 1).fill({ color: accent, alpha: 0.5 });
  container.addChild(body);

  // Marquee mit drei Lämpchen.
  const marquee = new Graphics();
  marquee.roundRect(w * 0.1, bodyTop + h * 0.03, w * 0.8, h * 0.09, 3)
    .fill(0x08050e)
    .stroke({ width: 1, color: accent, alpha: 0.45 });
  for (let index = 0; index < 3; index += 1) {
    marquee.circle(w * 0.22 + index * w * 0.28, bodyTop + h * 0.075, Math.max(1.2, w * 0.017))
      .fill({ color: accent, alpha: 0.8 });
  }
  container.addChild(marquee);

  // Walzenfenster mit drei sichtbaren Reihen.
  const windowX = w * 0.09;
  const windowY = bodyTop + h * 0.2;
  const windowW = w * 0.82;
  const windowH = h * 0.5;
  const frame = new Graphics();
  frame.roundRect(windowX - 2, windowY - 2, windowW + 4, windowH + 4, 4)
    .fill(0x030208)
    .stroke({ width: 1.5, color: accent, alpha: 0.55 });
  frame.rect(windowX, windowY + windowH / 3, windowW, 1).fill({ color: 0xffffff, alpha: 0.06 });
  frame.rect(windowX, windowY + (windowH * 2) / 3, windowW, 1).fill({ color: 0xffffff, alpha: 0.06 });
  container.addChild(frame);

  const reels = machine.reels.slice(0, 6);
  const columns = Math.max(1, reels.length);
  const gap = Math.max(1, w * 0.015);
  const tile = Math.max(4, Math.min((windowW - gap * (columns - 1)) / columns, (windowH - gap * 2) / 3));
  const totalW = columns * tile + (columns - 1) * gap;
  const startX = windowX + (windowW - totalW) / 2;
  reels.forEach((reelId, index) => {
    const symbols = getReel(reelId).symbols;
    for (let row = 0; row < 3; row += 1) {
      const symbol = symbols[(row * 3 + index * 2) % symbols.length] ?? 'BLANK';
      const sprite = createSymbolTile(symbol, tile);
      sprite.position.set(startX + index * (tile + gap), windowY + row * (tile + gap));
      container.addChild(sprite);
    }
  });

  // Hebel rechts, Münzfach und Spin-Knopf unten.
  const lever = new Graphics();
  lever.moveTo(w - 1, bodyTop + h * 0.24)
    .lineTo(w + pad * 0.45, bodyTop + h * 0.14)
    .stroke({ width: Math.max(1.5, w * 0.02), color: 0x8a7aa8 });
  lever.circle(w + pad * 0.5, bodyTop + h * 0.12, Math.max(2, w * 0.035)).fill(0xffd166);
  container.addChild(lever);

  const tray = new Graphics();
  tray.roundRect(w * 0.18, bodyTop + h * 0.8, w * 0.64, h * 0.09, 3).fill(0x05030a);
  tray.circle(w * 0.28, bodyTop + h * 0.845, Math.max(1.4, w * 0.018)).fill(accent);
  tray.roundRect(w * 0.46, bodyTop + h * 0.82, w * 0.4, h * 0.035, 2).fill({ color: accent, alpha: 0.3 });
  container.addChild(tray);

  const lamp = new Graphics();
  lamp.circle(w * 0.9, bodyTop + h * 0.02, Math.max(1.6, w * 0.022)).fill(0xff4d4d);
  container.addChild(lamp);

  const title = new Graphics();
  title.rect(w * 0.12, bodyTop - 2, w * 0.76, 2).fill({ color: accent, alpha: 0.7 });
  container.addChild(title);

  container.position.set(0, 0);
  return { container, lamp, accent };
}

export function drawModPips(container: Container, machine: MachineState, cell: number): void {
  if (machine.mods.length === 0) return;
  const g = new Graphics();
  const w = cell * 0.86;
  machine.mods.forEach((_, index) => {
    g.circle(w - 10 - index * 7, cell * 0.1, 2.2).fill(0xffd166);
  });
  container.addChild(g);
}
