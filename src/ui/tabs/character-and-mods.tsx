import { useEffect, useRef, useState } from 'react';
import { Application } from 'pixi.js';
import { MAX_EQUIPPED_PLAYER_MODS, type PlayerProfileView } from '../../core/character/player-profile';
import { APPEARANCE_OPTIONS, type Appearance } from '../../core/character/appearance';
import { PLAYER_MODS, suspicionForUse, type PlayerModId } from '../../core/mods/player-mods';
import { toVCString, type VaCoinMicro } from '../../core/economy/vacoin';
import { PlayerAvatarView, type AvatarViewState } from '../../stage/player-avatar-view';

export interface CharacterAndModsProps {
  readonly profile: PlayerProfileView;
  readonly ownedMods: readonly PlayerModId[];
  readonly cash: VaCoinMicro;
  readonly revision: number;
  readonly onBuy: (id: PlayerModId) => void;
  readonly onToggleEquip: (id: PlayerModId) => void;
  readonly onAppearanceChange?: (appearance: Appearance) => void;
}

interface RowProps<T extends string> {
  readonly label: string;
  readonly value: T;
  readonly options: readonly T[];
  readonly onPick: (value: T) => void;
}

function Row<T extends string>({ label, value, options, onPick }: RowProps<T>) {
  return (
    <div className="appearance-row">
      <span>{label}</span>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          className={option === value ? 'chip active' : 'chip'}
          onClick={() => onPick(option)}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function avatarState(profile: PlayerProfileView): AvatarViewState {
  return { appearance: profile.appearance, cosmetics: profile.cosmetics, suspicion: profile.suspicion };
}

export function CharacterAndMods({ profile, ownedMods, cash, revision, onBuy, onToggleEquip, onAppearanceChange }: CharacterAndModsProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const viewRef = useRef<PlayerAvatarView | null>(null);
  const stateRef = useRef<AvatarViewState>(avatarState(profile));
  const [localVersion, setLocalVersion] = useState(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;

    const boot = async () => {
      const app = new Application();
      await app.init({
        background: '#0a0e18',
        width: 320,
        height: 380,
        antialias: true,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
      });
      if (disposed) {
        app.destroy(true);
        return;
      }
      appRef.current = app;
      host.appendChild(app.canvas);
      const view = new PlayerAvatarView(stateRef.current);
      view.container.position.set(160, 250);
      app.stage.addChild(view.container);
      viewRef.current = view;
    };

    void boot();

    return () => {
      disposed = true;
      viewRef.current = null;
      // React entfernt den Host beim Tab-Wechsel; Pixi darf das Canvas nicht doppelt lösen.
      appRef.current?.destroy(false, { children: true });
      appRef.current = null;
    };
  }, []);

  useEffect(() => {
    stateRef.current = avatarState(profile);
    viewRef.current?.update(stateRef.current);
  }, [profile, revision, localVersion]);

  const pickAppearance = <K extends keyof Appearance>(key: K, value: Appearance[K]) => {
    setLocalVersion((version) => version + 1);
    onAppearanceChange?.({ ...profile.appearance, [key]: value });
  };

  const effects = profile.effects;
  const equipped = profile.equippedPlayerMods;
  const appearance = profile.appearance;

  return (
    <section className="character-panel">
      <header className="panel-head">
        <h2>Charakter &amp; Spieler-Mods</h2>
        <span className="price">{toVCString(cash)}</span>
      </header>

      <div className="character-body">
        <div className="avatar-stage" ref={hostRef} aria-label="Spieler-Charakter" />

        <div className="character-controls">
          <Row label="Körper" value={appearance.bodyTone} options={APPEARANCE_OPTIONS.bodyTone} onPick={(v) => pickAppearance('bodyTone', v)} />
          <Row label="Outfit" value={appearance.outfitId} options={APPEARANCE_OPTIONS.outfitId} onPick={(v) => pickAppearance('outfitId', v)} />
          <Row label="Gesicht" value={appearance.faceId} options={APPEARANCE_OPTIONS.faceId} onPick={(v) => pickAppearance('faceId', v)} />
          <Row label="Kopfbedeckung" value={appearance.headgearId} options={APPEARANCE_OPTIONS.headgearId} onPick={(v) => pickAppearance('headgearId', v)} />
          <Row label="Hand" value={appearance.handItemId} options={APPEARANCE_OPTIONS.handItemId} onPick={(v) => pickAppearance('handItemId', v)} />

          <div className="risk">
            <div className="risk-labels">
              <span>Suspicion {profile.suspicion}/100</span>
              <span>Mods {equipped.length}/{MAX_EQUIPPED_PLAYER_MODS}</span>
            </div>
            <div className="risk-bar">
              <span className={profile.suspicion >= 80 ? 'risk-fill danger' : 'risk-fill'} style={{ width: `${profile.suspicion}%` }} />
            </div>
            <p className="mod-meta">
              Luck-Bias +{profile.luckBiasBps / 100}% · Payout +{effects.payoutBonusBps / 100}% · Reveal {effects.shellRevealBps / 100}% · Lookahead {effects.cardLookahead}
            </p>
            <p className="hint">Bei 100: Rauswurf, 15 % Bargeld weg, 60 s CPU-Casino gesperrt.</p>
          </div>
        </div>
      </div>

      <div className="mod-grid">
        {PLAYER_MODS.map((mod) => {
          const owned = ownedMods.includes(mod.id);
          const isEquipped = equipped.includes(mod.id);
          const atLimit = equipped.length >= MAX_EQUIPPED_PLAYER_MODS;
          return (
            <article key={mod.id} className={isEquipped ? 'mod-card equipped' : 'mod-card'}>
              <header>
                <h3>{mod.name}</h3>
                <span className="price">{toVCString(mod.priceVC)}</span>
              </header>
              <p>{mod.description}</p>
              <p className="mod-meta">
                Sichtbar: {mod.cosmetic.label} · +{suspicionForUse(equipped, mod.id)} Suspicion/Einsatz · {mod.scope}
              </p>
              {owned ? (
                <button type="button" onClick={() => onToggleEquip(mod.id)} disabled={!isEquipped && atLimit}>
                  {isEquipped ? 'Ablegen' : 'Ausrüsten'}
                </button>
              ) : (
                <button type="button" className="buy" onClick={() => onBuy(mod.id)} disabled={cash < mod.priceVC}>
                  Kaufen
                </button>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
