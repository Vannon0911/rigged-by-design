/** Plinko als echte Simulation: Zufall nur in den Startbedingungen, danach entscheidet die Kollision. */
import { ballBody, staticBody, type Body } from '../physics/body';
import { PhysicsWorld } from '../physics/world';
import type { Prng } from '../rng/prng';

const WIDTH = 100;
const FLOOR_Y = 120;
const PEG_RADIUS = 1.8;
const BALL_RADIUS = 2.2;
const ROW_GAP = 11;
const LAST_ROW_Y = 103;
const TOP_GAP = 18;
const MAX_STEPS = 1_600;
const MAX_BALLS = 7;
const SPLIT_KICK = 1.6;
const COLUMNS = 8;

export const PLINKO_POCKETS = 9;
export const MIN_POCKETS = 5;
export const MAX_POCKETS = 13;
/** Die Basis-Reihen 0 bis 7; Ladder-Reihen 8 bis 11 wachsen nach oben daran. */
export const MIN_ROWS = 8;
export const MAX_ROWS = 12;

export type PegKind = 'NORMAL_PEG' | 'BOUNCY_PEG' | 'STICKY_PEG' | 'MAGNET_PEG' | 'SPLIT_PEG';
export type PlinkoMode = 'SINGLE' | 'TWIN' | 'TRIPLE';
export type PlinkoConfig = {
  readonly rows: number;
  readonly pockets: number;
  readonly weights: readonly number[];
  readonly pegs: readonly PegSpec[];
  readonly mode: PlinkoMode;
};
export type PegSpec = { readonly row: number; readonly column: number; readonly kind: PegKind };
export type PlinkoDrop = { readonly pockets: readonly number[]; readonly pocket: number; readonly steps: number };
type PlinkoBoard = { readonly config: PlinkoConfig; drop(prng: Prng): PlinkoDrop };

/** Die Fuenf: pro Typ eigene Restitution, Reibung und optionale Magnetkraft. */
export const PEG_PHYSICS: Readonly<Record<PegKind, { restitution: number; friction: number; magnet: number }>> = {
  NORMAL_PEG: { restitution: 0.55, friction: 0.15, magnet: 0 },
  BOUNCY_PEG: { restitution: 0.85, friction: 0.15, magnet: 0 },
  STICKY_PEG: { restitution: 0.2, friction: 0.8, magnet: 0 },
  MAGNET_PEG: { restitution: 0.55, friction: 0.15, magnet: 1 },
  SPLIT_PEG: { restitution: 0.55, friction: 0.15, magnet: 0 },
};
export const PEG_KINDS = Object.keys(PEG_PHYSICS) as readonly PegKind[];
export const SPECIAL_PEGS: readonly PegKind[] = ['BOUNCY_PEG', 'STICKY_PEG', 'MAGNET_PEG', 'SPLIT_PEG'];
const DEFAULT_PLINKO: PlinkoConfig = { rows: 8, pockets: 9, weights: Array(9).fill(1), pegs: [], mode: 'SINGLE' };

/** Startversatz der Baelle je Modus; die Mitte liegt immer auf der Brettachse. */
export function startOffsets(mode: PlinkoMode): readonly number[] {
  return mode === 'TWIN' ? [-2, 2] : mode === 'TRIPLE' ? [0, -8, 8] : [0];
}

/** Wie viele Pegs ein Brett mit `rows` Reihen traegt (versetztes Gitter, 8 Spalten). */
export function pegCount(rows: number): number {
  let count = 0;
  for (let row = 0; row < rows; row += 1) {
    const offset = row % 2 === 0 ? 0 : 5.5;
    for (let column = 0; column < COLUMNS; column += 1) if (10 + offset + column * 11 <= WIDTH - 6) count += 1;
  }
  return count;
}

function assertConfig(config: PlinkoConfig): void {
  if (!Number.isInteger(config.rows) || config.rows < MIN_ROWS || config.rows > MAX_ROWS) {
    throw new Error(`Plinko: Reihen ${config.rows} liegen ausserhalb ${MIN_ROWS} bis ${MAX_ROWS}`);
  }
  if (!Number.isInteger(config.pockets) || config.pockets < MIN_POCKETS || config.pockets > MAX_POCKETS) {
    throw new Error(`Plinko: Taschen ${config.pockets} liegen ausserhalb ${MIN_POCKETS} bis ${MAX_POCKETS}`);
  }
  if (config.weights.length !== config.pockets || config.weights.some((weight) => !(weight > 0))) {
    throw new Error('Plinko: jede Tasche braucht eine positive Breite');
  }
  for (const spec of config.pegs) {
    if (spec.row < 0 || spec.row >= config.rows || spec.column < 0 || spec.column >= COLUMNS || !PEG_KINDS.includes(spec.kind)) {
      throw new Error(`Plinko: ungueltiger Peg ${spec.row}:${spec.column} ${spec.kind}`);
    }
  }
  if (config.mode !== 'SINGLE' && config.mode !== 'TWIN' && config.mode !== 'TRIPLE') {
    throw new Error(`Plinko: unbekannter Modus ${String(config.mode)}`);
  }
}

/** Kanten der Taschen aus ihren relativen Breiten; Summe = Brettbreite. */
function pocketEdges(config: PlinkoConfig): readonly number[] {
  const total = config.weights.reduce((sum, weight) => sum + weight, 0);
  const edges: number[] = [];
  let cursor = 0;
  for (const weight of config.weights) {
    cursor += (weight / total) * WIDTH;
    edges.push(cursor);
  }
  return edges;
}

