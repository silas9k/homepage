# Palmr — optionale Evaluation

**Keine stabile Produktionsfreigabe.** Am 09.10.2026 bezeichnet das [offizielle README von kyantech/Palmr](https://github.com/kyantech/Palmr) das Projekt ausdrücklich als archiviert; zudem warnt es vor Produktionseinsatz der Beta. Gleichzeitig lieferte die GitHub-Metadaten-API `archived: false`. Die Erklärung des Maintainers ist entscheidend: laufende Pflege ist nicht zugesichert. Es wurde kein gepflegter Nachfolger verifiziert.

Geprüftes letztes Release: `v3.3.2-beta`, 10.12.2025. Der Docker-Hub-Tag und `latest` verwiesen bei Prüfung auf denselben Digest `sha256:043dd6cdbb4d9985b376915020fb26c2037b19876674273eac310ab04cdf16f4`. Das Beispiel pinnt den benannten Beta-Tag plus Digest, nicht ein unkontrolliertes `latest`.

Das [Upstream-Compose](https://github.com/kyantech/Palmr/blob/main/docker-compose.yaml) erfordert Web-Port 5487 **und** Storage-Port 9379; `STORAGE_URL` muss vom Browser erreichbar sein. API-Port 3333 wird hier nicht veröffentlicht. Persistenz folgt upstream unter `/app/server`, außen `/srv/palmr/data`.

Nur für einen bewusst isolierten Test ohne vertrauliche Dateien:

```bash
cd deploy/palmr
cp -n .env.example .env
chmod 600 .env
docker compose --profile evaluation config --quiet
docker compose --profile evaluation pull
docker compose --profile evaluation up -d
```

Beide Ports per SSH weiterleiten (`-L 5487:127.0.0.1:5487 -L 9379:127.0.0.1:9379`), dann `http://localhost:5487` öffnen. Der normale Compose-Aufruf ohne Profil startet Palmr nicht. Bei Updates zuerst Daten sichern, Wartungsstatus erneut prüfen und einen konkreten geprüften Tag/Digest wählen.

`share.silasnet.win` ist nur ein geplanter Hostname. Falls nach eigener Prüfung später ein öffentliches Setup gewählt wird, braucht auch der Browser-Storage-Endpunkt eine HTTPS-Route, etwa `share-storage.silasnet.win`, `PALMR_STORAGE_URL=https://share-storage.silasnet.win` und `PALMR_SECURE_SITE=true`. Authentifizierung/Access und Upload-/Download-Verhalten auf **beiden** Routen testen. Cloudflare-Größen-/Timeoutlimits gelten auch für Dateitransfers. Keine DNS-Einträge oder Tunnel werden automatisch erstellt; gegenwärtig bleibt die Karte als optionale archivierte Beta gekennzeichnet.
