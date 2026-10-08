# Ausgeführte Prüfung

Stand: 09.10.2026. Ausschließlich `C:\Users\silas\IdeaProjects\silas-homepage` bearbeitet. Bestehende andere Projekte wurden weder gelesen noch verändert. Fortsetzung der vorhandenen Anpassung; kein zweites Checkout.

| Prüfung                                   | Ergebnis                                                                                                                      |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Dependencies                              | Frozen pnpm-Lockfile installiert; Playwright als Dev-Abhängigkeit                                                             |
| Prettier                                  | Alle geänderten unterstützten Textdateien bestanden; `.env`/Shell ohne Prettier-Parser separat geprüft                        |
| `pnpm lint`                               | Bestanden, Exit 0; zusätzliche neue/migrierte Dateien ebenfalls geprüft                                                       |
| `pnpm exec vitest run --maxWorkers=4`     | **570 Testdateien, 1.792 Tests bestanden**                                                                                    |
| Nach Verschieben der zwei API-Testdateien | Beide am neuen Ort erneut geprüft: **24 Tests bestanden**                                                                     |
| `pnpm build`                              | **Bestanden**, optimierter Next-Standalone-Build                                                                              |
| Typprüfung                                | Next-Build-Prüfschritt erfolgreich; Upstream ist JavaScript, kein separater `typecheck`-Task/TS-Projekt vorhanden             |
| Produktionsstart                          | Standalone-Server unter `http://127.0.0.1:3100`, Healthcheck erfolgreich                                                      |
| Playwright am Produktionsserver           | **7 Tests bestanden**; 1920×1080, 1440×900, 768×1024, 390×844                                                                 |
| Suche / Layout                            | Tastaturöffnung, Filter, Escape/Fokusrückgabe, lokale Icons, 19 Karten, kein horizontaler Überlauf, untere Backups erreichbar |
| Leer-/Fehlerzustände                      | Keine Widget-Polls ohne Credentials; echte Nullwerte und Backendfehler mit isolierten Test-Fixtures geprüft                   |
| API-Schutz                                | Credentials nicht in Browser-Konfiguration, unbekannter Host abgewiesen, beide ehemaligen Testrouten liefern 404              |
| Compose                                   | **Alle sechs Stacks validiert**, einschließlich offizieller Immich-Datei mit SHA-256 und privatem Override                    |
| Compose-Sicherheitsprüfung                | Loopback-Defaults, persistente App-Daten außerhalb Git, keine Docker-Sockets, Immich DB/Redis ohne veröffentlichte Ports      |
| Shell                                     | `setup.sh` und `smoke.sh` Syntax geprüft                                                                                      |
| Geheimnisse                               | Nur leere/klare Beispielwerte; verschachtelte `.env`, private Schlüssel, Referenzen und lokale Artefakte ignoriert            |
| Visuelle QA                               | Alle elf gelieferten Referenzen analysiert; finale obere/untere Ansichten der vier Größen betrachtet und Raster nachgebessert |

Der finale Build meldet die bereits vorhandene Next-Warnung zur `middleware`-Dateikonvention. Es wurde keine warnende neue Middleware eingeführt. Upstream-Vitest meldet Hinweise zu esbuild/oxc und zwei vorhandenen `vi.unmock`-Positionen; sie verursachen keine Testfehler. Playwright meldet den Umgebungs-Hinweis zu NO_COLOR/FORCE_COLOR. Diese Hinweise sind keine verschwiegenen fehlerfreien Warnungsprüfungen.

## Nachweise

Lokal unter `artifacts/` (absichtlich nicht committed):

- `build-final.log`, `lint-expanded.log`, `lint-additions.log`, `format-final.log`
- `tests-expanded.log`, `tests-moved.log`, `browser-final.log`, `compose-expanded.log`
- `dashboard-1920x1080.png`: angeforderte unveränderte Viewport-Aufnahme
- `dashboard-full-page.png`: gesamter Inhalt mit 1920 px Breite
- `dashboard-1440x900.png`, `dashboard-768x1024.png`, `dashboard-390x844.png`
- `dashboard-bottom-*.png`: untere Bereiche auf allen vier Größen

Compose-Prüfung reproduzieren: `node deploy/validate-compose.mjs` mit installierter Docker-CLI/Compose. Alternativ `COMPOSE_BINARY` auf ein eigenständiges Compose-Binary setzen. Das Skript lädt ausschließlich Beispielwerte, prüft den offiziellen Immich-Download und startet keine Container.

## Noch nicht ausführbar in dieser Umgebung

**Hier ist keine Docker Engine verfügbar.** Compose wurde mit dem offiziellen eigenständigen Compose-Binary validiert; ein Docker-Image-Build, Linux-Containerstart und Container-Restart konnten lokal nicht ausgeführt werden. Der echte Produktions-Node-Build wurde dagegen gestartet und im Browser geprüft. Der manuelle GitHub-Workflow `Silas container` sowie `sh deploy/smoke.sh` stehen für den tatsächlichen Containercheck bereit. Ein erfolgreicher Compose-Parser ersetzt diesen Laufzeittest nicht.

Keine privaten Backend-URLs/API-Zugangsdaten und kein Zugriff auf `debian-docker` wurden bereitgestellt. Deshalb keine behaupteten Live-Metriken, erfolgreichen Backups, eingerichteten Minecraft-Welten oder installierten Anwendungen. Memos/Immich/Homebridge/Crafty sind vorbereitet, Palmr bleibt isolierte optionale Evaluation. Echte App-Konten, TLS-Vertrauen, Netzwerkerreichbarkeit, Datenpfadberechtigungen und Restore-Tests müssen auf der VM verifiziert werden.

GitHub-CLI ist nicht authentifiziert. Kein Remote-Fork, Push oder GHCR-Image wurde erstellt. Lokal sind der Feature-Branch und der `upstream`-Remote vorbereitet; die zusammenhängenden Login-/Fork-/Push-Befehle stehen in `CUSTOMIZATION.md`. Die Arbeit ist lokal geliefert, aber die komplette Produktionsabnahme auf dem Homeserver bleibt bis zum Container-/Integrationstest offen.
