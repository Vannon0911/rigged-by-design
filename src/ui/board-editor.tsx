/** Board-Werkbank: der Betreiber baut Taschen, Breiten und Spezial-Pegs, das Physik-Gate misst den RTP. */
import { useState } from 'react';
import {
  MAX_POCKETS, MAX_ROWS, MIN_POCKETS, MIN_ROWS, SPECIAL_PEGS, pegCount,
} from '../core/games/plinko-board';
import { boardGate, type GateResult } from '../core/games/plinko-rtp';
import {
  WIDTH_PROFILES, ballCount, editBoard, type BoardEdit, type WidthProfileId,
} from '../core/games/plinko-sandbox';

const PROFILE_LABEL: Readonly<Record<WidthProfileId, string>> = {
  EVEN: 'gleich breit', NARROW_CENTER: 'schmale Mitte', WIDE_CENTER: 'breite Mitte',
};
const range = (from: number, to: number): number[] => Array.from({ length: to - from + 1 }, (_, index) => from + index);
const kindLabel = (value: string): string => value.replace('_PEG', '').toLowerCase();

type PickerProps<T extends number | string> = {
  readonly label: string;
  readonly values: readonly T[];
  readonly active: T;
  readonly onPick: (value: T) => void;
  readonly format?: (value: T) => string;
};

function Picker<T extends number | string>({ label, values, active, onPick, format }: PickerProps<T>) {
  return (
    <>
      <p className="hint">{label}</p>
      <div className="row-actions">
        {values.map((value) => (
          <button key={String(value)} type="button" className={`btn tiny${value === active ? ' primary' : ''}`} onClick={() => onPick(value)}>
            {format ? format(value) : String(value)}
          </button>
        ))}
      </div>
    </>
  );
}

export function BoardEditor() {
  const [edit, setEdit] = useState<BoardEdit>({
    rows: MIN_ROWS, pockets: 9, profile: 'EVEN', specialKind: SPECIAL_PEGS[0], specialCount: 0,
  });
  const [gate, setGate] = useState<GateResult | null>(null);
  const change = (patch: Partial<BoardEdit>): void => {
    setEdit((value) => ({ ...value, ...patch }));
    setGate(null);
  };
  const measure = (): void => setGate(boardGate(editBoard(edit), 250));
  return (
    <>
      <h3>Plinko-Board bauen</h3>
      <p className="hint">
        {pegCount(edit.rows)} Pegs auf {edit.rows} Reihen, {edit.pockets} Taschen, {ballCount(edit.mode ?? 'SINGLE')} Bälle je Wurf.
        Das Physik-Gate misst den RTP einer deterministischen Stichprobe und blockiert alles ausserhalb von 85 bis 98 Prozent.
      </p>
      <Picker label="REIHEN" values={range(MIN_ROWS, MAX_ROWS)} active={edit.rows} onPick={(rows) => change({ rows })} />
      <Picker label="TASCHEN" values={range(MIN_POCKETS, MAX_POCKETS)} active={edit.pockets} onPick={(pockets) => change({ pockets })} />
      <Picker label="TASCHENBREITEN" values={WIDTH_PROFILES} active={edit.profile}
        onPick={(profile) => change({ profile })} format={(value) => PROFILE_LABEL[value]} />
      <Picker label="SPEZIAL-PEGS AUF REIHE 1" values={SPECIAL_PEGS} active={edit.specialKind ?? SPECIAL_PEGS[0]!}
        onPick={(specialKind) => change({ specialKind })} format={kindLabel} />
      <Picker label="ANZAHL DER SPEZIAL-PEGS" values={range(0, 8)} active={edit.specialCount ?? 0}
        onPick={(specialCount) => change({ specialCount })} />
      <div className="row-actions">
        <button type="button" className="btn primary" onClick={measure}>RTP MESSEN</button>
        {gate && <span className={gate.ok ? 'hint ok' : 'hint bad'}>{gate.reason}</span>}
      </div>
    </>
  );
}
