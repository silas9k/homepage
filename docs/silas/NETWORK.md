# Zwei Standorte, private Administration

HOME A und HOME B sind logische Labels ohne Adressannahmen. A ist standardmäßig ThinkCentre/debian-docker, B der Pi. Tailscale auf Debian-VM und Pi getrennt anmelden, verständliche MagicDNS-Namen vergeben und Grants/ACLs auf die tatsächlich benötigten Ports begrenzen. Proxmox-Administration separat privat anbinden, nicht über Homepage öffentlich machen. Keine Auth-Keys in Git. [Tailscale-Zugriffsregeln](https://tailscale.com/kb/1018/acls) und [Subnetzrouter](https://tailscale.com/kb/1019/subnets) sind Optionen; eine komplette gegenseitige Hausnetzfreigabe ist nicht Voraussetzung.

Homepage läuft im Docker-Bridge-Netz der VM. `localhost` in einer Widget-URL zeigt auf den Homepage-Container, nicht auf den Host oder Pi. Deshalb erreichbaren privaten DNS-Namen, gezielte LAN-Bindung oder eine freigegebene Tailscale-Route verwenden; Erreichbarkeit aus dem Container prüfen. Die sichere Loopback-Erstkonfiguration der Apps ist absichtlich erst über SSH erreichbar. Nicht pauschal alle Bindings auf `0.0.0.0` ändern. Docker-Publishing kann Host-Firewall-Regeln umgehen; Regeln für Docker-Traffic und die tatsächliche Schnittstelle testen.

## Geplante Cloudflare-Hostnamen

Es wurden keine DNS-Einträge oder Tunnel angelegt. Im eigenen Account nur bei Bedarf Public Hostnames am vorhandenen Tunnel hinzufügen, zum passenden privaten Origin leiten und Zugriffsschutz vor Freigabe prüfen:

| Hostname                     | Origin auf der VM (bei nativem cloudflared) | Zweck                                                  |
| ---------------------------- | ------------------------------------------- | ------------------------------------------------------ |
| `memos.silasnet.win`         | `http://127.0.0.1:5230`                     | Geplanter Memos-Zugriff; App-Login und optional Access |
| `share.silasnet.win`         | `http://127.0.0.1:5487`                     | Nur nach erneuter Palmr-Wartungs-/Sicherheitsprüfung   |
| `share-storage.silasnet.win` | `http://127.0.0.1:9379`                     | Palmr-Browser-Storage braucht eigene geschützte Route  |
| `photos.silasnet.win`        | `http://127.0.0.1:2283`                     | Optional Immich-Webansicht/kleine Requests             |

cloudflared im Container erreicht diese Host-Loopback-Origins nicht automatisch; entweder auf der VM betreiben oder bewusst internes Netzwerk/privates Host-Interface konfigurieren. Keine Tunnel-Tokens im Repository. [Cloudflare-Tunnel-Dokumentation](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/) beschreibt Connector und Hostnames. Proxmox, Portainer, Crafty und Homebridge-Admin erhalten keine öffentliche Route. Homepage selbst bleibt privat oder wird separat hinter Access geschützt; Homepage bringt keine eigene Benutzeranmeldung mit.

## Immich: große Uploads

Die mobile App und große Videos primär über **LAN/Tailscale** zur privaten Immich-URL schicken. Cloudflare ist kein unbegrenzter Uploadweg: aktuell Free/Pro 100 MB, Business 200 MB pro HTTP-Request; Enterprise planabhängig bis 5 GB, zusätzliche Timeouts möglich. Zoneneinstellungen können niedriger sein. Quelle, geprüft 09.10.2026: [offizielle Upload-Limits](https://developers.cloudflare.com/cache/concepts/default-cache-behavior/#upload-limits). Limit und Client-Verhalten vor realen großen Uploads testen. Dies betrifft ebenfalls Palmr-Dateitransfers.

Immich-App-Authentifizierung bleibt überall aktiv. Cloudflare Access kann nicht-browserbasierte Clients stören; nicht als einzige Sicherheits- oder Zugriffslösung voraussetzen und keine pauschale Auth-Umgehung einrichten. Keine Router-Portweiterleitung oder direkte unauthentifizierte Internetfreigabe wird erstellt. Tailscale schützt den Transport, ersetzt aber weder App-Accounts noch Backups.
