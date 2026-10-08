# Dienste auf debian-docker

Stand: 9. Oktober 2026. Die Stacks werden **einzeln** aktiviert. Kein Sammelbefehl installiert alle Apps, und keine App wird auf dem Entwicklungs-PC gestartet. Homepage ist die Startseite, kein Orchestrator für die übrigen Stacks.

## Orte und Daten

Standardzuordnung: **HOME A = ThinkCentre / Proxmox / debian-docker**, **HOME B = Raspberry Pi 5**. Unter `config/settings.yaml → silasSites` umbenennen; Kartennamen und `silas.site`/`silas.host` stehen in `config/services.yaml`. Homebridge A und B sind eigenständige Installationen mit eigenen HomeKit-Identitäten, Konten und API-URLs. Tailscale verbindet die Standorte, HomeKit-Geräte bleiben jeweils lokal.

| Pfad                                               | Inhalt                                                                      |
| -------------------------------------------------- | --------------------------------------------------------------------------- |
| `/srv/homepage/config`                             | Optional eigene Homepage-Konfiguration; Vorlagen bleiben im Git-Repo        |
| `/srv/memos/data`                                  | Memos-SQLite-Datenbank und Anhänge                                          |
| `/srv/palmr/data`                                  | Nur optionale isolierte Palmr-Evaluation                                    |
| `/srv/immich/{library,postgres,stack}`             | Medien, lokale SSD-Datenbank, offizieller Stack mit privater `.env`         |
| `/srv/homebridge/data`                             | Lokale Bridge-Konfiguration, Plugins, Pairings; eigener Pfad auf jedem Host |
| `/srv/crafty/{servers,config,backups,logs,import}` | Minecraft-Welten und Crafty-Daten                                           |

Nextcloud-Nutzdaten bleiben in dessen eigenem Datenverzeichnis außerhalb Git. Keine Migration, keine Löschung oder Überschreibung bestehender Welten/Medien findet durch dieses Projekt statt. Pfade lassen sich in den jeweiligen `.env` ändern. Immich-Postgres benötigt lokalen, zuverlässigen Speicher, kein NFS/SMB. Backups auf derselben SSD sind noch keine Absicherung gegen deren Ausfall: später verschlüsselte Kopie zum Pi/HDD, mit regelmäßigen Rücksicherungstests.

## Bereitstellungsübersicht

| Dienst                             | Bereitstellung                                      | Standardzugang                           |
| ---------------------------------- | --------------------------------------------------- | ---------------------------------------- |
| Homepage                           | Root-Compose, eigener Source-Build                  | Loopback 3000 / SSH / Tailscale          |
| [Memos](memos/README.md)           | Separates Compose, SQLite persistent                | Loopback 5230; später Tunnel             |
| [Palmr](palmr/README.md)           | Deaktiviertes `evaluation`-Profil, archivierte Beta | Nur isolierter Test, 5487 + 9379         |
| [Immich](immich/README.md)         | Original-Release-Compose + privates Override        | Loopback 2283; LAN/Tailscale bevorzugt   |
| [Homebridge](homebridge/README.md) | Separates offizielles Image, Linux-Hostnetz         | Lokales Hausnetz, UI typischerweise 8581 |
| [Crafty](crafty/README.md)         | Separates Compose, fünf persistente Verzeichnisse   | Loopback 8443; Minecraft TCP 25565–25569 |
| [Monitoring](monitoring/README.md) | Vorhandene/private Glances-4-API einbinden          | Kein öffentlicher Port                   |

Docker Engine + Compose **>= 2.24.4** vorausgesetzt (`docker compose version`). Für einen einfachen Stack, aus dem Repository-Root, beispielsweise Memos:

```bash
cd deploy/memos
cp -n .env.example .env
chmod 600 .env
nano .env
docker compose config --quiet
docker compose pull
docker compose up -d
docker compose ps
```

Crafty und Homebridge verwenden denselben Ablauf in ihrem Verzeichnis, aber zuerst die jeweilige Anleitung lesen. Palmr erfordert bewusst ein zusätzliches Profil. Immich hat ein eigenes Setup-Verfahren. Keine echten Passwörter stehen in Beispielen. Nach Erstinstallation jedes Admin-Konto sofort selbst einrichten, Registrierung beschränken und Backups konfigurieren.

## Ressourcen und Updates

16 GB sind der physische RAM des ThinkCentre, nicht vollständig der Debian-VM zugeteilt. Proxmox Reserve lassen, tatsächliches VM-Budget prüfen. Immich-Machine-Learning, Medien-Transcoding und mehrere Minecraft-JVMs konkurrieren um RAM/CPU. Zunächst einen Minecraft-Server mit kleinem Heap starten, Messwerte beobachten und Jobs zeitlich trennen. Keine automatischen ungeprüften Major-Upgrades. Images sind auf geprüfte Versionen/Digests gesetzt; `pull` allein aktualisiert einen Digest-Pin nicht. Zuerst Release Notes prüfen, Daten sichern, Pin bewusst ändern, dann `pull`/`up -d`. Keine `down -v`-Befehle verwenden.

Alle Compose-Konfigurationen sind statisch prüfbar. Der lokale Windows-PC hat keine Docker Engine; tatsächliche Linux-Containerstarts und API-Verbindungen sind deshalb erst auf der VM zu verifizieren, siehe [Prüfbericht](../docs/silas/VALIDATION.md).
