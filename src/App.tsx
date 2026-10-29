import { useCallback, useState } from 'react';
import type { PlacedItem } from './core/simulation/floor-types';
import type { CpuTableGame } from './core/simulation/cpu-tables';
import { FloorStage } from './stage/floor-stage';
import { playerStore, usePlayerStore } from './store/player-store';
import { gameStore, useGameStore } from './store/use-game-store';
import { ArcadeBar, type HudSection } from './ui/hud/arcade-bar';
import { ProgressionBanner } from './ui/hud/progression-banner';
import { TransactionTicker } from './ui/hud/transaction-ticker';
import { CpuCasinoDock } from './ui/dock/cpu-casino-dock';
import { FloorActionPanel, type FloorSelection } from './ui/floor-action-panel';
import { PlayerPlayDock } from './ui/player-play-dock';
import { PlayStage, type PlayGame } from './ui/stage/play-stage';
import { BuildAndManage } from './ui/tabs/build-and-manage';
import { CharacterTab } from './ui/tabs/character-tab';
import { WorkshopPage } from './ui/workshop';

type StageMode = 'FLOOR' | 'PLAY';

export default function App() {
  const game = useGameStore();
  const player = usePlayerStore();
  const [mode, setMode] = useState<StageMode>('FLOOR');
  const [section, setSection] = useState<HudSection>('CASINO');
  const [playGame, setPlayGame] = useState<PlayGame>('SLOT');
  const [source, setSource] = useState<'CPU' | 'OWN'>('CPU');
  const [selection, setSelection] = useState<FloorSelection | null>(null);

  const go = (next: HudSection): void => {
    setSection(next);
    setSelection(null);
    if (next === 'CPU') { setMode('PLAY'); setPlayGame('SLOT'); setSource('CPU'); }
    else setMode('FLOOR');
  };
  const openTable = (table: CpuTableGame): void => { setPlayGame(table); setSource('CPU'); setMode('PLAY'); };
  const openFloorItem = useCallback((item: PlacedItem): void => {
    setSelection({ x: item.x, y: item.y, item });
    setMode('FLOOR');
  }, []);
  const openEmptyCell = useCallback((x: number, y: number): void => {
    setSelection({ x, y });
    setMode('FLOOR');
  }, []);
  const openWorkshop = (): void => { setSection('WORKSHOP'); setMode('FLOOR'); setSelection(null); };
  const openItemPlay = (kind: 'SLOT' | 'SHELL' | 'DICE' | 'ROULETTE' | 'BLACKJACK' | 'POKER'): void => {
    setPlayGame(kind);
    setSource('OWN');
    setMode('PLAY');
    setSelection(null);
  };

  return (
    <div className="casino-app">
      <ArcadeBar
        cash={game.cash}
        vault={game.vault}
        visitors={game.visitors.length}
        avgAddiction={game.avgAddiction}
        ledgerOk={game.ledgerOk}
        notice={game.notice}
        section={section}
        onSection={go}
        onDeposit={() => gameStore.moveToVault('IN')}
        onWithdraw={() => gameStore.moveToVault('OUT')}
      />

      <div className="casino-main">
        <section className="stage-shell">
          <div className="stage-modebar">
            <div className="stage-switch">
              <button type="button" className={mode === 'FLOOR' ? 'active' : ''} onClick={() => setMode('FLOOR')}>DEIN CASINO</button>
              <button type="button" className={mode === 'PLAY' ? 'active' : ''} onClick={() => setMode('PLAY')}>SELBER SPIELEN</button>
            </div>
            <span>{game.floorSize}×{game.floorSize} GRID · {game.placements.length} OBJEKTE · {game.visitors.length} GÄSTE</span>
            <strong>{game.notice}</strong>
          </div>

          <div className="stage-body">
            {mode === 'FLOOR' ? (
              <FloorStage
                floor={gameStore.floorView}
                events={game.floorEvents}
                avatar={{ appearance: player.profile.appearance, cosmetics: player.profile.cosmetics, suspicion: player.profile.suspicion }}
                revision={game}
                onEmptyCell={openEmptyCell}
                onItem={openFloorItem}
              />
            ) : (
              <PlayStage game={playGame} source={source} onGame={setPlayGame} onSource={setSource} onExit={() => setMode('FLOOR')} />
            )}

            {mode === 'FLOOR' && selection && (
              <FloorActionPanel
                selection={selection}
                tier={game.venueTier}
                cash={game.cash}
                events={game.floorEvents}
                onClose={() => setSelection(null)}
                onWorkshop={openWorkshop}
                onPlay={openItemPlay}
              />
            )}
            {mode === 'PLAY' && (
              <PlayerPlayDock
                profile={player.profile}
                revision={player.revision}
                onUseMod={(id) => playerStore.useMod(id, gameStore.ledger, gameStore.tickCount)}
              />
            )}
          </div>
        </section>

        <aside className="dock-shell">
          <div className="dock-scroll">
            <ProgressionBanner />
            {section === 'CASINO' && <BuildAndManage />}
            {section === 'CPU' && <CpuCasinoDock onSlot={() => { setMode('PLAY'); setPlayGame('SLOT'); setSource('CPU'); }} onTable={openTable} />}
            {section === 'WORKSHOP' && <WorkshopPage cash={game.cash} />}
            {section === 'CHARACTER' && <CharacterTab />}
          </div>
          <TransactionTicker entries={game.lastEntries} />
        </aside>
      </div>
    </div>
  );
}