/**
 * Baut das komplette Brett frisch: Reihen waechsen nach oben, der Boden bleibt
 * liegen, dadurch laengerer Fallweg pro freigeschalteter Reihe.
 */
function build(config: PlinkoConfig, splits: { x: number; y: number }[]): PhysicsWorld {
  const world = new PhysicsWorld({ gravity: { x: 0, y: 620 }, fixedDt: 1 / 120, maxSteps: 4 });
  const top = LAST_ROW_Y - (config.rows - 1) * ROW_GAP - TOP_GAP;
  world.add(staticBody({ kind: 'segment', ax: 4, ay: top, bx: 4, by: FLOOR_Y }, { restitution: 0.2, friction: 0.2 }));
  world.add(staticBody({ kind: 'segment', ax: WIDTH - 4, ay: top, bx: WIDTH - 4, by: FLOOR_Y }, { restitution: 0.2, friction: 0.2 }));
  const special = new Map(config.pegs.map((spec) => [spec.row * COLUMNS + spec.column, spec.kind]));
  for (let row = 0; row < config.rows; row += 1) {
    const y = LAST_ROW_Y - (config.rows - 1 - row) * ROW_GAP;
    const offset = row % 2 === 0 ? 0 : 5.5;
    for (let column = 0; column < COLUMNS; column += 1) {
      const x = 10 + offset + column * 11;
      if (x > WIDTH - 6) continue;
      const kind = special.get(row * COLUMNS + column) ?? 'NORMAL_PEG';
      const spec = PEG_PHYSICS[kind];
      world.add(staticBody({ kind: 'circle', radius: PEG_RADIUS }, {
        position: { x, y }, restitution: spec.restitution, friction: spec.friction, magnet: spec.magnet,
        bouncy: kind === 'BOUNCY_PEG' || (kind !== 'STICKY_PEG' && row % 3 === 0),
      }));
      if (kind === 'SPLIT_PEG') splits.push({ x, y });
    }
  }
  world.add(staticBody({ kind: 'circle', radius: 3.4 }, { position: { x: 12, y: 108 }, restitution: 0.7, bouncy: true }));
  world.add(staticBody({ kind: 'circle', radius: 3.4 }, { position: { x: WIDTH - 12, y: 108 }, restitution: 0.7, bouncy: true }));
  return world;
}

interface Flyer { readonly body: Body; readonly done: Set<number> }

function spawn(world: PhysicsWorld, config: PlinkoConfig, prng: Prng): Flyer[] {
  const jitter = prng.nextFloat() - 0.5;
  const kick = (prng.nextFloat() - 0.5) * 26;
  return startOffsets(config.mode).map((offset) => ({
    done: new Set<number>(),
    body: world.add(ballBody(BALL_RADIUS, {
      position: { x: WIDTH / 2 + jitter * 3 + offset, y: LAST_ROW_Y - (config.rows - 1) * ROW_GAP - TOP_GAP },
      velocity: { x: kick + offset * 0.6, y: 0 }, restitution: 0.5, friction: 0.2, mass: 1,
    })),
  }));
}

/** Klone an einem Split-Peg: zwei Geister mit versetztem Lateral-Impuls, Ergebnisse addieren sich. */
function split(world: PhysicsWorld, flyers: Flyer[], index: number, peg: number): void {
  const source = flyers[index]!;
  source.done.add(peg);
  const origin = source.body;
  for (const kick of [SPLIT_KICK, -SPLIT_KICK]) {
    if (flyers.length >= MAX_BALLS) return;
    flyers.push({
      done: new Set(source.done),
      body: world.add(ballBody(BALL_RADIUS, {
        position: { x: origin.position.x, y: origin.position.y },
        velocity: { x: origin.velocity.x + kick, y: origin.velocity.y },
        restitution: 0.5, friction: 0.2, mass: 1,
      })),
    });
  }
}

/** Ein Board: pro Wurf wird die Welt neu gebaut, damit Geisterbaelle nicht ueberleben. */
export function createPlinkoBoard(config: PlinkoConfig = DEFAULT_PLINKO): PlinkoBoard {
  assertConfig(config);
  const edges = pocketEdges(config);
  return {
    config,
    drop(prng: Prng): PlinkoDrop {
      const splits: { x: number; y: number }[] = [];
      const world = build(config, splits);
      const flyers = spawn(world, config, prng);
      let steps = 0;
      while (steps < MAX_STEPS && flyers.some((flyer) => flyer.body.position.y < FLOOR_Y)) {
        world.step(1 / 60);
        steps += 1;
        for (let index = 0; index < flyers.length && flyers.length < MAX_BALLS; index += 1) {
          const flyer = flyers[index]!;
          for (let peg = 0; peg < splits.length; peg += 1) {
            if (flyer.done.has(peg)) continue;
            const dx = flyer.body.position.x - splits[peg]!.x;
            const dy = flyer.body.position.y - splits[peg]!.y;
            const reach = PEG_RADIUS + BALL_RADIUS;
            if (dx * dx + dy * dy <= reach * reach) split(world, flyers, index, peg);
          }
        }
      }
      const pockets = flyers.map((flyer) => Math.max(0, Math.min(config.pockets - 1, edges.findIndex((edge) => flyer.body.position.x <= edge))));
      return { pockets, pocket: pockets[0] ?? 0, steps };
    },
  };
}
