<p align="center">
  <img src="./docs/banner.svg" alt="Rigged by Design – Neon-Slotmaschine mit Kirschen, Sieben und Diamanten" width="100%">
</p>

<h1 align="center">Rigged by Design</h1>

<p align="center">
  <strong>Dein Casino. Deine Gäste. Deine Regeln.</strong><br>
  Vite · React 19 · TypeScript · PixiJS 8 · Vitest
</p>

> „Der Hausvorteil ist kein Bug. Er ist das Produkt.“

Kein Echtgeld. Keine echten Casinos. Nur fiktive VaCoins, simulierte Gäste und ein Haus, das jeden Tag Miete frisst.

---

## Die Idee

Du startest mit **0,00 VC** und **einem gratis Automaten**. Gäste betreten dein Casino am Eingang, wechseln an der Kasse Fiat in Chips und suchen sich selbst einen Platz. Manche spielen, manche trinken, manche gehen aufs Klo – und alle entscheiden anhand von **Laune, Geduld, Sucht, Budget und Persona**, ob dein Angebot zu ihnen passt.

Es gibt **ein Bild**: den Floor. Keine Tabs, keine Dashboard-Spalten. Bauen, Gäste, Personal, Preise und fremde Häuser öffnen als Popups; dahinter läuft die Simulation weiter.

Der Reiz ist nicht, Slot-Mathematik zu lernen. Der Reiz ist, **Mods, Spiele und Preise zu einer Kombination zu bauen**, die genau die Gäste anzieht, die bleiben und irgendwann süchtig werden. Und die, die nicht bleiben, werden wütend und beschädigen dein Mobiliar – es sei denn, du zahlst für einen Guard.

Fremde Casinos sind der Ort, an dem **du Gast bist**. Dort spielst du mit deinem eigenen Portemonnaie gegen die Hausregeln anderer Besitzer.

## Der Kreislauf

1. **Gäste kommen.** Zulauf hängt an Ordnung, Zustand deiner Geräte, Personal und Attraktion – nicht an einem Timer.
2. **Wechselkasse.** Jeder Gast bringt Fiat mit. Erst am Schalter wird daraus VC; es gibt keine zweite Geldwahrheit.
3. **Angebot.** Gäste wählen nach Persona-Geschmack, Mindesteinsatz, Zustand und Mods. Volle Plätze bedeuten Warten oder Ausweichen.
4. **Spiel.** Einsätze gehen ins Hauskonto, Gewinne warten als offene Auszahlung. Du zahlst an der Kasse aus.
5. **Ausbau.** Vom Hauskonto kaufst du Spiele, Deko, Mods, Walzen, Personal, Reinigung und Reparaturen.
6. **Zustand.** Dreck und kaputte Geräte senken die Reputation. Weniger Zulauf, schlechtere Laune, mehr Wut.
7. **Fremdes Haus.** Nimm Bargeld aus dem Hauskonto mit, setze es draußen und bring Gewinne zurück.

## Zwei Töpfe, eine Wahrheit

| Topf | Wofür |
| --- | --- |
| **Hauskonto** | Geschäftskonto. Alles, was das Casino kauft oder einnimmt, läuft hier durch. |
| **Portemonnaie** | Dein persönliches Bargeld. Entsteht nur, wenn du vom Hauskonto abhebst, und wird nur in fremden Häusern verspielt. |
| **Wechselkasse** | Der physische Schalter. Gäste wechseln hier Fiat in Chips und lassen sich Gewinne auszahlen. |

Jede Buchung läuft über das Ledger. Es gibt kein `addVC` außerhalb einer Buchung, keinen direkten Sprung vom Portemonnaie in den Tresor und keine Geldquelle außerhalb von `EXTERNAL_WORLD`.

## Spiele

Sieben Spiele mit unterschiedlichen Charakteren: **Book-of-Ra-Slot, Plinko, Blackjack, Video Poker, Roulette, Hütchenspiel und Würfel**. Am eigenen Automaten gibt es nur den **kostenlosen Testspin** – der Betreiber spielt nicht gegen sein eigenes Haus. In fremden Häusern wird mit richtigem Portemonnaie-Geld gespielt, inklusive optionalem Vollbild.

Im Floor zeigt die Automatenanzeige bei Zoom, was der sitzende Gast gerade dreht. Im Popup siehst du den Testspin mit echten Walzen, Mods und Zustand.

Die Grafik ist vollständig prozedural: South-Park-nahe Cutout-Figuren aus Pixi-Vektorteilen, Sprechblasen, Emotions-Sticker, Laufwege und Kamera-Zoom. Keine externen Bild-URLs, keine Asset-Pipeline.

## Floor und Kamera

Drei Hausgrößen als Vorlagen: **klein (30×30), mittel (60×60), groß (90×90)**. Jede Region ist 30×30 Kacheln. Die Minimap zeigt die Übersicht; ein Klick auf eine Zone zoomt hinein. Der Zoom folgt deinem Charakter, die Übersicht bleibt lesbar.

