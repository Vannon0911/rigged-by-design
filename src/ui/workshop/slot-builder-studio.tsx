import { useEffect, useRef, useState } from 'react';
import { fromVC, toVCString, type VaCoinMicro } from '../../core/economy/vacoin';
import { resolvePaylines } from '../../core/slot/slot-engine';
import { SLOT_SYMBOLS, type SlotConfig, type SlotSymbol } from '../../core/slot/slot-types';
import { OPERATOR_MODS, type OperatorModId } from '../../core/simulation/catalog';
import { SlotBuilderPreview } from '../../stage/slot-builder-preview';
import { BalanceMeter } from './balance-meter';
import { SYMBOL_LABELS } from './lab-model';
import {
  PAY_KEYS,
  addReel,
  biasOf,
  builderStrips,
  payBps,
  removeReel,
  symbolCounts,
  withPayout,
  withStrips,
  withSymbolCount,
} from './slot-builder-model';

const MIN_BET = fromVC(0.1);
const MAX_BET = fromVC(5);
const BET_STEP = fromVC(0.1);

export interface SlotBuilderStudioProps {
  readonly config: SlotConfig;
  readonly cash: VaCoinMicro;
  readonly ownedMods: readonly OperatorModId[];
  readonly onChange: (config: SlotConfig) => void;
  readonly onBuyMod: (id: OperatorModId) => void;
  readonly onToggleMod: (id: OperatorModId) => void;
}

