import { useState } from 'react';
import { toVCString } from '../../core/economy/vacoin';
import { TRIBUTE_INTERVAL } from '../../core/progression/roguelite-loop';
import { progressionStore, useProgressionStore } from '../../store/progression-store';

function countdown(ticks: number): string {
  const safe = Math.max(0, Math.ceil(ticks));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

export function ProgressionBanner() {
  const p = useProgressionStore();
  const [saveOpen, setSaveOpen] = useState(false);
  const [exportText, setExportText] = useState('');
  const [importText, setImportText] = useState('');
  const progress = Math.min(100, Math.max(0, 100 - (p.ticksUntilTribute / TRIBUTE_INTERVAL) * 100));

  const exportSave = (): void => {
    const text = progressionStore.exportSave();
    setExportText(text);
    if (typeof navigator !== 'undefined') void navigator.clipboard?.writeText(text);
  };

  return (
    <>
      <section className={`progression-banner ${p.status.toLowerCase()}`}>
        <div className="venue-block">
          <span className="progression-kicker">Venue {p.venue.tier} / 4</span>
          <strong>{p.venue.name}</strong>
          <small>
            {p.venue.gridSize}×{p.venue.gridSize} · {p.nextVenue
              ? `Nächster: ${p.nextVenue.name} · ${toVCString(p.nextVenue.unlockCostVC)}`
              : 'Maximaler Ausbau erreicht'}
          </small>
          {p.nextRequirement && (
            <small className="venue-requirements">
              {p.growth.revenueVC >= p.nextRequirement.minRevenueVC ? '✓' : '·'} Umsatz{' '}
              {toVCString(p.growth.revenueVC)} / {toVCString(p.nextRequirement.minRevenueVC)} ·{' '}
              {p.growth.gameCount}/{p.nextRequirement.minGames} Spiele
            </small>
          )}
        </div>

        <div className="tribute-block">
          <span className="progression-kicker">
            {p.status === 'TRIBUTE_DUE' ? 'TRIBUT FÄLLIG' : p.status === 'RUN_OVER' ? 'RUN BEENDET' : `Zyklus ${p.cycle} · Syndikat wartet`}
          </span>
          <strong>{toVCString(p.tributeDueVC)}</strong>
          <div className="tribute-track"><span style={{ width: `${progress}%` }} /></div>
          <small>{countdown(p.ticksUntilTribute)} bis zum Tribut · Umsatz {toVCString(p.revenueVC)}</small>
        </div>

        <div className="progression-actions">
          <button type="button" disabled={!p.canUpgrade || p.status === 'RUN_OVER'} onClick={() => progressionStore.upgradeVenue()}>
            Standort vergrößern
          </button>
          {p.status === 'TRIBUTE_DUE' && (
            <button type="button" className="primary" disabled={!p.canPayTribute} onClick={() => progressionStore.payTribute()}>
              Tribut zahlen
            </button>
          )}
          <button type="button" onClick={() => setSaveOpen((open) => !open)}>Save-Manager</button>
          {p.status !== 'RUN_OVER' && (
            <button type="button" className="danger" onClick={() => progressionStore.abandonRun()}>Run aufgeben</button>
          )}
        </div>
        <p className="progression-notice">{p.notice}</p>
      </section>

      {p.status === 'PERK_CHOICE' && (
        <section className="progression-modal perk-modal">
          <header>
            <span className="progression-kicker">Schutzgeld bezahlt · Zyklus {p.cycle} überlebt</span>
            <h2>Wähle 1 von 3 Blaupausen</h2>
          </header>
          <div className="perk-grid">
            {p.offeredPerks.map((perk) => (
              <button type="button" key={perk.id} onClick={() => progressionStore.choosePerk(perk.id)}>
                <strong>{perk.name}</strong>
                <span>{perk.description}</span>
                <small>{perk.blueprint ? 'Blaupause · bleibt im nächsten Run' : 'Sofort-Bonus'}</small>
              </button>
            ))}
          </div>
        </section>
      )}

      {p.status === 'RUN_OVER' && (
        <section className="progression-modal run-over-modal">
          <header>
            <span className="progression-kicker">Syndikats-Pfändung</span>
            <h2>Run over. Nimm die Siegel mit.</h2>
            <p>Umsatz {toVCString(p.revenueVC)} · {p.meta.tokens} Syndikat-Siegel verfügbar.</p>
          </header>
          <div className="meta-shop">
            {p.metaUnlocks.map((unlock) => {
              const owned = p.meta.unlocks.includes(unlock.id);
              return (
                <button
                  type="button"
                  key={unlock.id}
                  disabled={owned || p.meta.tokens < unlock.costTokens}
                  onClick={() => progressionStore.buyMeta(unlock.id)}
                >
                  <strong>{unlock.name}</strong>
                  <span>{unlock.description}</span>
                  <small>{owned ? 'FREIGESCHALTET' : `${unlock.costTokens} Siegel`}</small>
                </button>
              );
            })}
          </div>
          <button type="button" className="primary" onClick={() => progressionStore.newRun()}>
            Nächsten Run starten
          </button>
        </section>
      )}

      {saveOpen && (
        <section className="progression-modal save-modal">
          <header>
            <span className="progression-kicker">Versionierter Full-Save · schemaVersion 1</span>
            <h2>Save-Manager</h2>
          </header>
          <div className="save-actions">
            <button type="button" onClick={exportSave}>Export erzeugen</button>
            <button type="button" onClick={() => progressionStore.importSave(importText)} disabled={!importText.trim()}>
              Import anwenden
            </button>
          </div>
          <label>
            Export
            <textarea readOnly value={exportText} placeholder="Export erzeugen, um den kompletten Spielstand zu kopieren." />
          </label>
          <label>
            Import
            <textarea value={importText} onChange={(event) => setImportText(event.target.value)} placeholder="Full-Save-JSON hier einfügen." />
          </label>
          <small className="progression-notice">Import prüft das Ledger vor dem Neustart. Ungültige Saves werden abgelehnt.</small>
        </section>
      )}
    </>
  );
}
