# Integrationen

Alle Werte werden in `.env` gepflegt. Die Namen stehen vollständig in `.env.example`. Ein Link allein aktiviert kein API-Widget. Erst die Felder aus `silasRequired` schalten es ein. HTTP-Monitoring wird ausschließlich durch eine gültige `siteMonitor`-URL aktiviert. Die entsprechenden Health-URLs können unabhängig von der Browser-URL gesetzt werden; bevorzugt direkt intern, damit keine Access-Loginseite als Service-Erfolg interpretiert wird.

## Proxmox

Dedizierten Benutzer `homepage@pve` ohne Administratorrechte erstellen. Einen API-Token `dashboard` mit **Privilege Separation** anlegen. Benutzer **und** Token benötigen `PVEAuditor` auf den zu lesenden Ressourcen. Für das Homepage-Cluster-Widget empfiehlt die Upstream-Dokumentation den Pfad `/` mit Vererbung; das ist clusterweites Lesen, kein Schreiben. Bei feineren ACLs nur die benötigten Nodes/VMs freigeben und die Vollständigkeit der Counts prüfen. Kein `root@pam`, kein Administrator-Token, kein Root-Passwort.

- `HOMEPAGE_VAR_PROXMOX_URL`: interner HTTPS-DNS-Name inklusive Port 8006.
- `HOMEPAGE_VAR_PROXMOX_TOKEN_ID`: `homepage@pve!dashboard`.
- `HOMEPAGE_VAR_PROXMOX_TOKEN_SECRET`: das einmal angezeigte Secret.
- `HOMEPAGE_VAR_PROXMOX_NODE`: tatsächlicher Node-Name.

