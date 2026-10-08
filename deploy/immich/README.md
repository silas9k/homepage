# Immich

Der [offizielle Installationsweg](https://docs.immich.app/install/docker-compose/) bleibt erhalten. Das Setup lädt unverändert die Compose-Datei des überprüften Releases **v3.3.1** vom 08.10.2026, verifiziert SHA-256 und legt sie außerhalb Git unter `/srv/immich/stack` ab. Kein kopierter eigener Ersatz für Postgres, Redis oder Machine Learning. Nur Ports und Log-Limits werden per Override angepasst.

```bash
# Im silas-homepage-Repository auf Debian; benötigt curl, openssl und sha256sum.
sudo sh deploy/immich/setup.sh
sudo nano /srv/immich/stack/.env
cd /srv/immich/stack
sudo docker compose -f docker-compose.yml -f compose.private.yaml config --quiet
sudo docker compose -f docker-compose.yml -f compose.private.yaml pull
sudo docker compose -f docker-compose.yml -f compose.private.yaml up -d
sudo docker compose -f docker-compose.yml -f compose.private.yaml ps
```

Das Skript erzeugt ein zufälliges Datenbankpasswort nur auf dem Server und verweigert einen bereits existierenden Zielpfad. Es startet nichts. `.env` bleibt Modus 600; der Stackpfad ist wegen privater Daten root-lesbar. Bei fehlgeschlagenem Download vorhandene Dateien manuell prüfen, nichts blind löschen. `library` und `postgres` liegen außerhalb Git auf lokalem Speicher, ML-Cache in einem Docker-Volume. DB und Redis haben keine veröffentlichten Ports.

Für Erstzugriff SSH-Portforward auf 2283 nutzen. Anschließend Admin-Konto erstellen, eigenes Passwort setzen, Registrierung kontrollieren. `IMMICH_BIND` auf die tatsächliche private VM-/Tailscale-Adresse ändern, wenn direkter Zugriff benötigt wird. Keine Beispiel-IP wird vorausgesetzt. Bei Bindung an die Tailscale-Adresse muss Tailscale vor dem Container verfügbar sein; alternativ private LAN-Adresse mit eng begrenzter Subnetzroute/Firewall verwenden. Für Browser-API-Statistiken in Homepage getrennte API-URL plus Schlüssel mit ausschließlich `server.statistics` konfigurieren.

**LAN oder Tailscale ist der primäre Uploadweg**, auch in der mobilen Immich-App. `photos.silasnet.win` über Cloudflare ist optional für Webansicht/kleinere Anfragen. Free/Pro erlauben derzeit höchstens 100 MB pro HTTP-Request, Business 200 MB; zusätzliche Timeouts können früher greifen. Große Videos können deshalb scheitern. Kein unbegrenzter Upload wird zugesagt und es wird keine direkte unauthentifizierte Internetfreigabe angelegt. Details und Quellen: [Netzwerkplan](../../docs/silas/NETWORK.md).

## Update und Backup

Vor jedem Update [Release Notes](https://github.com/immich-app/immich/releases) und [Backup-Anleitung](https://docs.immich.app/administration/backup-and-restore/) prüfen. Datenbank-Backup und Medien gemeinsam sichern und Rücksicherung testen; Dateisystemkopie einer laufenden Postgres-Datenbank ist kein verlässlicher Dump. Automatische DB-Backups alleine sichern keine Fotos.

Neues offizielles Release-Compose zunächst als separate Datei herunterladen, Version/Änderungen und das private Override prüfen. Die neue Compose-Datei kann für neue Releases erforderlich sein; nicht nur blind das Image wechseln. Bestehende `.env` und Daten behalten, `IMMICH_VERSION` kontrolliert anpassen. Danach:

```bash
cd /srv/immich/stack
sudo docker compose -f docker-compose.yml -f compose.private.yaml config --quiet
sudo docker compose -f docker-compose.yml -f compose.private.yaml pull
sudo docker compose -f docker-compose.yml -f compose.private.yaml up -d
sudo docker compose -f docker-compose.yml -f compose.private.yaml ps
```

Niemals `setup.sh` über eine bestehende Installation ausführen oder Volumes löschen. Nach Datenbankmigrationen ist ein Downgrade gegebenenfalls nur mit passendem Backup möglich.
