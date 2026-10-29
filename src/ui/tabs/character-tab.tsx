/** Charakter-Tab: verbindet Spielerprofil, Mod-Kauf und das Haupt-Ledger. */
import { gameStore, useGameStore } from '../../store/use-game-store';
import { playerStore, usePlayerStore } from '../../store/player-store';
import { CharacterAndMods } from './character-and-mods';

export function CharacterTab() {
  const game = useGameStore();
  const player = usePlayerStore();

  return (
    <div className="tab-page">
      <p className="hint">{player.notice}</p>
      <CharacterAndMods
        profile={player.profile}
        ownedMods={player.ownedMods}
        cash={game.cash}
        revision={player.revision}
        onBuy={(id) => gameStore.buyPlayerMod(id)}
        onToggleEquip={(id) => playerStore.toggleEquip(id)}
        onAppearanceChange={() => playerStore.refresh()}
      />
    </div>
  );
}
