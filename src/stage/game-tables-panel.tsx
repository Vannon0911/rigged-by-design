/** Demo-Tische: montiert den prozeduralen Pixi-Renderer und spielt echte Core-Runden. */
import { useEffect, useRef, useState } from 'react';
import { fromVC } from '../core/economy/vacoin';
import { DEFAULT_DICE_CONFIG, playDiceRound } from '../core/games/dice/dice-engine';
import { DEFAULT_SHELL_CONFIG, playShellRound } from '../core/games/shell/shell-engine';
import { Prng } from '../core/rng/prng';
import { ShellAndDiceView } from './games/shell-and-dice-view';

const DEMO_BET = fromVC(1);

export function GameTablesPanel() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<ShellAndDiceView | null>(null);
  const prngRef = useRef<Prng | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let view: ShellAndDiceView | null = null;

    const boot = async (): Promise<void> => {
      try {
        const created = await ShellAndDiceView.create(host);
        if (disposed) {
          created.destroy();
          return;
        }
        view = created;
        viewRef.current = created;
      } catch (cause) {
        if (!disposed) setError(cause instanceof Error ? cause.message : 'Renderer konnte nicht starten.');
      }
    };

    void boot();
    return () => {
      disposed = true;
      viewRef.current = null;
      view?.destroy();
      host.replaceChildren();
    };
  }, []);

  const run = async (kind: 'SHELL' | 'DICE'): Promise<void> => {
    const view = viewRef.current;
    if (!view || busy) return;
    const prng = prngRef.current ?? (prngRef.current = new Prng(20261029));
    setBusy(true);
    setError(null);
    try {
      if (kind === 'SHELL') {
        await view.showShell(playShellRound(DEFAULT_SHELL_CONFIG, prng, DEMO_BET));
      } else {
        await view.showDice(playDiceRound(DEFAULT_DICE_CONFIG, prng, DEMO_BET));
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Runde fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="game-tables-panel">
      <div className="table-actions">
        <button type="button" disabled={busy} onClick={() => void run('SHELL')}>
          Hütchen mischen
        </button>
        <button type="button" disabled={busy} onClick={() => void run('DICE')}>
          Würfeln
        </button>
        <span className="hint">Demo-Tisch · Einsätze laufen nicht über dein Ledger</span>
      </div>
      <div className="table-host" ref={hostRef} aria-label="Hütchenspiel und Würfeltisch" />
      {error && <p className="lab-error">{error}</p>}
    </div>
  );
}
