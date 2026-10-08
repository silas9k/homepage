# Referenzanalyse und Visual QA

Alle elf PNGs aus dem bereitgestellten ZIP wurden einzeln geöffnet, bevor das Design implementiert wurde. Die Dokumente im ZIP wurden als Kontext behandelt; maßgeblich ist der Auftrag im Chat.

| Referenz | Beobachtung                                                                                         |
| -------- | --------------------------------------------------------------------------------------------------- |
| 01       | Video-/Kommentar-Kontext und Hardware; kein verwertbares Dashboard-Layout                           |
| 02       | Monitor mit einer anderen blauen Oberfläche; keine Vorgabe für den gewünschten Light-Look           |
| 03       | Teilweise verdecktes Dashboard; kleine Typografie und kompakte Messwerte erkennbar                  |
| 04       | Beste Kartendetailansicht: dünne Ränder, leicht graue Stat-Zellen, Icon links, kleiner Punkt rechts |
| 05       | Untere Kategorien, Dreispaltenraster und breitere Smart-Home-Karten                                 |
| 06       | Bestätigt ruhige Zellabstände und geringe visuelle Tiefe                                            |
| 07       | Verhältnis von Serverkarten, Abschnittsüberschriften und unteren Kategorien                         |
| 08       | Breite Matrix, geringe Rundung und zweispaltiger Serverbereich im fremden Lab                       |
| 09       | Schmale Kopfzeile mit kleiner Wortmarke links, Suchfeld rechts                                      |
| 10       | Seitenränder und gesamter vertikaler Rhythmus der Kopfzeile                                         |
| 11       | Derselbe Video-/Kommentar-Kontext wie 01; kein zusätzlicher Dashboardzustand                        |

Umsetzung: warmgraue Fläche `#f5f5f3`, nahezu weiße Karten `#fcfcfb`, Stat-Zellen `#eeefed`, Rand `#dedfdb`, keine Schatten/Verläufe, 12 px Kartenradius, 18 px Rasterabstand, 40 px zwischen Abschnitten. Zentrierter Inhalt: bis zu 1584 px innerhalb eines 1680-px-Containers. Kopfzeile: 86 px hoch, Suchknopf 292 × 42 px. Neutrale Systemschrift ohne Font-Download. Dienste 16 px, Beschreibungen 13 px, Statistiklabels 11 px.

Die Erweiterung zeigt 19 aktive Karten für zwei Standorte. Smart Home umfasst drei Karten; Standortlabels sitzen klein neben dem Statuspunkt. Server, Smart Home, Gaming und Backups nutzen auf großen Bildschirmen zwei breite Karten pro Zeile; Cloud & Dokumente, Fotos & Medien und Verwaltung & Netzwerk nutzen drei. Unter 1000 px werden Raster zweispaltig, unter 600 px einspaltig. Alle Geräte können zu Gaming, Verwaltung und Backups scrollen; die zusätzlichen Dienste werden nicht in eine einzige Bildschirmhöhe gedrängt. Karten haben mindestens 168 px Höhe und großzügigere Kopf- und Statistikbereiche.

Die endgültige Produktionsansicht wird unter `artifacts/dashboard-1920x1080.png` erfasst. Weitere Browserprüfungen: 1440×900, 768×1024 und 390×844. Überprüft werden Kartenanzahl, lokale Icons, ausbleibender horizontaler Überlauf, versteckte optionale Dienste, keine API-Polls ohne Zugangsdaten, Suchbedienung und Fokus-Rückgabe. Zusätzlich werden echte Nullwerte und ein fehlgeschlagenes Backend ausschließlich mit markierten Test-Fixtures geprüft. Diese Fixtures sind weder in `config/` noch im Produkt enthalten.

Die Screenshots zeigen den ehrlichen Auslieferungszustand ohne verbundene private APIs. Graue Punkte und `—` ersetzen unbekannte Messwerte. Grüne Statuspunkte werden nicht für die Aufnahme simuliert. Die persönlichen Referenzbilder werden nicht mit dem Fork veröffentlicht.

Nach Erweiterung wurden Desktop (1920×1080 und 1440×900), Tablet (768×1024) und Mobil (390×844) erneut visuell geprüft. Die Cloud-Zeile wurde auf Desktop auf vier Karten verdichtet; Schrift, Rand, Zellen und Abschnittsabstände bleiben aus dem bestehenden Design erhalten. Zusätzliche untere Screenshots prüfen Backups/Netzwerk; `dashboard-full-page.png` zeigt den gesamten Inhalt bei 1920 px Breite. Nur für diese Zusatzaufnahme wird der innere Scrollcontainer vorübergehend erweitert. Der geforderte 1920×1080-Screenshot bleibt eine unveränderte echte Viewport-Aufnahme.
