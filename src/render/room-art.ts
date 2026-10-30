/** Boden, Zonen und Dreck: wenige Formen statt tausender Tiles, damit 90x90 fluessig bleibt. */
import type { Graphics } from 'pixi.js';
import type { Area } from '../core/sim/grid-zones';
import { CARPETS } from '../core/sim/types';
import type { GameView } from '../store/types';

/** Ein 30×30-Chunk: Teppich, Checker, Regionsgitter und die Zonenanteile darin. */
export function drawRegionFloor(g: Graphics, view: GameView, area: Area, tile: number): void {
  const carpet = CARPETS[view.carpet] ?? CARPETS.VIOLET;
  const ox = area.x * tile;
  const oy = area.y * tile;
  const px = area.w * tile;
  const py = area.h * tile;
  g.rect(ox, oy, px, py).fill(carpet.color);
  for (let y = area.y; y < area.y + area.h; y += 2) {
    for (let x = area.x; x < area.x + area.w; x += 2) {
      const odd = ((x + y) / 2) % 2 === 0;
      g.rect(x * tile, y * tile, tile * 2, tile * 2).fill({ color: odd ? 0xffffff : 0x000000, alpha: 0.025 });
    }
  }
  for (const zone of view.zones) {
    const ix = Math.max(zone.x, area.x);
    const iy = Math.max(zone.y, area.y);
    const ex = Math.min(zone.x + zone.w, area.x + area.w);
    const ey = Math.min(zone.y + zone.h, area.y + area.h);
    if (ex <= ix || ey <= iy) continue;
    g.roundRect(ix * tile + 3, iy * tile + 3, (ex - ix) * tile - 6, (ey - iy) * tile - 6, 10)
      .fill({ color: zone.color, alpha: 0.26 })
      .stroke({ width: 2, color: zone.color, alpha: 0.8 });
  }
  g.rect(ox, oy, 2, py).fill({ color: 0xffffff, alpha: 0.13 });
  g.rect(ox, oy, px, 2).fill({ color: 0xffffff, alpha: 0.13 });
  if (area.x === 0 && area.y === 0) g.rect(0, 0, view.size * tile, view.size * tile).stroke({ width: 7, color: 0x2a1a3a });
}

export function drawRegionDirt(g: Graphics, view: GameView, area: Area, tile: number): void {
  for (const index of view.dirtyTiles) {
    const x = index % view.size;
    const y = Math.floor(index / view.size);
    if (x < area.x || y < area.y || x >= area.x + area.w || y >= area.y + area.h) continue;
    const cx = x * tile + tile / 2;
    const cy = y * tile + tile / 2;
    g.ellipse(cx, cy, 7, 4).fill({ color: 0x6a4a2a, alpha: 0.75 });
    g.circle(cx + 5, cy - 3, 2.5).fill({ color: 0x3a2a1a, alpha: 0.8 });
    g.circle(cx - 4, cy + 2, 1.8).fill({ color: 0x3a2a1a, alpha: 0.6 });
  }
}

