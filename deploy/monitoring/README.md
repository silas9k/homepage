# Kleines Monitoring

Glances 4 auf `debian-docker` und separat auf dem Raspberry Pi liefert reale CPU-/RAM-/Dateisystemwerte. Bestehendes Monitoring weiterverwenden. Anleitung und API-Pfade: [Integrationen](../../docs/silas/INTEGRATIONS.md). Kein zusätzlicher großer Monitoring-Stack und kein Docker-Socket sind erforderlich.

Nur an private Interfaces binden oder einen authentifizierten internen Proxy vorschalten; eingehenden API-Zugriff auf den Homepage-Host begrenzen. Konfiguration ohne Credentials funktioniert nur innerhalb dieses geschützten Netzes. Die Dashboard-Containeradresse `localhost` bezeichnet den Container selbst: Host-APIs über erreichbaren internen DNS-Namen/Tailscale-Subnetzroute konfigurieren.

Die zukünftige Pi-HDD-Backupkarte bleibt ein geplanter Leerzustand. Nach tatsächlicher Einrichtung separat die Mount-Belegung und den letzten erfolgreichen Backup-Lauf integrieren. Ein erreichbarer HTTP-Endpunkt oder freier Speicher beweist kein erfolgreiches Backup. Resticwatch bleibt optional; Restic-Passwörter und Repository-Schlüssel niemals Homepage geben. Bis echte APIs bekannt sind, wird keine Backup-Statistik simuliert.
