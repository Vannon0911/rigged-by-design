/** Eigenes Hütchen- oder Würfelgerät: echte Ledger-Runde im Pixi-Tisch. */
import { useEffect, useRef, useState } from 'react';
import { toVCString } from '../../core/economy/vacoin';
import type { DiceRound } from '../../core/games/dice/dice-engine';
import type { ShellRound } from '../../core/games/shell/shell-engine';
import { gameStore, useGameStore } from '../../store/use-game-store';
import { ShellAndDiceView } from '../../stage/games/shell-and-dice-view';

export interface OwnTablePlayProps {
  readonly kind: 'SHELL' | 'DICE';
}

export function OwnTablePlay({ kind }: OwnTablePlayProps) {
  const game = useGameStore();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<ShellAndDiceView | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('Bereit für deine Gäste.');

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let view: ShellAndDiceView | null = null;
    const boot = async (): Promise<void> => {
      const created = await ShellAndDiceView.create(host);
      if (disposed) { created.destroy(); return; }
      view = created; viewRef.current = created;
    };
    void boot();
    return () => { disposed = true; viewRef.current = null; view?.destroy(); host.replaceChildren(); };
  }, []);

  const play = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      const outcome = gameStore.playOwnTable(kind);
      if (!outcome) { setNotice(gameStore.getSnapshot().notice); return; }
      setNotice(outcome.payout > 0 ? `+${toVCString(outcome.payout)}` : `−${toVCString(outcome.totalBet)}`);
      const visual = outcome.visual;
      if (visual.kind === 'SHELL') {
        const round: ShellRound = {
          cups: visual.cups, variant: 'CLASSIC', winning: visual.winning, picked: visual.picked,
          hit: visual.hit, isNearMiss: outcome.isNearMiss, totalBet: outcome.totalBet,
          payout: outcome.payout, multiplierBps: 0, effectiveHitRate: 0, heatGain: 1,
        };
        await viewRef.current?.showShell(round);
      } else if (visual.kind === 'DICE') {
        const round: DiceRound = {
          dice: visual.dice as DiceRound['dice'], sum: visual.sum, baseWin: outcome.payout > 0,
          devil: null, win: outcome.payout > 0, totalBet: outcome.totalBet, payout: outcome.payout,
          payoutBps: 0, isNearMiss: outcome.isNearMiss,
        };
        await viewRef.current?.showDice(round);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="own-table-play">
      <div className="play-subbar">
        <span>{kind === 'SHELL' ? 'HÜTCHENSPIEL' : 'STREET CRAPS'} · EINSATZ {toVCString(game.bet)}</span>
        <strong>{notice}</strong>
        <button type="button" className="spin-cta" disabled={!game.hasTable || busy} onClick={() => void play()}>
          {kind === 'SHELL' ? 'BECHER MISCHEN' : 'WÜRFELN'}
        </button>
      </div>
      <div className="slot-play-host" ref={hostRef} aria-label="Eigener Tisch" />
      {!game.hasTable && <p className="lab-error">Baue zuerst einen Hütchen-Karton oder Würfeltisch.</p>}
    </div>
  );
}