export function SlotBuilderStudio({ config, cash, ownedMods, onChange, onBuyMod, onToggleMod }: SlotBuilderStudioProps) {
  const [draft, setDraft] = useState<SlotConfig>(config);
  const [reel, setReel] = useState(0);
  const [paySymbol, setPaySymbol] = useState<SlotSymbol>('CHERRY');
  const hostRef = useRef<HTMLDivElement | null>(null);
  const previewRef = useRef<SlotBuilderPreview | null>(null);

  useEffect(() => { setDraft(config); }, [config]);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let preview: SlotBuilderPreview | null = null;
    void SlotBuilderPreview.create(host).then((created) => {
      if (disposed) { created.destroy(); return; }
      preview = created;
      previewRef.current = created;
      created.setConfig(config);
    });
    return () => {
      disposed = true;
      previewRef.current = null;
      preview?.destroy();
      host.replaceChildren();
    };
  }, []);
  useEffect(() => { previewRef.current?.setConfig(draft); }, [draft]);

  const strips = builderStrips(draft);
  const activeReel = Math.min(reel, strips.length - 1);
  const strip = strips[activeReel] ?? [];
  const counts = symbolCounts(strip);
  const bias = biasOf(draft);
  const lineCount = resolvePaylines(draft).length;

  const update = (next: SlotConfig): void => { setDraft(next); onChange(next); };
  const updateStrips = (next: SlotSymbol[][]): void => {
    update(withStrips(draft, next, bias.pull, bias.shift));
  };
  const changeCount = (symbol: SlotSymbol, delta: number): void => {
    const nextStrip = withSymbolCount(strip, symbol, counts[symbol] + delta);
    updateStrips(strips.map((entry, index) => (index === activeReel ? nextStrip : entry)));
  };
  const setPull = (pull: number): void => { update(withStrips(draft, strips, pull, bias.shift)); };
  const setShift = (shift: number): void => { update(withStrips(draft, strips, bias.pull, shift)); };
  const setPaytable = (key: (typeof PAY_KEYS)[number], value: number): void => {
    update(withPayout(draft, paySymbol, key, Math.round(value * 10_000)));
  };

  return (
    <section className="studio">
      <header className="studio-head">
        <div>
          <h3>Sucht-Spiel-Baukasten</h3>
          <p className="lab-note">Rollen, Symbole, Preise und Zahlen-Bias live schrauben.</p>
        </div>
        <span className="lab-footer">{strips.length} Rollen · {lineCount} Linien</span>
      </header>

      <div className="studio-top">
        <div className="studio-preview" ref={hostRef} aria-label="PixiJS Slot-Vorschau" />
        <BalanceMeter config={draft} />
      </div>

      <div className="studio-row">
        <strong>Rollen-Erweiterung</strong>
        <span>{strips.length} / 6</span>
        <button type="button" onClick={() => { const next = addReel(strips, activeReel); updateStrips(next); setReel(next.length - 1); }} disabled={strips.length >= 6}>+1 Slot-Rolle anbauen</button>
        <button type="button" onClick={() => { updateStrips(removeReel(strips, activeReel)); setReel(Math.max(0, activeReel - 1)); }} disabled={strips.length <= 3}>Rolle abmontieren</button>
      </div>

      <div className="reel-tabs">
        {strips.map((_, index) => (
          <button type="button" key={index} className={index === activeReel ? 'reel-tab active' : 'reel-tab'} onClick={() => setReel(index)}>Rolle {index + 1}</button>
        ))}
      </div>

      <div className="symbol-stack">
        {SLOT_SYMBOLS.map((symbol) => (
          <div className="symbol-count" key={symbol}>
            <span>{SYMBOL_LABELS[symbol]}</span>
            <button type="button" onClick={() => changeCount(symbol, -1)} aria-label={`${SYMBOL_LABELS[symbol]} entfernen`}>−</button>
            <strong>{counts[symbol]}</strong>
            <button type="button" onClick={() => changeCount(symbol, 1)} aria-label={`${SYMBOL_LABELS[symbol]} hinzufuegen`}>+</button>
          </div>
        ))}
      </div>

      <div className="studio-grid">
        <label>Basis-Einsatz <strong>{toVCString(draft.baseBet)}</strong>
          <input type="range" min={MIN_BET} max={MAX_BET} step={BET_STEP} value={draft.baseBet} onChange={(event) => update({ ...draft, baseBet: Number(event.target.value) as VaCoinMicro })} />
        </label>
        <label>Gewinnlinien <strong>{lineCount}</strong>
          <input type="range" min={1} max={9} step={1} value={typeof draft.paylines === 'number' ? draft.paylines : lineCount} onChange={(event) => update({ ...draft, paylines: Number(event.target.value) })} />
        </label>
        <label>Nullen-Pull (Haus) <strong>{bias.pull.toFixed(2)}</strong>
          <input type="range" min={-1} max={1} step={0.05} value={bias.pull} onChange={(event) => setPull(Number(event.target.value))} />
        </label>
        <label>Fenster-Shift <strong>{bias.shift.toFixed(2)}</strong>
          <input type="range" min={-0.5} max={0.5} step={0.05} value={bias.shift} onChange={(event) => setShift(Number(event.target.value))} />
        </label>
      </div>

      <div className="paytable-tuner">
        <header>
          <strong>Paytable-Tuner</strong>
          <select value={paySymbol} onChange={(event) => setPaySymbol(event.target.value as SlotSymbol)} aria-label="Symbol fuer Paytable">
            {SLOT_SYMBOLS.filter((symbol) => symbol !== 'BLANK').map((symbol) => <option key={symbol} value={symbol}>{SYMBOL_LABELS[symbol]}</option>)}
          </select>
          <span className="lab-footer">x vom Linieneinsatz</span>
        </header>
        <div className="paytable-grid">
          {PAY_KEYS.map((key) => (
            <label key={key}>
              {key === 'two' ? '2er' : key === 'three' ? '3er' : key === 'four' ? '4er' : key === 'five' ? '5er' : '6er'}
              <input type="number" min={0} max={1000} step={0.1} value={(payBps(draft, paySymbol, key) / 10_000).toFixed(1)} onChange={(event) => setPaytable(key, Number(event.target.value) || 0)} />
            </label>
          ))}
        </div>
      </div>

      <div className="op-mods compact">
        {OPERATOR_MODS.filter((mod) => mod.appliesTo.includes('SLOT')).map((mod) => {
          const owned = ownedMods.includes(mod.id);
          const installed = config.mods.some((contract) => contract.id === mod.id);
          return (
            <article className={installed ? 'op-mod installed' : 'op-mod'} key={mod.id}>
              <header><strong>{mod.name}</strong><span>{toVCString(mod.priceVC)}</span></header>
              {owned ? <button type="button" onClick={() => onToggleMod(mod.id)}>{installed ? 'Ausbauen' : 'Einbauen'}</button>
                : <button type="button" className="primary" disabled={cash < mod.priceVC} onClick={() => onBuyMod(mod.id)}>Kaufen</button>}
            </article>
          );
        })}
      </div>
    </section>
  );
}
