// @loc-exception: Kombinierter PixiJS-Tisch-Renderer fuer Becher-Shuffle und Wuerfelwurf.
import { Application, Container, Graphics, Text } from 'pixi.js';
import { toVCString } from '../../core/economy/vacoin';
import type { DiceFace, DiceRound } from '../../core/games/dice/dice-engine';
import type { ShellRound } from '../../core/games/shell/shell-engine';

const WIDTH = 440;
const HEIGHT = 620;
const CUP_Y = 186;
const DICE_Y = 452;
const CUP_X = [62, 140, 218, 296, 374];

function diceX(index: number, count: number): number {
  return WIDTH / 2 + (index - (count - 1) / 2) * 76;
}

const PIP: Readonly<Record<DiceFace, readonly (readonly [number, number])[]>> = {
  1: [[0, 0]],
  2: [[-8, -8], [8, 8]],
  3: [[-8, -8], [0, 0], [8, 8]],
  4: [[-8, -8], [8, -8], [-8, 8], [8, 8]],
  5: [[-8, -8], [8, -8], [0, 0], [-8, 8], [8, 8]],
  6: [[-8, -8], [8, -8], [-8, 0], [8, 0], [-8, 8], [8, 8]],
};

export class ShellAndDiceView {
  readonly app: Application;
  readonly #cups: Container[] = [];
  readonly #balls: Graphics[] = [];
  readonly #dice: Container[] = [];
  readonly #faces: Graphics[] = [];
  readonly #shadows: Graphics[] = [];
  readonly #shellStatus: Text;
  readonly #diceStatus: Text;
  #destroyed = false;

