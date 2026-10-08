# Homepage

Die einzige Homepage-Compose-Datei bleibt [`../../compose.yaml`](../../compose.yaml). Sie baut den vorhandenen Fork. Keine zweite Installation und kein Stock-Image verwenden. Start, Update, private Bind-Adresse und SSH-Zugriff stehen in der [Projekt-README](../../README.md).

`config/` enthält versionierte Vorlagen, keine Nutzdaten. Optional die Konfiguration nach `/srv/homepage/config` kopieren und `HOMEPAGE_CONFIG_PATH=/srv/homepage/config` in `.env` setzen. Bestehende Dateien zuerst sichern; Updates nie blind darüberkopieren. Das Verzeichnis muss für Container-UID 1000 lesbar sein. API-Zugangsdaten gehören ausschließlich in `.env` oder Dateisecrets. Logs gehen begrenzt an Docker, nicht in Git.
