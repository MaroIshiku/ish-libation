# Libiku

Libation Web GUI fuer Docker, ZimaOS und optionale Gluetun-Deployments.

## Kurzbeschreibung

Libiku ist eine Weboberflaeche fuer [Libation](https://github.com/rmcrackan/Libation). Die App baut Libation CLI im Container, liest die Libation-SQLite-Datenbank fuer die Library-Ansicht read-only und fuehrt Scan-, Download-, Status-, Login- und Import-Aktionen ueber die offizielle CLI aus.

## Teil der ishiku-Familie

Libiku folgt dem gemeinsamen Pixel Soft Utility Designsystem der ishiku Apps: ruhige Flaechen, runde Komponenten, mobile AppShell, Desktop-Dashboard und konsistente Themes. Die App nutzt dieselben sechs Themes wie die anderen ishiku Utilities: Lavender, Mint, Sky, Amber, Rose und Graphite, jeweils mit Light, Dark und System Mode.

Der erste Start nutzt das gemeinsame Admin-Setup mit Docker-Secret. Danach ist die oeffentliche Registrierung geschlossen und die Web GUI verlangt eine Admin-Session.

## Funktionen

- Dashboard mit Libation-Version, Public-IP-Kontext, aktiven Jobs und Job-Verlauf.
- Library-Ansicht mit Suche, Statusfilter, Sortierung und kartengestuetzter Mobile-Ansicht.
- Aktionen fuer Refresh, Liberate All, Einzel-Liberate, Force, PDF und Status Check.
- Account-Liste ueber `LibationCli list-accounts`.
- Externer Audible-Login und Import von `audible-cli` JSON als Hintergrundjobs.
- JSON-Editoren fuer `Settings.json` und `AccountsSettings.json`.
- Logs, Diagnostics und technische Informationen im Settings-Bereich.
- First-Run Admin-Setup mit Setup-Secret, gehashtem Passwort und Session-Cookie.

## Tech Stack

- Node.js ohne Frontend-Framework.
- Libation CLI aus dem upstream Libation Repository.
- SQLite-Zugriff ueber `sqlite3` im Container, read-only fuer Library-Daten.
- Docker Multi-Stage Build mit .NET SDK fuer Libation und Node Runtime fuer Libiku.
- Pixel Soft Utility Designsystem mit lokaler CSS/JS-Basis, lokaler Icon-Sprite und lokalem Logo.

## Installation

### Docker Compose

Lege zuerst ein Setup-Secret an:

```bash
mkdir -p secrets
printf '%s\n' 'replace-with-a-long-random-secret' > secrets/setup_secret.txt
```

Direkter Betrieb ohne VPN:

```bash
docker compose -f compose.yml up -d
```

Fuer eigene Deployments kann `docker-compose.example.yml` als neutrale Vorlage genutzt werden.

Empfohlener Betrieb mit Gluetun:

```bash
docker compose -f compose.gluetun.yml up -d
```

Vor dem Start des Gluetun-Stacks muessen die Platzhalter in `compose.gluetun.yml` ersetzt werden:

```yaml
MULLVAD_ACCOUNT_ID: INSERT_HERE
WIREGUARD_PRIVATE_KEY: INSERT_HERE
WIREGUARD_ADDRESSES: INSERT_HERE
```

Die Web GUI ist danach unter folgendem Port erreichbar:

```text
http://<host>:3100
```

### Erstes Starten

Beim ersten Aufruf zeigt Libiku ein blockierendes Admin-Setup. Die normale App ist erst sichtbar, wenn ein erster Adminaccount erstellt wurde.

### Adminaccount erstellen

Gib im Setup-Fenster das Setup-Secret aus `secrets/setup_secret.txt`, einen Anzeigenamen, einen Admin-Benutzernamen und ein Admin-Passwort ein. Das Admin-Passwort muss mindestens 12 Zeichen lang sein und darf nicht dem Setup-Secret entsprechen.

Nach erfolgreicher Erstellung wird die Registrierung geschlossen. Weitere Admins koennen nicht ueber das oeffentliche Setup erstellt werden.

## Konfiguration

### Umgebungsvariablen

| Variable | Standard | Zweck |
| --- | --- | --- |
| `PORT` | `3000` | Webserver-Port im Container |
| `TZ` | `Europe/Berlin` | Zeitzone fuer Logs und Anzeige |
| `LIBIKU_AUTH_FILE` | `/config/LibikuAuth.json` | Persistente Admin- und Setup-Metadaten |
| `LIBIKU_SESSION_TTL_SECONDS` | `604800` | Laufzeit der Admin-Session |
| `LIBATION_CLI` | `/libation/LibationCli` | Pfad zur Libation CLI |
| `LIBATION_FILES_DIR` | `/config` | Libation Settings und Accounts |
| `LIBATION_DB_DIR` | `/db` | Suchpfad fuer Libation-Datenbanken |
| `LIBATION_BOOKS_DIR` | `/data` | Zielpfad fuer Downloads |
| `PUBLIC_IP_URL` | `https://api.ipify.org?format=json` | Public-IP-Pruefung |
| `PUBLIC_IP_INTERVAL_SECONDS` | `300` | Intervall der Public-IP-Pruefung |

### Docker Secrets

Libiku liest bevorzugt:

```text
ISHIKU_SETUP_SECRET_FILE=/run/secrets/ishiku_setup_secret
```

`ISHIKU_SETUP_SECRET` ist nur als Fallback fuer einfache lokale Deployments gedacht. Das Secret wird nicht in der Datenbank gespeichert und nicht an den Browser ausgegeben.

### Persistente Daten

Die Compose-Dateien nutzen standardmaessig:

| Host-Pfad | Container-Pfad | Zweck |
| --- | --- | --- |
| `/media/ZimaOS-HD/AppData/libiku/config` | `/config` | Libation Settings, Accounts und Libiku Auth-Datei |
| `/media/ZimaOS-HD/AppData/libiku/db` | `/db` | Libation-Datenbank |
| `/media/ZimaOS-HD/AppData/libiku/data` | `/data` | Download-Ausgabe |
| `/media/ZimaOS-HD/AppData/libiku/gluetun` | `/gluetun` | Gluetun Statusdaten im VPN-Stack |

## Sicherheit

- Das Setup-Secret ist nur fuer die erste Admin-Registrierung vorgesehen.
- Das Admin-Passwort darf nicht mit dem Setup-Secret uebereinstimmen.
- Passwoerter werden mit Node `scrypt` gehasht gespeichert, nicht im Klartext.
- Oeffentliche Registrierung ist nach dem ersten Adminaccount geschlossen.
- Sessions nutzen HttpOnly-Cookies mit `SameSite=Lax`.
- Falsche Setup-Versuche werden begrenzt.
- Healthchecks unter `/healthz` geben keine sensiblen Daten aus.

## Updates und Backup

Ziehe neue Images und erstelle den Stack neu:

```bash
docker compose -f compose.yml pull
docker compose -f compose.yml up -d
```

Sichere vor Updates die persistenten Verzeichnisse `/config`, `/db` und `/data`. Im Gluetun-Modus sollte auch `/gluetun` gesichert werden, wenn dessen Zustand erhalten bleiben soll.

## Entwicklung

```bash
npm install
npm run dev
```

Fuer lokale Entwicklung ohne gebautes Libation CLI kann `LIBATION_CLI` auf einen vorhandenen `LibationCli`-Pfad gesetzt werden.

Syntaxcheck:

```bash
npm run check
```

## Erstellt mit ChatGPT Codex

Dieses Projekt wurde mit Unterstuetzung von ChatGPT Codex entworfen und ueberarbeitet. Maintainer, Rechteinhaber und Verantwortung fuer Betrieb und Veroeffentlichung bleiben beim Repository-Inhaber.

## Status und Lizenz

Status: fruehe Docker-first Web GUI fuer Libation CLI.

Eine Lizenzdatei ist aktuell nicht enthalten. Vor Weiterverwendung ausserhalb des eigenen Deployments sollte eine passende Lizenz ergaenzt werden.
