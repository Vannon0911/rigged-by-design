/** Paper-Doll-Besucher fuer die Floor-Mini-Ansicht: Sprites, Sitzplaetze, Sucht-Augen. */
import { Container, Graphics } from 'pixi.js';
import type { Visitor } from '../core/simulation/visitors';

const OUTFIT_COLORS = [0x6b5a44, 0x3f6f8f, 0x7a4fa0, 0xd4af37];
const SKIN = 0xd9a066;

export class VisitorLayer {
  readonly container = new Container();
  readonly #cell: number;
  readonly #sprites = new Map<number, Graphics>();
  readonly #spots = new Map<number, { x: number; y: number }>();

  constructor(cellSize: number) {
    this.#cell = cellSize;
  }

  update(visitors: readonly Visitor[], blocked: Set<number>): void {
    const active = new Set<number>();
    for (const visitor of visitors) {
      active.add(visitor.id);
      const spot = this.#spotFor(visitor, blocked);
      blocked.add(spot.y * 8 + spot.x);

      let sprite = this.#sprites.get(visitor.id);
      if (!sprite) {
        sprite = new Graphics();
        this.#sprites.set(visitor.id, sprite);
        this.container.addChild(sprite);
      }
      sprite.clear();

      const cx = spot.x * this.#cell + this.#cell / 2;
      const cy = spot.y * this.#cell + this.#cell / 2;
      sprite.roundRect(cx - 5, cy - 1, 10, 12, 3).fill(OUTFIT_COLORS[visitor.outfitTier] ?? OUTFIT_COLORS[0]!);
      sprite.circle(cx, cy - 7, 4.5).fill(SKIN);
      const eye = visitor.addiction >= 75 ? 0xff3030 : 0xffffff;
      sprite.rect(cx - 3, cy - 8, 2, 2).fill(eye);
      sprite.rect(cx + 1, cy - 8, 2, 2).fill(eye);
      if (visitor.addiction >= 75) {
        sprite.circle(cx, cy - 6, 7).stroke({ width: 1, color: 0xff3030, alpha: 0.5 });
      }
    }

    for (const [id, sprite] of this.#sprites) {
      if (active.has(id)) continue;
      sprite.destroy();
      this.#sprites.delete(id);
      this.#spots.delete(id);
    }
  }

  positionOf(id: number): { x: number; y: number } | null {
    const spot = this.#spots.get(id);
    if (!spot) return null;
    return { x: spot.x * this.#cell + this.#cell / 2, y: spot.y * this.#cell + this.#cell / 2 };
  }

  #spotFor(visitor: Visitor, blocked: Set<number>): { x: number; y: number } {
    const existing = this.#spots.get(visitor.id);
    if (existing) return existing;
    const taken = new Set([...this.#spots.values()].map((spot) => spot.y * 8 + spot.x));
    let chosen = { x: 0, y: 7 };
    const start = (visitor.id * 7 + 3) % 64;
    for (let step = 0; step < 64; step += 1) {
      const index = (start + step) % 64;
      if (!blocked.has(index) && !taken.has(index)) {
        chosen = { x: index % 8, y: Math.floor(index / 8) };
        break;
      }
    }
    this.#spots.set(visitor.id, chosen);
    return chosen;
  }
}
