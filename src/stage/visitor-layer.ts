/** Gäste auf dem Floor: Figur, Geduldsbalken, Suchtpunkt, Warteschlange. */
import { Container, Graphics } from 'pixi.js';
import { getPersona } from '../core/visitors/persona';
import type { Visitor } from '../core/visitors/visitor';
import { FLOOR_TOP, FLOOR_WIDTH } from './room-art';

interface VisitorSprite {
  readonly root: Container;
  readonly bars: Graphics;
  x: number;
  y: number;
  phase: number;
}

export class VisitorLayer {
  readonly container = new Container();
  readonly #sprites = new Map<number, VisitorSprite>();
  #ox = 0;
  #oy = 0;
  #cell = 64;

  setLayout(ox: number, oy: number, cell: number): void {
    this.#ox = ox;
    this.#oy = oy;
    this.#cell = cell;
  }

  update(visitors: readonly Visitor[], machineCell: (id: number) => { x: number; y: number } | null): void {
    const alive = new Set(visitors.map((visitor) => visitor.id));
    for (const [id, sprite] of this.#sprites) {
      if (!alive.has(id)) {
        sprite.root.destroy({ children: true });
        this.#sprites.delete(id);
      }
    }

    const groups = new Map<number, Visitor[]>();
    const waiting = visitors.filter((visitor) => visitor.pendingPayout > 0 && visitor.patience <= 0);
    for (const visitor of visitors) {
      if (waiting.includes(visitor)) continue;
      const group = groups.get(visitor.target) ?? [];
      group.push(visitor);
      groups.set(visitor.target, group);
    }

    for (const visitor of visitors) {
      const sprite = this.#sprites.get(visitor.id) ?? this.#create(visitor);
      const cell = machineCell(visitor.target);
      let targetX: number;
      let targetY: number;
      if (waiting.includes(visitor)) {
        // Wer an der Kasse wartet, steht in der Schlange vor der Kasse.
        const queueIndex = waiting.findIndex((entry) => entry.id === visitor.id);
        targetX = FLOOR_WIDTH - 170 + (queueIndex % 4) * 36;
        targetY = FLOOR_TOP + 198 + Math.floor(queueIndex / 4) * 26;
      } else if (cell) {
        const group = groups.get(visitor.target) ?? [visitor];
        const index = group.findIndex((entry) => entry.id === visitor.id);
        const count = Math.max(1, group.length);
        const step = Math.min(this.#cell * 0.2, 18);
        targetX = this.#ox + cell.x * this.#cell + this.#cell / 2 + (index - (count - 1) / 2) * step;
        targetY = this.#oy + cell.y * this.#cell + this.#cell * 0.93;
      } else {
        targetX = this.#ox - 18 + (visitor.id % 3) * 9;
        targetY = this.#oy + this.#cell * 0.55;
      }
      sprite.x += (targetX - sprite.x) * 0.18;
      sprite.y += (targetY - sprite.y) * 0.18;
      this.#drawBars(sprite, visitor);
    }
  }

  animate(now: number): void {
    for (const sprite of this.#sprites.values()) {
      sprite.root.position.set(sprite.x, sprite.y + Math.sin(now / 320 + sprite.phase) * 2);
    }
  }

  #create(visitor: Visitor): VisitorSprite {
    const persona = getPersona(visitor.persona);
    const root = new Container();
    const body = new Graphics();
    body.ellipse(0, 13, 9, 3).fill({ color: 0x000000, alpha: 0.4 });
    body.roundRect(-4, 6, 3, 8, 1).fill(0x2a1c3a);
    body.roundRect(1, 6, 3, 8, 1).fill(0x2a1c3a);
    body.circle(0, -15, 5.5).fill(0xe6c3a0);
    if (visitor.persona === 'BUSINESS' || visitor.persona === 'HIGH_ROLLER') {
      body.roundRect(-6, -21, 12, 3, 1).fill(0x1a1020);
      body.rect(-3, -20, 6, 2).fill(persona.color);
    } else if (visitor.persona === 'STAMMGAST') {
      body.circle(0, -21, 4).fill(0x3a2440);
    } else {
      body.roundRect(-5, -21, 10, 3, 2).fill(0x2a1c3a);
    }
    body.roundRect(-6, -11, 12, 15, 4).fill(persona.color);
    body.roundRect(-8, -8, 3, 10, 2).fill(persona.color);
    body.roundRect(5, -8, 3, 10, 2).fill(persona.color);
    body.circle(-2, -16, 0.8).fill(0x1a1020);
    body.circle(2, -16, 0.8).fill(0x1a1020);
    if (visitor.persona === 'LUMPEN') {
      body.circle(6, -7, 3).fill({ color: 0x1a1020, alpha: 0.55 });
    }
    const bars = new Graphics();
    root.addChild(body, bars);
    this.container.addChild(root);
    const sprite: VisitorSprite = {
      root,
      bars,
      x: this.#ox - 18,
      y: this.#oy + this.#cell * 0.55,
      phase: visitor.id * 1.7,
    };
    this.#sprites.set(visitor.id, sprite);
    return sprite;
  }

  #drawBars(sprite: VisitorSprite, visitor: Visitor): void {
    const g = sprite.bars;
    g.clear();
    const patience = Math.max(0, Math.min(100, visitor.patience));
    const color = patience > 60 ? 0x00ffcc : patience > 25 ? 0xffd166 : 0xff2e88;
    g.roundRect(-10, -30, 20, 3, 1).fill(0x1a1024);
    g.roundRect(-10, -30, (20 * patience) / 100, 3, 1).fill(color);
    g.circle(10, -34, 2).fill({ color: 0xff2e88, alpha: 0.2 + (visitor.addiction / 100) * 0.8 });
    if (visitor.pendingPayout > 0) {
      if (visitor.patience <= 0) g.circle(-13, -37, 6.5).stroke({ width: 1, color: 0xffd166, alpha: 0.55 });
      g.circle(-13, -37, 4.5).fill(0xffd166).stroke({ width: 1, color: 0x1a1020 });
      g.rect(-14, -39, 2, 3).fill(0x1a1020);
      g.circle(-13, -34.5, 0.9).fill(0x1a1020);
    }
  }
}
