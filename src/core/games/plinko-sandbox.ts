/** Reihen-Ladder, Multi-Ball-Freischaltung und der Operator-Editor des Plinko-Bretts. */
import {
  MAX_POCKETS, MAX_ROWS, MIN_POCKETS, MIN_ROWS, SPECIAL_PEGS,
  type PegKind, type PegSpec, type PlinkoConfig, type PlinkoMode,
} from './plinko-board';

export type SandboxProgress = {
  /** Gesamtzahl gespielter Plinko-Wuerfe, unabhaengig von Gewinn oder Verlust. */
  readonly totalPlinkoDrops: number;
  /** Suchtfaktor des Casinos als eigene Content-Unlock-Ressource. */
  readonly addictionScore: number;
  readonly specialPegs: number;
  readonly regularGuest: boolean;
};
export type WidthProfileId = 'EVEN' | 'NARROW_CENTER' | 'WIDE_CENTER';
export type BoardEdit = {
  readonly rows: number;
  readonly pockets: number;
  readonly profile: WidthProfileId;
  readonly specialKind?: PegKind;
  readonly specialCount?: number;
  readonly mode?: PlinkoMode;
};

/** Die Leiter: jede Ladder-Reihe hat ihre eigene Waehrung, Reihe 8 bis 11. */
export const ROW_GATES: readonly { row: number; kind: 'DROPS' | 'ADDICTION'; needed: number; specialPegs: number }[] = [
  { row: 8, kind: 'DROPS', needed: 25, specialPegs: 0 },
  { row: 9, kind: 'DROPS', needed: 75, specialPegs: 0 },
  { row: 10, kind: 'DROPS', needed: 200, specialPegs: 3 },
  { row: 11, kind: 'ADDICTION', needed: 40, specialPegs: 0 },
];
export const WIDTH_PROFILES: readonly WidthProfileId[] = ['EVEN', 'NARROW_CENTER', 'WIDE_CENTER'];

/** Prueft EINE Reihe allein: der Suchtscore bleibt unabhaengig von den Wuerfen ein eigener Schlüssel. */
export function requirementMet(row: number, progress: SandboxProgress): boolean {
  const gate = ROW_GATES.find((entry) => entry.row === row);
  if (!gate) return row < MIN_ROWS;
  if (gate.kind === 'ADDICTION') return progress.addictionScore > gate.needed;
  return progress.totalPlinkoDrops >= gate.needed && progress.specialPegs >= gate.specialPegs;
}

/** Der Brettumfang: die Leiter waechst lueckenlos, jede Reihe setzt die vorherige voraus. */
export function unlockedRows(progress: SandboxProgress): number {
  let rows = MIN_ROWS;
  for (const gate of ROW_GATES) {
    if (!requirementMet(gate.row, progress)) break;
    rows = gate.row + 1;
  }
  return rows;
}

/** Zaehlt die verbauten Spezial-Pegs; ab drei wird Reihe 10 frei. */
export function countSpecialPegs(pegs: readonly PegSpec[]): number {
  return pegs.filter((peg) => SPECIAL_PEGS.includes(peg.kind)).length;
}

export function ballCount(mode: PlinkoMode): number {
  return mode === 'SINGLE' ? 1 : mode === 'TWIN' ? 2 : 3;
}

/** SINGLE immer, TWIN ab Reihe 8, TRIPLE nur als Stammgast-Bonus. */
export function modeUnlocked(mode: PlinkoMode, progress: SandboxProgress): boolean {
  if (mode === 'SINGLE') return true;
  if (mode === 'TWIN') return requirementMet(8, progress);
  return progress.regularGuest;
}

/** Relative Taschenbreiten je Profil, danach auf mittlere Breite normiert. */
function weightsFor(profile: WidthProfileId, pockets: number): number[] {
  const center = (pockets - 1) / 2;
  const raw = Array.from({ length: pockets }, (_, index) => {
    const edge = Math.abs(index - center) / (center || 1);
    return profile === 'NARROW_CENTER' ? 0.25 + 1.75 * edge : profile === 'WIDE_CENTER' ? 2 - 1.75 * edge : 1;
  });
  const mean = raw.reduce((sum, value) => sum + value, 0) / pockets;
  return raw.map((value) => value / mean);
}

/** Uebersetzt die Editor-Eingaben in ein gueltiges Brett; abgewiesene Eingaben werfen. */
export function editBoard(edit: BoardEdit): PlinkoConfig {
  if (!Number.isInteger(edit.rows) || edit.rows < MIN_ROWS || edit.rows > MAX_ROWS) {
    throw new Error(`Editor: Reihen ${edit.rows} liegen ausserhalb ${MIN_ROWS} bis ${MAX_ROWS}`);
  }
  if (!Number.isInteger(edit.pockets) || edit.pockets < MIN_POCKETS || edit.pockets > MAX_POCKETS) {
    throw new Error(`Editor: Taschen ${edit.pockets} liegen ausserhalb ${MIN_POCKETS} bis ${MAX_POCKETS}`);
  }
  if (!WIDTH_PROFILES.includes(edit.profile)) throw new Error(`Editor: unbekanntes Profil ${String(edit.profile)}`);
  const count = edit.specialCount ?? 0;
  const kind = edit.specialKind ?? 'NORMAL_PEG';
  if (!Number.isInteger(count) || count < 0 || count > 8 || (count > 0 && !SPECIAL_PEGS.includes(kind))) {
    throw new Error(`Editor: ${count} Spezial-Pegs der Art ${kind} sind nicht platzierbar`);
  }
  const pegs: PegSpec[] = [];
  for (let column = 0; column < count; column += 1) pegs.push({ row: 0, column, kind });
  return { rows: edit.rows, pockets: edit.pockets, weights: weightsFor(edit.profile, edit.pockets), pegs, mode: edit.mode ?? 'SINGLE' };
}
