# Zugriff und Geheimnisse

Die Anwendung verlangt jetzt immer eine lokale Anmeldung mit serverseitigen SQLite-Sessions. Einrichtung, Bootstrap, HTTPS-Origins, Passwort-Reset und Persistenz: [AUTHENTICATION.md](AUTHENTICATION.md). Alle Daten-/API-Endpunkte prüfen die Session auch im Handler. Produktive Browserzugriffe benötigen HTTPS; reine HTTP-SSH-Portweiterleitung ist nur für den Entwicklungsserver geeignet. Cloudflare Access kann später als zusätzliche Schicht verwendet werden.


Homepage läuft ausschließlich in `debian-docker`, niemals als Dienst auf dem Proxmox-Host. Dieses Compose richtet weder Tunnel noch öffentliche DNS-Einträge ein. Homepage-Links sind keine Authentifizierung. Ein erlaubt gesetzter Host ist ebenfalls keine Zugangskontrolle.

## Privater Zugriff

Compose veröffentlicht fest `127.0.0.1:3000`; keine direkte LAN-/Tailscale-Portfreigabe. Der bestehende HTTPS-Endpunkt `https://debian-docker.tail277de6.ts.net` über Tailscale Serve und später der hostlokale Cloudflare Tunnel sind die vorgesehenen Zugangswege. Die Tailnet-ACL auf eigene Geräte beschränken. Niemals `tailscale funnel` aktivieren. Docker-Portfreigaben können einfache UFW-Regeln umgehen, deshalb bleibt die Host-Bindung auf Loopback. Siehe [Produktionsanleitung und Rollback](PRODUCTION_RUNBOOK.md) und [Release-Gate](PRODUCTION_SECURITY_AUDIT.md).

## Cloudflare Access

Für die geplante Freigabe exakt `home.silasnet.win` verwenden. Die Tunnelroute zunächst nur vorbereiten, dann die auf die eigene Identität beschränkte Access-Anwendung einrichten und prüfen, erst danach die öffentliche Route aktivieren. Keine Bypass-Regel für `/api/` oder Health setzen. Caching nur für diesen Dashboard-Host deaktivieren. Das Ziel bleibt `http://127.0.0.1:3000`; cloudflared muss deshalb im Netzwerk-Namespace des VM-Hosts laufen. Bei einem Bridge-Container bedeutet `localhost` dessen eigenen Container: In diesem Fall stoppen und die Architektur separat planen, weder die Homepage-Bindung erweitern noch andere Dienste ändern. Tunnel-Management-API-Token und Tunnel-Connector-Token sind verschiedene Geheimnisse. Homepage-Anmeldung und Access bleiben unabhängig aktiv.

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

Im zentralen HTTP-Proxy bleibt die Zertifikatsprüfung standardmäßig aktiviert. Bevorzugt ein gültiges Zertifikat mit passendem DNS-Namen verwenden. Für einzelne interne Hosts mit selbst signiertem Zertifikat kann die Ausnahme über eine exakte Host-Allowlist konfiguriert werden:

```dotenv
HOMEPAGE_TLS_INSECURE_HOSTS=192.168.178.156
```

Die Liste ist kommasepariert, wird getrimmt, vergleicht Hostnamen/IP-Adressen ohne Port und deaktiviert die Prüfung ausschließlich für exakt passende HTTPS-Ziele. Leere Einträge werden ignoriert. Keine Wildcards, Teilstrings oder Credentials verwenden. `NODE_TLS_REJECT_UNAUTHORIZED=0` bleibt verboten.

Alternativ die **öffentliche CA-Zertifikatsdatei** (niemals deren privaten Schlüssel) auf die VM kopieren und Folgendes in `.env` ergänzen:

```dotenv
HOMEPAGE_CA_FILE=/absolute/path/to/homelab-ca.crt
```

```bash
docker compose -f compose.yaml -f deploy/compose.ca.yaml config --quiet
docker compose -f compose.yaml -f deploy/compose.ca.yaml up -d --build
```

Für spätere Updates dieselben Compose-Dateien verwenden. `NODE_EXTRA_CA_CERTS` erweitert die vertrauenswürdigen CAs, ohne die Hostnamenprüfung abzuschalten. `NODE_TLS_REJECT_UNAUTHORIZED=0` ist keine Lösung.

## Docker und Monitoring

Homepage bekommt überhaupt keinen Docker-Socket. Containerzahlen kommen optional über Portainer. Auch ein read-only gemounteter Docker-Socket verhindert keine Schreib-API-Aufrufe und wäre daher kein ausreichender Schutz. Beszel nur intern/Tailscale mit Firewall beziehungsweise Authentifizierung zugänglich machen; das Dashboard sollte nicht dessen Prozesse oder Container steuern können.

Runtime: unprivilegierter Node-Benutzer, alle Capabilities entfernt, `no-new-privileges`, begrenzte PIDs/Logs/RAM. Die Konfiguration ist read-only eingebunden. Das Image-Dateisystem bleibt für Next.js-ISR-Cache beschreibbar. Das Dashboard benötigt keinen Zugriff auf Backup-Repositories oder deren Passwörter.
