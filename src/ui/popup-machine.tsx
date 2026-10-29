/** Eine Maschine als Popup: Walzen, Mods, Einsatz, Testspin und EV-Guard. */
import { useMemo, useState } from 'react';
import { toVCString, type VaCoinMicro } from '../core/economy/vacoin';
import { attractionOf, paylinesOf, reelSlotsOf, slotConfigOf, totalBetOf, type MachineState } from '../core/machine/machine';
import { guardMachine } from '../core/machine/guard';
import { getItem } from '../core/offer/catalog';
import { getMod, modsForVenue, type ModId } from '../core/offer/mods';
import { getReel, type ReelId } from '../core/offer/reels';
import { synergiesOf } from '../core/offer/synergy';
import { Prng } from '../core/rng/prng';
import { spinSlot } from '../core/slot/slot-engine';
import type { SpinResult } from '../core/slot/slot-types';
import type { VenueTier } from '../core/venues';
import { PopupShell } from './popup-shell';
import { Symbol } from './symbol';
import { pct, vc } from './format';

export interface MachinePopupProps {
  readonly machine: MachineState;
  readonly venueTier: VenueTier;
  readonly ownedReels: readonly ReelId[];
  readonly cash: VaCoinMicro;
  readonly onClose: () => void;
  readonly onSwapReel: (slot: number, reelId: ReelId) => void;
  readonly onAddReel: () => void;
  readonly onRemoveReel: (slot: number) => void;
  readonly onInstallMod: (modId: ModId) => void;
  readonly onSetBet: (bet: VaCoinMicro) => void;
}

function betSteps(min: VaCoinMicro, max: VaCoinMicro): VaCoinMicro[] {
  const values = [min, Math.min(max, Math.round(min * 2)), Math.min(max, Math.round(min * 4))];
  return [...new Set(values)] as VaCoinMicro[];
}

