/**
 * @test-target: src/core/games/plinko-sandbox.ts
 * @error-code: ERR-1003
 *
 * Physik-Sandbox-Beweis: fuenf Peg-Typen, Reihen-Ladder 8-11, 3er-Multi-Ball und das
 * 85-%-RTP-Gate. Jede Forderung ist eine numerische Invariante, nichts nur existenziell.
 */
import { describe, expect, it } from 'vitest';
import { ballBody, staticBody } from '../../physics/body';
import { PhysicsWorld } from '../../physics/world';
import { Prng } from '../../rng/prng';
import {
  MAX_POCKETS, MAX_ROWS, MIN_POCKETS, MIN_ROWS, PEG_KINDS, PEG_PHYSICS, SPECIAL_PEGS,
  createPlinkoBoard, pegCount, startOffsets, type PegKind, type PlinkoConfig,
} from '../plinko-board';
import { HOUSE_RTP_CAP, MIN_MEASURED_RTP, NOMINAL_RTP, boardGate, measureRTP, pocketPaytable } from '../plinko-rtp';
import {
  ROW_GATES, WIDTH_PROFILES, ballCount, countSpecialPegs, editBoard, modeUnlocked, requirementMet,
  unlockedRows, type SandboxProgress, type WidthProfileId,
} from '../plinko-sandbox';

type Probe = { restitution: number; friction: number; magnet: number };
type Point = { x: number; y: number };
const uniform = (pockets: number): number[] => Array.from({ length: pockets }, () => 1);
const board = (over: Partial<PlinkoConfig> = {}): PlinkoConfig => ({ rows: 8, pockets: 9, weights: uniform(9), pegs: [], mode: 'SINGLE', ...over });
const progress = (over: Partial<SandboxProgress> = {}): SandboxProgress => ({ totalPlinkoDrops: 0, addictionScore: 0, specialPegs: 0, regularGuest: false, ...over });
const everyPeg = (rows: number, kind: PegKind): PlinkoConfig['pegs'] =>
  Array.from({ length: rows }, (_, row) => Array.from({ length: 8 }, (_, column) => ({ row, column, kind }))).flat();
const start: Point = { x: 0, y: -14 }; const side: Point = { x: 0, y: 0 };

/** Eine Kugel am einzelnen Peg: hoechster Punkt nach Kontakt, Rest-x und Rest-Seitentempo. */
function probe(spec: Probe, position: Point, velocity: Point, stopY: number, watchContact: boolean) {
  const world = new PhysicsWorld({ gravity: { x: 0, y: 620 }, fixedDt: 1 / 120, maxSteps: 8 });
  world.add(staticBody({ kind: 'circle', radius: 1.8 }, { position: side, restitution: spec.restitution, friction: spec.friction, magnet: spec.magnet }));
  const ball = world.add(ballBody(2.2, { position, velocity, restitution: 0.5, friction: 0.2, mass: 1 }));
  let touched = false; let apex = 0;
  for (let step = 0; step < 900 && ball.position.y < stopY; step += 1) {
    world.step(1 / 60);
    if (watchContact && Math.hypot(ball.position.x, ball.position.y) <= 4 + 1e-9) touched = true;
    if (touched) apex = Math.min(apex, ball.position.y);
  }
  return { apex, x: ball.position.x, vx: ball.velocity.x };
}

