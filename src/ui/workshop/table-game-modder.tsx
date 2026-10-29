import { useMemo, useState } from 'react';
import type { VenueTier } from '../../core/progression/venues-and-tiers';
import type { DeckModId } from '../../core/games/cards/card-shoe';
import { pct } from './lab-model';
import {
  BUILD_SAMPLE,
  BUILD_SEED,
  DEFAULT_TABLE_BUILDS,
  TABLE_TABS,
  dicePayout,
  roulettePayout,
  runTableBuildProof,
  shellMultiplier,
  toggleDeck,
  toggleDeckIds,
  withShellBias,
  type TableBuilds,
  type TableGameId,
} from './table-modder-model';

interface RangeProps {
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly onChange: (value: number) => void;
  readonly suffix?: string;
}

function Range({ label, value, min, max, step, onChange, suffix = '' }: RangeProps) {
  return (
    <label className="modder-range">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
      <strong>{value.toFixed(step < 0.1 ? 2 : 1)}{suffix}</strong>
    </label>
  );
}

export interface TableGameModderProps {
  readonly venueTier: VenueTier;
}

export function TableGameModder({ venueTier }: TableGameModderProps) {
  const [active, setActive] = useState<TableGameId>('SHELL');
  const [builds, setBuilds] = useState<TableBuilds>(DEFAULT_TABLE_BUILDS);
  const tab = TABLE_TABS.find((entry) => entry.id === active)!;
  const locked = tab.minTier > venueTier;
  const proof = useMemo(() => {
    try {
      return runTableBuildProof(builds, active);
    } catch {
      return null;
    }
  }, [builds, active]);

  const setShell = (patch: Partial<TableBuilds['shell']>): void => setBuilds({ ...builds, shell: { ...builds.shell, ...patch } });
  const setDice = (patch: Partial<TableBuilds['dice']>): void => setBuilds({ ...builds, dice: { ...builds.dice, ...patch } });
  const setRoulette = (patch: Partial<TableBuilds['roulette']>): void => setBuilds({ ...builds, roulette: { ...builds.roulette, ...patch } });
  const setBlackjack = (patch: Partial<TableBuilds['blackjack']>): void => setBuilds({ ...builds, blackjack: { ...builds.blackjack, ...patch } });
  const setPoker = (patch: Partial<TableBuilds['poker']>): void => setBuilds({ ...builds, poker: { ...builds.poker, ...patch } });
  const shellBias = builds.shell.mods.find((mod) => mod.target === 'HIT_RATE')?.value ?? 0;
  const shellPull = builds.shell.manipulation?.pullStrength ?? 0;
  const dicePull = builds.dice.manipulation?.pullStrength ?? 0;

  return (
    <section className="table-modder">
      <header className="studio-head">
        <div>
          <h3>Tisch-Baukasten</h3>
          <p className="lab-note">Deck-Mods, Extra-Becher, Extra-Würfel, Quoten und Zahlen-Bias.</p>
        </div>
        <span className="lab-footer">{BUILD_SAMPLE} Live-Runden pro Regler</span>
      </header>

      <div className="reel-tabs">
        {TABLE_TABS.map((entry) => (
          <button type="button" key={entry.id} className={entry.id === active ? 'reel-tab active' : 'reel-tab'} onClick={() => setActive(entry.id)} disabled={entry.minTier > venueTier} title={entry.minTier > venueTier ? `Ab Standort ${entry.minTier}` : undefined}>
            {entry.name}
          </button>
        ))}
      </div>

      {locked ? (
        <p className="lab-error">Gesperrt: Dieser Tisch braucht eigenen Casino-Rang {tab.minTier}.</p>
      ) : (
        <>
          {active === 'SHELL' && (
            <div className="modder-controls">
              <Range label="Becher" value={builds.shell.cups} min={3} max={5} step={1} onChange={(cups) => setShell({ cups: cups as 3 | 4 | 5, variant: cups === 4 ? builds.shell.variant : 'CLASSIC' })} />
              <label className="modder-check"><input type="checkbox" checked={builds.shell.variant === 'DOUBLE_BALL'} onChange={(event) => setShell({ cups: event.target.checked ? 4 : builds.shell.cups, variant: event.target.checked ? 'DOUBLE_BALL' : 'CLASSIC' })} /> Doppel-Kugel (nur 4 Becher)</label>
              <Range label="Auszahlung" value={shellMultiplier(builds.shell)} min={1.5} max={10} step={0.1} suffix="x" onChange={(value) => setShell({ multiplierBps: Math.round(value * 10_000) })} />
              <Range label="Treffer-Bias" value={shellBias} min={-0.35} max={0.35} step={0.01} onChange={(value) => setBuilds({ ...builds, shell: withShellBias(builds.shell, value) })} />
              <Range label="Zahlen-Pull" value={shellPull} min={-1} max={1} step={0.05} onChange={(value) => setShell({ manipulation: { targetNumbers: [0], pullStrength: value } })} />
            </div>
          )}
          {active === 'DICE' && (
            <div className="modder-controls">
              <Range label="Würfel" value={builds.dice.diceCount} min={2} max={4} step={1} onChange={(count) => setDice({ diceCount: count as 2 | 3 | 4 })} />
              <label className="modder-check"><input type="checkbox" checked={builds.dice.devilDie === true} onChange={(event) => setDice({ devilDie: event.target.checked })} /> Teufelswürfel</label>
              <Range label="Auszahlung" value={dicePayout(builds.dice)} min={1} max={12} step={0.1} suffix="x" onChange={(value) => setDice({ payoutBps: Math.round(value * 10_000) })} />
              <Range label="Sechser-Gewicht" value={builds.dice.weights?.[6] ?? 100} min={50} max={200} step={5} onChange={(weight) => setDice({ weights: { ...(builds.dice.weights ?? {}), 6: weight } })} />
              <Range label="Zahlen-Pull" value={dicePull} min={-1} max={1} step={0.05} onChange={(value) => setDice({ manipulation: { targetNumbers: [6], pullStrength: value } })} />
            </div>
          )}
          {active === 'ROULETTE' && (
            <div className="modder-controls">
              <label className="modder-check"><input type="checkbox" checked={builds.roulette.tripleZero === true} onChange={(event) => setRoulette({ tripleZero: event.target.checked, doubleZero: event.target.checked })} /> Extra 00 + 000</label>
              <label className="modder-check"><input type="checkbox" checked={builds.roulette.lightning === true} onChange={(event) => setRoulette({ lightning: event.target.checked })} /> Lightning-Pockets</label>
              <Range label="Rot/Schwarz-Quote" value={roulettePayout(builds.roulette)} min={1.5} max={2.5} step={0.05} suffix="x" onChange={(value) => setRoulette({ payoutBps: Math.round(value * 10_000) })} />
              <Range label="Null-Gewicht" value={builds.roulette.pocketWeights?.['0'] ?? 100} min={100} max={400} step={10} onChange={(weight) => setRoulette({ pocketWeights: { ...(builds.roulette.pocketWeights ?? {}), '0': weight } })} />
            </div>
          )}
          {active === 'BLACKJACK' && (
            <div className="modder-controls">
              {([['DECK_FIFTH_ACE', 'Extra-Ass'], ['DECK_DEATH_CARD', 'Totenkopf-Karte'], ['DECK_GREEDY_TENS', '10er entfernen'], ['DECK_FAT_FIVES', 'Extra-5er']] as const).map(([id, label]) => (
                <label className="modder-check" key={id}><input type="checkbox" checked={builds.blackjack.deckMods.includes(id as DeckModId)} onChange={() => setBlackjack(toggleDeck(builds.blackjack, id as DeckModId))} /> {label}</label>
              ))}
              <label className="modder-check"><input type="checkbox" checked={builds.blackjack.dealerPush22} onChange={(event) => setBlackjack({ dealerPush22: event.target.checked })} /> Dealer-Push bei 22</label>
              <label className="modder-check"><input type="checkbox" checked={builds.blackjack.blackjackPayoutBps === 22_000} onChange={(event) => setBlackjack({ blackjackPayoutBps: event.target.checked ? 22_000 : 25_000 })} /> Blackjack nur 6:5</label>
              <label className="modder-check"><input type="checkbox" checked={builds.blackjack.dealerBias} onChange={(event) => setBlackjack({ dealerBias: event.target.checked })} /> Dealer-Späher (Peek 2)</label>
            </div>
          )}
          {active === 'POKER' && (
            <div className="modder-controls">
              <label className="modder-check"><input type="checkbox" checked={builds.poker.playerCards === 6} onChange={(event) => setPoker({ playerCards: event.target.checked ? 6 : 5, tableTier: event.target.checked ? 'SIX_CARD_SOFT' : 'STANDARD' })} /> Sechskarten-Deal</label>
              {([['DECK_FIFTH_ACE', 'Extra-Ass im Schuh'], ['DECK_DEATH_CARD', 'Totenkopf-Karte']] as const).map(([id, label]) => (
                <label className="modder-check" key={id}><input type="checkbox" checked={(builds.poker.deckMods ?? []).includes(id)} onChange={() => setPoker({ deckMods: toggleDeckIds(builds.poker.deckMods ?? [], id) })} /> {label}</label>
              ))}
              <label className="modder-check"><input type="checkbox" checked={builds.poker.riverTaxBps > 0} onChange={(event) => setPoker({ riverTaxBps: event.target.checked ? 10_000 : 0 })} /> River-Bluff-Steuer</label>
              <label className="modder-check"><input type="checkbox" checked={builds.poker.jackpotBonus} onChange={(event) => setPoker({ jackpotBonus: event.target.checked })} /> Jackpot-Bonusfeld</label>
              <label className="modder-check"><input type="checkbox" checked={builds.poker.dealerQualifyPair} onChange={(event) => setPoker({ dealerQualifyPair: event.target.checked })} /> Dealer braucht ein Paar</label>
            </div>
          )}
        </>
      )}

      {proof && !locked && (
        <div className="lab-kpis">
          <div className="kpi"><span>Trefferquote</span><strong>{pct(proof.hitRate)}</strong></div>
          <div className="kpi"><span>RTP</span><strong>{pct(proof.measuredRTP * 100)}</strong></div>
          <div className="kpi"><span>Hausvorteil</span><strong>{pct(proof.houseEdge * 100)}</strong></div>
          <div className="kpi"><span>Sucht-Aufbau</span><strong>{proof.addictionScore} / 100</strong></div>
        </div>
      )}
      <p className="lab-footer">Entwurf wird live auf echten Core-Runden geprüft. Seed {BUILD_SEED} / {BUILD_SAMPLE}.</p>
    </section>
  );
}
