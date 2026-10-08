# Crafty Controller und Minecraft

Aufbau: Proxmox → Debian-13-VM → Docker → Crafty → getrennte Java-Minecraft-Prozesse. Basis: [offizielle Crafty-Docker-Dokumentation](https://docs.craftycontrol.com/pages/getting-started/installation/docker/), offizielles Arcadia-Image **4.11.0** mit geprüftem Digest. Nur auf Linux starten. Keine Docker-Socket-Freigabe; Crafty startet Java-Prozesse innerhalb seines Containers.

```bash
cd deploy/crafty
cp -n .env.example .env
chmod 600 .env
nano .env
docker compose config --quiet
docker compose pull
docker compose up -d
docker compose ps
```

Für die erste Einrichtung `ssh -N -L 8443:127.0.0.1:8443 USER@debian-docker`, dann `https://localhost:8443`. Initialzugang ausschließlich privat nach [Crafty First Steps](https://docs.craftycontrol.com/pages/getting-started/access/) ermitteln und sofort ändern; die Datei `config/default-creds.txt` enthält sensible Erstzugangsdaten und darf nicht in Git/öffentliche Logs gelangen. Keine Zugangsdaten sind hier vorgegeben. MFA aktivieren, wo verfügbar.

Das initiale selbstsignierte UI-Zertifikat ist lokal üblich. Für Homepage-Monitoring ein Zertifikat mit passendem internen DNS-Namen einsetzen und dessen CA explizit vertrauen, siehe [TLS](../../docs/silas/SECURITY.md). Keine globale Abschaltung der Zertifikatsprüfung. Bis dahin Health-URL leer lassen; ein privater Link funktioniert unabhängig vom Widget.

## Server und Ports

| Port            | Zweck                             | Standard                              |
| --------------- | --------------------------------- | ------------------------------------- |
| TCP 8443        | Crafty HTTPS-Administration       | Loopback, Zugriff via SSH/Tailscale   |
| TCP 25565–25569 | Bis zu fünf getrennte Java-Server | Loopback; pro Server ein eigener Port |
| UDP 19132       | Optional Bedrock                  | Nicht veröffentlicht                  |
| TCP 8123        | Optional Dynmap                   | Nicht veröffentlicht                  |

In Crafty später Paper/Fabric-Server einzeln erstellen und den gewünschten Server-Port zuweisen. Passende unterstützte Java-Version im Container auswählen; Version hängt von Minecraft/Modpack ab. Speicherlimits pro JVM anhand des tatsächlichen VM-RAMs setzen, nicht fünf große Heaps parallel reservieren. Minecraft-EULA selbst lesen/akzeptieren. RCON ist standardmäßig nicht veröffentlicht. Autostart pro Server in Crafty erst nach erfolgreichem Test aktivieren.

Für LAN-Spieler `MINECRAFT_BIND` auf die echte LAN-Adresse setzen. Für private Tailscale-Spieler passende Tailscale-Adresse bzw. LAN-Subnetzroute verwenden. Crafty-Admin-Bind separat lassen. Kein Routerport wird durch dieses Projekt geöffnet.

Homepage hat im verwendeten Upstream keine native Crafty-Integration. Die Crafty-Karte verwendet deshalb nur Link/HTTP-Erreichbarkeit. Die separate Minecraft-Karte nutzt das bestehende **Minecraft-Widget** mit realem Java-Status, Spielerzahl und Version. Konfigurationssyntax: `HOMEPAGE_VAR_MINECRAFT_STATUS_URL=udp://PRIVATE_DNS_NAME:25565`; trotz des historischen URL-Schemas erfolgt die Java-Statusabfrage über TCP. Vom Homepage-Container aus muss die Adresse erreichbar sein. `*_URL` ist ein optionaler HTTP-Link, nicht die Spieladresse. Weitere Karten durch Kopieren mit eigenen Namen/Ports; Server 2 ist bereits verborgen vorbereitet. Crafty-CPU/RAM/Serverzahlen werden mangels sicherer nativer API nicht erfunden.

## Updates ohne Weltverlust

Prozesse laufen während eines Container-Austauschs **nicht** unterbrechungsfrei weiter. Zuerst Spieler informieren, alle Minecraft-Server über Crafty sauber speichern/stoppen, Crafty-Backups erstellen und externe Sicherung der Verzeichnisse `servers`, `config`, `backups` anlegen. Dann:

```bash
cd deploy/crafty
docker compose stop --timeout 120
# Persistente Verzeichnisse sichern; neuen geprüften Image-Pin in .env eintragen.
docker compose pull
docker compose up -d
docker compose ps
```

Welten/Konfiguration bleiben in `/srv/crafty`; das Container-Image enthält nicht die einzige Kopie. Nach Update Crafty und Server kontrolliert starten, Welt/Spielstand prüfen. Kein `down -v`, kein Löschen/Leeren von Verzeichnissen. Vor Datenbankmigrationen vollständiges Backup; für Rollback gegebenenfalls Datenstand und Image gemeinsam zurücksetzen.

## Optional Playit.gg

Lokales Spielen benötigt Playit nicht. Einen [offiziellen Linux-Agenten](https://playit.gg/support/run-on-linux/) später separat **auf der Debian-VM** einrichten; Account/Agent-Zuordnung und Secrets ausschließlich dort speichern, nicht in Git. Für Java einen Minecraft-Java-/TCP-Tunnel auf `127.0.0.1:25565` konfigurieren, weitere Server mit eigenem Port/Tunnel. Bedrock benötigt UDP und eine gesonderte Konfiguration. Die generierte öffentliche Spieladresse den Spielern geben, nie die Crafty-Admin-UI auf 8443 tunneln. Kein Agent wurde installiert, kein Tunnel gebucht/erstellt. Die optionale Homepage-Karte wird erst bei gesetzter `HOMEPAGE_VAR_PLAYIT_URL` sichtbar.