describe('Plinko-Sandbox: fuenf physikalische Peg-Typen', () => {
  it('definiert genau fuenf Typen mit den spezifizierten Parametern', () => {
    expect(PEG_KINDS).toEqual(['NORMAL_PEG', 'BOUNCY_PEG', 'STICKY_PEG', 'MAGNET_PEG', 'SPLIT_PEG']);
    expect(SPECIAL_PEGS).toEqual(['BOUNCY_PEG', 'STICKY_PEG', 'MAGNET_PEG', 'SPLIT_PEG']);
    expect(PEG_PHYSICS.NORMAL_PEG).toEqual({ restitution: 0.55, friction: 0.15, magnet: 0 });
    expect(PEG_PHYSICS.BOUNCY_PEG.restitution).toBe(0.85);
    expect(PEG_PHYSICS.STICKY_PEG.restitution).toBe(0.2); expect(PEG_PHYSICS.STICKY_PEG.friction).toBe(0.8);
    expect(PEG_PHYSICS.MAGNET_PEG.magnet).toBeGreaterThan(0);
    expect(PEG_PHYSICS.SPLIT_PEG.magnet).toBe(0);
    expect(SPECIAL_PEGS.includes('NORMAL_PEG')).toBe(false);
  });

  it('BOUNCY springt hoeher und STICKY klebt haerter als NORMAL', () => {
    const high = probe(PEG_PHYSICS.BOUNCY_PEG, start, side, 60, true).apex;
    const mid = probe(PEG_PHYSICS.NORMAL_PEG, start, side, 60, true).apex;
    const low = probe(PEG_PHYSICS.STICKY_PEG, start, side, 60, true).apex;
    expect(high).toBeLessThan(mid);
    expect(mid).toBeLessThan(low);
  });

  it('MAGNET zieht einen vorbeifallenden Ball messbar zum Peg-Mittelpunkt', () => {
    const free = probe(PEG_PHYSICS.NORMAL_PEG, { x: -5, y: 0 }, { x: 0, y: 60 }, 4, false);
    const drawn = probe(PEG_PHYSICS.MAGNET_PEG, { x: -5, y: 0 }, { x: 0, y: 60 }, 4, false);
    expect(free.x).toBe(-5);
    expect(drawn.x).toBeGreaterThan(free.x);
  });

  it('STICKY frisst das Seitentempo staerker auf als NORMAL', () => {
    const from = { x: -3, y: -16 };
    const sticky = Math.abs(probe(PEG_PHYSICS.STICKY_PEG, from, side, 10, false).vx);
    const loose = Math.abs(probe(PEG_PHYSICS.NORMAL_PEG, from, side, 10, false).vx);
    expect(sticky).toBeLessThan(loose);
  });

  it('SPLIT_PEG vervielfaeltigt den Wurf und die Taschen zahlen sich additiv', () => {
    const splitBoard = board({ rows: 12, pegs: everyPeg(12, 'SPLIT_PEG') });
    const split = createPlinkoBoard(splitBoard).drop(new Prng(5));
    const table = pocketPaytable(board());
    const total = split.pockets.reduce((sum, pocket) => sum + (table[pocket] ?? 0), 0);
    const plain = createPlinkoBoard(board()).drop(new Prng(5));
    expect(split.pockets.length).toBeGreaterThan(plain.pockets.length);
    expect(plain.pockets.length).toBe(1);
    expect(total).toBe(split.pockets.length * 9_000);
    expect(total).toBeGreaterThan(table[plain.pockets[0] ?? 0] ?? 0);
    expect(createPlinkoBoard(splitBoard).drop(new Prng(5))).toEqual(split);
  });
});

