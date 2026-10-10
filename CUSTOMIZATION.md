# silasnet. Anpassungen

Basis: `gethomepage/homepage`, Upstream-Branch `dev`, Commit `9c6e6219`. Der Fork nutzt die vollständige Upstream-Historie. Arbeitsbranch: `feat/silas-homeserver-dashboard`. Kein anderes Repository ist Bestandteil dieses Projekts.

## GitHub-Fork nachholen

Die lokale GitHub-CLI war während der Einrichtung nicht angemeldet. Deshalb wurde direkt vom Upstream geklont. Nach interaktivem Login lassen sich Fork, Remote und Push zusammen herstellen:

```bash
gh auth login
gh repo fork gethomepage/homepage --fork-name silas-homepage --clone=false --remote=true
git remote -v
git push -u origin feat/silas-homeserver-dashboard
```

`upstream` zeigt bereits auf `https://github.com/gethomepage/homepage.git`. `origin` soll danach auf den eigenen Fork zeigen. Falls GitHub den gewünschten Fork bereits unter anderem Namen kennt, diesen bestehenden Fork verwenden und `origin` entsprechend setzen. GitHub-Forks öffentlicher Repositories sind öffentlich; `.env` und private Konfigurationswerte niemals pushen. Wer einen privaten Remote braucht, muss stattdessen ein neues privates Repository erstellen und die lokale Historie dorthin pushen.

## Anpassungspunkte

| Dateien                                                            | Zweck und Konfliktrisiko                                                                                               |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `config/*.yaml`, `config/custom.css`                               | Persönliche Konfiguration, warmes Weiß, flache Karten, 1/2/3 Spalten, lokale Icons; kaum Upstream-Konflikte            |
| `src/components/silas/*`                                           | Kleine Header- und Leerzustandskomponenten, keine externe UI-Bibliothek                                                |
| `src/pages/index.jsx`                                              | Header nur bei `silasTheme: true` austauschen; native QuickLaunch bleibt erhalten                                      |
| `src/components/services/item.jsx`                                 | Neutraler Statuspunkt und Leerzustand nur im Silas-Theme                                                               |
| `src/components/quicklaunch.jsx`                                   | Zugängliche Suchbeschriftung und deutsche Texte                                                                        |
| `src/components/services/widget/error.jsx`                         | Kompakte Fehlermeldung ohne reflektierte Backenddetails im Silas-Theme                                                 |
| `src/utils/config/silas.js`                                        | Opt-in Metadaten `silas`, sichere URL-Prüfung, optionale Karten, Widget-Aktivierung; kein eigener Konfigurationsserver |
| `src/utils/config/service-helpers.js`                              | Kleiner Aufruf des Adapters; Silas-Platzhalter nach YAML-Parsing ersetzen; native Credential-Allowlist bleibt erhalten |
| `src/utils/proxy/use-widget-api.js`                                | Mindestintervall 60 s und begrenzte Wiederholungen für Silas-Widgets                                                   |
| `src/components/silas/beszel-host-data.jsx`                       | Gemeinsame Beszel-Systemsabfrage und normalisierte Hostmetriken                                                      |
| `src/utils/proxy/http.js`                                          | TLS-Verifikation aktiv; absichtliche Sicherheitsabweichung vom Upstream                                                |
| `src/utils/logger.js`, `src/utils/silas-redact.js`                 | Bekannte Secrets in Logs maskieren                                                                                     |
| `src/pages/_app.jsx`                                               | Browser-Zoom wieder zulassen                                                                                           |
| `deploy/`, `compose.yaml`, `.github/workflows/silas-container.yml` | Eigenes Image, Least-Privilege-Runtime, privater Standardzugriff, optionale CA und manuelle Image-Pipeline             |
| `public/silas/`                                                    | Lokale Markenicons mit Lizenz/Attribution; eigenes Favicon                                                             |
| `tests/browser/`, `playwright.config.mjs`, neue Unit-Tests         | Responsivität, Suche, leere/echte Nullwerte, TLS, URL-/Secret-Verarbeitung                                             |
| `package.json`, `pnpm-lock.yaml`                                   | Playwright ausschließlich als Entwicklungsabhängigkeit                                                                 |
| `.gitignore`, `.dockerignore`, `eslint.config.mjs`                 | Secrets und lokale Prüfwerkzeuge ausschließen; Konfiguration versionieren                                              |

Erweiterte Metadaten: `silas.optional: true` verbirgt eine Karte bis zu einer gültigen URL. `silas.metrics` beschreibt ausschließlich leere Platzhalterfelder. `widget.silasRequired` enthält Feldnamen wie `[url, key]`, niemals Secretwerte. Vollständig eingerichtete Widgets nutzen die normalen Homepage-Komponenten. Keine Verzweigung nach privaten IPs oder Dienstnamen im JavaScript.

## Upstream synchronisieren

Zuerst lokale Änderungen committen und eine private Sicherung der nicht versionierten Secrets anlegen. Dann zum Beispiel:

```bash
git switch feat/silas-homeserver-dashboard
git fetch upstream
git branch backup/before-upstream-sync
git merge upstream/dev
pnpm install --frozen-lockfile
pnpm lint
pnpm exec vitest run --maxWorkers=4
pnpm build
docker compose config --quiet
docker compose up -d --build
```

Alternativ auf einem nur selbst verwendeten Branch `git rebase upstream/dev`; ein anschließender Force-Push darf nur bewusst mit `--force-with-lease` erfolgen. Die Merge-Variante vermeidet History-Rewrites. Vor jedem Update die drei CPU/RAM/Disk-Felder und die Leerkonfiguration im Browser prüfen.

Wahrscheinliche Konflikte: Services-Serializer/Allowlist, Index-Header, API-Hook, zentraler HTTP-Proxy und Logger. TLS-Verifikation und Secret-Redaktion nicht unbesehen durch die Upstream-Version ersetzen. Stock-Funktionen bleiben verfügbar; `silasTheme: false` verwendet den ursprünglichen Header und die ursprünglichen Fehleransichten. Für vollständige Rückkehr zum Stock-Look zusätzlich `config/custom.css` leeren.

## Erweiterung auf zwei Häuser

`settings.yaml:silasSites` und `service.silas.site/host` ergänzen dezente Standortlabels. Zwei Homebridge-Konfigurationen bleiben vollständig unabhängig. Der bestehende Kartenrenderer und CSS gelten auch für Memos, Palmr, Immich, Gaming und Backups; keine zweite Dashboard-App.

`deploy/{memos,palmr,immich,homebridge,crafty,monitoring,homepage}` enthält getrennte optionale Deployments/Anleitungen. Immich wird aus dem verifizierten offiziellen Release geladen, Palmr bleibt ein deaktiviertes Evaluationsprofil. `docs/silas/NETWORK.md` beschreibt private Administration, Tunnel-Hostnamen und Uploadgrenzen. Neue Widget-Ausnahme: ausschließlich das native Minecraft-Widget darf das upstream dokumentierte UDP-URL-Schema verwenden; Browserlinks bleiben HTTP(S) ohne eingebettete Credentials.

Zwei bereits upstream unter `src/pages/api/` liegende Tests wurden nach `src/__tests__/pages/api/{mcp,services}` verschoben (Proxy-Test: `proxy-routing.test.js`). Sonst würde Next sie als öffentliche API-Routen bauen. Nur Importpfade geändert; Verhalten und Tests bleiben erhalten. Die Browserprüfung verlangt jetzt 404 für beide ehemaligen Testrouten.
