import { useMemo } from 'react';
import { proveSlotMath } from '../../core/slot/slot-evaluator';
import type { SlotConfig } from '../../core/slot/slot-types';

export interface BalanceMeterProps {
  readonly config: SlotConfig;
}

export function BalanceMeter({ config }: BalanceMeterProps) {
  const proof = useMemo(() => {
    try {
      return proveSlotMath(config, 1200, 1337);
    } catch {
      return null;
    }
  }, [config]);

  if (!proof) {
    return <div className="balance-meter dead"><strong>Waage blockiert</strong><span>Mindestens eine Rolle braucht Symbole.</span></div>;
  }

  const dead = proof.hitRate <= 0 || proof.addictionScore === 0;
  const rtpPct = proof.measuredRTP * 100;
  const edgePct = proof.houseEdge * 100;

  return (
    <div className={dead ? 'balance-meter dead' : 'balance-meter'}>
      <header>
        <span>BALANCE-WAAGE</span>
        <strong>{dead ? 'TOTGEPATCHT' : `SUCHT ${proof.addictionScore}/100`}</strong>
      </header>
      <div className="balance-pan">
        <div>
          <span>Gewinnchancen</span>
          <strong>{proof.hitRate.toFixed(1)} %</strong>
          <div className="balance-track"><span style={{ width: `${Math.min(100, proof.hitRate)}%` }} /></div>
        </div>
        <div>
          <span>Hausvorteil</span>
          <strong>{edgePct.toFixed(1)} %</strong>
          <div className="balance-track edge"><span style={{ width: `${Math.min(100, Math.max(0, edgePct))}%` }} /></div>
        </div>
      </div>
      <div className="balance-foot">
        <span>RTP {rtpPct.toFixed(1)} %</span>
        <span>1.200 echte Spins</span>
      </div>
      {dead ? (
        <p className="balance-dead-text">Totgepatcht – erzeugt 0 % Sucht, Besucher gehen sofort!</p>
      ) : (
        <p className="balance-dead-text live">Jeder Treffer und jede Kombination treibt den Sucht-Aufbau.</p>
      )}
    </div>
  );
}