describe('Plinko-Sandbox: Reihen-Ladder 8 bis 11', () => {
  it('setzt jede Freischaltung auf genau die spezifizierte Schwelle', () => {
    expect(ROW_GATES.map((gate) => [gate.row, gate.kind, gate.needed, gate.specialPegs])).toEqual([
      [8, 'DROPS', 25, 0], [9, 'DROPS', 75, 0], [10, 'DROPS', 200, 3], [11, 'ADDICTION', 40, 0],
    ]);
    expect([MIN_ROWS, MAX_ROWS]).toEqual([8, 12]);
    const drops = (count: number, over: Partial<SandboxProgress> = {}) => unlockedRows(progress({ totalPlinkoDrops: count, ...over }));
    expect(drops(0)).toBe(8); expect(drops(24)).toBe(8); expect(drops(25)).toBe(9);
    expect(drops(74)).toBe(9); expect(drops(75)).toBe(10); expect(drops(200)).toBe(10);
    expect(drops(200, { specialPegs: 2 })).toBe(10); expect(drops(200, { specialPegs: 3 })).toBe(11);
    expect(drops(500, { specialPegs: 3, addictionScore: 40 })).toBe(11);
    expect(drops(500, { specialPegs: 3, addictionScore: 41 })).toBe(12); expect(drops(999, { addictionScore: 41 })).toBe(10);
    expect(requirementMet(11, progress({ addictionScore: 41 }))).toBe(true);
    expect(requirementMet(11, progress({ addictionScore: 40 }))).toBe(false);
    expect(requirementMet(10, progress({ totalPlinkoDrops: 200, specialPegs: 3 }))).toBe(true);
    expect(requirementMet(10, progress({ totalPlinkoDrops: 200, specialPegs: 2 }))).toBe(false);
    expect(requirementMet(10, progress({ totalPlinkoDrops: 199, specialPegs: 9 }))).toBe(false);
    expect(countSpecialPegs([{ row: 0, column: 0, kind: 'MAGNET_PEG' }, { row: 0, column: 1, kind: 'NORMAL_PEG' }])).toBe(1);
    expect(countSpecialPegs(everyPeg(12, 'SPLIT_PEG'))).toBeGreaterThan(3);
  });

  it('laengert Fallweg und Peg-Zaehler pro Reihe und weist 13 Reihen zurueck', () => {
    expect(pegCount(8)).toBe(64);
    expect(pegCount(12)).toBeGreaterThan(pegCount(8));
    const short = createPlinkoBoard(board()).drop(new Prng(21));
    const long = createPlinkoBoard(board({ rows: 12, pegs: everyPeg(12, 'NORMAL_PEG') })).drop(new Prng(21));
    expect(long.steps).toBeGreaterThan(short.steps);
    expect(() => createPlinkoBoard(board({ rows: 13 }))).toThrow();
    expect(countSpecialPegs([])).toBe(0);
  });
});

describe('Plinko-Sandbox: Multi-Ball', () => {
  it('schaltet SINGLE frei, TWIN ab Reihe 8 und TRIPLE nur fuer Stammgaeste', () => {
    expect([ballCount('SINGLE'), ballCount('TWIN'), ballCount('TRIPLE')]).toEqual([1, 2, 3]);
    expect(modeUnlocked('SINGLE', progress())).toBe(true); expect(modeUnlocked('TWIN', progress())).toBe(false);
    expect(modeUnlocked('TWIN', progress({ totalPlinkoDrops: 24 }))).toBe(false);
    expect(modeUnlocked('TWIN', progress({ totalPlinkoDrops: 25 }))).toBe(true);
    expect(modeUnlocked('TRIPLE', progress({ totalPlinkoDrops: 500 }))).toBe(false);
    expect(modeUnlocked('TRIPLE', progress({ totalPlinkoDrops: 500, regularGuest: true }))).toBe(true);
    expect(startOffsets('SINGLE')).toEqual([0]); expect(startOffsets('TWIN')).toEqual([-2, 2]);
    expect(startOffsets('TRIPLE')).toEqual([0, -8, 8]);
  });

  it('laesst alle Trajektionen unabhaengig fallen und addiert ihre Ergebnisse', () => {
    for (const mode of ['SINGLE', 'TWIN', 'TRIPLE'] as const) {
      const config = board({ mode });
      const first = createPlinkoBoard(config).drop(new Prng(42));
      const table = pocketPaytable(config);
      const paid = first.pockets.map((pocket) => table[pocket] ?? 0);
      expect(createPlinkoBoard(config).drop(new Prng(42))).toEqual(first);
      expect(first.pockets.length).toBe(ballCount(mode));
      expect(first.pocket).toBe(first.pockets[0]);
      expect(paid.reduce((sum, value) => sum + value, 0)).toBe(paid.length * 9_000);
    }
    const triple = createPlinkoBoard(board({ mode: 'TRIPLE' })).drop(new Prng(42));
    const table = pocketPaytable(board());
    const added = triple.pockets.reduce((sum, pocket) => sum + (table[pocket] ?? 0), 0);
    expect(added).toBe(3 * 9_000);
    expect(added).toBeGreaterThan(Math.max(...triple.pockets.map((pocket) => table[pocket] ?? 0)));
    let divergent = 0;
    for (let seed = 1; seed <= 30; seed += 1) {
      if (new Set(createPlinkoBoard(board({ mode: 'TRIPLE' })).drop(new Prng(seed)).pockets).size > 1) divergent += 1;
    }
    expect(divergent).toBeGreaterThan(0);
  });
});