Das vorhandene Widget liefert CPU, RAM, VMs und LXC. Es liefert keine zuverlässige Dashboard-Zusammenfassung für physischen Samsung-SSD-Speicher oder Host-Uptime; diese Felder werden deshalb nicht vorgetäuscht. TLS siehe [Sicherheit](SECURITY.md). Grundlage: [Homepage-Proxmox-Dokumentation](https://gethomepage.dev/configs/proxmox/).

## Debian und Raspberry Pi

Glances **4** mit Web-API auf dem jeweiligen Host einrichten. Eine native Glances-Installation misst den Host; ein isolierter Container kann stattdessen Container-Dateisysteme oder falsche Mounts liefern. Für die erste Einrichtung die Glances-API `/api/4/cpu`, `/api/4/mem` und `/api/4/fs` vom Dashboard-Netz aus prüfen. Nicht öffentlich exponieren. Glances muss keine Schreibrechte auf Docker erhalten.

`HOMEPAGE_VAR_DEBIAN_GLANCES_URL` und `HOMEPAGE_VAR_RASPI_GLANCES_URL` enthalten jeweils die Basis-URL ohne `/api/4`. Optional User/Password für Basic Auth am internen Proxy setzen. `*_HEALTH_URL` darf auf einen nur intern zugänglichen Health-Endpunkt zeigen. `*_URL` ist der separat wählbare Browserlink zur Verwaltung.

Die kleine Glances-Erweiterung `metric: "summary:/"` zeigt CPU, RAM und das Dateisystem mit `mnt_point: /`. Für die Pi-Backupplatte kann stattdessen `summary:/mnt/backup` gesetzt werden. Ein fehlender Mount wird als `—` gezeigt, niemals als 0 %. Containerzahlen erscheinen in Portainer. Zusätzliche Glances-Netzwerk-/Containerwidgets bleiben upstream verfügbar, sind wegen der kompakten Standardansicht nicht eingeschaltet.

## Nextcloud und Vaultwarden

Nextcloud: Basis-URL und `HOMEPAGE_VAR_NEXTCLOUD_TOKEN` (NC-Token für Serverinformationen) setzen. Der Serverinfo-Endpunkt muss erreichbar und aktiviert sein. In Nextcloud unter Verwaltung/System beziehungsweise der Dokumentation der eingesetzten Version prüfen. Gezeigt werden freier Speicher, **aktive** Nutzer und Dateien, nicht die Gesamtzahl aller registrierten Nutzer. Eine optionale Health-URL kann `/status.php` sein; HTTP-Erreichbarkeit allein wertet dessen Wartungsmodus nicht aus. Datenbank-/Redis-Health ist nicht Teil dieses Widgets.

Vaultwarden: nur Link und optionaler Health-Endpunkt, beispielsweise der erreichbare `/alive`-Endpunkt der eingesetzten Version. Kein Admin-Token, kein Masterpasswort, keine Tresorinhalte erforderlich.

## Jellyfin

Dedizierten API-Key im Jellyfin-Dashboard unter Erweitert/API-Schlüssel erzeugen. Jellyfin-API-Keys können weitergehende Berechtigungen haben; daher nur privat bereitstellen und bei Bedarf widerrufen. `HOMEPAGE_VAR_JELLYFIN_WIDGET_VERSION=1` für ältere Server, `2` für Jellyfin >= 12 (10.12) gemäß der mitgelieferten Upstream-Dokumentation. Die tatsächliche Serverversion prüfen.

Filme, Serien und Episoden sind aktiviert. Bibliotheksspeicher wird nicht erfunden. `enableNowPlaying: true` kann später aktive Wiedergaben anzeigen; `enableUser: false` und `enableMediaControl: false` sollten erhalten bleiben. Ein separater reiner Streamzähler ist nicht Bestandteil der konfigurierten Felder.

## Home Assistant und Homebridge

Home Assistant unterstützt eine getrennte Browser- und API-URL. Ein dediziertes Konto mit den geringstmöglichen Rechten und einen langlebigen Token einsetzen; HA-Tokens sind nicht auf reine Statistik-Endpunkte beschränkt. Es werden nur die Homepage-Felder `lights_on` und `switches_on` verwendet, keine Anwesenheitsdaten.

Homebridge B läuft auf dem Pi, Homebridge A separat in debian-docker. Beide Karten haben eigene `*_A_*`/`*_B_*` Browser-, Health- und API-URLs sowie User/Passwort. Die Host- und Standortzuordnung ist konfigurierbar. Die Integration benötigt Config UI X sowie dessen Benutzer/Passwort. Nur die nötigen Kontorechte vergeben; unterstützt die eingesetzte Version kein geeignetes eingeschränktes Konto, nur Link/HTTP-Prüfung nutzen und Zugangsdaten leer lassen. Metriken: verfügbare Updates und Child Bridges, keine fiktiven CPU-Werte.

## Portainer, Cloudflare und Tailscale

Portainer: Basis-URL, Environment-ID aus der Umgebungsauswahl und einen dedizierten API-Key setzen. Nur Leserechte für das gewählte Environment vergeben, sofern die eingesetzte Portainer-Edition dies unterstützt; ansonsten Integration deaktiviert lassen oder das Risiko eines breiteren Schlüssels bewusst selbst bewerten. Das Dashboard führt keine Verwaltungsaktionen aus.

Cloudflare: Account-ID, Tunnel-ID und einen auf den eigenen Account beschränkten API-Token mit ausschließlich `Account.Cloudflare Tunnel:Read`. **Kein** Global API Key und kein Connector-Token. Nur Tunnelstatus wird angezeigt; öffentliche Origin-IP bleibt ausgeblendet.

Tailscale: API-Key und Device-ID (`...CNTRL`) aus der Maschinenansicht. API-Keys haben eine begrenzte Gültigkeit und können weitreichende Rechte besitzen; deshalb ist die Integration vollständig optional. Für die minimale Variante nur den vorhandenen Verwaltungslink verwenden. Das Widget zeigt letzten Kontakt und Key-Ablauf; das ist keine Garantie, dass die Maschine aktuell erreichbar ist.

## Paperless-ngx und Resticwatch

Paperless ist standardmäßig verborgen; eine URL aktiviert die Karte und sein API-Token liefert Dokument-/Inbox-Zahlen. Resticwatch ist als optionale, nicht konfigurierte Karte sichtbar.

[Resticwatch](https://github.com/kchromik/Resticwatch) ist als Link plus optionaler HTTP-Prüfung vorbereitet. Es bekommt separat read-only Zugriff auf das Backupziel; Homepage bekommt keinerlei Restic-Passwörter. Keine spekulative Statistik-API ist verdrahtet. `RW_DEMO` im echten Resticwatch nicht setzen: Dieser Modus liefert ausdrücklich erfundene Daten. Nach dessen Installation kann ein Homepage-`customapi`-Widget anhand der tatsächlich eingesetzten API-Version ergänzt werden.

## Memos, Palmr, Immich und Gaming

Memos und Palmr benötigen für Homepage keine API-Credentials: private Browser-URL und optional interne HTTP-Health-URL genügen. Keine Notizen/Transferinhalte werden gelesen. Palmr bleibt wegen des archivierten Beta-Status ausdrücklich optional; [Wartungsbefund](../../deploy/palmr/README.md).

Immich: Browser-URL für LAN/Tailscale und separat `HOMEPAGE_VAR_IMMICH_API_URL` setzen. Einen API-Key mit ausschließlich `server.statistics` verwenden. Das native Widget (`version: 2`) zeigt Fotos, Videos, Speicher und Nutzer. Job-/ML-/Datenbankgesundheit ist darin nicht enthalten. Keine Jobs werden als gesund angenommen, nur weil HTTP erreichbar ist. [Upstream-Widget](https://gethomepage.dev/widgets/services/immich/).

Crafty: kein nativer Statistikadapter im verwendeten Homepage-Stand, daher Link/HTTP-Status ohne Zugangsdaten. Minecraft separat über das bestehende Statuswidget; Serveradresse im dokumentierten `udp://host:port`-Format, tatsächliche Java-Abfrage per TCP. Keine Crafty- oder RCON-Secrets nötig. CPU/RAM sind Hostwerte in der Server-Sektion, keine behaupteten Minecraft-Prozesswerte. [Setup, Ports, Updates und Playit](../../deploy/crafty/README.md).
