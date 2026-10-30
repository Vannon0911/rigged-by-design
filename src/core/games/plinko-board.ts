/** Plinko als echte Simulation: Zufall nur in den Startbedingungen, danach entscheidet die Kollision. */
import { ballBody, staticBody } from '../physics/body';
import { PhysicsWorld } from '../physics/world';
import type { Prng } from '../rng/prng';

const WIDTH = 100;
const TOP = 8;
const FLOOR_Y = 120;
const ROWS = 8;
const PEG_RADIUS = 1.8;
const BALL_RADIUS = 2.2;
export const PLINKO_POCKETS = 9;
const POCKET_WIDTH = WIDTH / PLINKO_POCKETS;
const MAX_STEPS = 1_600;

interface PlinkoDrop {
  readonly pocket: number;
  readonly steps: number;
}

interface PlinkoBoard {
  drop(prng: Prng): PlinkoDrop;
}

/** Ein Board: alle Hindernisse statisch, nur der Ball wird pro Wurf zurueckgesetzt. */
export function createPlinkoBoard(): PlinkoBoard {
  const world = new PhysicsWorld({ gravity: { x: 0, y: 620 }, fixedDt: 1 / 120, maxSteps: 4 });
  const half = WIDTH / 2;
  world.add(staticBody({ kind: 'segment', ax: 4, ay: TOP, bx: 4, by: FLOOR_Y }, { restitution: 0.2, friction: 0.2 }));
  world.add(staticBody({ kind: 'segment', ax: WIDTH - 4, ay: TOP, bx: WIDTH - 4, by: FLOOR_Y }, { restitution: 0.2, friction: 0.2 }));
  // Versetztes Gitter ueber die ganze Breite: der Ball kann nicht an den Pegs vorbei rutschen.
  for (let row = 0; row < ROWS; row += 1) {
    const y = 26 + row * 11;
    const offset = row % 2 === 0 ? 0 : 5.5;
    for (let column = 0; column < 8; column += 1) {
      const x = 10 + offset + column * 11;
      if (x > WIDTH - 6) continue;
      world.add(staticBody(
        { kind: 'circle', radius: PEG_RADIUS },
        { position: { x, y }, restitution: 0.55, friction: 0.15, bouncy: row % 3 === 0 },
      ));
    }
  }
  // Zwei Deflektoren ueber den Randfaechern halten den Ball im Feld.
  world.add(staticBody({ kind: 'circle', radius: 3.4 }, { position: { x: 12, y: 108 }, restitution: 0.7, bouncy: true }));
  world.add(staticBody({ kind: 'circle', radius: 3.4 }, { position: { x: WIDTH - 12, y: 108 }, restitution: 0.7, bouncy: true }));
  const ball = world.add(ballBody(BALL_RADIUS, {
    position: { x: half, y: TOP },
    restitution: 0.5,
    friction: 0.2,
    mass: 1,
  }));

  return {
    drop(prng: Prng): PlinkoDrop {
      // Startbedingung ist das einzige Zufaellige; ab hier rechnet nur die Physik.
      ball.position = { x: half + (prng.nextFloat() - 0.5) * 3, y: TOP };
      ball.velocity = { x: (prng.nextFloat() - 0.5) * 26, y: 0 };
      ball.rotation = 0;
      ball.angularVelocity = 0;
      let steps = 0;
      while (ball.position.y < FLOOR_Y && steps < MAX_STEPS) {
        world.step(1 / 60);
        steps += 1;
      }
      const raw = Math.floor(ball.position.x / POCKET_WIDTH);
      return { pocket: Math.max(0, Math.min(PLINKO_POCKETS - 1, raw)), steps };
    },
  };
}
