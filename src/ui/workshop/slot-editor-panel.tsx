import { useEffect, useState } from 'react';
import { fromVC, toVCString, type VaCoinMicro } from '../../core/economy/vacoin';
import { resolvePaylines } from '../../core/slot/slot-engine';
import { proveSlotMath, type SlotMathProof } from '../../core/slot/slot-evaluator';
import { BASE_WEIGHTS, SLOT_SYMBOLS, type SlotConfig, type SlotSymbol } from '../../core/slot/slot-types';
import { OPERATOR_MODS, type OperatorModId } from '../../core/simulation/catalog';
import { PREVIEW_SEED, SYMBOL_LABELS, pct } from './lab-model';

const MIN_BET = fromVC(0.1);
const MAX_BET = fromVC(5);
const BET_STEP = fromVC(0.1);
const MIN_WEIGHT = 1;
const MAX_WEIGHT = 60;
const PREVIEW_SPINS = 3000;

export interface SlotEditorPanelProps {
  readonly config: SlotConfig;
  readonly cash: VaCoinMicro;
  readonly ownedMods: readonly OperatorModId[];
  readonly onChange: (config: SlotConfig) => void;
  readonly onBuyMod: (id: OperatorModId) => void;
  readonly onToggleMod: (id: OperatorModId) => void;
}

interface Preview {
  readonly before: SlotMathProof;
  readonly after: SlotMathProof;
}

export function SlotEditorPanel({ config, cash, ownedMods, onChange, onBuyMod, onToggleMod }: SlotEditorPanelProps) {
  const [draft, setDraft] = useState<SlotConfig>(config);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    // Mods sofort uebernehmen, ungespeicherte Regler-Aenderungen aber behalten.
    setDraft((current) => ({ ...current, mods: config.mods, paylines: config.paylines }));
    setPreview(null);
  }, [config]);

  const weightOf = (symbol: SlotSymbol): number => draft.weights?.[symbol] ?? BASE_WEIGHTS[symbol];
  const lineCount = resolvePaylines(draft).length;
  const dirty =
    draft.baseBet !== config.baseBet ||
    SLOT_SYMBOLS.some((symbol) => weightOf(symbol) !== (config.weights?.[symbol] ?? BASE_WEIGHTS[symbol]));

  const setWeight = (symbol: SlotSymbol, value: number): void =>
    setDraft((current) => ({
      ...current,
      weights: { ...(current.weights ?? {}), [symbol]: Math.min(MAX_WEIGHT, Math.max(MIN_WEIGHT, value)) },
    }));

  const resetWeights = (): void =>
    setDraft({ id: draft.id, baseBet: draft.baseBet, paylines: draft.paylines, mods: draft.mods });

  const runPreview = (): void => {
    setPreviewing(true);
    setPreviewError(null);
    window.setTimeout(() => {
      try {
        setPreview({
          before: proveSlotMath(config, PREVIEW_SPINS, PREVIEW_SEED),
          after: proveSlotMath(draft, PREVIEW_SPINS, PREVIEW_SEED),
        });
      } catch (cause) {
        setPreviewError(cause instanceof Error ? cause.message : 'Vorschau fehlgeschlagen.');
      } finally {
        setPreviewing(false);
      }
    }, 20);
  };

  return (
    <div className="slot-editor">
      <header className="editor-head">
        <div>
          <h3>Eigener Automat</h3>
          <p className="lab-note">Einsatz und Walzen-Gewichte schrauben, dann den Beweis neu starten.</p>
        </div>
        <span className="lab-footer">{lineCount} Linien · {config.mods.length} Mods</span>
      </header>

      <div className="editor-row">
        <label htmlFor="base-bet">Basis-Einsatz / Linie</label>
        <input
          id="base-bet"
          type="range"
          min={MIN_BET}
          max={MAX_BET}
          step={BET_STEP}
          value={draft.baseBet}
          onChange={(event) => setDraft({ ...draft, baseBet: Number(event.target.value) as VaCoinMicro })}
        />
        <strong>{toVCString(draft.baseBet)}</strong>
      </div>
      <p className="lab-footer">
        Gesamt pro Spin: {toVCString((draft.baseBet * lineCount) as VaCoinMicro)} · Fenster {toVCString(MIN_BET)} bis {toVCString(MAX_BET)}
      </p>

      <div className="weight-list">
        {SLOT_SYMBOLS.map((symbol) => (
          <div className="weight-row" key={symbol}>
            <span>{SYMBOL_LABELS[symbol]}</span>
            <input
              type="range"
              min={MIN_WEIGHT}
              max={MAX_WEIGHT}
              step={1}
              value={weightOf(symbol)}
              aria-label={`Gewicht ${SYMBOL_LABELS[symbol]}`}
              onChange={(event) => setWeight(symbol, Number(event.target.value))}
            />
            <span className="lab-num">{weightOf(symbol)}</span>
          </div>
        ))}
      </div>

      <div className="editor-actions">
        <button type="button" onClick={resetWeights} disabled={!draft.weights}>Gewichte zuruecksetzen</button>
        <button type="button" className="primary" disabled={!dirty} onClick={() => onChange(draft)}>Uebernehmen</button>
        <button type="button" onClick={runPreview} disabled={previewing}>
          {previewing ? 'rechne...' : `Mathe-Vorschau (${PREVIEW_SPINS.toLocaleString('de-DE')} Spins)`}
        </button>
      </div>
      {previewError && <p className="lab-error">{previewError}</p>}

      {preview && (
        <div className="preview-grid">
          <div>
            <span>RTP vorher → nachher</span>
            <strong>{pct(preview.before.measuredRTP * 100)} → {pct(preview.after.measuredRTP * 100)}</strong>
          </div>
          <div>
            <span>Sucht vorher → nachher</span>
            <strong>{preview.before.addictionScore} → {preview.after.addictionScore}</strong>
          </div>
          <div>
            <span>Hit-Rate vorher → nachher</span>
            <strong>{pct(preview.before.hitRate)} → {pct(preview.after.hitRate)}</strong>
          </div>
        </div>
      )}
      {preview && (
        <p className="lab-footer">
          {PREVIEW_SPINS} Spins je Seite, Seed {PREVIEW_SEED}. Mods bleiben installiert und wirken auf beide Seiten.
        </p>
      )}

      <div className="op-mods">
        {OPERATOR_MODS.map((mod) => {
          const owned = ownedMods.includes(mod.id);
          const installed = config.mods.some((contract) => contract.id === mod.id);
          return (
            <article className={installed ? 'op-mod installed' : 'op-mod'} key={mod.id}>
              <header><strong>{mod.name}</strong><span>{toVCString(mod.priceVC)}</span></header>
              <p>{mod.description}</p>
              {owned ? (
                <button type="button" onClick={() => onToggleMod(mod.id)}>{installed ? 'Ausbauen' : 'Einbauen'}</button>
              ) : (
                <button type="button" className="primary" disabled={cash < mod.priceVC} onClick={() => onBuyMod(mod.id)}>
                  Kaufen
                </button>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
