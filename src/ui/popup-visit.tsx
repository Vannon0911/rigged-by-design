/** Fremdes Haus besuchen: dort gelten die Mods des Besitzers, nicht deine. */
import { useState } from 'react';
import { fromVC, toVCString, type VaCoinMicro } from '../core/economy/vacoin';
import { getMod } from '../core/offer/mods';
import { HOUSES, type HouseId, type HouseSpinResult } from '../core/visit/houses';
import type { VenueTier } from '../core/venues';
import { PopupShell } from './popup-shell';
import { SymbolRow } from './symbol';
import { vc } from './format';

export interface VisitPopupProps {
  readonly venueTier: VenueTier;
  readonly cash: VaCoinMicro;
  readonly lastHouse: HouseSpinResult | null;
  readonly onSpin: (houseId: HouseId, bet: VaCoinMicro) => void;
  readonly onClose: () => void;
}

const BETS: readonly VaCoinMicro[] = [fromVC(0.1), fromVC(0.25), fromVC(0.5), fromVC(1)];

export function VisitPopup({ venueTier, cash, lastHouse, onSpin, onClose }: VisitPopupProps) {
  const [bet, setBet] = useState<VaCoinMicro>(BETS[0]!);
  return (
    <PopupShell eyebrow="FREMDES HAUS" title="Du bist hier Gast" onClose={onClose} wide>
      <p className="hint">
        In einem fremden Casino gelten die Hausregeln des Besitzers. Deine Mods wirken hier nicht.
        Bargeld: {toVCString(cash)}.
      </p>
      <div className="bet-steps">
        {BETS.map((step) => (
          <button key={step} type="button" className={bet === step ? 'active' : ''} onClick={() => setBet(step)}>
            {toVCString(step)}
          </button>
        ))}
      </div>

      {lastHouse && (
        <div className="house-result">
          <span className="eyebrow">LETZTES ERGEBNIS · {lastHouse.houseName}</span>
          <SymbolRow symbols={lastHouse.spin.grid.map((column) => column[1] ?? 'BLANK')} />
          <strong className={lastHouse.payout > 0 ? 'win' : ''}>
            {lastHouse.payout > 0 ? `+${toVCString(lastHouse.payout)}` : `−${toVCString(lastHouse.totalBet)}`}
          </strong>
        </div>
      )}

      <div className="house-list">
        {HOUSES.map((house) => {
          const locked = house.tier > venueTier;
          const totalBet = (bet * house.paylines) as VaCoinMicro;
          const belowMin = bet < house.minBetVC;
          return (
            <article className={locked ? 'house locked' : 'house'} key={house.id}>
              <header>
                <strong>{house.name}</strong>
                <span className="house-tier">Stufe {house.tier}</span>
              </header>
              <p>{house.description}</p>
              <small>
                Haus-Mods: {house.mods.map((id) => getMod(id).name).join(', ') || 'keine'} · {house.reels.length} Walzen · {house.paylines} Linien
              </small>
              <div className="house-foot">
                <span>ab {vc(house.minBetVC)} / Linie</span>
                <button
                  type="button"
                  className="primary"
                  disabled={locked || belowMin || cash < totalBet}
                  onClick={() => onSpin(house.id, bet)}
                >
                  {locked
                    ? `ab Stufe ${house.tier}`
                    : belowMin
                      ? `ab ${vc(house.minBetVC)} / Linie`
                      : `${toVCString(totalBet)} spielen`}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </PopupShell>
  );
}
