<p align="center">
  <img src="./docs/banner.svg" alt="Rigged by Design – Neon-Slotmaschine mit Kirschen, Sieben und Diamanten" width="100%">
</p>

<h1 align="center">Rigged by Design</h1>

<p align="center">
  <strong>Dein Casino. Deine Regeln.</strong><br>
  Vite · React 19 · TypeScript · PixiJS 8 · Vitest
</p>

> „Der Hausvorteil ist kein Bug. Er ist das Produkt.“

**Kein Echtgeld. Keine echten Casinos. Nur fiktive VaCoins, simulierte Gäste und ein RNG, das genau das tut, was man ihm sagt.**

---

## Die Idee

**Ein Bild, ein Kreislauf.** Du startest mit **0,0000 VC** und einem gratis rostigen Automaten. Gäste kommen von selbst, spielen an deinen Maschinen und lassen ihr Geld im Tresor. Du hebst ab, kaufst Walzen, Mods und Deko, stellst den Automaten um und siehst zu, wie die richtigen Leute bleiben.

Alles passiert auf dem Floor. Es gibt keine Tabs und keine Dashboard-Spalten; Maschinen, Gäste, Baumarkt und fremde Häuser öffnen als Popups. Der Floor läuft dahinter weiter.

Der Reiz ist nicht, die Slot-Mathematik zu lernen. Der Reiz ist, **Mods zu Kombinationen zu verbinden**, die zu einer bestimmten Kundschaft passen: zwei NEON-Mods für die Straße, CLASSIC plus BOOZE für den Stammtisch, SPEED plus HIGH_STAKES für die, die es sich leisten können. Gäste entscheiden anhand von Geschmack, Geduld, Sucht und Budget, ob dein Angebot zu ihnen passt.

Fremde Casinos sind der Ort, an dem **du Gast bist**: Dort gelten die Mods des Besitzers, nicht deine. Dein Bargeld ist der Einsatz.

## Die Schleife

1. **Gäste kommen.** Sie spawnen abhängig von Venue, Deko und Anziehung. Jeder Gast hat eine Persona, ein Budget, Geduld, Sucht und Geschmack.
2. **Gäste spielen.** Ein Spin pro Tick. Einsätze wandern in den Tresor, Gewinne werden als offene Auszahlung reserviert und warten an der Kasse.
3. **Tresor abheben.** Mit einem Klick geht der Tresor in die Kasse. Davon kaufst du Angebot, nicht vom Tresor.
4. **Angebot bauen.** Deko und Maschinen auf freie Felder ziehen oder anklicken. Maschinen bekommen Walzen und Mods.
5. **Kombis bauen.** Zwei passende Mod-Tags ergeben eine Kombi mit eigenem Bonus. Die Kombi steht im Automaten-Popup.
6. **Kasse halten.** Wer mit 0 Geduld und offenem Gewinn dasteht, blockiert einen Platz, bis du zahlst. Volle Plätze bedeuten keine neuen Gäste.
7. **Standort ausbauen.** Mehr Automaten und Bargeld schalten die nächste Venue frei: 4×4, 6×6, 8×8, 10×10.

## Steuerung

| Ort | Was du machst |
| --- | --- |
| **Floor** | Automaten anklicken: Walzen tauschen, Mods kaufen, Einsatz setzen, Testspin. Freie Felder anklicken: Baumarkt öffnen. |
| **Baumarkt-Leiste** | Objekt ziehen und auf ein Feld fallen lassen — oder anklicken und dann ein Feld wählen. |
| **HUD** | Tresor abheben, offene Gewinne sammeln, Gäste ansehen, fremdes Haus besuchen, Venue ausbauen. |
| **Popup** | `Escape` oder Klick auf den Hintergrund schließt. Der Floor tickt weiter. |

## Was drin ist

| Bereich | Inhalt |
| --- | --- |
| **Angebot** | Drei Automaten, vier Deko-Objekte, elf Walzen (3–6 Slots, tauschbar), sechs Betreiber-Mods, sechs Mod-Kombis. |
| **Gäste** | Fünf Personas mit Budget, Geduld, Suchtneigung und Tag-Geschmack. Auswahl nach Anziehung, Geschmack und Reibung am Mindesteinsatz. |
| **Kasse** | Gewinne werden bei `PENDING_PAYOUT` reserviert, an der Kasse ausgezahlt und blockieren wartende Gäste. Ein Klick auf „Alle zahlen“ räumt die Schlange. |
| **Wirtschaft** | VaCoins als ganzzahlige Mikro-Einheiten, doppelte Buchführung über sechs Konten, keine negativen Salden, Integritätsprüfung. |
| **Venues** | Vier Stufen von der nassen Straßenecke bis zum Palast: Grid, Kapazität, Gästebudget, Miete und RTP-Deckel wachsen mit. |
| **Fremde Häuser** | Vier Häuser mit eigenen Walzen, Mods, Mindesteinsätzen und Hausregeln. Deine Mods wirken dort nicht. |
| **RNG** | Seed-basierter Mulberry32, deterministische Walzen, Bias-Verträge mit harten Grenzen, Near-Miss und LDW. |
| **Guard** | 6.000-Spin-Schätzung pro Automat. Offensichtliche Gelddrucker werden blockiert; gierige Maschinen sind erlaubt, aber sichtbar. |
| **Persistenz** | Automatischer Spielstand in `localStorage` (v3), Ledger-Replay und PRNG-Zustand. Alte v2-Stände werden verworfen. |
| **Bühne** | Komplett prozedurale PixiJS-Grafik: Raum, Eingang, Kasse, Bar, Kabinette, Gäste, Partikel. Keine externen Bild-URLs. |

