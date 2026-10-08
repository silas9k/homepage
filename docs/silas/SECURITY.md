# Zugriff und Geheimnisse

Homepage läuft ausschließlich in `debian-docker`, niemals als Dienst auf dem Proxmox-Host. Dieses Compose richtet weder Tunnel noch öffentliche DNS-Einträge ein. Homepage-Links sind keine Authentifizierung. Ein erlaubt gesetzter Host ist ebenfalls keine Zugangskontrolle.

## Privater Zugriff

Der Standard bindet an Loopback. SSH-Portweiterleitung ist in der README beschrieben. Für Tailscale kann der Port gezielt an die Tailscale-IP der VM gebunden werden; die Tailnet-ACL muss den Zugriff auf die eigenen Geräte beschränken. `tailscale serve` auf der VM kann alternativ einen HTTPS-Endpunkt zum Loopback-Port bereitstellen. Niemals `tailscale funnel` für dieses Dashboard aktivieren. Für direkten LAN-Zugriff die VM-IP binden und Zugriffe zusätzlich mit der vorhandenen Firewall einschränken; Docker-Portfreigaben können einfache UFW-Regeln umgehen.

## Cloudflare Access

Nur bei ausdrücklich gewünschter Freigabe einen Host wie `home.silasnet.win` verwenden. Zuerst eine Cloudflare-Access-Anwendung mit einer auf die eigene Identität beschränkten Allow-Regel anlegen und den Login testen. Dann die Tunnelroute zum Dashboard einrichten. Keine Bypass-Regel für `/api/` setzen: APIs enthalten ebenfalls private Homelab-Daten. Caching für den gesamten Dashboard-Host deaktivieren. Bei cloudflared auf dem VM-Host kann das Ziel `http://127.0.0.1:3000` sein. Bei cloudflared in einem Container bedeutet `localhost` dessen eigenen Container; dann ein privates gemeinsames Docker-Netz mit dem Ziel `http://homepage:3000` verwenden und den Hostport entfernen. Tunnel-Management-API-Token und Tunnel-Connector-Token sind verschiedene Geheimnisse.

`HOMEPAGE_ALLOWED_HOSTS` muss exakt die aufgerufenen Hosts enthalten, beispielsweise `home.silasnet.win,localhost:3000,127.0.0.1:3000`. Kein Protokoll, Pfad oder `*`.

## Secrets

`.env`, private Zertifikate, lokale Referenzen und Artefakte sind ignoriert und vom Docker-Kontext ausgeschlossen. `config/` enthält ausschließlich Platzhalter. Der serverseitige Konfigurationslader ersetzt diese erst nach dem YAML-Parsing: Anführungszeichen oder Zeilenumbrüche in Tokens werden nicht als YAML ausgeführt. Die bestehende Homepage-Allowlist entfernt Widget-Zugangsdaten aus der Browserantwort. Die angepasste Fehleransicht zeigt keine rohen Backendantworten; der Logger maskiert bekannte Tokens, Passwörter und Secrets, auch URL-kodiert.

`docker compose config` ohne `--quiet` und `docker inspect` können Umgebungswerte ausgeben. Entsprechende Ausgaben nicht veröffentlichen. Container-/Docker-Administratoren können Umgebungsvariablen lesen. Für strengere Trennung unterstützt Homepage `HOMEPAGE_FILE_*`:

1. In `services.yaml` zum Beispiel `password: "{{HOMEPAGE_FILE_PROXMOX_TOKEN_SECRET}}"` verwenden.
2. Eine private Compose-Override-Datei mit einem Compose-Secret anlegen und dieses dem Dienst zuordnen.
3. `HOMEPAGE_FILE_PROXMOX_TOKEN_SECRET: /run/secrets/proxmox-token` als Umgebung setzen.
4. Die lokale Quelldatei mit Modus 600 außerhalb des Repositorys ablegen, ohne abschließenden Zeilenumbruch.

Beispiel für eine **lokale**, nicht zu committende Override-Datei:

```yaml
services:
  homepage:
    environment:
      HOMEPAGE_FILE_PROXMOX_TOKEN_SECRET: /run/secrets/proxmox-token
    secrets: [proxmox-token]
secrets:
  proxmox-token:
    file: /absolute/private/path/proxmox-token
```

Compose-Secrets verschlüsseln die Datei auf dem Host nicht. Host und Backups entsprechend schützen. Keine Credentials in URLs verwenden.

## TLS und Proxmox

Im Fork ist `rejectUnauthorized: true` im zentralen HTTP-Proxy gesetzt. Ein nicht vertrauenswürdiges oder namensfremdes Zertifikat führt absichtlich zum Fehler. Bevorzugt ein gültiges Zertifikat mit passendem DNS-Namen verwenden. Alternativ die **öffentliche CA-Zertifikatsdatei** (niemals deren privaten Schlüssel) auf die VM kopieren und Folgendes in `.env` ergänzen:

```dotenv
HOMEPAGE_CA_FILE=/absolute/path/to/homelab-ca.crt
```

```bash
docker compose -f compose.yaml -f deploy/compose.ca.yaml config --quiet
docker compose -f compose.yaml -f deploy/compose.ca.yaml up -d --build
```

Für spätere Updates dieselben Compose-Dateien verwenden. `NODE_EXTRA_CA_CERTS` erweitert die vertrauenswürdigen CAs, ohne die Hostnamenprüfung abzuschalten. `NODE_TLS_REJECT_UNAUTHORIZED=0` ist keine Lösung.

## Docker und Monitoring

Homepage bekommt überhaupt keinen Docker-Socket. Containerzahlen kommen optional über Portainer. Auch ein read-only gemounteter Docker-Socket verhindert keine Schreib-API-Aufrufe und wäre daher kein ausreichender Schutz. Glances auf Debian und Pi nur intern/Tailscale mit Firewall beziehungsweise Authentifizierung zugänglich machen; das Dashboard sollte nicht dessen Prozesse oder Container steuern können.

Runtime: unprivilegierter Node-Benutzer, alle Capabilities entfernt, `no-new-privileges`, begrenzte PIDs/Logs/RAM. Die Konfiguration ist read-only eingebunden. Das Image-Dateisystem bleibt für Next.js-ISR-Cache beschreibbar. Das Dashboard benötigt keinen Zugriff auf Backup-Repositories oder deren Passwörter.
