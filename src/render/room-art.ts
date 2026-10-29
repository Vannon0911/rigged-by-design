/** Boden, Zonen und Dreck: wenige Formen statt tausender Tiles, damit 90x90 fluessig bleibt. */
import type { Graphics, Text } from 'pixi.js';
import { CARPETS, REGION } from '../core/sim/types';
import type { GameView } from '../store/types';

export function drawFloor(g: Graphics, view: GameView, tile: number): void {
  const px = view.size * tile;
  const carpet = CARPETS[view.carpet] ?? CARPETS.VIOLET;
  g.clear();
  g.rect(0, 0, px, px).fill(carpet.color);
  for (let y = 0; y < view.size; y += 2) {
    for (let x = 0; x < view.size; x += 2) {
      const odd = ((x + y) / 2) % 2 === 0;
      g.rect(x * tile, y * tile, tile * 2, tile * 2).fill({ color: odd ? 0xffffff : 0x000000, alpha: 0.025 });
    }
  }
  for (let step = 0; step <= view.size; step += REGION) {
    g.rect(step * tile, 0, 2, px).fill({ color: 0xffffff, alpha: 0.05 });
    g.rect(0, step * tile, px, 2).fill({ color: 0xffffff, alpha: 0.05 });
  }
  for (const zone of view.zones) {
    g.roundRect(zone.x * tile + 3, zone.y * tile + 3, zone.w * tile - 6, zone.h * tile - 6, 10)
      .fill({ color: zone.color, alpha: 0.26 })
      .stroke({ width: 2, color: zone.color, alpha: 0.8 });
    g.roundRect(zone.x * tile + 9, zone.y * tile + 9, zone.w * tile - 18, zone.h * tile - 18, 7)
      .stroke({ width: 1, color: 0xffffff, alpha: 0.1 });
  }
  g.rect(0, 0, px, px).stroke({ width: 7, color: 0x2a1a3a });
  g.rect(tile, tile, px - tile * 2, px - tile * 2).stroke({ width: 1, color: 0xffffff, alpha: 0.08 });
}

export function drawDirt(g: Graphics, view: GameView, tile: number): void {
  g.clear();
  for (const index of view.dirtyTiles) {
    const x = (index % view.size) * tile + tile / 2;
    const y = Math.floor(index / view.size) * tile + tile / 2;
    g.ellipse(x, y, 7, 4).fill({ color: 0x6a4a2a, alpha: 0.75 });
    g.circle(x + 5, y - 3, 2.5).fill({ color: 0x3a2a1a, alpha: 0.8 });
    g.circle(x - 4, y + 2, 1.8).fill({ color: 0x3a2a1a, alpha: 0.6 });
  }
}

export function drawZoneLabels(labels: Text[], view: GameView, tile: number): void {
  view.zones.forEach((zone, index) => {
    const label = labels[index] ?? labels[0]!;
    label.text = zone.name.toUpperCase();
    label.position.set(zone.x * tile + 12, zone.y * tile + 10);
    label.visible = true;
  });
  for (let index = view.zones.length; index < labels.length; index += 1) labels[index]!.visible = false;
}