## Architektur

```text
src/
  core/            headless, kein React/Pixi
    economy/       Ledger, VaCoin-Mikro-Einheiten
    rng/           PRNG, gewichtete Pools, Bias-Verträge
    slot/          Slot-Engine, Auszahlungstabelle, Beweise
    machine/       Walzen/Mods zu einer Maschine, RTP-Guard
    offer/         Katalog, Walzen, Mods, Kombis, Tags
    visitors/      Personas, Spawn, Auswahl, Tick, Kassenbuchungen
    floor/         Grid, Platzieren, Miete, Ticks, Events
    visit/         fremde Häuser
  store/           ein Besitzer für Ledger, Floor, PRNG, Save und Snapshot
  stage/           Pixi: Raum, Kabinette, Gäste, Partikel, Bühne
  ui/              HUD, Baumarkt-Leiste und Popups
  styles/          Tokens, App, Popups
scripts/           LOC-Guard
.github/           CI
```

Die Regeln sind nicht dekorativ:

1. **200 LOC pro `.ts`/`.tsx`-Datei.** Komplexe Renderer dürfen 350 LOC haben, aber nur mit begründetem `// @loc-exception:` in Zeile 1. `scripts/check-loc.mjs` beendet sich sonst mit Exit-Code 1.
2. **`src/core/` bleibt headless.** Wirtschaft, Gäste und Maschinen müssen ohne Browser beweisbar sein.
3. **Geld ist ganzzahlig.** `1,0000 VC = 10.000` Mikro-Einheiten. Keine Floats, keine `0.1 + 0.2`-Überraschungen.
4. **Jede Buchung läuft über das Ledger.** Einsätze, Gewinne, Auszahlungen, Käufe und Miete sind Buchungen. Die Summe bleibt exakt null; nur `EXTERNAL_WORK` ist die Gegenpartei der Außenwelt.

## Schnellstart

Voraussetzung: **Node 22** und npm.

```bash
npm ci
npm run dev
```

Der Dev-Server läuft auf [http://localhost:3000](http://localhost:3000). Ein frischer Stand beginnt mit 0 VC, einem Automaten und einer Gratis-Walze im Inventar.

Alle Gates in einem Rutsch:

```bash
npm run verify:all
```

Das sind LOC-Guard, Typecheck, Tests und Production-Build.

## Tests

- **Ledger:** doppelte Buchführung, Unterdeckung, 1.000 zufällige Buchungen, Integrität.
- **RNG/Slots:** Seed-Reproduzierbarkeit, Symbolverteilung, LDW/Near-Miss, RTP-Beweise.
- **Guard:** Startautomat erlaubt, Ein-Symbol-Exploit blockiert, gierige Maschine erlaubt, deterministisch.
- **Kombis:** gleiche Tags, gemischte Tags, einzelne Mods.
- **Gäste-Fluss:** offene Gewinne blockieren den laufenden Gast nicht; ein Gast mit 0 Geduld wartet an der Kasse.

## Bewusst nicht drin

- **Echtgeld, Einzahlungen, Auszahlungen.** VaCoins sind fiktiv.
- **Accounts, Cloud-Saves, Multiplayer.** Der Stand lebt im Browser.
- **Getrennte Tisch-Engines.** Das Angebot wächst über Walzen und Mods, nicht über fünf Spiele-Engines.
- **Ein Fail-State über einen Timer.** Druck kommt aus Miete, vollen Plätzen und offenen Auszahlungen, nicht aus einem Run-Timer.
- **Migration alter Spielstände.** Die v2-Struktur passt nicht mehr; sie wird beim Start verworfen.

## Ernst gemeint

Dieses Spiel simuliert bewusst suchtfördernde Mechaniken: Near Misses, Loss Disguised as Wins, steigende Einsätze, Gäste mit Geduld und Sucht. Das ist Satire über Glücksspielprodukte, kein Glücksspielprodukt. Es gibt kein Echtgeld, keine Einzahlung und keinen Gewinn, der irgendwo ankommt.

Wenn Glücksspiel für dich aufgehört hat, ein Spiel zu sein, ist die [BZgA](https://www.bzga.de/) ein besserer Ansprechpartner als dieses Repository.
