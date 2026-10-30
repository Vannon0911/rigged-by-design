# Architektur und Governance

## Zustandsbesitz

- `src/store/world-store.ts` ist der einzige Besitzer von Welt, Ledger, PRNG und Save.
- `src/core/` bleibt headless: Simulation, Geld und Spiele kennen weder DOM noch Pixi.
- `src/render/` liest ausschließlich `GameView`-Snapshots; dort liegt kein Spielzustand.
- `src/ui/` liest denselben Snapshot und sendet nur Commands an den Store.
- Geld existiert nur als Ledger-Buchung; VaCoins sind ganzzahlige Mikro-Einheiten.
- Fiat eines Gastes liegt ab dem Spawn auf `FIAT_<id>`, Chips auf `VISITOR_<id>`, offene Gewinne auf `PENDING_<id>`. Ein fehlgeschlagener Transfer lässt Gast und Guthaben stehen.
- Auszahlungen werden nie gekappt: Das Hauskonto zahlt, so weit es reicht; der Rest wird als Verbindlichkeit auf `HAUS_SCHULDEN` gebucht (`openLiability`). Die Summe aller Konten bleibt null.
- Der Umbau läuft über `src/core/sim/remodel.ts`: erst Deckung prüfen, dann alle Gastansprüche buchen, dann Geld buchen und das Haus tauschen.
- Der Save ist v6; `replaySave` hebt v5-Stände beim Laden an und bucht damaliges Fiat als Konto nach.
- Zufall ist seedbar und läuft ausschließlich über `src/core/rng/`: `weighted.ts` zieht Zahlen aus einer Gewichtsverteilung, die ihre eigenen Chancen mitliefert (Bias ≤ 9.000 bps, Deadzones, nie 100 %); `shoe.ts` zieht Karten ohne Zurücklegen und mischt erst den leeren Schuh neu. Es gibt kein `Math.random()` im Spielpfad.
- Physik liegt in `src/core/physics/`: `body.ts` beschreibt Koerper (Position, Geschwindigkeit, Rotation, Winkelgeschwindigkeit, Masse, Traegheit, Reibung, Restitution, Form), `world.ts` simuliert mit festem Zeitschritt und aufgeloesten Impulsen. Kollisionen erzeugen ueber die Tangentialreibung echtes Drehmoment. Statische Koerper koennen rotieren und uebertragen ihre Oberflaechengeschwindigkeit; `trigger`-Zonen sind nicht solide und werden ueber `triggerHits` gelesen. Die Welt kennt weder Pixi noch DOM, und die Breitphase ist allokationsfrei.
- Plinko ist kein Wuerfel mehr: `src/core/games/plinko-board.ts` baut das Board aus echten Pegs, Waenden und Deflektoren. Zufall steckt nur in der Startbedingung; welches Fach der Ball trifft, entscheiden danach ausschliesslich Kollisionen. Die Paytable ist auf die gemessene Fachverteilung geeicht.
- Jedes Spiel hat seine eigene Engine unter `src/core/games/engines/`: `slot.ts` (5x3, zehn Linien, gewichtete Symbole, BOOK als Wild und Scatter, Freispiele), `cards.ts` (Blackjack mit Ziehen/Verdoppeln und Dealer-Regel, Video Poker mit Hold/Draw und Paytable als Daten), `table.ts` (Roulette mit voller Wettfläche, zwei Würfel, Hütchenspiel mit Serie). `round.ts` ist nur noch der Dispatcher auf diese Engines.
- Spiele haben genau eine Naht: `src/core/games/contracts.ts`. `playAction({ game, stake, houseEdgeBps?, bonusBps? })` prüft die Aktion **vor** der Ziehung, spielt die Runde und liefert `{ game, stake, payout, multiplierBps, label, detail }`. `payout` ist immer `mulVC(stake, multiplierBps)`, ein Verlust bleibt 0, Bonus und Hausvorteil greifen nur auf Gewinne. `round.ts` ist nur noch die Engine dahinter: `playRound` hat außerhalb dieses Vertrags keinen Produktions-Aufrufer mehr. Verbraucher sind der Gast-Spin (`guest-play`), der freie Testspin und das Fremdspiel (`actions`).
- Der PRNG-Zustand (`prngState`) liegt im Save. `replaySave` zieht selbst nichts, deshalb setzt die Folge nach dem Laden exakt an der gespeicherten Stelle fort.