export function MachinePopup(props: MachinePopupProps) {
  const { machine, venueTier, ownedReels, cash, onClose } = props;
  const def = getItem(machine.catalogId);
  const signature = `${machine.reels.join(',')}|${machine.mods.join(',')}|${machine.baseBet}|${venueTier}`;
  const guard = useMemo(() => guardMachine(machine, venueTier), [signature]);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [spinKey, setSpinKey] = useState(0);
  const capacity = reelSlotsOf(machine);
  const installed = new Set(machine.mods);
  const synergies = synergiesOf(machine.mods);

  const testSpin = (): void => {
    const seed = (Date.now() ^ (machine.id * 7919)) >>> 0;
    setResult(spinSlot(slotConfigOf(machine), new Prng(seed)));
    setSpinKey((key) => key + 1);
  };

  return (
    <PopupShell eyebrow={`${def.kind === 'MACHINE' ? 'AUTOMAT' : 'OBJEKT'} #${machine.id}`} title={def.name} onClose={onClose} wide>
      <div className="machine-top">
        <div className="machine-stat">
          <span>ANZIEHUNG</span>
          <strong>{Math.round(attractionOf(machine) / 100)}</strong>
        </div>
        <div className="machine-stat">
          <span>LINIEN</span>
          <strong>{paylinesOf(machine)}</strong>
        </div>
        <div className="machine-stat">
          <span>EINSATZ / SPIN</span>
          <strong>{toVCString(totalBetOf(machine))}</strong>
        </div>
        <div className={`machine-stat${guard.ok ? '' : ' bad'}`}>
          <span>ERWARTETE AUSZAHLUNG</span>
          <strong>{pct(guard.rtp)}</strong>
          <small>Deckel {pct(guard.ceiling, 0)}</small>
        </div>
      </div>
      <p className={guard.ok ? 'hint ok' : 'hint bad'}>{guard.reason}</p>

      <h3 className="section-title">Walzen ({machine.reels.length}/{capacity})</h3>
      <div className="reel-slots">
        {machine.reels.map((reelId, slot) => (
          <div className="reel-slot" key={`${slot}-${reelId}`}>
            <span className="reel-name">{getReel(reelId).name}</span>
            <select
              value={reelId}
              onChange={(event) => props.onSwapReel(slot, event.target.value as ReelId)}
              aria-label={`Walze ${slot + 1} tauschen`}
            >
              <option value={reelId}>{getReel(reelId).name}</option>
              {ownedReels.map((owned, index) => (
                <option key={`${owned}-${index}`} value={owned}>{getReel(owned).name}</option>
              ))}
            </select>
            {machine.reels.length > 3 && (
              <button type="button" className="link" onClick={() => props.onRemoveReel(slot)}>ausbauen</button>
            )}
          </div>
        ))}
        {machine.reels.length < capacity && (
          <button type="button" className="reel-add" onClick={props.onAddReel} disabled={ownedReels.length === 0}>
            + Walze {ownedReels.length === 0 ? '(Inventar leer)' : 'einsetzen'}
          </button>
        )}
      </div>

      <h3 className="section-title">Einsatz pro Linie</h3>
      <div className="bet-steps">
        {betSteps(def.minBetVC, def.maxBetVC).map((bet) => (
          <button
            key={bet}
            type="button"
            className={machine.baseBet === bet ? 'active' : ''}
            onClick={() => props.onSetBet(bet)}
          >
            {toVCString(bet)}
          </button>
        ))}
      </div>

      <h3 className="section-title">Mods ({machine.mods.length}/{def.maxMods})</h3>
      <div className="mod-list">
        {modsForVenue(venueTier).map((mod) => {
          const isInstalled = installed.has(mod.id);
          const full = machine.mods.length >= def.maxMods;
          return (
            <button
              type="button"
              key={mod.id}
              className={isInstalled ? 'mod installed' : 'mod'}
              disabled={isInstalled || full || cash < mod.priceVC}
              onClick={() => props.onInstallMod(mod.id)}
            >
              <strong>{mod.name}</strong>
              <span>{mod.description}</span>
              <small>
                {isInstalled
                  ? 'verbaut'
                  : `${mod.tag} · ${vc(mod.priceVC)} · +${(mod.attractionBps / 100).toFixed(0)} Anziehung · ${mod.patienceDelta >= 0 ? '+' : ''}${mod.patienceDelta} Geduld`}
              </small>
            </button>
          );
        })}
      </div>
      {machine.mods.length > 0 && (
        <p className="hint">Verbaut: {machine.mods.map((id) => getMod(id).name).join(', ')}</p>
      )}

      <h3 className="section-title">Kombis ({synergies.length})</h3>
      <div className="synergy-list">
        {synergies.map((synergy) => (
          <article className="synergy" key={synergy.id}>
            <strong>{synergy.name}</strong>
            <span>{synergy.description}</span>
            <small>
              +{(synergy.attractionBps / 100).toFixed(1)} Anziehung · {synergy.patienceDelta >= 0 ? '+' : ''}{synergy.patienceDelta} Geduld
              {synergy.addictionBonus > 0 ? ` · +${synergy.addictionBonus} Sucht` : ''}
            </small>
          </article>
        ))}
        {synergies.length === 0 && (
          <p className="hint">Zwei Mods mit passenden Tags bilden eine Kombi. Zwei NEON-Mods zum Beispiel.</p>
        )}
      </div>

      <div className="test-spin">
        <button type="button" className="primary" onClick={testSpin}>TESTSPIN (gratis)</button>
        {result && (
          <div className="spin-result" key={spinKey}>
            <div className="reel-grid">
              {result.grid.map((column, reelIndex) => (
                <div className="reel-col" key={reelIndex}>
                  {column.map((symbol, rowIndex) => (
                    <Symbol key={`${reelIndex}-${rowIndex}`} symbol={symbol} size={34} />
                  ))}
                </div>
              ))}
            </div>
            <strong className={result.totalPayout > 0 ? 'win' : ''}>
              {result.totalPayout > 0 ? `+${toVCString(result.totalPayout)}` : result.isNearMiss ? 'SO KNAPP' : 'KEIN GEWINN'}
            </strong>
          </div>
        )}
      </div>
    </PopupShell>
  );
}
