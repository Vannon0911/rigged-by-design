/** Juice: Münzburst, aufsteigende Beträge, Screenshake. */
import { Container, Graphics, Text } from 'pixi.js';

interface Particle {
  readonly g: Graphics;
  vx: number;
  vy: number;
  life: number;
  readonly max: number;
}

interface Floating {
  readonly text: Text;
  life: number;
}

export class FxLayer {
  readonly container = new Container();
  readonly #particles: Particle[] = [];
  readonly #floats: Floating[] = [];
  #shake = 0;

  get shake(): number { return this.#shake; }

  burst(x: number, y: number, color: number, count = 14, intensity = 1): void {
    for (let index = 0; index < count; index += 1) {
      const g = new Graphics().circle(0, 0, 1.6 + Math.random() * 2).fill(color);
      g.position.set(x, y);
      this.container.addChild(g);
      const angle = Math.random() * Math.PI * 2;
      const speed = (1 + Math.random() * 3) * intensity;
      this.#particles.push({
        g,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.4,
        life: 1,
        max: 1,
      });
    }
    this.#shake = Math.min(6, this.#shake + 2 * intensity);
  }

  float(text: string, x: number, y: number, color: number): void {
    const label = new Text({
      text,
      style: { fontFamily: 'ui-monospace, monospace', fontSize: 13, fill: color, fontWeight: 'bold' },
    });
    label.anchor.set(0.5);
    label.position.set(x, y);
    this.container.addChild(label);
    this.#floats.push({ text: label, life: 1 });
  }

  update(delta: number): void {
    const step = Math.min(3, delta);
    for (let index = this.#particles.length - 1; index >= 0; index -= 1) {
      const particle = this.#particles[index]!;
      particle.life -= 0.02 * step;
      particle.vy += 0.09 * step;
      particle.g.x += particle.vx * step;
      particle.g.y += particle.vy * step;
      particle.g.alpha = Math.max(0, particle.life);
      if (particle.life <= 0) {
        particle.g.destroy();
        this.#particles.splice(index, 1);
      }
    }
    for (let index = this.#floats.length - 1; index >= 0; index -= 1) {
      const item = this.#floats[index]!;
      item.life -= 0.014 * step;
      item.text.y -= 0.8 * step;
      item.text.alpha = Math.max(0, item.life);
      if (item.life <= 0) {
        item.text.destroy();
        this.#floats.splice(index, 1);
      }
    }
    this.#shake = Math.max(0, this.#shake - 0.25 * step);
  }
}
