# RAMcast – Radio And Music Cast

*Fullscreen radio and music card for Home Assistant – Norwegian radio stations built in, search any station worldwide (Radio Browser), and play music from your Music Assistant sources (YouTube Music, Spotify, Tidal …). Per-user favourites and categories, per-user speakers, live song info and cover art.*

**RAMcast** er et fullskjerms kort for **radio og musikk** i Home Assistant:

- **Radio** – de vanligste norske kanalene (NRK, P4-gruppen, Bauer) ligger inne fra start, og du kan søke opp radiokanaler fra hele verden.
- **Musikk** – søk og spill sanger, artister, album og spillelister fra musikkildene du har i **Music Assistant**, som YouTube Music, Spotify, Tidal, Apple Music, Deezer, Qobuz og SoundCloud.

Kortet viser hva som spilles nå med cover, og alt spilles gjennom Music Assistant til Google Cast-høyttalere, grupper eller TV.

> Tidligere het kortet **RACast**. De gamle kortnavnene `custom:racast-card` og `custom:radio-norge-card` virker fortsatt.

## Funksjoner

- **Spilles nå med cover** – sang, artist, program og fremdrift. Kilder: NRK sitt åpne API, Bauer sitt API (valgfri REST-pakke), ellers ICY-data fra strømmen via Music Assistant. Albumcover hentes fra iTunes. Nye cover tones mykt inn, og forrige cover blir stående til det neste er klart. Cover fra Music Assistant vises via Home Assistant, så de virker også utenfor hjemmenettet.
- **Søk i hele verden** – via [Radio Browser](https://www.radio-browser.info/). Norske treff vises først.
- **Musikk fra Music Assistant** – Musikk-fanen søker etter sanger, artister, album og spillelister i musikkildene dine i Music Assistant (f.eks. YouTube Music, Spotify, Tidal). Uten søk vises spillelistene i biblioteket. Forrige/neste, tilfeldig rekkefølge og «Kommer» (sporene som spilles etterpå).
- **Favoritter per bruker** – radio og musikk. Nye brukere starter med NRK mP3, P5 Hits og Radio Norge, pluss snarveiene «Finn radiokanaler» og «Finn musikk».
- **Egne kategorier per bruker** – «+ Lag kategori», gi den navn og legg til radiokanaler og musikk. Endre rekkefølge, gi nytt navn eller slett med ✎. Fanene kan også flyttes.
- **Utganger per bruker** – admin bestemmer hvilke høyttalere hver bruker får se (f.eks. bare den i samme rom). Hver bruker husker sin siste utgang.
- **Fullmodus** – mens noe spilles, skjules faner og kanaler etter en stund uten berøring, så cover og sanginfo fyller skjermen. Et trykk henter dem tilbake.
- **Følger med på hva som faktisk spiller** – startes radio fra en annen enhet eller bruker, viser kortet det, og hopper til riktig utgang. Kastes musikk fra en app på telefonen (f.eks. Spotify), vises det også.
- **Robust avspilling** – raske kanalbytter gir bare ett kall, nytt forsøk hvis kanalen ikke starter, og automatisk omstart hvis strømmen faller ut.

## Krav

- En nyere Home Assistant-versjon (utviklet og testet på HA 2026)
- **[Music Assistant](https://music-assistant.io/)** (anbefalt, se under) med Home Assistant-integrasjonen – testet med MA 2.10
- Google Cast-høyttalere/grupper/TV (andre MA-spillere virker også)

### Hvorfor Music Assistant – og sett utgangsformat til MP3

Direkte Cast fra Home Assistant fungerer dårlig for nettradio:

- mange radioservere (bl.a. P4-gruppen og Bauer) sender for lite buffer ved oppstart, så Cast kan bruke 15–20 s på å starte
- å bytte mellom direkte Cast og Music Assistant på samme høyttaler får høyttaleren til å bytte mottaker-app – du hører «blipp»-lyden, og kanalen starter tregt eller ikke i det hele tatt

RAMcast spiller derfor alt via Music Assistant. **Viktig innstilling i Music Assistant** – for hver Google Cast-spiller og gruppe du bruker:

1. Åpne Music Assistant → **Innstillinger → Spillere** → velg spilleren
2. Trykk **Vis avanserte innstillinger** nederst
3. Sett **Output codec** til **MP3** (standard er FLAC)
4. Slå gjerne på **Queue flow mode**
5. Lagre

Med FLAC melder Google-høyttalere ofte avspillingsfeil etter ca. 3 minutter med radio, og strømmen stopper. Med MP3 spiller de stabilt.

Sørg også for at hver spiller er **aktivert** og har **Expose player to Home Assistant** slått på (under avanserte innstillinger), ellers lager ikke Home Assistant noen MA-spiller for den, og kortet må falle tilbake til direkte Cast.

## Installasjon

### Manuelt

1. Kopier `ramcast-card.js` til `/config/www/ramcast/ramcast-card.js`
2. **Innstillinger → Dashbord → ⋮ → Ressurser → Legg til ressurs**
   - URL: `/local/ramcast/ramcast-card.js?v=2.11.0`
   - Type: **JavaScript-modul**
3. Hard-oppdater nettleseren (Ctrl+Shift+R)

> `/local/` caches i 31 dager. Bytt `?v=` i ressurs-URL-en hver gang du oppdaterer fila.

### HACS / Marketplace (egendefinert repo)

Legg til repoet som *Dashboard* via «egendefinert repo» / «Add from link». Et privat repo krever at GitHub-kontoen din er koblet til.

## Bruk

Lag gjerne et eget dashbord med en **panel**-visning, så kortet fyller hele skjermen:

```yaml
views:
  - title: RAMcast
    path: radio
    type: panel
    cards:
      - type: custom:ramcast-card
```

Uten noen innstillinger finner kortet selv hvilken Music Assistant-spiller som hører til hver Cast-høyttaler (de har samme enhets-ID). Høyttaleren vises én gang, med Cast-navnet, og spilles via Music Assistant. Standardutgang er en MA-gruppe hvis du har en, ellers første MA-spiller. Bruk `ma_only: true` for å skjule høyttalere som ikke finnes i Music Assistant.

## Innstillinger

| Valg | Standard | Beskrivelse |
|---|---|---|
| `title` | `RAMcast` | Navnet øverst til venstre |
| `default_player` | første MA-spiller | Standard utgang |
| `ma_players` | `{}` | Kobler en Cast-entitet til en MA-spiller manuelt, f.eks. `media_player.stue: media_player.stue_ma`. Trengs vanligvis ikke (se `auto_twins`), men overstyrer den automatiske koblingen |
| `auto_twins` | `true` | Finn Cast → MA-spiller automatisk via enhetsregisteret |
| `extra_players` | `[]` | Ekstra utganger som ikke er høyttalere (f.eks. en Chromecast/Google TV) |
| `players` | auto | Fast liste over utganger i menyen |
| `ma_only` | `false` | `true`: vis bare utganger som spilles via Music Assistant – MA-spillere og Cast-utganger som har en MA-spiller i `ma_players` (vises med Cast-navnet). Anbefalt når alle høyttalerne er i MA |
| `admin_users` | `[]` | Bruker-ID-er som kan styre «Utganger per bruker» (i tillegg til HA-eieren) |
| `restrict_outputs` | `false` | `true`: brukere admin ikke har satt opp, får bare standardutgangen |
| `bauer_sensor_prefix` | `sensor.radio_np_` | Prefiks for Bauer «spilles nå»-sensorer (se under) |
| `nrk_direct` | `false` | Spill NRK direkte via Cast i stedet for via MA |
| `idle_timeout` | `20` | Fullmodus: sekunder uten berøring før faner og kanaler skjules mens noe spilles (`0` = av). Admin kan overstyre for alle og per bruker under Innstillinger |
| `ma_config_entry` | auto | Config entry-ID for Music Assistant-integrasjonen (brukes av Musikk-fanen). Finnes vanligvis automatisk |
| `import_categories_from` | – | Overgang fra v1.x: todo-lista der kategoriene lå før. Hver bruker henter sine egne kategorier derfra én gang |

Eksempel med Cast-gruppe og TV:

```yaml
type: custom:ramcast-card
default_player: media_player.hele_huset
extra_players:
  - media_player.tv
ma_only: true          # skjul utganger som ikke går via Music Assistant
admin_users:
  - 0123456789abcdef0123456789abcdef   # bruker-ID (finnes på person-entiteten, attributtet user_id)
restrict_outputs: true
```

### Utganger per bruker

Admin (HA-eieren eller brukere i `admin_users`) får **«Innstillinger…»** nederst i utgangsmenyen. Der velger du for hver person hvilke høyttalere de kan bruke og hvilken som er standard, og hvor lenge det går før fullmodus slår inn (for alle og per bruker). Innstillingene lagres i Home Assistant (`frontend/system_data`) og gjelder på alle enheter.

HA sitt admin-flagg brukes bevisst ikke, fordi kiosk-/veggpanel-brukere ofte må være admin i HA av andre grunner.

## Valgfritt

### «Spilles nå» for Bauer-kanalene

Bauer sitt API mangler CORS, så Home Assistant må hente det. Kopier `extras/bauer_nowplaying.yaml` til `/config/packages/` og start HA på nytt. Uten pakken virker kanalene som før, men uten sanginfo.

### Riktige navn og logoer i Music Assistant / på Cast-skjermer

Mange strømmer sender ikke kanalnavn, så Music Assistant viser f.eks. «P05AAH». Skriptet legger kortets kanaler inn i MA sitt radiobibliotek med navn og logo:

```bash
MA_URL=http://<ma-ip>:8095 MA_TOKEN=<token> node tools/add-stations-to-ma.mjs
```

Token lages i Music Assistant under **Innstillinger → Profil**. Slett den gjerne etterpå.

## Lagring

- Favoritter, kategorier, rekkefølgen på fanene og siste utgang: per HA-bruker (`frontend/user_data`, nøkkel `radio_norge_card`)
- Utganger per bruker og fullmodus: felles (`frontend/system_data`, samme nøkkel)

## Eksterne tjenester

Kortet henter data direkte fra nettleseren: `psapi.nrk.no` (NRK spilles nå), `*.api.radio-browser.info` (søk), `itunes.apple.com` (cover) og `images.weserv.nl` (gjør NRK sine SVG-logoer om til PNG for Cast).
