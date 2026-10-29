/** Paper-Doll-Besucher fuer die Floor-Ansicht: Wallet, Sucht, Zocker-Augen und Zittern. */
import { Container, Graphics, Text } from 'pixi.js';
import { toVCString } from '../core/economy/vacoin';
import { visitorNetResult, type Visitor } from '../core/simulation/visitors';

const OUTFIT_COLORS = [0x6b5a44, 0x3f6f8f, 0x7a4fa0, 0xd4af37];
const SKIN = 0xd9a066;

export class VisitorLayer {
  readonly container = new Container();
  readonly #cell: number;
  readonly #sprites = new Map<number, Graphics>();
  readonly #wallets = new Map<number, Text>();
  readonly #nets = new Map<number, Text>();
  readonly #meters = new Map<number, Graphics>();
  readonly #spots = new Map<number, { x: number; y: number }>();
  readonly #visitors = new Map<number, Visitor>();
  #size = 8;

  constructor(cellSize: number) {
    this.#cell = cellSize;
  }

  update(visitors: readonly Visitor[], blocked: Set<number>, size = 8): void {
    if (size !== this.#size) {
      this.#size = size;
      this.#spots.clear();
    }
    const active = new Set<number>();
    for (const visitor of visitors) {
      active.add(visitor.id);
      this.#visitors.set(visitor.id, visitor);
      const spot = this.#spotFor(visitor, blocked, size);
      blocked.add(spot.y * size + spot.x);
      const sprite = this.#sprite(visitor.id);
      const wallet = this.#text(this.#wallets, visitor.id, 7, 0xffffff);
      const net = this.#text(this.#nets, visitor.id, 7, 0x8a97b0);
      const meter = this.#meter(visitor.id);
      sprite.clear();
      const cx = spot.x * this.#cell + this.#cell / 2;
      const cy = spot.y * this.#cell + this.#cell / 2;
      sprite.roundRect(cx - 6, cy - 1, 12, 14, 3).fill(OUTFIT_COLORS[visitor.outfitTier] ?? OUTFIT_COLORS[0]!);
      sprite.circle(cx, cy - 8, 5).fill(SKIN);
      const eye = visitor.addiction >= 75 ? 0xff3030 : 0xffffff;
      sprite.rect(cx - 3, cy - 9, 2, 2).fill(eye);
      sprite.rect(cx + 1, cy - 9, 2, 2).fill(eye);
      if (visitor.addiction >= 75) sprite.circle(cx, cy - 7, 8).stroke({ width: 1, color: 0xff3030, alpha: 0.6 });
      if (visitor.wallet <= 0) sprite.circle(cx, cy + 6, 10).stroke({ width: 1, color: 0xff4d6d, alpha: 0.5 });
      const result = visitorNetResult(visitor);
      wallet.text = `${toVCString(visitor.wallet).replace(' VC', '')} VC`;
      wallet.tint = visitor.wallet > 0 ? 0xffd166 : 0xff6b81;
      wallet.position.set(cx, cy - 29);
      net.text = `Σ${result > 0 ? '+' : ''}${toVCString(result).replace(' VC', '')}`;
      net.tint = result > 0 ? 0xff4d6d : result < 0 ? 0x4ade80 : 0x8a97b0;
      net.position.set(cx, cy + 15);
      meter.clear();
      meter.roundRect(cx - 12, cy - 21, 24, 3, 1.5).fill(0x141d30);
      meter.roundRect(cx - 12, cy - 21, 24 * (visitor.addiction / 100), 3, 1.5)
        .fill(visitor.addiction >= 75 ? 0xff4d6d : visitor.addiction >= 40 ? 0xffb547 : 0x4ade80);
    }

    for (const [id, sprite] of this.#sprites) {
      if (active.has(id)) continue;
      sprite.destroy(); this.#sprites.delete(id);
      this.#wallets.get(id)?.destroy(); this.#wallets.delete(id);
      this.#nets.get(id)?.destroy(); this.#nets.delete(id);
      this.#meters.get(id)?.destroy(); this.#meters.delete(id);
      this.#spots.delete(id); this.#visitors.delete(id);
    }
  }

  positionOf(id: number): { x: number; y: number } | null {
    const spot = this.#spots.get(id);
    return spot ? { x: spot.x * this.#cell + this.#cell / 2, y: spot.y * this.#cell + this.#cell / 2 } : null;
  }

  animate(now: number): void {
    for (const [id, sprite] of this.#sprites) {
      const visitor = this.#visitors.get(id);
      sprite.x = visitor?.addiction === 100 ? Math.sin(now / 42 + id) * 1.8 : 0;
    }
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }

  #sprite(id: number): Graphics {
    let sprite = this.#sprites.get(id);
    if (!sprite) {
      sprite = new Graphics();
      this.#sprites.set(id, sprite);
      this.container.addChild(sprite);
    }
    return sprite;
  }

  #text(map: Map<number, Text>, id: number, size: number, fill: number): Text {
    let text = map.get(id);
    if (!text) {
      text = new Text({
        text: '',
        style: { fontFamily: 'monospace', fontSize: size, fontWeight: 'bold', fill, align: 'center' },
      });
      text.anchor.set(0.5, 0);
      map.set(id, text);
      this.container.addChild(text);
    }
    return text;
  }

  #meter(id: number): Graphics {
    let meter = this.#meters.get(id);
    if (!meter) {
      meter = new Graphics();
      this.#meters.set(id, meter);
      this.container.addChild(meter);
    }
    return meter;
  }

  #spotFor(visitor: Visitor, blocked: Set<number>, size: number): { x: number; y: number } {
    const existing = this.#spots.get(visitor.id);
    if (existing && existing.x < size && existing.y < size) return existing;
    const taken = new Set([...this.#spots.values()].map((spot) => spot.y * size + spot.x));
    let chosen = { x: 0, y: size - 1 };
    const start = (visitor.id * 7 + 3) % (size * size);
    for (let step = 0; step < size * size; step += 1) {
      const index = (start + step) % (size * size);
      if (!blocked.has(index) && !taken.has(index)) {
        chosen = { x: index % size, y: Math.floor(index / size) };
        break;
      }
    }
    this.#spots.set(visitor.id, chosen);
    return chosen;
  }
}