## Fehler-Governance

1. Jede Fehlermeldung hat das Format `[IDX-XXXX] [ERR-YYYY] Komponente: Klartext`.
2. Neue Fehlerarten werden zuerst in `docs/ERROR_CATALOG.md` und `src/core/governance/error-codes.ts` registriert.
3. `ERR-0000` ist ein unbekannter Fehler und blockiert den Build sofort (Fail-Closed).
4. `ERR-0911` kennzeichnet automatisch reparierbare Verstöße. `scripts/run-pipeline.mjs` führt `npm run autofix:0911` vor den harten Gates aus.
5. Jede Testdatei deklariert `@test-target` und `@error-code`; der Reporter `src/core/governance/test-harness.ts` gibt jeden Testfall indiziert aus.
6. Tests laufen im Thread-Pool (`pool: 'threads'`) mit harter Teardown-Grenze. Worker sind Threads im Runner-Prozess und sterben mit ihm, es bleiben also keine verwaisten Testprozesse zurueck; `testTimeout` und `teardownTimeout` beenden haengende Tests. Die sieben RTP-Monte-Carlo-Laeufe sind parallelisiert, die Stichprobengroesse je Spiel ist an seine Tail-Verteilung angepasst (Video Poker braucht wegen Royal und Straight Flush mehr Runden).

## Pipeline

Ein fehlgeschlagenes Autofix zählt als rotes Gate und beendet die Pipeline mit Nicht-Null-Exit.

`npm run verify:all` führt in dieser Reihenfolge aus:

1. `autofix:0911` (ESLint-Fix, Dependency-Matrix, Commit-Sanitizing)
2. ESLint (`ERR-4011`)
3. LOC-Guard (`ERR-4012`)
4. TypeScript (`ERR-1005`)
5. Testqualität und Determinismus (`ERR-1001`, `ERR-4001`, `ERR-4002`, `ERR-3001`)
6. Tote Exporte (`ERR-4003`)
7. Dependency-Matrix (`ERR-4013`, `ERR-4007`)
8. `npm audit --audit-level=low` (`ERR-4004`)
9. Vitest mit indizierten Testfällen
10. Production-Build (`ERR-1005`)

## Dependency-Begründungen

Jede Laufzeit- und Entwicklungabhängigkeit braucht eine nicht-leere Begründung und mindestens eine reale Nutzung. Die folgende Matrix wird von `scripts/sync-dependency-matrix.mjs` aus `package.json` und den echten Imports erzeugt.

