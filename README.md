# silasnet.

Ein privates Homeserver-Dashboard auf Basis von [gethomepage/homepage](https://github.com/gethomepage/homepage), für die Debian-13-Docker-VM auf dem ThinkCentre M920q. Alle Dienste bleiben echte Homepage-Integrationen. Ohne konfigurierte APIs erscheinen ausschließlich neutrale Leerzustände.

## Auf Debian starten

Voraussetzung: Git, Docker Engine und Docker Compose >= 2.24.4. Im Fork muss der Branch `feat/silas-homeserver-dashboard` vorhanden sein. `YOUR_GITHUB_USER` durch den eigenen GitHub-Namen ersetzen.

```bash
git clone --branch feat/silas-homeserver-dashboard https://github.com/YOUR_GITHUB_USER/silas-homepage.git
cd silas-homepage
cp .env.example .env
chmod 600 .env
nano .env
docker compose config --quiet
docker compose up -d --build
docker compose ps
curl --fail http://127.0.0.1:3000/api/healthcheck
```

Das eigene Image ist nötig, weil dieser Fork React- und Sicherheitsanpassungen enthält. `ghcr.io/gethomepage/homepage` enthält diese Änderungen **nicht**. Der erste Build benötigt Netzwerkzugang und temporär mehr RAM als der laufende Container. Das Laufzeitlimit beträgt 768 MiB. Das Dashboard läuft als UID 1000, ohne Linux-Capabilities, ohne Docker-Socket, mit Neustartrichtlinie und Healthcheck.

Standardmäßig ist der Port ausschließlich an `127.0.0.1` der Debian-VM gebunden. Für den ersten Zugriff vom eigenen Rechner, ohne einen Port freizugeben:

```bash
ssh -N -L 3000:127.0.0.1:3000 YOUR_SSH_USER@debian-docker
```

Dann im Browser `http://localhost:3000` öffnen. SSH-Benutzer und Host anpassen. Für einen direkten Zugriff im eigenen LAN/Tailnet `HOMEPAGE_BIND` auf die feste VM- oder Tailscale-Adresse setzen und den verwendeten Namen inklusive Port in `HOMEPAGE_ALLOWED_HOSTS` ergänzen. Keine Platzhalter-IP steht im Quellcode. Details: [Zugriff und Sicherheit](docs/silas/SECURITY.md).

## Welche Werte muss ich setzen?

Für den Start über SSH sind **keine API-Zugangsdaten erforderlich**. Für den gewünschten direkten Zugriff müssen nur Bind-Adresse und erlaubter Host stimmen:

| Wert                     | Bedeutung                                                                   |
| ------------------------ | --------------------------------------------------------------------------- |
| `HOMEPAGE_BIND`          | Standard `127.0.0.1`; für direkten privaten Zugriff die passende VM-Adresse |
| `HOMEPAGE_PORT`          | Standard `3000`                                                             |
| `HOMEPAGE_ALLOWED_HOSTS` | Exakte Browser-Hosts, gegebenenfalls mit Port; niemals `*`                  |
| `HOMEPAGE_VAR_*`         | Optionale Dienst-URLs und APIs; leer lassen, solange unbekannt              |

Ein Widget wird erst aktiv, wenn sämtliche in `silasRequired` genannten Felder gesetzt sind. Ein leerer Link wird entfernt, eine leere Health-URL wird nicht abgefragt. Paperless-ngx, Minecraft Server 2 und Playit.gg bleiben verborgen, bis ihre URL gesetzt wird. Resticwatch und das zukünftige Pi-Backupziel sind als optionale/geplante Karten sichtbar. Nach `.env`-Änderungen `docker compose up -d --force-recreate` ausführen, dann im Dashboard unten rechts neu laden. Passwörter mit Sonderzeichen in `.env` in einfache Anführungszeichen setzen. Für Dateisecrets siehe Sicherheitsdokumentation.

## Dienste und reale Metriken

| Bereich               | Dienste                                                          | Daten / Zustand                                                       |
| --------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------- |
| Server                | Proxmox, debian-docker, raspi                                    | PVE-Lesetoken; Glances 4 je Host                                      |
| Cloud & Dokumente     | Nextcloud, Memos, Vaultwarden, Palmr                             | NC-Dateien/Nutzer/Speicher; übrige Links/HTTP, Palmr archivierte Beta |
| Fotos & Medien        | Immich, Jellyfin                                                 | Immich Fotos/Videos/Speicher/Nutzer; Jellyfin Bibliothek              |
| Smart Home            | Home Assistant, Homebridge · Standort A, Homebridge · Standort B | HA und zwei völlig getrennte UI-X-APIs                                |
| Gaming                | Crafty Controller, Minecraft · Server 1                          | Crafty HTTP; echtes Minecraft-Statuswidget mit Spielerzahl/Version    |
| Verwaltung & Netzwerk | Portainer, Tailscale, Cloudflare Tunnel                          | Optionale dedizierte Integrationen                                    |
| Backups               | Resticwatch, Backup-HDD · Raspberry Pi                           | Optional/geplant, bis echte Datenquellen bestehen                     |
| Verborgen vorbereitet | Paperless-ngx, Minecraft · Server 2, Playit.gg                   | Erst nach Konfiguration sichtbar                                      |

19 sichtbare Karten. **HOME A** ist standardmäßig der ThinkCentre, **HOME B** der Pi am anderen Standort. Labels zentral unter `silasSites` in `config/settings.yaml` ändern; Kartennamen/Hostzuordnung in `services.yaml`. Die Pi-Bridge bleibt bestehen, die zweite läuft in debian-docker. Homebridge hat getrennte `HOMEPAGE_VAR_HOMEBRIDGE_A_*`/`B_*` Werte. Frühere einzelne `HOMEPAGE_VAR_HOMEBRIDGE_*` Werte gegebenenfalls einmalig in die passende Gruppe übertragen.

[Integrationen einrichten](docs/silas/INTEGRATIONS.md) beschreibt Tokens, unterstützte Metriken und Grenzen. Proxmox-Speicher/Uptime, Jellyfin-Speicher und Nextcloud-Datenbank-/Redis-Health sind bewusst nicht durch Ersatzwerte dargestellt. Ein grauer Punkt bedeutet **Status nicht konfiguriert**, ein grüner HTTP-Punkt lediglich **HTTP-Endpunkt erreichbar**, nicht einen erfolgreichen Backup-Job oder vollständig gesunden Dienst.

## Weitere Apps und zwei Standorte

[Deployment-Übersicht](deploy/README.md) mit getrennten Anleitungen für **Memos, Immich, Homebridge und Crafty**. Alle Daten unter `/srv`, keine Medien/Welten in Git. Apps werden nicht zusammen mit Homepage gestartet. Immich nutzt den offiziellen Release-Stack; Crafty persistiert Welten und Konfiguration und veröffentlicht standardmäßig nur Loopback-Ports. Palmr ist ausdrücklich eine deaktivierte **Evaluation einer archivierten Beta**, keine stabile Produktionsempfehlung.

[Netzwerkplan](docs/silas/NETWORK.md): Tailscale/LAN für Administration und Immich-Großuploads. Geplant sind `memos.silasnet.win`, optional `photos.silasnet.win`; `share.silasnet.win` und `share-storage.silasnet.win` erst nach erneuter Palmr-Prüfung. Es wurden keine DNS-Records, Tunnel oder Cloudflare-Freigaben angelegt. Cloudflare-Uploadlimits gelten auch für große Videos/Dateitransfers. Minecraft läuft lokal ohne Playit; optionaler Playit-Agent transportiert nur Spielverkehr.

## Design und Konfiguration

- `config/settings.yaml`: Wortmarke/Titel (`silasnet.`), Sprache, Layout.
- `config/services.yaml`: Kategorien, Links, erforderliche Zugangsdaten und Widget-Felder.
- `config/custom.css`: Farben, Abstände, Karten, responsive Darstellung.
- `config/widgets.yaml`, `bookmarks.yaml`, `docker.yaml`, `proxmox.yaml`, `kubernetes.yaml`: bewusst leere, gültige Startkonfiguration.
- `public/silas/`: lokal ausgelieferte Icons und Favicon.

Alle elf Referenzbilder wurden geprüft; persönliche Inhalte aus den Vorlagen sind nicht übernommen. API-Anfragen erfolgen frühestens alle 60 Sekunden pro Widget-Endpunkt; HTTP-Prüfungen alle 30 Sekunden. Ohne API-Konfiguration gibt es keine Widget-Abfragen. Die Suche öffnet konfigurierte Dienste: Suchknopf fokussieren und Enter drücken oder auf der Seite tippen, dann Pfeiltasten/Enter; Escape schließt sie. Nicht konfigurierte Dienste haben keinen ausführbaren Link.

## Aktualisieren und zurückrollen

Für den lokalen Image-Build:

```bash
git pull --ff-only
docker compose build --pull
docker compose up -d
docker compose ps
```

`.env` bleibt lokal und wird nie committed. Vor Updates eine private Sicherung von `.env` und eigenen Konfigurationsänderungen anlegen. Eigene YAML-Anpassungen auf dem eigenen Branch committen; niemals Zugangsdaten hinein schreiben. Zur Rückkehr einen bekannten guten Commit auschecken und mit `docker compose up -d --build` neu bauen.

Optional kann der manuell gestartete Workflow **Silas container** ein eigenes GHCR-Image bauen und veröffentlichen. Danach `HOMEPAGE_IMAGE=ghcr.io/YOUR_GITHUB_USER/silas-homepage:latest` in `.env` ergänzen; bei privatem Image vorher bei GHCR anmelden. Erst dann ist dieser kurze Image-Workflow sinnvoll:

```bash
git pull --ff-only
docker compose pull
docker compose up -d --no-build
```

## Lokale Entwicklung und Prüfungen

Node 22+, pnpm 11.8.0. Kein fremdes Projekt wird benötigt.

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm exec vitest run --maxWorkers=4
pnpm build
node deploy/preview.mjs
```

Für die Browserprüfung in einem zweiten Terminal:

```bash
pnpm exec playwright install chromium
pnpm exec playwright test
```

Das Preview-Skript startet den echten Standalone-Build auf `127.0.0.1:3100` und kopiert dessen statische Assets. Browserprüfungen erwarten die unkonfigurierte Beispielkonfiguration und erzeugen Screenshots unter `artifacts/`. Integrationstests mit synthetischen Antworten sind nur Tests, keine Produktionsdaten.

## Fork und Upstream

[GitHub-Einrichtung, Dateiübersicht und Upstream-Sync](CUSTOMIZATION.md). Die vollständige Upstream-Historie und Funktionalität bleiben erhalten. [Ursprüngliche README](docs/silas/UPSTREAM_README.md), [Upstream-Dokumentation](https://gethomepage.dev/), [GPL-3.0-Lizenz](LICENSE), [Icon-Lizenz und Attribution](public/silas/icons/NOTICE.md).

Den aktuellen, tatsächlich ausgeführten Prüfstand und verbleibende Umgebungsgrenzen dokumentiert [VALIDATION.md](docs/silas/VALIDATION.md).
