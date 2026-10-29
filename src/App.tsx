import { useEffect, useRef, useState } from 'react';
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
import { MiniMap } from './ui/mini-map';

type Popup = { kind: 'guests'; guestId: number | null } | { kind: 'machine'; itemId: number } | { kind: 'games' } | null;

function fits(view: GameView, id: BuildId, x: number, y: number): boolean {
  const def = getBuildDef(id);
  if (x < 1 || y < 1 || x + def.w >= view.size - 1 || y + def.h >= view.size - 1) return false;
  return !view.furniture.some((item) =>
    x < item.x + item.w && x + def.w > item.x && y < item.y + item.h && y + def.h > item.y);
}

export default function App() {
  const view = useWorldStore();
  const [popup, setPopup] = useState<Popup>(null);
  const [buildOpen, setBuildOpen] = useState(false);
  const [placing, setPlacing] = useState<BuildId | null>(null);
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
      if (placing) { setPlacing(null); setPlaceError(''); }
      else if (buildOpen) setBuildOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [placing, buildOpen]);

  const place = (id: BuildId, x: number, y: number): void => {
    if (!fits(view, id, x, y)) { setPlaceError('Da ist kein Platz. Freie Fläche wählen.'); return; }
    if (view.house < getBuildDef(id).cost) { setPlaceError('Das Hauskonto reicht nicht.'); return; }
    worldStore.build(id, x, y);
    setPlacing(null);
    setPlaceError('');
    setBuildOpen(false);
  };

  const pick = (id: BuildId): void => {
    setPlacing(id);
    setPlaceError('');
    setBuildOpen(false);
    setPopup(null);
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
        onTakeHome={() => worldStore.takeHome(20)}
      />

      <main
        className={`stage-wrap${placing ? ' is-placing' : ''}`}
        onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; }}
        onDrop={(event) => {
          event.preventDefault();
          const id = event.dataTransfer.getData('text/build') as BuildId;
          const cell = stage.current?.cellAt(event.clientX, event.clientY);
          if (id && cell) place(id, cell.x, cell.y);
        }}
      >
        <FloorStage
          ref={stage}
          view={view}
          onGuest={(id) => { setBuildOpen(false); setPopup({ kind: 'guests', guestId: id }); }}
          onFurniture={(id) => { setBuildOpen(false); setPopup({ kind: 'machine', itemId: id }); }}
          onEmpty={(x, y) => {
            if (placing) { place(placing, x, y); return; }
            worldStore.moveTo({ x, y });
          }}
        />

        <div className="stage-legend">
          <span><b>KLICK</b> laufen</span>
          <span><b>GAST</b> Budget</span>
          <span><b>OBJEKT</b> Zustand</span>
          <span><b>RAD</b> zoomen</span>
        </div>

        <MiniMap
          view={view}
          onZone={(id) => stage.current?.zoomToZone(id)}
          onFit={() => stage.current?.fit()}
          onZoomIn={() => stage.current?.zoomIn()}
          onZoomOut={() => stage.current?.zoomOut()}
        />

        {placing && (
          <div className="place-hint">
            <b>{getBuildDef(placing).name}</b>
            <span>{placeError || 'Auf freie Fläche klicken. Ziehen geht auch.'}</span>
            <button type="button" className="btn tiny" onClick={() => { setPlacing(null); setPlaceError(''); }}>ABBRECHEN</button>
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
          placing={placing}
          onClose={() => setBuildOpen(false)}
          onPick={pick}
          onTemplate={(id: TemplateId) => worldStore.setTemplate(id)}
          onHire={(role) => worldStore.hire(role)}
          onFire={(role) => worldStore.fire(role)}
          onPrice={(key, value) => worldStore.setPrice(key, value)}
          onCarpet={(id: CarpetId) => worldStore.setCarpet(id)}
          onRepair={(id) => worldStore.repair(id)}
          onClean={() => worldStore.clean()}
        />
      )}

      {popup?.kind === 'guests' && (
        <GuestPopup view={view} selectedId={popup.guestId} onClose={() => setPopup(null)} onPay={(id) => worldStore.pay(id)} onServe={(id) => worldStore.serveDrink(id)} />
      )}

      {popup?.kind === 'games' && (
        <GamesPopup
          view={view}
          onClose={() => setPopup(null)}
          onPlay={(game, bet, edge) => worldStore.playForeign(game, bet, edge)}
          onTakeHome={() => worldStore.takeHome(20)}
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
