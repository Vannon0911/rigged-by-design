/** Gewinn-Text, Muenzpartikel und Screen-Shake fuer den Spielautomaten. */
import { Application, Container, Graphics, Text } from 'pixi.js';
import { toVCString, type VaCoinMicro } from '../core/economy/vacoin';

export class SlotPayoutFx {
  readonly #app: Application;
  readonly #layer: Container;
  readonly #x: number;
  readonly #y: number;
  #destroyed = false;

  constructor(app: Application, layer: Container, x: number, y: number) {
    this.#app = app;
    this.#layer = layer;
    this.#x = x;
    this.#y = y;
  }

  play(amount: VaCoinMicro): void {
    if (this.#destroyed) return;
    const label = new Text({
      text: `+${toVCString(amount)}!`,
      style: {
        fontFamily: 'monospace',
        fontSize: 22,
        fill: 0xffd166,
        fontWeight: 'bold',
        stroke: { color: 0x2a1700, width: 4 },
      },
    });
    label.anchor.set(0.5);
    label.position.set(this.#x, this.#y);
    this.#layer.addChild(label);

    const started = performance.now();
    const tick = (): void => {
      if (this.#destroyed) {
        this.#app.ticker.remove(tick);
        label.destroy();
        return;
      }
      const progress = Math.min(1, (performance.now() - started) / 1100);
      label.y -= 0.35;
      label.alpha = 1 - progress * progress;
      if (progress >= 1) {
        this.#app.ticker.remove(tick);
        label.destroy();
      }
    };
    this.#app.ticker.add(tick);
    this.#coins(amount);
  }

  shake(target: Container): void {
    if (this.#destroyed) return;
    const started = performance.now();
    const tick = (): void => {
      if (this.#destroyed) {
        this.#app.ticker.remove(tick);
        return;
      }
      const progress = Math.min(1, (performance.now() - started) / 320);
      const amplitude = 9 * (1 - progress);
      target.position.set((Math.random() - 0.5) * amplitude, (Math.random() - 0.5) * amplitude);
      if (progress >= 1) {
        this.#app.ticker.remove(tick);
        target.position.set(0, 0);
      }
    };
    this.#app.ticker.add(tick);
  }

  destroy(): void {
    this.#destroyed = true;
  }

  #coins(amount: VaCoinMicro): void {
    const count = Math.min(28, 12 + Math.floor(amount / 5_000));
    for (let index = 0; index < count; index += 1) {
      const coin = new Graphics().circle(0, 0, 4).fill(0xffcc00).stroke({ width: 1, color: 0xfff2a8 });
      coin.position.set(this.#x, this.#y);
      this.#layer.addChild(coin);
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 3.5;
      const vx = Math.cos(angle) * speed;
      let vy = Math.sin(angle) * speed - 3.5;
      let life = 0;

      const tick = (ticker: { deltaMS: number }): void => {
        if (this.#destroyed) {
          this.#app.ticker.remove(tick);
          coin.destroy();
          return;
        }
        const dt = ticker.deltaMS / 16.67;
        life += ticker.deltaMS;
        coin.x += vx * dt;
        coin.y += vy * dt;
        vy += 0.18 * dt;
        coin.alpha = Math.max(0, 1 - life / 900);
        coin.rotation += 0.15 * dt;
        if (life >= 900) {
          this.#app.ticker.remove(tick);
          coin.destroy();
        }
      };
      this.#app.ticker.add(tick);
    }
  }
}