Der Charakter läuft per **Point-and-Click** über das Grid. Du kannst Bedienung selbst machen: an die Bar gehen, einen Drink zapfen und ihn einem Gast bringen. Oder Personal einstellen, das sauber macht, hinter der Bar steht und Ärger verhindert.

## Steuerung

| Ort | Aktion |
| --- | --- |
| **Floor** | Freie Fläche: Charakter läuft dorthin. Gast: Budget, Laune, Geduld, Sucht. Objekt: Zustand, Mods, Testspin. |
| **Bauen** | Spiel oder Deko anklicken und auf den Floor setzen – oder direkt aus dem Panel ziehen. |
| **HUD** | Hauskonto abheben, Gäste ansehen, fremdes Haus besuchen, putzen. |
| **Minimap** | Zonen anklicken, zoomen, alles einpassen. |
| **Popup** | `Escape` oder Klick auf den Hintergrund schließt. Die Simulation läuft weiter. |

## Architektur

```text
src/
  core/
    economy/       Ledger, VaCoin als ganzzahlige Mikro-Einheiten
    rng/           deterministischer Mulberry32
    sim/           Welt, Templates, Pfade, Gäste, Angebot, Mods, Tick, Aktionen
    games/         kompakte Runden für alle sieben Spiele
  store/           ein Besitzer für Welt, Ledger, PRNG, Uhr und Save
  render/          Pixi: Floor, Kamera, Möbel, Figuren, Dreck
  ui/              HUD, Minimap und Popups
  styles/          Tokens, App, Popups
scripts/           LOC-Guard
.github/           CI
```

Die Regeln:

1. **200 LOC pro `.ts`/`.tsx`-Datei.** Renderer und der zentrale Store dürfen 350 LOC haben, aber nur mit begründetem `// @loc-exception:` in Zeile 1. `scripts/check-loc.mjs` bricht sonst ab.
2. **`src/core/` bleibt headless.** Simulation und Geld müssen ohne Browser testbar sein.
3. **Ein Besitzer pro Zustand.** `world-store` hält Welt, Ledger und PRNG; UI-Zustand wie offene Popups lebt in React.
4. **Geld ist ganzzahlig.** 1 VC = 10.000 Mikro-Einheiten, keine Floats.
5. **Jede Buchung ist eine Ledger-Zeile.** Käufe, Einsätze, Gewinne, Löhne, Miete und Auszahlungen.

## Start

Voraussetzung: Node 22 und npm.

```bash
npm ci
npm run dev
```

Der Dev-Server läuft auf [http://localhost:3000](http://localhost:3000). Ein frischer Stand beginnt mit 0 VC und einem Gratis-Automaten. Alte Spielstände aus v3/v4 werden verworfen; der aktuelle Save ist v5.

Alle Gates:

```bash
npm run verify:all
```

Das sind LOC-Guard, Typecheck, Tests und Production-Build.

## Tests

- **Ledger:** doppelte Buchführung, Unterdeckung, 1.000 zufällige Buchungen, Integrität.
- **Spiele:** jedes Spiel deterministisch und gültig; Monte-Carlo sichert 90–96 % RTP und sichtbare Gewinnchancen; Testspin kostet kein Geld; fremde Runden buchen nur vom Portemonnaie.
- **Welt:** Startzustand mit 0 VC und einem Gratis-Automaten; Spawn am Eingang; Max-Pool für Laune, Geduld und Sozialverhalten; Wechsel erst an der Kasse.
- **Angebot:** Mods verändern Anziehung und Geduld; Persona-Geschmack verschiebt die Platzwahl.
- **Simulation:** 900 Ticks ohne negatives Konto, ohne Ledger-Leck, mit Tageswechsel.
- **Service:** Drink zapfen und am Gast abgeben; belegte Plätze werden nicht doppelt reserviert.

## Bekannte Grenzen

- **Kein Multiplayer, keine Accounts, keine Cloud-Saves.** Der Stand lebt im Browser.
- **Die Spiele sind kompakte Simulationen**, keine vollständigen Tisch-Engines mit Split, Double Down oder Side Pots. Das Angebot wächst über Maschinen, Mods und Preise.
- **Kein Echtgeld.** VaCoins sind fiktiv; die Wirtschaft ist eine Satire auf Casino-Produkte.
- **Der Save ist lokal und wächst mit dem Ledger.** Für sehr lange Sitzungen ist noch kein Ledger-Checkpoint eingebaut.

## Ernst gemeint

Dieses Spiel simuliert bewusst suchtfördernde Mechaniken: Near Misses, Gewinne, die wie Verluste aussehen, steigende Einsätze, Gäste mit Geduld und Sucht. Das ist Satire über Glücksspielprodukte, kein Glücksspielprodukt. Es gibt kein Echtgeld, keine Einzahlung und keinen Gewinn, der irgendwo ankommt.

Wenn Glücksspiel für dich aufgehört hat, ein Spiel zu sein, ist die [BZgA](https://www.bzga.de/) ein besserer Ansprechpartner als dieses Repository.
