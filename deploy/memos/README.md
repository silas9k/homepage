# Memos

Offizielles [Compose-Verfahren](https://usememos.com/docs/deploy/docker-compose), geprüft am 09.10.2026. Image `neosmemo/memos:0.31.0`, ein Container mit SQLite und Anhängen unter `/var/opt/memos`; kein öffentlicher Datenbankport. Deployment wie in [deploy/README](../README.md), Datenpfad `/srv/memos/data`.

Zuerst lokal über SSH `ssh -N -L 5230:127.0.0.1:5230 USER@debian-docker` öffnen, Host-Admin anlegen, Benutzerregistrierung nach Bedarf deaktivieren und Notizen privat halten. Erst dann `memos.silasnet.win` im eigenen Tunnel einrichten, `MEMOS_INSTANCE_URL` passend setzen und Container neu erstellen. Die Homepage-URL/Health-URL separat setzen. Eine interne HTTP-Prüfung bestätigt Erreichbarkeit; es werden keine Notiztexte gelesen und kein Memos-Token benötigt.

Ein auf der VM nativ laufender cloudflared kann `http://127.0.0.1:5230` erreichen. Läuft cloudflared in Docker, ist dessen `localhost` ein anderer Container: stattdessen gezielt an eine private VM-Adresse binden oder ein gemeinsames internes Docker-Netz einrichten. Zugriff auf diesen Origin mit Firewall begrenzen. [Netzwerkplan](../../docs/silas/NETWORK.md).

Update: Release Notes prüfen, konsistente SQLite-Sicherung während des Stopps anlegen, Versions-Pin bewusst ändern:

```bash
cd deploy/memos
docker compose stop
# /srv/memos/data jetzt in das private Backupziel sichern.
docker compose pull
docker compose up -d
docker compose ps
```

Auch Wiederherstellung prüfen: Datenbank und Anhänge gehören zusammen. Keine Aktualisierung überschreibt vorhandene Nutzdaten durch Dateien aus Git.