describe('Plinko-Sandbox: Board-Editor mit RTP-Gate', () => {
  const edit = (profile: WidthProfileId) => editBoard({ rows: 8, pockets: 9, profile, specialKind: 'NORMAL_PEG', specialCount: 0 });

  it('baut Taschenbreiten je Profil und weist 5 bis 13 Taschen zu', () => {
    expect(WIDTH_PROFILES).toEqual(['EVEN', 'NARROW_CENTER', 'WIDE_CENTER']);
    expect([MIN_POCKETS, MAX_POCKETS]).toEqual([5, 13]);
    const even = edit('EVEN').weights; const narrow = edit('NARROW_CENTER').weights; const wide = edit('WIDE_CENTER').weights;
    expect(narrow[4] ?? 0).toBeLessThan(even[4] ?? 0); expect(wide[4] ?? 0).toBeGreaterThan(even[4] ?? 0);
    expect(wide[0] ?? 0).toBeLessThan(even[0] ?? 0);
    expect(narrow.reduce((sum, value) => sum + value, 0)).toBeCloseTo(wide.reduce((sum, value) => sum + value, 0), 6);
    expect(() => editBoard({ rows: 8, pockets: 4, profile: 'EVEN' })).toThrow(); expect(() => editBoard({ rows: 8, pockets: 14, profile: 'EVEN' })).toThrow();
    expect(() => editBoard({ rows: 13, pockets: 9, profile: 'EVEN' })).toThrow();
    expect(boardGate(board({ pockets: 4, weights: uniform(4) }), 10).reason).toContain('5 bis 13');
    const magnets = editBoard({ rows: 8, pockets: 9, profile: 'EVEN', specialKind: 'MAGNET_PEG', specialCount: 3 });
    expect(countSpecialPegs(magnets.pegs)).toBe(3);
    expect(measureRTP(edit('EVEN'), 60)).toBe(measureRTP(edit('EVEN'), 60));
  });

  it('laesst ein ehrliches 90-Prozent-Brett durch das Gate', () => {
    const config = edit('EVEN');
    const measured = measureRTP(config, 400);
    const gate = boardGate(config, 400);
    expect(measured).toBeCloseTo(NOMINAL_RTP, 3);
    expect(measured).toBe(measureRTP(config, 400));
    expect(gate.ok).toBe(true); expect(gate.measuredRTP).toBe(measured);
    expect(gate.measuredRTP).toBeGreaterThanOrEqual(MIN_MEASURED_RTP);
    expect(gate.measuredRTP).toBeLessThanOrEqual(HOUSE_RTP_CAP);
    expect(gate.reason).toContain('85'); expect(pocketPaytable(config)[4]).toBe(9_000);
  });

  it('blockiert eine schmale Mitte ueber dem Deckel und eine breite Mitte darunter', () => {
    const greedy = boardGate(edit('NARROW_CENTER'), 400);
    expect(greedy.ok).toBe(false); expect(greedy.measuredRTP).toBeGreaterThan(HOUSE_RTP_CAP);
    expect(greedy.reason).toContain('98');
    const stingy = boardGate(edit('WIDE_CENTER'), 400);
    expect(stingy.ok).toBe(false); expect(stingy.measuredRTP).toBeLessThan(MIN_MEASURED_RTP);
    expect(stingy.reason).toContain('85');
  });
});
