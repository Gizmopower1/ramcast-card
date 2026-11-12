# RACast

*Fullscreen web radio card for Home Assistant – Norwegian stations built in, search any station worldwide (Radio Browser), per-user favourites and categories, per-user speakers, live song info and cover art. Plays through Music Assistant.*

**RACast** er et fullskjerms nettradiokort for Home Assistant. De vanligste norske kanalene (NRK, P4-gruppen, Bauer) ligger inne fra start, og du kan søke opp radiokanaler fra hele verden. Kortet viser hva som spilles nå med albumcover, og alt spilles gjennom **Music Assistant** til Google Cast-høyttalere, grupper eller TV.

## Funksjoner

- **Spilles nå med cover** – sang, artist, program og fremdrift. Kilder: NRK sitt åpne API, Bauer sitt API (valgfri REST-pakke), ellers ICY-data fra strømmen via Music Assistant. Albumcover hentes fra iTunes.
- **Søk i hele verden** – via [Radio Browser](https://www.radio-browser.info/). Norske treff vises først.
- **Favoritter per bruker** – nye brukere starter med NRK mP3, P5 Hits og Radio Norge, pluss en «Søk for flere kanaler»-flis.
- **Egne kategorier per bruker** – «+ Lag kategori», gi den navn og legg til kanaler fra søket. Endre rekkefølge, gi nytt navn eller slett med ✎.
- **Utganger per bruker** – admin bestemmer hvilke høyttalere hver bruker får se (f.eks. bare den i samme rom). Hver bruker husker sin siste utgang.
- **Følger med på hva som faktisk spiller** – startes radio fra en annen enhet eller bruker, viser kortet det, og hopper til riktig utgang.
- **Robust avspilling** – raske kanalbytter gir bare ett kall, nytt forsøk hvis kanalen ikke starter, og automatisk omstart hvis strømmen faller ut.

## Krav

- En nyere Home Assistant-versjon (utviklet og testet på HA 2026)
- **[Music Assistant](https://music-assistant.io/)** (anbefalt, se under) med Home Assistant-integrasjonen – testet med MA 2.10
- Google Cast-høyttalere/grupper/TV (andre MA-spillere virker også)

### Hvorfor Music Assistant – og sett utgangsformat til MP3

Direkte Cast fra Home Assistant fungerer dårlig for nettradio:

- mange radioservere (bl.a. P4-gruppen og Bauer) sender for lite buffer ved oppstart, så Cast kan bruke 15–20 s på å starte
- å bytte mellom direkte Cast og Music Assistant på samme høyttaler får høyttaleren til å bytte mottaker-app – du hører «blipp»-lyden, og kanalen starter tregt eller ikke i det hele tatt

RACast spiller derfor alt via Music Assistant. **Viktig innstilling i Music Assistant** – for hver Google Cast-spiller og gruppe du bruker:

1. Åpne Music Assistant → **Innstillinger → Spillere** → velg spilleren
2. Trykk **Vis avanserte innstillinger** nederst
3. Sett **Output codec** til **MP3** (standard er FLAC)
4. Slå gjerne på **Queue flow mode**
5. Lagre

Med FLAC melder Google-høyttalere ofte avspillingsfeil etter ca. 3 minutter med radio, og strømmen stopper. Med MP3 spiller de stabilt.

Sørg også for at spillerne er aktivert i Music Assistant, slik at de finnes som `media_player`-entiteter i Home Assistant.

## Installasjon

### Manuelt

1. Kopier `racast-card.js` til `/config/www/racast/racast-card.js`
2. **Innstillinger → Dashbord → ⋮ → Ressurser → Legg til ressurs**
   - URL: `/local/racast/racast-card.js?v=2.0.1`
   - Type: **JavaScript-modul**
3. Hard-oppdater nettleseren (Ctrl+Shift+R)

> `/local/` caches i 31 dager. Bytt `?v=` i ressurs-URL-en hver gang du oppdaterer fila.

### HACS / Marketplace (egendefinert repo)

Legg til repoet som *Dashboard* via «egendefinert repo» / «Add from link». Et privat repo krever at GitHub-kontoen din er koblet til.

## Bruk

Lag gjerne et eget dashbord med en **panel**-visning, så kortet fyller hele skjermen:

```yaml
views:
  - title: RACast
    path: radio
    type: panel
    cards:
      - type: custom:racast-card
```

Uten noen innstillinger viser utgangsmenyen alle høyttalere og Music Assistant-spillere, og første MA-spiller er standard. Bruk `ma_players` for å koble en Cast-høyttaler til sin MA-spiller (da vises bare Cast-navnet, men avspillingen går via MA), eller `ma_only: true` for å vise bare MA-spillere.

## Innstillinger

| Valg | Standard | Beskrivelse |
|---|---|---|
| `title` | `RACast` | Navnet øverst til venstre |
| `default_player` | første MA-spiller | Standard utgang |
| `ma_players` | `{}` | Kobler en vanlig Cast-entitet til tilsvarende MA-spiller, f.eks. `media_player.stue: media_player.stue_ma`. Menyen viser Cast-navnet, men avspillingen går via MA |
| `extra_players` | `[]` | Ekstra utganger som ikke er høyttalere (f.eks. en Chromecast/Google TV) |
| `players` | auto | Fast liste over utganger i menyen |
| `ma_only` | `false` | `true`: vis bare Music Assistant-spillere (pluss `extra_players`) |
| `admin_users` | `[]` | Bruker-ID-er som kan styre «Utganger per bruker» (i tillegg til HA-eieren) |
| `restrict_outputs` | `false` | `true`: brukere admin ikke har satt opp, får bare standardutgangen |
| `bauer_sensor_prefix` | `sensor.radio_np_` | Prefiks for Bauer «spilles nå»-sensorer (se under) |
| `nrk_direct` | `false` | Spill NRK direkte via Cast i stedet for via MA |

Eksempel med Cast-gruppe og TV:

```yaml
type: custom:racast-card
default_player: media_player.hele_huset
ma_players:
  media_player.hele_huset: media_player.hele_huset_ma
  media_player.stue: media_player.stue_ma
  media_player.tv: media_player.tv_ma
extra_players:
  - media_player.tv
admin_users:
  - 0123456789abcdef0123456789abcdef   # bruker-ID (finnes på person-entiteten, attributtet user_id)
restrict_outputs: true
```

### Utganger per bruker

Admin (HA-eieren eller brukere i `admin_users`) får **«Utganger per bruker…»** nederst i utgangsmenyen. Der velger du for hver person hvilke høyttalere de kan bruke, og hvilken som er standard. Innstillingen lagres i Home Assistant (`frontend/system_data`) og gjelder på alle enheter.

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

- Favoritter, kategorier og siste utgang: per HA-bruker (`frontend/user_data`, nøkkel `radio_norge_card`)
- Utganger per bruker: felles (`frontend/system_data`, samme nøkkel)

## Eksterne tjenester

Kortet henter data direkte fra nettleseren: `psapi.nrk.no` (NRK spilles nå), `*.api.radio-browser.info` (søk), `itunes.apple.com` (cover) og `images.weserv.nl` (gjør NRK sine SVG-logoer om til PNG for Cast).
