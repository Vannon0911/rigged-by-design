import { useCallback, useEffect, useRef, useState } from 'react';
import { Application } from 'pixi.js';
import { getCpuCasino } from './core/simulation/cpu-casinos';
import { FloorMiniView } from './stage/floor-mini-view';
import { GameTablesPanel } from './stage/game-tables-panel';
import { SlotMachineView } from './stage/slot-machine-view';
import { gameStore, useGameStore } from './store/use-game-store';
import { TopBar } from './ui/hud/top-bar';
import { TransactionTicker } from './ui/hud/transaction-ticker';
import { StageBar, type StageMode } from './ui/stage-bar';
import { BuildAndManage } from './ui/tabs/build-and-manage';
import { CharacterTab } from './ui/tabs/character-tab';
import { HustleAndGamble } from './ui/tabs/hustle-and-gamble';
import { WorkshopPage } from './ui/workshop';

type TabId = 'HUSTLE' | 'BUILD' | 'WORKSHOP' | 'CHARACTER';

const TABS: readonly { id: TabId; label: string }[] = [
  { id: 'HUSTLE', label: '1. Arbeiten & CPU-Casinos' },
  { id: 'BUILD', label: '2. Eigenes Casino & Baumarkt' },
  { id: 'WORKSHOP', label: '3. RNG-Labor & Werkstatt' },
  { id: 'CHARACTER', label: '4. Charakter & Mods' },
];

export default function App() {
  const game = useGameStore();
  const [tab, setTab] = useState<TabId>('HUSTLE');
  const [stageMode, setStageMode] = useState<StageMode>('SLOT');
  const hostRef = useRef<HTMLDivElement | null>(null);
  const slotRef = useRef<SlotMachineView | null>(null);
  const floorRef = useRef<FloorMiniView | null>(null);
  const lockRef = useRef(false);

  const handleSpin = useCallback(async (): Promise<boolean> => {
    if (lockRef.current) return false;
    const result = gameStore.spinCpu();
    if (!result) return false;
    lockRef.current = true;
    try {
      await slotRef.current?.spin(result.spin);
    } finally {
      lockRef.current = false;
    }
    return true;
  }, []);

  useEffect(() => {
    if (tab === 'BUILD') setStageMode('FLOOR');
    else if (tab === 'HUSTLE') setStageMode('SLOT');
  }, [tab]);

  useEffect(() => {
    if (tab === 'CHARACTER' || stageMode === 'TABLES') return;
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let slot: SlotMachineView | null = null;
    let floorView: FloorMiniView | null = null;
    let app: Application | null = null;

    const boot = async (): Promise<void> => {
      if (stageMode === 'SLOT') {
        const created = await SlotMachineView.create(host, {
          mode: 'CPU',
          onSpinRequest: () => void handleSpin(),
        });
        if (disposed) {
          created.destroy();
          return;
        }
        slot = created;
        slotRef.current = created;
        return;
      }

      const createdApp = new Application();
      await createdApp.init({
        background: '#05070d',
        width: 440,
        height: 520,
        antialias: true,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
      });
      if (disposed) {
        createdApp.destroy(true);
        return;
      }
      app = createdApp;
      host.appendChild(createdApp.canvas);
      floorView = new FloorMiniView(createdApp, 48);
      floorView.container.position.set(16, 16);
      createdApp.stage.addChild(floorView.container);
      floorView.update(gameStore.floorView);
      floorRef.current = floorView;
    };

    host.replaceChildren();
    void boot();
    return () => {
      disposed = true;
      slotRef.current = null;
      floorRef.current = null;
      slot?.destroy();
      floorView?.destroy();
      if (app) app.destroy(true, { children: true });
      host.replaceChildren();
    };
  }, [stageMode, handleSpin, tab]);

  useEffect(() => {
    floorRef.current?.update(gameStore.floorView);
  }, [game]);

  const stageCaption = stageMode === 'SLOT'
    ? `CPU · ${getCpuCasino(game.casinoId).name}`
    : stageMode === 'FLOOR'
      ? `${game.placements.length} Objekte · ${game.visitors.length} Gäste`
      : 'Hütchenspiel & Street Craps · Demo';

  return (
    <div className="game-shell">
      <TopBar
        cash={game.cash}
        vault={game.vault}
        visitors={game.visitors.length}
        avgAddiction={game.avgAddiction}
        ledgerOk={game.ledgerOk}
        notice={game.notice}
        onDeposit={() => gameStore.moveToVault('IN')}
        onWithdraw={() => gameStore.moveToVault('OUT')}
      />

      <div className="game-grid">
        <section className="stage-column">
          <div className="stage-frame">
            <StageBar mode={stageMode} caption={stageCaption} onSelect={setStageMode} />
            {tab === 'CHARACTER'
              ? (
                <div key="character-stage" className="stage-host stage-placeholder">
                  <div>
                    <span className="stage-caption">Spieler-Profil</span>
                    <strong>Charakter-Labor</strong>
                    <p className="hint">Aussehen, Player-Mods und Suspicion rechts bearbeiten.</p>
                  </div>
                </div>
              )
              : stageMode === 'TABLES'
                ? <GameTablesPanel />
                : <div key="pixi-stage" className="stage-host" ref={hostRef} aria-label="PixiJS Bühne" />}
          </div>
          <TransactionTicker entries={game.lastEntries} />
        </section>

        <aside className="panel-column">
          <nav className="main-tabs" aria-label="Hauptbereiche">
            {TABS.map((entry, index) => (
              <button
                type="button"
                key={entry.id}
                className={entry.id === tab ? 'active' : ''}
                onClick={() => setTab(entry.id)}
              >
                <span>{index + 1}</span>
                {entry.label.replace(/^\d+\.\s*/, '')}
              </button>
            ))}
          </nav>

          <div className="tab-body">
            {tab === 'HUSTLE' && <HustleAndGamble onSpin={handleSpin} />}
            {tab === 'BUILD' && <BuildAndManage />}
            {tab === 'WORKSHOP' && <WorkshopPage cash={game.cash} />}
            {tab === 'CHARACTER' && <CharacterTab />}
          </div>
        </aside>
      </div>
    </div>
  );
}
