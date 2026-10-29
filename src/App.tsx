import { useEffect, useRef, useState } from 'react';
import type { ItemId } from './core/offer/catalog';
import type { HouseId } from './core/visit/houses';
import { FloorStage, type FloorStageHandle } from './stage/floor-stage';
import { gameStore, useGameStore } from './store/use-game-store';
import { BuildTray } from './ui/build-tray';
import { Hud } from './ui/hud';
import { BuildPopup } from './ui/popup-build';
import { GuestsPopup } from './ui/popup-guests';
import { MachinePopup } from './ui/popup-machine';
import { VisitPopup } from './ui/popup-visit';

type Popup =
  | { readonly kind: 'build' }
  | { readonly kind: 'guests' }
  | { readonly kind: 'visit' }
  | { readonly kind: 'machine'; readonly id: number }
  | null;

export default function App() {
  const snapshot = useGameStore();
  const [popup, setPopup] = useState<Popup>(null);
  const [placing, setPlacing] = useState<ItemId | null>(null);
  const floorRef = useRef<FloorStageHandle>(null);

  useEffect(() => {
    if (!snapshot.notice) return;
    const id = setTimeout(() => gameStore.dismissNotice(), 6000);
    return () => clearTimeout(id);
  }, [snapshot.notice]);

  const placeAt = (itemId: ItemId, x: number, y: number): void => {
    gameStore.placeItem(itemId, x, y);
    setPlacing(null);
  };

  const dropItem = (itemId: ItemId, clientX: number, clientY: number): void => {
    const cell = floorRef.current?.cellAt(clientX, clientY);
    if (cell) placeAt(itemId, cell.x, cell.y);
  };

  const activeMachine = popup?.kind === 'machine'
    ? snapshot.machines.find((machine) => machine.id === popup.id) ?? null
    : null;

  return (
    <div className="app">
      <Hud
        snapshot={snapshot}
        onBuild={() => setPopup({ kind: 'build' })}
        onGuests={() => setPopup({ kind: 'guests' })}
        onVisit={() => setPopup({ kind: 'visit' })}
        onUpgrade={() => gameStore.upgradeVenue()}
        onWithdraw={() => gameStore.withdrawVault()}
        onPayAll={() => gameStore.payAllVisitors()}
      />

      <main className="stage-wrap">
        <FloorStage
          ref={floorRef}
          snapshot={snapshot}
          onMachine={(id) => setPopup({ kind: 'machine', id })}
          onEmpty={(x, y) => {
            if (placing) placeAt(placing, x, y);
            else setPopup({ kind: 'build' });
          }}
        />
        {placing && (
          <div className="place-hint">
            Klicke ein freies Feld für dein Objekt.
            <button type="button" className="link" onClick={() => setPlacing(null)}>abbrechen</button>
          </div>
        )}
        {snapshot.notice && (
          <button type="button" className="notice" onClick={() => gameStore.dismissNotice()}>
            {snapshot.notice}
          </button>
        )}
      </main>

      <BuildTray
        venueTier={snapshot.venueTier}
        cash={snapshot.cash}
        selected={placing}
        onSelect={(id) => setPlacing(id)}
        onDrop={dropItem}
      />

      {popup?.kind === 'build' && (
        <BuildPopup
          cash={snapshot.cash}
          venueTier={snapshot.venueTier}
          ownedReels={snapshot.ownedReels.length}
          onClose={() => setPopup(null)}
          onSelectItem={(id) => { setPlacing(id); setPopup(null); }}
          onBuyReel={(id) => gameStore.buyReel(id)}
        />
      )}

      {popup?.kind === 'guests' && (
        <GuestsPopup
          visitors={snapshot.visitors}
          onPay={(id) => gameStore.payVisitor(id)}
          onPayAll={() => gameStore.payAllVisitors()}
          onClose={() => setPopup(null)}
        />
      )}

      {popup?.kind === 'visit' && (
        <VisitPopup
          venueTier={snapshot.venueTier}
          cash={snapshot.cash}
          lastHouse={snapshot.lastHouse}
          onSpin={(houseId: HouseId, bet) => gameStore.visit(houseId, bet)}
          onClose={() => setPopup(null)}
        />
      )}

      {activeMachine && (
        <MachinePopup
          machine={activeMachine}
          venueTier={snapshot.venueTier}
          ownedReels={snapshot.ownedReels}
          cash={snapshot.cash}
          onClose={() => setPopup(null)}
          onSwapReel={(slot, reelId) => gameStore.swapReel(activeMachine.id, slot, reelId)}
          onAddReel={() => gameStore.addReelSlot(activeMachine.id)}
          onRemoveReel={(slot) => gameStore.removeReel(activeMachine.id, slot)}
          onInstallMod={(modId) => gameStore.installMod(activeMachine.id, modId)}
          onSetBet={(bet) => gameStore.setBaseBet(activeMachine.id, bet)}
        />
      )}
    </div>
  );
}