<!-- DEP_MATRIX_START -->
| Paket | Version | Kategorie | Architektur-Begründung | Real genutzte Dateien (Anzahl & Pfade) |
| --- | --- | --- | --- | --- |
| @eslint/js | ^10.0.1 | Lint | Empfohlene ESLint-Basisregeln. | 1: `eslint.config.mjs` |
| @types/node | ^26.6.6 | Typen | Typen fuer Node-Builtins in Gate-Skripten und Vitest-Reporter. | 13: `scripts/autofix-0911.mjs`<br>`scripts/check-loc.mjs`<br>`scripts/ci-bump-version.mjs`<br>`scripts/lib/report.mjs`<br>`scripts/run-pipeline.mjs`<br>`scripts/sanitize-commit.mjs`<br>… (+7) |
| @types/react | ^19.0.7 | Typen | Typpaket fuer die React-19-API; wird implizit von React-Imports genutzt. | 8: `src/App.tsx`<br>`src/main.tsx`<br>`src/render/floor-stage.tsx`<br>`src/store/use-world-store.ts`<br>`src/ui/games-popup.tsx`<br>`src/ui/guest-popup.tsx`<br>… (+2) |
| @types/react-dom | ^19.0.3 | Typen | Typpaket fuer React-DOM; wird implizit von react-dom-Imports genutzt. | 1: `src/main.tsx` |
| @vitejs/plugin-react | ^4.3.4 | Build | React-19-JSX-Transform und Fast Refresh fuer Vite. | 1: `vite.config.ts` |
| eslint | ^10.13.0 | Lint | Fail-Closed-Lint-Gate mit TypeScript-Parser und ungenutzten Symbolen. | 2: `eslint.config.mjs`<br>`package.json` |
| globals | ^16.5.0 | Lint | Browser- und Node-Globals fuer die ESLint-Konfiguration. | 1: `eslint.config.mjs` |
| pixi.js | ^8.6.6 | Runtime | WebGL/Canvas-Renderer fuer Floor, Figuren, Sticker und Spiele; kein DOM-Rendering im Spielfeld. | 8: `src/render/comic-bubbles.ts`<br>`src/render/floor-camera.ts`<br>`src/render/floor-stage.tsx`<br>`src/render/floor-view.ts`<br>`src/render/furniture-art.ts`<br>`src/render/guest-art.ts`<br>… (+2) |
| react | ^19.0.0 | UI | Deklarative HUD-, Popup- und Panel-Oberflaeche mit einem Store-Snapshot. | 8: `src/App.tsx`<br>`src/main.tsx`<br>`src/render/floor-stage.tsx`<br>`src/store/use-world-store.ts`<br>`src/ui/games-popup.tsx`<br>`src/ui/guest-popup.tsx`<br>… (+2) |
| react-dom | ^19.0.0 | UI | Mountet die React-Oberflaeche in den Browser. | 1: `src/main.tsx` |
| typescript | ^5.7.3 | Build | Strikte Typpruefung mit noUncheckedIndexedAccess und ungenutzten Symbolen. | 1: `tsconfig.json` |
| typescript-eslint | ^8.72.1 | Lint | TypeScript-Parser und Regeln fuer das Lint-Gate. | 1: `eslint.config.mjs` |
| vite | ^6.0.7 | Build | Dev-Server und Production-Bundler; liefert die Modul- und CSS-Pipeline. | 1: `package.json` |
| vitest | ^5.0.5 | Test | Deterministische Unit- und Monte-Carlo-Beweise fuer Ledger, Spiele und Simulation. | 17: `package.json`<br>`src/core/economy/__tests__/economy.test.ts`<br>`src/core/games/__tests__/contracts.test.ts`<br>`src/core/games/__tests__/round.bench.ts`<br>`src/core/games/__tests__/round.test.ts`<br>`src/core/governance/__tests__/dependency-governance.test.ts`<br>… (+11) |
<!-- DEP_MATRIX_END -->

## Delivery-Regel

**Nach jedem abgeschlossenen Arbeits-Turn wird auf `main` geliefert.** Der verbindliche Weg ist:

```bash
npm run turn:finish
```

`turn:finish` führt Autofix und `verify:all` aus, erzeugt bei Änderungen einen Commit im deutschen Steam-Developer-Notes-Format (ohne Drittanbieter-Trailer) und pusht auf `main`. Gestaged werden nur die übergebenen Pfade; ohne Argumente ausschließlich bereits verfolgte Änderungen, damit kein fremder oder unverfolgter Inhalt mitgeht. Ein fehlgeschlagenes Gate verhindert Commit und Push. Lehnt der Branch-Schutz den Direktpush ab, wird der Arbeitsbranch gepusht und ein fokussierter PR gegen `main` nötig.

Der Geschwindigkeits-Benchmark läuft separat über `npm run test:perf` und ist absichtlich nicht Teil von `verify:all`: Er misst Durchsatz und ist kein Korrektheitsgate.
