# Zwei Homebridge-Instanzen

**A: debian-docker am ThinkCentre. B: vorhandener Raspberry Pi 5 am anderen Standort.** Die Zuordnung und Anzeigenamen sind konfigurierbar. Bestehende Pi-Installation weiterverwenden; dieser Stack ersetzt oder migriert sie nicht automatisch. Falls später gewünscht, denselben Stack separat auf dem Pi mit dessen eigenem lokalen Datenverzeichnis nutzen.

Grundlage ist das [offizielle Docker-Image](https://github.com/homebridge/docker-homebridge), stabiler Channel vom 25.09.2026 per Digest fixiert. Linux-Hostnetz ist für HomeKit/mDNS nötig; keine künstliche Port-Mapping-Isolation behaupten. Die UI lauscht üblicherweise auf 8581. Vor Start Host-Firewall so setzen, dass UI nur lokale/Tailscale-Administratoren erreicht; HomeKit/mDNS nur im jeweiligen Hausnetz. Kein Tunnel zur Admin-UI, keine Routerfreigabe.

Deployment im Verzeichnis `deploy/homebridge` nach [Standardverfahren](../README.md). Das gesamte `/homebridge` inklusive Plugins und Pairings wird unter `/srv/homebridge/data` auf **diesem** Host gespeichert. Pro Haus getrennte HomeKit-Bridge-ID, Pairing-Code und UI-Zugangsdaten einrichten. Ein dupliziertes Backup kann kollidierende Identitäten enthalten. Tailscale überträgt nicht automatisch mDNS-Broadcasts; es ersetzt nicht die zweite lokale Bridge.

Dashboard: `HOMEPAGE_VAR_HOMEBRIDGE_A_*` und `HOMEPAGE_VAR_HOMEBRIDGE_B_*` haben jeweils eigene Browser-URL, Health-URL, API-URL und UI-X-User/Passwort. Kein gemeinsamer Token und kein gemeinsamer Status. API-Zugriff bleibt optional; ohne geeignete eingeschränkte Konten nur Link und Erreichbarkeit verwenden. Metriken sind Updates/Child Bridges, keine erfundenen Sensor- oder CPU-Werte.

Update: Homebridge-Backup aus der UI und Kopie des persistenten Verzeichnisses sichern, Release Notes lesen, neuen **stabilen** Digest in `.env` setzen. Dann `docker compose pull && docker compose up -d`, Pairings und Plugins prüfen. Nicht auf Beta/Alpha wechseln. Container-Logs können pluginabhängig private Geräteinformationen enthalten; nicht öffentlich teilen.
