/** Charakter am Spieltisch: sichtbare Player-Mods und direkter Mod-Trigger. */
import { useEffect, useRef } from 'react';
import { Application } from 'pixi.js';
import { PLAYER_MODS, suspicionForUse, type PlayerModId } from '../core/mods/player-mods';
import type { PlayerProfileView } from '../core/character/player-profile';
import { PlayerAvatarView } from '../stage/player-avatar-view';

export interface PlayerPlayDockProps {
  readonly profile: PlayerProfileView;
  readonly revision: number;
  readonly onUseMod: (id: PlayerModId) => void;
}

export function PlayerPlayDock({ profile, revision, onUseMod }: PlayerPlayDockProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<PlayerAvatarView | null>(null);
  const stateRef = useRef(profile);
  stateRef.current = profile;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let app: Application | null = null;
    const boot = async (): Promise<void> => {
      const created = new Application();
      await created.init({ background: '#080b13', width: 168, height: 172, antialias: true, autoDensity: true, resolution: window.devicePixelRatio || 1 });
      if (disposed) { created.destroy(true); return; }
      app = created;
      host.appendChild(created.canvas);
      const view = new PlayerAvatarView(stateRef.current);
      view.setScale(0.28);
      view.container.position.set(84, 150);
      created.stage.addChild(view.container);
      viewRef.current = view;
    };
    void boot();
    return () => { disposed = true; viewRef.current = null; app?.destroy(true, { children: true }); host.replaceChildren(); };
  }, []);

  useEffect(() => {
    viewRef.current?.update(profile);
  }, [profile, revision]);

  const equipped = PLAYER_MODS.filter((mod) => profile.equippedPlayerMods.includes(mod.id));

  return (
    <aside className="player-play-dock" aria-label="Spieler am Tisch">
      <div className="player-dock-head">
        <span>DU · SUSPICION {profile.suspicion}/100</span>
        <div className="player-suspicion"><span style={{ width: `${profile.suspicion}%` }} /></div>
      </div>
      <div className="player-dock-avatar" ref={hostRef} />
      <div className="player-mod-triggers">
        {equipped.length === 0 ? (
          <small>Keine Spieler-Mods ausgerüstet.</small>
        ) : equipped.map((mod) => (
          <button type="button" key={mod.id} onClick={() => onUseMod(mod.id)} title={mod.description}>
            <strong>{mod.name.replace('Gezinkte ', '').replace('Vergoldeter ', '')}</strong>
            <span>+{suspicionForUse(profile.equippedPlayerMods, mod.id)} Risiko</span>
          </button>
        ))}
      </div>
    </aside>
  );
}
