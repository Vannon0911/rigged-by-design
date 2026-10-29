import { useEffect, useRef, useState } from 'react';
import { LAB_SEED, addictionTone, parseSeed, pct, type DeterminismReport } from './lab-model';
import {
  TABLE_LAB_GAMES,
  runTableProof,
  verifyTableDeterminism,
  type TableGameId,
  type TableProofView,
  type TableVariant,
} from './table-lab-model';

type Busy = 'proof' | 'det' | null;

export function TableLab() {
  const [game, setGame] = useState<TableGameId>('ROULETTE');
  const [variant, setVariant] = useState<TableVariant>('FAIR');
  const [seedText, setSeedText] = useState(String(LAB_SEED));
  const [proof, setProof] = useState<TableProofView | null>(null);
  const [determinism, setDeterminism] = useState<DeterminismReport | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const tokenRef = useRef(0);

  useEffect(() => () => { tokenRef.current += 1; }, []);

  const reset = (nextGame: TableGameId, nextVariant: TableVariant): void => {
    setGame(nextGame);
    setVariant(nextVariant);
    setProof(null);
    setDeterminism(null);
    setError(null);
  };

  const schedule = (job: () => void): void => {
    const token = tokenRef.current + 1;
    tokenRef.current = token;
    window.setTimeout(() => {
      if (token === tokenRef.current) job();
    }, 25);
  };

  const run = (sampleSize: number): void => {
    const seed = parseSeed(seedText);
    if (seed === null) {
      setError('Seed muss eine ganze Zahl im sicheren Bereich sein.');
      return;
    }
    setBusy('proof');
    setDeterminism(null);
    setError(null);
    schedule(() => {
      try {
        setProof(runTableProof(game, seed, sampleSize, variant));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Beweis fehlgeschlagen.');
      } finally {
        setBusy(null);
      }
    });
  };

  const runDeterminism = (): void => {
    const seed = parseSeed(seedText);
    if (seed === null) {
      setError('Seed muss eine ganze Zahl im sicheren Bereich sein.');
      return;
    }
    setBusy('det');
    setError(null);
    schedule(() => {
      try {
        setDeterminism(verifyTableDeterminism(game, seed, 1000, variant));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Determinismus-Check fehlgeschlagen.');
      } finally {
        setBusy(null);
      }
    });
  };

  const tone = proof ? addictionTone(proof.addictionScore) : null;
  const meta = TABLE_LAB_GAMES.find((entry) => entry.id === game)!;

  return (
    <div className="lab table-lab">
      <header className="lab-head">
        <div>
          <h3>Tisch-Labor · alle Spielkategorien</h3>
          <p className="lab-note">{meta.note}</p>
        </div>
        <span className="lab-footer">echte Core-Runden · kein Renderer</span>
      </header>

      <div className="workshop-tabs">
        {TABLE_LAB_GAMES.map((entry) => (
          <button
            type="button"
            key={entry.id}
            className={entry.id === game ? 'workshop-tab active' : 'workshop-tab'}
            onClick={() => reset(entry.id, variant)}
          >
            {entry.name}
          </button>
        ))}
      </div>

      <div className="lab-toolbar">
        <label className="lab-seed">
          Seed
          <input value={seedText} onChange={(event) => setSeedText(event.target.value)} inputMode="numeric" aria-label="Tisch-Seed" />
        </label>
        <label className="lab-seed">
          <input
            type="checkbox"
            checked={variant === 'RIGGED'}
            onChange={(event) => reset(game, event.target.checked ? 'RIGGED' : 'FAIR')}
          />
          Haus-Mods aktiv
        </label>
        <div className="lab-actions">
          <button type="button" onClick={() => run(1000)} disabled={busy !== null}>
            {busy === 'proof' ? 'laeuft...' : '1.000 Runden'}
          </button>
          <button type="button" className="primary" onClick={() => run(10_000)} disabled={busy !== null}>
            10.000 Runden beweisen
          </button>
        </div>
      </div>

      {error && <p className="lab-error">{error}</p>}

      {proof ? (
        <>
          <div className="lab-kpis">
            <div className="kpi"><span>Hit-Rate</span><strong>{pct(proof.hitRate)}</strong></div>
            <div className="kpi"><span>RTP gemessen</span><strong>{pct(proof.rtp * 100)}</strong></div>
            <div className="kpi"><span>Hausvorteil</span><strong>{pct(proof.houseEdge * 100)}</strong></div>
            <div className="kpi"><span>Sucht-Faktor</span><strong>{proof.addictionScore} / 100</strong></div>
          </div>

          <div className="lab-kpis">
            {proof.extras.map((extra) => (
              <div className="kpi" key={extra.label}>
                <span>{extra.label}</span><strong>{extra.value}</strong>
              </div>
            ))}
          </div>

          {tone && (
            <div className={`addiction ${tone}`}>
              <div className="addiction-head">
                <span>{proof.label} · {proof.variant === 'RIGGED' ? 'Haus-Modus' : 'Fairer Tisch'}</span>
                <strong>{proof.addictionScore} / 100</strong>
              </div>
              <div className="addiction-bar"><span style={{ width: `${proof.addictionScore}%` }} /></div>
            </div>
          )}

          <p className="lab-footer">
            {proof.sampleSize} echte Runden · Seed {proof.seed} · Variante {proof.variant}
          </p>
        </>
      ) : (
        <p className="hint">Noch kein Tischbeweis gelaufen - Kategorie, Seed und Variante waehlen.</p>
      )}

      <div className="lab-badge">
        <button type="button" onClick={runDeterminism} disabled={busy !== null}>
          {busy === 'det' ? 'pruefe...' : 'Seed-Reproduzierbarkeit pruefen'}
        </button>
        {determinism && (
          <span className={determinism.mismatchAt === null ? 'badge ok' : 'badge fail'}>
            {determinism.mismatchAt === null
              ? `BEWIESEN: ${determinism.identical}/${determinism.spins} Runden identisch`
              : `ABWEICHUNG bei Runde ${determinism.mismatchAt}`}
          </span>
        )}
      </div>
    </div>
  );
}