  private constructor(app: Application) {
    this.app = app;
    this.#drawTables();
    this.#shellStatus = new Text({
      text: 'BECHER BEREIT',
      style: { fontFamily: 'monospace', fontSize: 12, fill: 0xffd166, letterSpacing: 1 },
    });
    this.#shellStatus.anchor.set(0.5);
    this.#shellStatus.position.set(WIDTH / 2, 228);
    this.#diceStatus = new Text({
      text: 'WÜRFEL BEREIT',
      style: { fontFamily: 'monospace', fontSize: 12, fill: 0x00ffcc, letterSpacing: 1 },
    });
    this.#diceStatus.anchor.set(0.5);
    this.#diceStatus.position.set(WIDTH / 2, 586);
    app.stage.addChild(this.#shellStatus, this.#diceStatus);
    this.#buildCups();
    this.#buildDice();
  }

  static async create(host: HTMLElement): Promise<ShellAndDiceView> {
    const app = new Application();
    await app.init({
      background: '#05070d',
      width: WIDTH,
      height: HEIGHT,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
    });
    host.appendChild(app.canvas);
    return new ShellAndDiceView(app);
  }

  async showShell(round: ShellRound): Promise<void> {
    const cups = Math.min(5, Math.max(3, round.cups));
    const offset = Math.floor((5 - cups) / 2);
    this.#cups.forEach((cup, index) => {
      cup.visible = index < cups;
      cup.position.set(CUP_X[index + offset]!, CUP_Y);
      cup.rotation = 0;
      this.#balls[index]!.visible = false;
    });
    this.#shellStatus.text = 'MISCHEN...';
    const starts = this.#cups.slice(0, cups).map((cup) => cup.x);
    await this.#animate(760, (progress) => {
      for (let index = 0; index < cups; index += 1) {
        const cup = this.#cups[index]!;
        const wave = Math.sin(Math.PI * progress * 4 + index * 1.4);
        cup.x = starts[index]! + (index % 2 === 0 ? 1 : -1) * wave * 22;
        cup.rotation = wave * 0.08;
      }
    });
    this.#cups.forEach((cup, index) => {
      cup.x = CUP_X[index + offset]!;
      cup.rotation = 0;
    });

    await Promise.all(round.picked.map(async (index) => {
      const cup = this.#cups[index];
      if (!cup) return;
      await this.#animate(280, (progress) => {
        cup.y = CUP_Y - 34 * (1 - Math.pow(1 - progress, 2));
      });
      this.#balls[index]!.visible = round.winning.includes(index);
    }));
    this.#shellStatus.text = round.hit
      ? `TREFFER +${toVCString(round.payout)}`
      : 'DANEBEN · KUGEL WEG';
  }

  async showDice(round: DiceRound): Promise<void> {
    const count = round.dice.length;
    this.#dice.forEach((die, index) => {
      die.visible = index < count;
      die.position.set(diceX(index, count), DICE_Y);
      die.rotation = 0;
      die.scale.set(1);
      const shadow = this.#shadows[index];
      if (shadow) {
        shadow.visible = index < count;
        shadow.position.set(diceX(index, count), DICE_Y + 27);
      }
    });
    this.#diceStatus.text = 'WÜRFEL FLIEGEN...';
    await this.#animate(700, (progress) => {
      round.dice.forEach((_, index) => {
        const die = this.#dice[index];
        if (!die) return;
        die.x = diceX(index, count) + Math.sin(progress * Math.PI * 3 + index) * 10;
        die.y = DICE_Y - Math.sin(Math.PI * progress) * 92;
        die.rotation = (1 - progress) * Math.PI * 3 + index * 0.3;
        die.scale.set(1 + Math.sin(Math.PI * progress) * 0.18);
      });
    });
    round.dice.forEach((face, index) => {
      const die = this.#dice[index];
      if (!die) return;
      die.position.set(diceX(index, count), DICE_Y);
      die.rotation = 0;
      die.scale.set(1);
      this.#drawFace(this.#faces[index]!, face);
    });
    const devil = round.devil === 'SKULL'
      ? ' · TEUFEL: TOTENKOPF'
      : round.devil === 'GOLD' ? ' · TEUFEL: GOLD x3' : '';
    this.#diceStatus.text = `SUMME ${round.sum} · ${round.win ? `+${toVCString(round.payout)}` : 'VERLOREN'}${devil}`;
  }

  destroy(): void {
    this.#destroyed = true;
    this.app.destroy(true, { children: true });
  }

  #drawTables(): void {
    const bg = new Graphics().roundRect(0, 0, WIDTH, HEIGHT, 16).fill(0x070a11)
      .stroke({ width: 1, color: 0x1e2636 });
    const shell = new Graphics().roundRect(16, 42, 408, 206, 12).fill(0x160c12)
      .stroke({ width: 2, color: 0xff2e88, alpha: 0.7 }).roundRect(24, 50, 392, 190, 8).fill(0x241019);
    const dice = new Graphics().roundRect(16, 286, 408, 320, 12).fill(0x071b12)
      .stroke({ width: 2, color: 0x00ffcc, alpha: 0.7 }).roundRect(24, 294, 392, 288, 8).fill(0x0d3a25)
      .rect(60, 500, 320, 2).fill({ color: 0xffd166, alpha: 0.45 })
      .circle(WIDTH / 2, 458, 150).stroke({ width: 1, color: 0x00ffcc, alpha: 0.15 });
    const shellTitle = new Text({
      text: 'HÜTCHENSPIEL',
      style: { fontFamily: 'monospace', fontSize: 14, fill: 0xff2e88, fontWeight: 'bold', letterSpacing: 3 },
    });
    shellTitle.position.set(30, 18);
    const diceTitle = new Text({
      text: 'STREET CRAPS',
      style: { fontFamily: 'monospace', fontSize: 14, fill: 0x00ffcc, fontWeight: 'bold', letterSpacing: 3 },
    });
    diceTitle.position.set(30, 298);
    this.app.stage.addChild(bg, shell, dice, shellTitle, diceTitle);
  }

  #buildCups(): void {
    for (let index = 0; index < 5; index += 1) {
      const cup = new Container();
      const body = new Graphics()
        .poly([-28, 22, 28, 22, 20, -22, -20, -22]).fill(0x2a1b12)
        .stroke({ width: 2, color: 0xd4a24a, alpha: 0.9 })
        .roundRect(-21, -27, 42, 7, 3).fill(0x4a2f1c);
      const ball = new Graphics().circle(0, 15, 5).fill(0xffd166)
        .stroke({ width: 1, color: 0xfff2a8 });
      ball.visible = false;
      cup.addChild(body, ball);
      cup.position.set(CUP_X[index]!, CUP_Y);
      cup.visible = index < 3;
      this.#cups.push(cup);
      this.#balls.push(ball);
      this.app.stage.addChild(cup);
    }
  }

  #buildDice(): void {
    for (let index = 0; index < 4; index += 1) {
      const shadow = new Graphics().ellipse(0, 0, 20, 6).fill({ color: 0x000000, alpha: 0.32 });
      shadow.position.set(diceX(index, 4), DICE_Y + 27);
      shadow.visible = index < 2;
      this.#shadows.push(shadow);
      this.app.stage.addChild(shadow);
      const die = new Container();
      const face = new Graphics();
      die.addChild(face);
      die.position.set(diceX(index, 4), DICE_Y);
      die.visible = index < 2;
      this.#dice.push(die);
      this.#faces.push(face);
      this.#drawFace(face, 1);
      this.app.stage.addChild(die);
    }
  }

  #drawFace(g: Graphics, face: DiceFace): void {
    g.clear();
    g.roundRect(-22, -22, 44, 44, 8).fill(0xf2ead8)
      .stroke({ width: 2, color: 0xffd166, alpha: 0.9 });
    g.roundRect(-18, -18, 36, 10, 4).fill({ color: 0xffffff, alpha: 0.25 });
    for (const [x, y] of PIP[face]) g.circle(x, y, 3.6).fill(0x16121c);
  }

  #animate(duration: number, frame: (progress: number) => void): Promise<void> {
    return new Promise((resolve) => {
      const started = performance.now();
      const tick = (): void => {
        if (this.#destroyed) {
          this.app.ticker.remove(tick);
          resolve();
          return;
        }
        const progress = Math.min(1, (performance.now() - started) / duration);
        frame(progress);
        if (progress < 1) return;
        this.app.ticker.remove(tick);
        resolve();
      };
      this.app.ticker.add(tick);
    });
  }
}
