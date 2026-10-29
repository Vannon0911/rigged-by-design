import { useEffect, useRef, useState } from 'react';
import { toVCString } from '../../core/economy/vacoin';
import { resolvePaylines } from '../../core/slot/slot-engine';
import { proveSlotMath, type SlotMathProof } from '../../core/slot/slot-evaluator';
import type { SlotConfig } from '../../core/slot/slot-types';
import {
  LAB_SEED,
  SYMBOL_LABELS,
  addictionTone,
  parseSeed,
  pct,
  signedPp,
  verifyDeterminism,
  type DeterminismReport,
} from './lab-model';

export interface RngProofPanelProps {
  readonly config: SlotConfig;
  readonly title: string;
  readonly note: string;
  readonly seed?: number;
}

type Busy = '1000' | '10000' | 'det' | null;

const TONE_TEXT = { low: 'entspannt', mid: 'erhoeht', high: 'kritisch' } as const;

export function RngProofPanel({ config, title, note, seed = LAB_SEED }: RngProofPanelProps) {
  const [seedText, setSeedText] = useState(String(seed));
  const [proof, setProof] = useState<SlotMathProof | null>(null);
  const [determinism, setDeterminism] = useState<DeterminismReport | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const tokenRef = useRef(0);

  useEffect(() => {
    tokenRef.current += 1;
    setProof(null);
    setDeterminism(null);
    setError(null);
    setBusy(null);
  }, [config]);

  // Beim Unmount laufende Berechnungen entwerten.
  useEffect(() => () => { tokenRef.current += 1; }, []);

  const schedule = (job: () => void): void => {
    const token = tokenRef.current + 1;
    tokenRef.current = token;
    window.setTimeout(() => {
      if (token === tokenRef.current) job();
    }, 30);
  };

  const runProof = (sampleSize: number): void => {
    const parsed = parseSeed(seedText);
    if (parsed === null) {
      setError('Seed muss eine ganze Zahl im sicheren Bereich sein.');
      return;
    }
    setError(null);
    setDeterminism(null);
    setBusy(sampleSize === 10_000 ? '10000' : '1000');
    schedule(() => {
      try {
        setProof(proveSlotMath(config, sampleSize, parsed));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Beweis fehlgeschlagen.');
      } finally {
        setBusy(null);
      }
    });
  };

  const runDeterminism = (): void => {
    const parsed = parseSeed(seedText);
    if (parsed === null) {
      setError('Seed muss eine ganze Zahl im sicheren Bereich sein.');
      return;
    }
    setError(null);
    setBusy('det');
    schedule(() => {
      try {
        setDeterminism(verifyDeterminism(config, parsed, 1000));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Determinismus-Check fehlgeschlagen.');
      } finally {
        setBusy(null);
      }
    });
  };

  const tone = proof ? addictionTone(proof.addictionScore) : null;

  return (
    <div className="lab">
      <header className="lab-head">
        <div>
          <h3>{title}</h3>
          <p className="lab-note">{note}</p>
        </div>
        <span className="lab-footer">{resolvePaylines(config).length} Basis-Linien</span>
      </header>

      <div className="lab-toolbar">
        <label className="lab-seed">
          Seed
          <input value={seedText} onChange={(event) => setSeedText(event.target.value)} inputMode="numeric" aria-label="Seed" />
        </label>
        <div className="lab-actions">
          <button type="button" onClick={() => runProof(1000)} disabled={busy !== null}>
            {busy === '1000' ? 'laeuft...' : '1.000 Spins'}
          </button>
          <button type="button" className="primary" onClick={() => runProof(10_000)} disabled={busy !== null}>
            {busy === '10000' ? 'laeuft...' : '10.000 Spins beweisen'}
          </button>
        </div>
      </div>

      {error && <p className="lab-error">{error}</p>}

      {proof ? (
        <>
          <div className="lab-bars">
            <div className="lab-bar-row lab-bar-head">
              <span>Symbol</span>
              <span>Soll / Ist</span>
              <span>Soll</span>
              <span>Ist</span>
              <span>Delta</span>
            </div>
            {proof.symbolDistribution.map((row) => (
              <div className="lab-bar-row" key={row.symbol}>
                <span className="lab-symbol">{SYMBOL_LABELS[row.symbol]}</span>
                <span className="lab-track">
                  <span className="lab-fill theory" style={{ width: `${row.theoreticalPct}%` }} />
                  <span className="lab-fill actual" style={{ width: `${row.measuredPct}%` }} />
                </span>
                <span className="lab-num">{pct(row.theoreticalPct, 2)}</span>
                <span className="lab-num">{pct(row.measuredPct, 2)}</span>
                <span className={Math.abs(row.deltaPct) < 1.5 ? 'lab-delta ok' : 'lab-delta warn'}>
                  {signedPp(row.deltaPct)}
                </span>
              </div>
            ))}
          </div>
          <p className="lab-footer">
            Symbolhaeufigkeit ueber {proof.sampleSize * 9} Zellen ({proof.sampleSize} Spins x 3x3).
          </p>

          <div className="lab-kpis">
            <div className="kpi"><span>Hit-Rate</span><strong>{pct(proof.hitRate)}</strong></div>
            <div className="kpi"><span>LDW-Quote</span><strong>{pct(proof.ldwRate)}</strong></div>
            <div className="kpi"><span>Near-Miss</span><strong>{pct(proof.nearMissRate)}</strong></div>
            <div className="kpi"><span>RTP gemessen</span><strong>{pct(proof.measuredRTP * 100)}</strong></div>
            <div className="kpi"><span>Hausvorteil</span><strong>{pct(proof.houseEdge * 100)}</strong></div>
          </div>

          {tone && (
            <div className={`addiction ${tone}`}>
              <div className="addiction-head">
                <span>Sucht-Faktor ({TONE_TEXT[tone]})</span>
                <strong>{proof.addictionScore} / 100</strong>
              </div>
              <div className="addiction-bar"><span style={{ width: `${proof.addictionScore}%` }} /></div>
              <p className="hint">Hit-Rate, LDW, Near-Miss und Linienzahl; RTP-Strafe unter 65 %.</p>
            </div>
          )}

          <p className="lab-footer">
            {proof.sampleSize} Spins · Seed {proof.seed} · Einsatz {toVCString(proof.totalBet)} · Auszahlung {toVCString(proof.totalPayout)}
          </p>
        </>
      ) : (
        <p className="hint">Noch kein Beweis gelaufen - Seed waehlen und Spins starten.</p>
      )}

      <div className="lab-badge">
        <button type="button" onClick={runDeterminism} disabled={busy !== null}>
          {busy === 'det' ? 'pruefe...' : 'Seed-Reproduzierbarkeit pruefen'}
        </button>
        {determinism && (
          <span className={determinism.mismatchAt === null ? 'badge ok' : 'badge fail'}>
            {determinism.mismatchAt === null
              ? `BEWIESEN: ${determinism.identical}/${determinism.spins} Spins identisch`
              : `ABWEICHUNG bei Spin ${determinism.mismatchAt} von ${determinism.spins}`}
          </span>
        )}
      </div>
    </div>
  );
}
