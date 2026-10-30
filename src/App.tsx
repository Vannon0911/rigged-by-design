import { useEffect, useRef, useState } from 'react';
import { canPlaceAt } from './core/sim/grid-zones';
import { getBuildDef, type BuildId } from './core/sim/offers';
import type { CarpetId, TemplateId } from './core/sim/types';
import { FloorStage, type FloorHandle } from './render/floor-stage';
import { useWorldStore, worldStore } from './store/use-world-store';
import type { GameView } from './store/types';
import { BuildPanel } from './ui/build-panel';
import { GamesPopup } from './ui/games-popup';
import { GuestPopup } from './ui/guest-popup';
import { Hud } from './ui/hud';
import { MachinePopup } from './ui/machine-popup';

type Popup = { kind: 'guests'; guestId: number | null } | { kind: 'machine'; itemId: number } | { kind: 'games' } | null;

function fits(view: GameView, id: BuildId, x: number, y: number): boolean {
  const def = getBuildDef(id);
  const blockers = [view.player.position, ...view.guests.map((guest) => guest.position)];
  return canPlaceAt(view.size, view.furniture, blockers, x, y, def.w, def.h, def.seats > 0);
}

export default function App() {
  const view = useWorldStore();
  const [popup, setPopup] = useState<Popup>(null);
  const [buildOpen, setBuildOpen] = useState(false);
  const [placeError, setPlaceError] = useState('');
  const stage = useRef<FloorHandle>(null);

  useEffect(() => {
    if (!view.notice) return;
    const id = window.setTimeout(() => worldStore.dismiss(), 6500);
    return () => window.clearTimeout(id);
  }, [view.notice]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      if (buildOpen) setBuildOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [buildOpen]);

  const carryingCrate = view.player.carrying.startsWith('KRATE:');
  const ghostId = (() => {
    const match = /^KRATE:(\d+)$/.exec(view.player.carrying);
    const crate = match ? view.crates.find((entry) => entry.id === Number(match[1])) : undefined;
    return crate && crate.payload.kind === 'FURNITURE' ? crate.payload.buildId : null;
  })();

  const buy = (id: BuildId): void => {
    if (view.house < getBuildDef(id).cost) { setPlaceError('Das Hauskonto reicht nicht.'); return; }
    worldStore.buy(id);
    setPlaceError('');
  };

  const deployAt = (x: number, y: number): void => {
    const match = /^KRATE:(\d+)$/.exec(view.player.carrying);
    const crate = match ? view.crates.find((entry) => entry.id === Number(match[1])) : undefined;
    if (!crate || crate.payload.kind !== 'FURNITURE') return;
    if (!fits(view, crate.payload.buildId, x, y)) return;
    worldStore.deploy(x, y);
  };

  const active = popup?.kind === 'machine' ? view.furniture.find((item) => item.id === popup.itemId) ?? null : null;

  return (
    <div className="app">
      <Hud
        view={view}
        onBuild={() => { setPopup(null); setBuildOpen((open) => !open); }}
        onGuests={() => { setBuildOpen(false); setPopup({ kind: 'guests', guestId: null }); }}
        onVisit={() => { setBuildOpen(false); setPopup({ kind: 'games' }); }}
        onClean={() => worldStore.clean()}
        onOverview={() => stage.current?.fit()}
        onSkill={(attribute) => worldStore.spendSkill(attribute)}
      />

      <main
        className={`stage-wrap${carryingCrate ? ' is-placing' : ''}`}
        onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; }}
        onDrop={(event) => {
          event.preventDefault();
          const id = event.dataTransfer.getData('text/build') as BuildId;
          if (id) buy(id);
        }}
      >
        <FloorStage
          ref={stage}
          view={view}
          placing={ghostId}
          onGuest={(id) => { setBuildOpen(false); setPopup({ kind: 'guests', guestId: id }); }}
          onFurniture={(id) => { setBuildOpen(false); setPopup({ kind: 'machine', itemId: id }); }}
          onEmpty={(x, y) => {
            if (carryingCrate) { deployAt(x, y); return; }
            worldStore.moveTo({ x, y });
          }}
        />

        <div className="stage-legend">
          <span><b>KLICK</b> Bereich zoomen</span>
          <span><b>GAST</b> Budget</span>
          <span><b>OBJEKT</b> Zustand</span>
          <span><b>RAD</b> zoomen</span>
        </div>

        {carryingCrate && (
          <div className="place-hint">
            <b>Kiste tragen</b>
            <span>{placeError || 'Auf freie Fläche klicken zum Aufstellen.'}</span>
          </div>
        )}

        {view.lastEvent && !view.notice && <div className="event-line">{view.lastEvent}</div>}

        {view.notice && (
          <button type="button" className="toast" onClick={() => worldStore.dismiss()}>{view.notice}</button>
        )}
      </main>

      {buildOpen && (
        <BuildPanel
          view={view}
          onClose={() => setBuildOpen(false)}
          onBuy={buy}
          onTemplate={(id: TemplateId) => worldStore.setTemplate(id)}
          onHire={(role) => worldStore.hire(role)}
          onFire={(role) => worldStore.fire(role)}
          onPrice={(key, value) => worldStore.setPrice(key, value)}
          onCarpet={(id: CarpetId) => worldStore.setCarpet(id)}
          onRepair={(id) => worldStore.repair(id)}
          onClean={() => worldStore.clean()}
          onPickup={(id) => worldStore.pickup(id)}
          onUnload={() => worldStore.unloadHere()}
          onOrderDrinks={(count) => worldStore.orderDrinks(count)}
          onOrderParts={(count) => worldStore.orderParts(count)}
          onUpgradeBar={() => worldStore.upgradeBar()}
          onUpgradeWc={() => worldStore.upgradeWc()}
          onWall={(color) => worldStore.setWall(color)}
          onNeon={(color) => worldStore.setNeon(color)}
          onServeDesk={() => worldStore.serveDesk()}
          onCalm={(id) => worldStore.calm(id)}
        />
      )}

      {popup?.kind === 'guests' && (
        <GuestPopup view={view} selectedId={popup.guestId} onClose={() => setPopup(null)} onPay={(id) => worldStore.pay(id)} onServe={(id) => worldStore.serveDrink(id)} onCalm={(id) => worldStore.calm(id)} onTalk={(id) => worldStore.talk(id)} onFight={(id) => worldStore.fightBrawl(id)} />
      )}

      {popup?.kind === 'games' && (
        <GamesPopup
          view={view}
          onClose={() => setPopup(null)}
          onPlay={(game, bet, edge) => worldStore.playForeign(game, bet, edge)}
          onTakeHome={() => worldStore.takeHome(5)}
        />
      )}

      {active && (
        <MachinePopup
          item={active}
          view={view}
          onClose={() => setPopup(null)}
          onTest={() => worldStore.spinTest(active.id)}
          onRepair={() => worldStore.repair(active.id)}
          onMod={(id) => worldStore.installMod(active.id, id)}
          onAddReel={() => worldStore.addReel(active.id)}
          onBet={(value) => worldStore.setBet(active.id, value)}
          onTakeDrink={() => worldStore.takeDrink()}
        />
      )}
    </div>
  );
}
