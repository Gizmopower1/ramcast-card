/*
 * RACast – fullskjerms nettradio for Home Assistant: faste (norske) kanaler + søk i radiokanaler fra hele verden
 * (Radio Browser), favoritter og egne kategorier per bruker, utganger per bruker (styres av admin).
 *
 *   type: custom:racast-card          # (custom:radio-norge-card virker også)
 *   default_player: media_player.x   # valgfritt, ellers første Music Assistant-spiller
 *   ma_players:                      # valgfritt: Cast-spiller -> tilsvarende Music Assistant-spiller
 *     media_player.kjokken: media_player.kjokken_ma
 *   Se README.md for alle valg.
 *
 * Ruting: alle kanaler går via Music Assistant når utgangen er (eller har) en MA-spiller. Å blande direkte
 * Cast og MA på samme høyttaler tvinger Google-høyttaleren til å bytte mottaker-app ("blipp" + treg
 * eller uteblitt oppstart). nrk_direct: true sender NRK direkte via Cast likevel.
 *
 * Spilles nå-kilder (i prioritert rekkefølge):
 *   NRK  -> psapi.nrk.no (åpent API, sang + bilde)
 *   Bauer-> sensor.radio_np_<kode> (REST i HA, API-et har ikke CORS)
 *   Ellers -> media_title/media_artist/entity_picture fra spilleren (Music Assistant leser ICY)
 *   Cover -> iTunes Search API når vi har artist + tittel
 * Favoritter og rekkefølge lagres per HA-bruker (frontend/user_data), synkes mellom enheter.
 */

const VERSION = "2.0.0";
// Alle faste kanaler ligger i MA sitt radiobibliotek (builtin/add_radio) med navn + logo, nøklet på st.url.
// MA slår opp URL-en der, så TV-en viser riktig navn og logo. Nye faste kanaler må legges inn i MA på samme måte.
// Søketreff spilles via Radio Browser-kilden i MA, som har egne navn + logoer.
const MA_URL = (st) => (st.rb ? `radiobrowser://radio/${st.rb}` : st.url);
const NBSP = / /g;
// Cast-mottakeren viser ikke SVG – konverter (NRK-logoene) til PNG på mørk bakgrunn for TV-skjermen
const CAST_IMG = (url) => !url ? "" : /\.svg(\?|$)/i.test(url)
  ? `https://images.weserv.nl/?url=${encodeURIComponent(url.replace(/^https?:\/\//, ""))}&output=png&w=720&h=720&fit=contain&bg=10131a&cbg=10131a`
  : url;
const RB_HOSTS = ["all.api.radio-browser.info", "de1.api.radio-browser.info", "de2.api.radio-browser.info"];
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9æøå]+/g, " ").trim();
const NRK_CDN = "https://cdn0-47115-liveicecast0.dna.contentdelivery.net/";
const NRK_LOGO = (s) => `https://static.nrk.no/radio/dist/images/channel-logos/nrk-logo-nrk-${s}--color-light.svg`;
const P4_LOGO = (id, ext = "png") => `https://ddjh0q34m0xak.cloudfront.net/mmo/ncl/${id}.${ext}?w=600&ar=1x1`;
const BAUER_LOGO = (p) => `https://media.bauerradio.com/image/upload/c_crop,g_custom/${p}`;
const BAUER_STREAM = (s) => `https://live-bauerno.sharp-stream.com/${s}.aac?direct=true`;

const nrk = (id, name, slug, stream, color, api, tag) => ({
  id: "nrk_" + id, name, group: "nrk", logo: NRK_LOGO(slug), url: NRK_CDN + stream, color, nrk: api, tag,
});
const p4 = (id, name, stream, logo, color, tag) => ({
  id: "p4_" + id, name, group: "p4", logo, url: `https://${stream}`, color, tag,
});
const bauer = (code, name, stream, logo, color, tag) => ({
  id: "bauer_" + code, name, group: "bauer", logo: BAUER_LOGO(logo), url: BAUER_STREAM(stream), color, bauer: code, tag,
});

const STATIONS = [
  nrk("p1", "NRK P1", "p1", "p1_mp3_h", "#1767ce", "p1", "Hele Norges kanal"),
  nrk("p1pluss", "NRK P1+", "p1+", "p1pluss_mp3_h", "#5f3dc4", "p1pluss", "Musikken du er glad i"),
  nrk("p2", "NRK P2", "p2", "p2_mp3_h", "#c2255c", "p2", "Kultur og samfunn"),
  nrk("p3", "NRK P3", "p3", "p3_mp3_h", "#e8590c", "p3", "Dette er P3"),
  nrk("mp3", "NRK mP3", "mp3", "mp3_mp3_h", "#d6336c", "mp3", "Hits, hele dagen"),
  nrk("p3musikk", "NRK P3 Musikk", "p3-musikk", "p3musikk_mp3_h", "#f76707", null, "Bare musikk fra P3"),
  nrk("nyheter", "NRK Nyheter", "nyheter", "nyheter_mp3_h", "#1c7ed6", null, "Nyheter døgnet rundt"),
  nrk("sport", "NRK Sport", "sport", "sport_mp3_h", "#2f9e44", "sport", "Sport direkte"),
  nrk("klassisk", "NRK Klassisk", "klassisk", "klassisk_mp3_h", "#9c36b5", "klassisk", "Klassisk musikk"),
  nrk("jazz", "NRK Jazz", "jazz", "jazz_mp3_h", "#0c8599", "jazz", "Jazz hele døgnet"),
  nrk("folkemusikk", "NRK Folkemusikk", "folkemusikk", "folkemusikk_mp3_h", "#5c940d", "folkemusikk", "Folkemusikk"),
  nrk("super", "NRK Super", "super", "radio_super_mp3_h", "#f59f00", "radio_super", "For barn"),
  nrk("sapmi", "NRK Sápmi", "sapmi", "sapmi_mp3_h", "#c92a2a", "sapmi", "Samisk radio"),

  p4("p4", "P4 Norge", "p4.p4groupaudio.com/P04_MH", P4_LOGO("6e2f9c96-a018-424a-b3bf-7be5252d806c"), "#e03131", "Lyden av Norge"),
  p4("p5", "P5 Hits", "p5.p4groupaudio.com/P05_MM", P4_LOGO("996f007d-9d5a-4b56-9d3b-ac0d6724599d"), "#f03e3e", "Hits"),
  p4("p5n", "P5 Nonstop Hits", "p5n.p4groupaudio.com/P05AAH", P4_LOGO("488dff43-6567-45ec-bd55-1813ccf861a4"), "#e64980", "Nonstop hits"),
  p4("p6", "P6 Rock", "p6.p4groupaudio.com/P06_MM", P4_LOGO("f906dad9-93e0-4bbe-a666-45cdf17fa031"), "#495057", "Rock"),
  p4("p7", "P7 Klem", "p7.p4groupaudio.com/P07_MM", P4_LOGO("637fa6b4-f0ea-415f-8d99-3ca4c2bab5fe"), "#d6336c", "Norske favoritter"),
  p4("p8", "P8 Pop", "p8.p4groupaudio.com/P08_MM", P4_LOGO("665b308b-626d-469f-859e-1e7430360c50"), "#ae3ec9", "Pop"),
  p4("p9", "P9 Retro", "p9.p4groupaudio.com/P09_MH", P4_LOGO("258ff588-4e23-49af-88e1-b0b2afedaa4a"), "#f08c00", "Retro"),
  p4("p10", "P10 Country", "p10.p4groupaudio.com/P10_AH", P4_LOGO("547b5770-dc41-4be3-8d30-583e636a9c18"), "#a0522d", "Country"),
  p4("p11", "P11 Dance", "p11.p4groupaudio.com/P11_MH", P4_LOGO("5ef8a33b-f086-4755-9dd1-b9bc5820c8db"), "#4263eb", "Dance"),
  p4("p12", "P12 Hitmix", "nrj.p4groupaudio.com/NRJ_MM", P4_LOGO("95c6448b-5cb4-4403-baca-686c22ba0c60", "jpg"), "#7048e8", "Hitmix"),

  bauer("rno", "Radio Norge", "simulcast5_no", "v1758718202/brand_manager/stations/qxxajhgtl1vfexpngjk2.png", "#d71d2f", "Mer av musikken du liker"),
  bauer("rro", "Radio Rock", "simulcast3_no", "v1765293609/brand_manager/stations/wuscfr7mqtvg4c6efbcf.jpg", "#c92a2a", "Bare ekte rock"),
  bauer("nrn", "NRJ", "simulcast2_no", "v1733474324/brand_manager/stations/rgs62dvjwqjk9narycax.png", "#ff0000", "Musikk som gjør deg glad"),
  bauer("top", "Topp 40", "simulcast7_no", "v1645710968/brand_manager/stations/rtleczbreiids2p1brpe.png", "#fd1aa3", "Norges 40 best likte"),
  bauer("vin", "Vinyl", "simulcast6_no", "v1731598248/brand_manager/stations/qyatputm2fjmo2ajtvmb.png", "#9d7a48", "Tidenes største"),
  bauer("ptf", "P24-7 Mix", "simulcast1_no", "v1790607555/brand_manager/stations/gcyfcpvmxpwrl6svpley.png", "#38a89d", "2000-tallets største hits"),
  bauer("kos", "P24-7 Kos", "simulcast9_no", "v1741688797/brand_manager/stations/mx3cnz7khopuksrisbce.png", "#96040d", "Hits for kos og hygge"),
  bauer("rn8", "Radio Norge 80s", "webcast1_no", "v1765809218/brand_manager/stations/jipbg3rf2vblswvzggc8.png", "#d71d2f", "80-tallet"),
  bauer("rrl", "Radio Rock Legends", "webcast4_no", "v1765457830/brand_manager/stations/tvbqxz1yls2i8jyekezj.png", "#868e96", "Rockens største legender"),

  { id: "other_nova", name: "Radio Nova", group: "other", logo: "", url: "http://stream.radionova.no/mp3", color: "#20c997", tag: "Studentradio i Oslo" },
];

const USER_DATA_KEY = "radio_norge_card";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const initials = (n) => n.replace(/^(NRK|Radio)\s+/i, "").split(/\s+/).map((w) => w[0]).join("").slice(0, 3).toUpperCase();
const isoDur = (d) => { const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(d || ""); return m ? (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0)) : 0; };
const msDate = (d) => { const m = /Date\((\d+)/.exec(d || ""); return m ? +m[1] : 0; };

class RadioNorgeCard extends HTMLElement {
  setConfig(config) {
    this._config = {
      // standardutgang; tom = første Music Assistant-spiller (ellers første høyttaler)
      default_player: null,
      // valgfrie REST-sensorer for Bauer-kanalenes «spilles nå» (se radio_norge.yaml i repoet)
      bauer_sensor_prefix: "sensor.radio_np_",
      // Cast-spiller -> tilsvarende Music Assistant-spiller (spilles da via MA, se README)
      ma_players: {},
      nrk_direct: false,
      title: "RACast", // navnet øverst til venstre
      // hvem som kan styre «Utganger per bruker»: HA-eieren + disse bruker-id-ene (HA sitt admin-flagg brukes ikke,
      // fordi kiosk-brukere ofte må være admin i HA av andre grunner)
      admin_users: [],
      // ekstra utganger som ikke er høyttalere (TV/Chromecast) – spilles direkte via Cast med logo på skjermen
      extra_players: [],
      // true: brukere admin ikke har satt opp får bare standardutgangen. false: de ser alle.
      restrict_outputs: false,
      // vis bare Music Assistant-spillere (+ extra_players). Tom = automatisk: ja når MA finnes og ma_players ikke er satt
      ma_only: null,
      // (overgang) todo-liste med kategorier fra en eldre versjon som hver bruker henter sine egne fra én gang
      import_categories_from: null,
      ...config,
    };
    this._player = this._config.default_player;
    this._tab = "fav";
    // nye brukere starter med disse favorittene (+ en «Søk for flere kanaler»-flis sist)
    this._data = { favs: ["nrk_mp3", "p4_p5", "bauer_rno"], custom: {}, cats: [] };
    this._np = {};
    this._art = new Map();
    this._editFavs = false;
    this._searchResults = [];
    this._searchQ = "";
    this._searching = false;
  }

  static getStubConfig() { return {}; }

  // standardutgangen: konfigurert, ellers første Music Assistant-spiller, ellers første høyttaler
  get _defPlayer() {
    const st = this._hass ? this._hass.states : {};
    const d = this._config.default_player;
    if (d && st[d]) return d;
    if (this._autoDef && st[this._autoDef]) return this._autoDef;
    const mp = Object.keys(st).filter((id) => id.startsWith("media_player.") && st[id].state !== "unavailable").sort();
    this._autoDef = mp.find((id) => st[id].attributes.mass_player_type) || mp.find((id) => st[id].attributes.device_class === "speaker") || null;
    return this._autoDef;
  }
  getCardSize() { return 12; }
  getGridOptions() { return { columns: "full", rows: 12 }; }

  connectedCallback() {
    this._timer = setInterval(() => this._poll(), 15000);
    this._tick = setInterval(() => this._renderProgress(), 1000);
  }
  disconnectedCallback() { clearInterval(this._timer); clearInterval(this._tick); clearTimeout(this._playT); clearTimeout(this._watchT); }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (first) { this._build(); this._loadUserData(); }
    const p = hass.states[this._active];
    const sig = p ? `${p.state}|${p.attributes.media_content_id}|${p.attributes.media_title}|${p.attributes.media_artist}|${p.attributes.entity_picture}|${p.attributes.volume_level}` : "";
    const st = this._current && this._current.bauer ? hass.states[this._config.bauer_sensor_prefix + this._current.bauer] : null;
    const twin = this._twin(this._player);
    // status + kanal på alle kjente spillere, slik at kortet følger med når noe startes fra en annen enhet
    const psig = this._watchIds().map((id) => { const s = hass.states[id]; return s ? `${s.state}|${s.attributes.media_content_id}` : ""; }).join(",");
    const bsig = (st ? st.last_updated : "") + (twin ? hass.states[twin].last_updated : "");
    this._checkDropout(p);
    if (sig !== this._sig || bsig !== this._bsig || psig !== this._psig) {
      const resync = first || psig !== this._psig || sig !== this._sig;
      this._sig = sig; this._bsig = bsig; this._psig = psig;
      if (resync && this._loaded) this._syncFromPlayers();
      this._updateNowPlaying();
    }
  }

  /* ---------- data ---------- */

  get _allStations() {
    const m = new Map();
    for (const s of [...STATIONS, ...Object.values(this._data.custom || {})]) if (!m.has(s.id)) m.set(s.id, s);
    return [...m.values()];
  }
  _station(id) { return this._allStations.find((s) => s.id === id); }

  async _loadUserData() {
    try {
      const r = await this._hass.callWS({ type: "frontend/get_user_data", key: USER_DATA_KEY });
      if (r && r.value) this._data = { favs: [], custom: {}, ...r.value };
    } catch (e) { /* bruker standard */ }
    if (!Array.isArray(this._data.cats)) this._data.cats = []; // egne kategorier: [{ id, name, ids: [] }]
    if (!this._data.favs.length && this._data.cats.length) this._tab = "cat:" + this._data.cats[0].id;
    await this._loadSystemData();
    this._pickStartPlayer();
    this._loaded = true;
    this._importLegacyCats();
    this._syncFromPlayers();
    this._renderStrip();
    this._renderTabs();
    this._updateNowPlaying();
  }
  _saveUserData() {
    this._hass.callWS({ type: "frontend/set_user_data", key: USER_DATA_KEY, value: this._data }).catch(() => {});
  }

  /* ---------- engangsflytting fra den felles todo-lista (v1.11) ---------- */

  async _importLegacyCats() {
    const ent = this._config.import_categories_from;
    if (!ent || !this._hass.states[ent]) return;
    let items = [];
    try { items = (await this._hass.callWS({ type: "todo/item/list", entity_id: ent })).items || []; } catch (e) { return; }
    const me = this._hass.user && this._hass.user.id;
    let changed = false;
    for (const it of items) {
      let d = {};
      try { d = JSON.parse(it.description || "{}"); } catch (e) { continue; }
      if (!d.owner || d.owner !== me) continue; // bare kategorier denne brukeren laget
      if (!this._data.cats.find((c) => c.id === d.id)) this._data.cats.push({ id: d.id || it.uid, name: it.summary, ids: Array.isArray(d.ids) ? d.ids : [] });
      Object.assign(this._data.custom, d.custom || {});
      this._hass.callService("todo", "remove_item", { item: it.uid }, { entity_id: ent }).catch(() => {});
      changed = true;
    }
    if (changed) { this._saveUserData(); this._renderTabs(); this._renderStrip(); }
  }
  _persistCat() { this._saveUserData(); }
  _removeCat(cat) { this._data.cats = this._data.cats.filter((c) => c.id !== cat.id); this._saveUserData(); }

  /* ---------- utganger per bruker ---------- */
  // Admin bestemmer (frontend/system_data, lesbar for alle) hvilke utganger hver bruker får se, og
  // brukerens standard. Admin ser alltid alle. Brukeren husker selv sist valgte utgang (user_data.player).

  get _isAdmin() {
    const u = this._hass.user;
    return !!u && (u.is_owner || (this._config.admin_users || []).includes(u.id));
  }
  _policy(uid) { return ((this._sys && this._sys.users) || {})[uid] || null; }
  _allowedIds() {
    if (this._isAdmin) return null; // alle
    const p = this._policy(this._hass.user && this._hass.user.id);
    if (p && Array.isArray(p.allowed) && p.allowed.length) return p.allowed;
    return this._config.restrict_outputs ? [this._defPlayer] : null;
  }
  _allowed(id) { const a = this._allowedIds(); return !a || a.includes(id); }
  async _loadSystemData() {
    try { this._sys = (await this._hass.callWS({ type: "frontend/get_system_data", key: USER_DATA_KEY })).value || {}; } catch (e) { this._sys = {}; }
  }
  _saveSystemData() {
    this._hass.callWS({ type: "frontend/set_system_data", key: USER_DATA_KEY, value: this._sys }).catch((e) => this._toast(`Kunne ikke lagre: ${e.message || e}`));
  }
  _pickStartPlayer() {
    const pol = this._policy(this._hass.user && this._hass.user.id);
    for (const id of [this._data.player, pol && pol.default, this._defPlayer, ...(this._allowedIds() || [])]) {
      if (id && this._hass.states[id] && this._allowed(id)) { this._player = id; this._sig = null; return; }
    }
  }

  _openSettings() {
    const el = this._el.settings;
    const persons = Object.values(this._hass.states)
      .filter((s) => s.entity_id.startsWith("person.") && s.attributes.user_id)
      .map((s) => ({ uid: s.attributes.user_id, name: s.attributes.friendly_name || s.entity_id }))
      .sort((a, b) => a.name.localeCompare(b.name, "nb"));
    const outs = this._players(true);
    const defName = (outs.find((o) => o.id === this._defPlayer) || {}).name || this._defPlayer;
    this._sys = this._sys || {};
    this._sys.users = this._sys.users || {};
    const render = () => {
      el.innerHTML = `<div class="sethead"><b>Utganger per bruker</b><button class="close">Ferdig</button></div>
        <p class="sethint">Trykk på utgangene en bruker skal få bruke. Administratorer ser alltid alle. Har en bruker ingen valgt, får den bare «${esc(defName)}».</p>
        ${persons.map((p) => {
          const pol = this._sys.users[p.uid] || {}, al = pol.allowed || [];
          return `<div class="setuser" data-uid="${esc(p.uid)}"><div class="setname">${esc(p.name)}</div>
            <div class="setouts">${outs.map((o) => `<button data-out="${esc(o.id)}" class="${al.includes(o.id) ? "on" : ""}">${esc(o.name)}</button>`).join("")}</div>
            ${al.length > 1 ? `<label class="setdef">Standard: <select>${al.map((id) => `<option value="${esc(id)}" ${pol.default === id ? "selected" : ""}>${esc((outs.find((o) => o.id === id) || {}).name || id)}</option>`).join("")}</select></label>` : ""}
          </div>`;
        }).join("")}`;
      el.querySelector(".close").addEventListener("click", () => el.classList.add("hidden"));
      el.querySelectorAll(".setuser").forEach((row) => {
        const uid = row.dataset.uid;
        const pol = () => (this._sys.users[uid] = this._sys.users[uid] || { allowed: [] });
        row.querySelectorAll("button[data-out]").forEach((b) => b.addEventListener("click", () => {
          const p = pol(), id = b.dataset.out;
          p.allowed = p.allowed.includes(id) ? p.allowed.filter((x) => x !== id) : [...p.allowed, id];
          if (!p.allowed.includes(p.default)) p.default = p.allowed[0];
          this._saveSystemData(); render();
        }));
        const sel = row.querySelector("select");
        if (sel) sel.addEventListener("change", () => { pol().default = sel.value; this._saveSystemData(); });
      });
    };
    render();
    el.classList.remove("hidden");
  }


  _isFav(id) { return this._data.favs.includes(id); }
  _toggleFav(st) {
    const f = this._data.favs;
    if (f.includes(st.id)) this._data.favs = f.filter((x) => x !== st.id);
    else {
      f.push(st.id);
      if (!STATIONS.find((s) => s.id === st.id)) this._data.custom[st.id] = st;
    }
    this._saveUserData();
    this._renderStrip();
    this._renderFavButton();
  }
  _moveFav(id, dir) { this._moveIn(this._data.favs, id, dir); }
  _moveIn(f, id, dir) {
    const i = f.indexOf(id), j = i + dir;
    if (i < 0 || j < 0 || j >= f.length) return;
    [f[i], f[j]] = [f[j], f[i]];
    this._saveUserData();
    this._renderStrip();
  }

  /* ---------- egne kategorier ---------- */

  _cat() {
    if (!this._tab.startsWith("cat:")) return null;
    const id = this._tab.slice(4);
    return (this._data.cats || []).find((c) => c.id === id) || null;
  }
  _newCat() {
    const id = Date.now().toString(36);
    const cat = { id, name: "Ny kategori", ids: [] };
    this._data.cats.push(cat);
    this._tab = "cat:" + id;
    this._editFavs = false;
    this._editCat = true;
    this._persistCat(cat);
    this._renderTabs();
    this._renderStrip();
    setTimeout(() => { const i = this._el.catbar.querySelector("input"); if (i) { i.focus(); i.select(); } }, 50);
  }
  _toggleInCat(cat, st) {
    cat = this._cat() || cat; // alltid den ferskeste utgaven (lista kan ha blitt oppdatert fra HA)
    if (cat.ids.includes(st.id)) cat.ids = cat.ids.filter((x) => x !== st.id);
    else {
      cat.ids = [...cat.ids, st.id];
      if (!STATIONS.find((s) => s.id === st.id)) this._data.custom[st.id] = st;
    }
    this._persistCat(cat);
    this._renderStrip();
  }
  _addCat() { return this._addTarget ? (this._data.cats || []).find((c) => c.id === this._addTarget) || null : null; }
  _renderCatBar() {
    const bar = this._el.catbar, cat = this._cat();
    // søk for å legge til i en kategori: vis hvilken, og en Ferdig-knapp tilbake
    const addCat = this._tab === "search" ? this._addCat() : null;
    if (addCat) {
      bar.classList.remove("hidden");
      bar.innerHTML = `<ha-icon icon="mdi:playlist-plus"></ha-icon><span class="addhint">Legger til i «${esc(addCat.name)}» – trykk ⊕ på kanalene</span><button class="done">Ferdig</button>`;
      bar.querySelector(".done").addEventListener("click", () => {
        this._tab = "cat:" + addCat.id; this._addTarget = null;
        this._renderTabs(); this._renderStrip();
      });
      return;
    }
    bar.classList.toggle("hidden", !(this._editCat && cat));
    if (!(this._editCat && cat)) return;
    bar.innerHTML = `<ha-icon icon="mdi:tag-outline"></ha-icon>
      <input type="text" maxlength="30" value="${esc(cat.name)}" placeholder="Navn på kategori" autocomplete="off" enterkeyhint="done">
      <button class="del">Slett</button><button class="done">Ferdig</button>`;
    const inp = bar.querySelector("input");
    const rename = () => {
      const n = inp.value.trim();
      const c = this._cat() || cat;
      if (n && n !== c.name) { c.name = n; this._persistCat(c); }
      const tab = this._el.tabs.querySelector(`button[data-k="cat:${cat.id}"]`);
      if (tab) tab.textContent = cat.name;
    };
    inp.addEventListener("input", () => { const tab = this._el.tabs.querySelector(`button[data-k="cat:${cat.id}"]`); if (tab) tab.textContent = inp.value || "…"; });
    inp.addEventListener("change", rename);
    inp.addEventListener("blur", rename);
    for (const ev of ["keydown", "keyup", "keypress"]) inp.addEventListener(ev, (e) => { e.stopPropagation(); if (ev === "keydown" && e.key === "Enter") inp.blur(); });
    const del = bar.querySelector(".del");
    del.addEventListener("click", () => {
      if (!this._delArm) {
        this._delArm = true; del.textContent = "Bekreft sletting"; del.classList.add("armed");
        clearTimeout(this._delT); this._delT = setTimeout(() => { this._delArm = false; del.textContent = "Slett"; del.classList.remove("armed"); }, 3000);
        return;
      }
      this._delArm = false;
      this._removeCat(this._cat() || cat);
      this._tab = "fav"; this._editCat = false;
      this._renderTabs(); this._renderStrip();
    });
    bar.querySelector(".done").addEventListener("click", () => { rename(); this._editCat = false; this._renderTabs(); this._renderStrip(); });
  }

  _players(all = false) {
    const states = this._hass.states;
    let ids = this._config.players;
    if (!ids) {
      ids = Object.keys(states).filter((id) => {
        if (!id.startsWith("media_player.")) return false;
        const s = states[id];
        if (s.state === "unavailable") return false;
        return s.attributes.device_class === "speaker" || s.attributes.mass_player_type;
      }).sort((a, b) => (states[a].attributes.friendly_name || a).localeCompare(states[b].attributes.friendly_name || b, "nb"));
    }
    const twins = new Set(Object.values(this._config.ma_players || {}));
    const isMA = (i) => states[i] && states[i].attributes.mass_player_type;
    const maOnly = this._config.ma_only ?? (!Object.keys(this._config.ma_players || {}).length && ids.some(isMA));
    if (maOnly && !this._config.players) ids = ids.filter(isMA);
    ids = [...new Set([...ids, ...(this._config.extra_players || [])])];
    const def = this._defPlayer;
    ids = [def, ...ids.filter((i) => i !== def && !twins.has(i))];
    return ids.filter((i) => states[i] && states[i].state !== "unavailable" && (all || this._allowed(i))).map((i) => ({
      id: i, name: states[i].attributes.friendly_name || i, state: states[i].state,
      tv: states[i].attributes.device_class === "tv" || (this._config.extra_players || []).includes(i),
    }));
  }

  // spillere vi følger med på: standard + alle med MA-tvilling + tvillingene selv
  _watchIds() {
    if (!this._watchList) {
      const m = this._config.ma_players || {};
      this._watchList = [...new Set([this._defPlayer, ...Object.keys(m), ...Object.values(m), ...(this._config.players || []), ...(this._config.extra_players || [])])].filter(Boolean);
    }
    return this._watchList;
  }
  _matchStation(cid) {
    if (!cid) return null;
    return this._allStations.find((s) => (s.url && (cid === s.url || cid.includes(s.url))) || (s.rb && cid.includes(s.rb))) || null;
  }
  // Spiller noe kortet ikke kjenner (f.eks. et søketreff en annen bruker valgte): lag kanalen fra MA-spilleren
  _adhocStation(p) {
    const a = p.attributes, cid = a.media_content_id || "";
    this._adhoc = this._adhoc || new Map();
    if (this._adhoc.has(cid)) return this._adhoc.get(cid);
    let m, st = null;
    if ((m = /^radiobrowser:\/\/radio\/([0-9a-f-]+)/i.exec(cid))) st = { id: "rb_" + m[1], rb: m[1], url: "" };
    else if ((m = /^builtin:\/\/radio\/(.+)$/.exec(cid))) st = { id: "url_" + m[1], url: m[1] };
    if (!st) return null;
    Object.assign(st, { name: a.media_album_name || "Radio", group: "custom", logo: "", color: "#5c7cfa", tag: "" });
    this._adhoc.set(cid, st);
    if (st.rb) {
      fetch(`https://all.api.radio-browser.info/json/stations/byuuid/${st.rb}`).then((r) => r.json()).then((j) => {
        const s = j && j[0];
        if (!s) return;
        Object.assign(st, { name: s.name.trim(), logo: s.favicon || "", url: s.url_resolved || "", tag: s.tags ? s.tags.split(",").slice(0, 3).join(" · ") : "" });
        this._updateNowPlaying();
      }).catch(() => {});
    }
    return st;
  }
  // kanalen som faktisk spiller på en utgang (eller MA-tvillingen dens)
  _playingOn(id) {
    for (const e of [id, this._twin(id)]) {
      const p = e && this._hass.states[e];
      if (!p || (p.state !== "playing" && p.state !== "buffering")) continue;
      const st = this._matchStation(p.attributes.media_content_id) || this._adhocStation(p);
      if (st) return st;
    }
    return null;
  }
  // Kortet viser det som FAKTISK spiller, ikke det denne nettleseren/brukeren sist valgte.
  // Har ikke brukeren valgt utgang selv, hopper vi til den utgangen som spiller.
  _syncFromPlayers() {
    if (this._busy || this._want || Date.now() - (this._localPlayAt || 0) < 20000) return; // midt i et bytte
    let st = this._playingOn(this._player);
    // valgt utgang er stille, men en annen spiller: bytt dit (med mindre brukeren nettopp valgte utgang selv)
    if (!st && Date.now() - (this._userPickedAt || 0) > 60000) {
      const twins = new Set(Object.values(this._config.ma_players || {}));
      for (const id of this._watchIds().filter((i) => !twins.has(i) && this._allowed(i))) {
        const s = this._playingOn(id);
        if (s) { this._player = id; st = s; this._sig = null; break; }
      }
    }
    if (st && st !== this._current) {
      this._current = st;
      this._np = {};
      this._lastRoute = this._route(st);
      this._poll();
    }
  }

  // Strømmen faller ut uten at noen trykket stopp (Cast-feil hos MA etter noen minutter):
  // start samme kanal igjen. Bare kortet som selv startet kanalen gjør dette, maks én gang per 2 min.
  _checkDropout(p) {
    const state = p ? p.state : "off";
    const was = this._actState;
    this._actState = state;
    if (was !== "playing" || state === "playing" || state === "buffering") return;
    const st = this._current;
    if (!st || !this._localPlayAt || this._userStopped || this._busy || this._want) return;
    if (document.visibilityState !== "visible") return; // ikke start noe i bakgrunnen (f.eks. etter "Hey Google, stopp")
    if (Date.now() - this._localPlayAt < 15000) return; // vanlig kanalbytte (idle et lite øyeblikk)
    clearTimeout(this._dropT);
    this._dropT = setTimeout(() => {
      const now = this._hass.states[this._active];
      if (!now || now.state === "playing" || this._userStopped || this._current !== st) return; // MA tok seg inn selv
      if (Date.now() - (this._lastRecover || 0) < 120000) { this._toast(`${st.name} falt ut – trykk ▶ for å starte igjen`); return; }
      this._lastRecover = Date.now();
      this._toast(`${st.name} falt ut – starter på nytt…`);
      this._localPlayAt = Date.now();
      this._lastRoute = null;
      this._busy = true;
      this._send(st, 1).finally(() => { this._busy = false; });
    }, 4000);
  }

  /* ---------- ruting ---------- */

  _isMA(id) { const s = this._hass.states[id]; return !!(s && s.attributes.mass_player_type); }
  _twin(id) { const t = (this._config.ma_players || {})[id]; return t && this._hass.states[t] ? t : null; }
  _route(st, player = this._player) {
    if (this._isMA(player)) return { entity: player, ma: true };
    const twin = this._twin(player);
    if (twin && st && !(this._config.nrk_direct && st.group === "nrk")) return { entity: twin, ma: true };
    return { entity: player, ma: false };
  }
  // entiteten som faktisk spiller (Cast eller MA-tvillingen) – brukes til status, stopp og volum
  get _active() { return this._route(this._current).entity; }

  /* ---------- avspilling ---------- */

  // UI oppdateres med en gang; selve kallet sendes etter en kort pause slik at raske
  // trykk på flere kanaler bare gir ett kall (det siste) og ikke en kø av oppstarter.
  _play(st) {
    this._localPlayAt = Date.now();
    this._userStopped = false;
    this._current = st;
    this._data.last = st.id;
    if (!STATIONS.find((s) => s.id === st.id)) this._data.custom[st.id] = st;
    this._np = {};
    this._updateNowPlaying();
    this._poll();
    this._want = st;
    clearTimeout(this._playT);
    this._playT = setTimeout(() => this._flushPlay(), 300);
  }
  async _flushPlay() {
    if (this._busy) return; // kjører allerede – _want plukkes opp når den er ferdig
    const st = this._want;
    if (!st) return;
    this._want = null;
    this._busy = true;
    this._saveUserData();
    await this._send(st, 0);
    this._busy = false;
    if (this._want) this._flushPlay();
  }
  async _send(st, attempt) {
    const r = this._route(st);
    const prev = this._lastRoute;
    this._lastRoute = r;
    try {
      // bare ved bytte mellom Cast og MA på samme høyttaler (nrk_direct) – ellers erstatter MA køen selv
      if (prev && prev.entity !== r.entity && this._hass.states[prev.entity]?.state === "playing") {
        await this._hass.callService("media_player", "media_stop", {}, { entity_id: prev.entity });
      }
      if (r.ma) {
        await this._hass.callService("music_assistant", "play_media", { media_id: MA_URL(st), media_type: "radio", enqueue: "replace" }, { entity_id: r.entity });
        // Gjenta på: når Cast tror radiostrømmen er "ferdig" (etter et hikk hos kanalen) ber den om neste
        // spor. Uten gjenta finnes ingen neste og avspillingen stopper etter noen minutter.
        if (this._hass.states[r.entity]?.attributes.repeat !== "all") {
          this._hass.callService("media_player", "repeat_set", { repeat: "all" }, { entity_id: r.entity }).catch(() => {});
        }
      } else {
        const img = CAST_IMG(st.logo);
        await this._hass.callService("media_player", "play_media", {
          media_content_id: st.url,
          media_content_type: "music",
          extra: {
            stream_type: "LIVE", title: st.name, thumb: img || undefined,
            // MusicTrackMediaMetadata: TV-en viser logo stort + kanalnavn + slagord
            metadata: { metadataType: 3, title: st.name, artist: st.tag || "", albumName: "Radio", images: img ? [{ url: img, width: 720, height: 720 }] : [] },
          },
        }, { entity_id: r.entity });
      }
    } catch (e) {
      if (attempt === 0 && this._current === st) { await new Promise((ok) => setTimeout(ok, 1500)); return this._send(st, 1); }
      this._toast(`Kunne ikke spille: ${e.message || e}`);
      return;
    }
    this._watch(st, r.entity, attempt);
  }
  // vakthund: kom ikke kanalen i gang innen 25 s, prøv én gang til (MA bruker iblant 15–20 s på en kald Cast)
  _watch(st, entity, attempt) {
    clearTimeout(this._watchT);
    this._watchT = setTimeout(() => {
      if (this._current !== st || this._want || this._busy) return;
      const s = this._hass.states[entity];
      if (s && (s.state === "playing" || s.state === "buffering")) return;
      if (attempt === 0) { this._lastRoute = null; this._busy = true; this._send(st, 1).finally(() => { this._busy = false; }); }
      else this._toast(`${st.name} startet ikke – prøv igjen`);
    }, 25000);
  }
  _stop(entity = this._active) { this._userStopped = true; clearTimeout(this._dropT); clearTimeout(this._playT); clearTimeout(this._watchT); this._want = null; this._hass.callService("media_player", "media_stop", {}, { entity_id: entity }); }
  _volume(v) { this._hass.callService("media_player", "volume_set", { volume_level: v }, { entity_id: this._active }); }

  /* ---------- spilles nå ---------- */

  async _poll() {
    const st = this._current;
    if (!st || !st.nrk) return;
    try {
      const r = await fetch(`https://psapi.nrk.no/channels/${st.nrk}/liveelements/now`);
      if (r.status !== 200) { this._setNp(st, {}); return; }
      const items = await r.json();
      const now = items.find((i) => i.relativeTimeType === "Present");
      const past = items.filter((i) => i.relativeTimeType === "Past").slice(-2).reverse();
      const np = { program: (now || items[items.length - 1] || {}).programTitle, history: past.map((i) => `${i.title} – ${i.description}`) };
      if (now && now.type === "Music") Object.assign(np, {
        title: now.title, artist: now.description, image: now.imageUrl, start: msDate(now.startTime), dur: isoDur(now.duration),
      });
      this._setNp(st, np);
    } catch (e) { /* nettverksfeil – prøver igjen */ }
  }
  _setNp(st, np) {
    if (this._current !== st) return;
    this._np = np;
    this._updateNowPlaying();
  }

  _resolveNp() {
    const st = this._current;
    if (!st) return {};
    if (st.nrk) return this._np;
    if (st.bauer) {
      const s = this._hass.states[this._config.bauer_sensor_prefix + st.bauer];
      if (s && s.attributes.stationNowPlaying) {
        const n = s.attributes.stationNowPlaying, o = s.attributes.stationOnAir || {};
        const start = n.nowPlayingTime ? new Date(n.nowPlayingTime.replace(" ", "T")).getTime() : 0;
        return { title: n.nowPlayingTrack, artist: n.nowPlayingArtist, image: n.nowPlayingImage, program: (o.episodeTitle || "").trim(), start, dur: n.nowPlayingDuration || 0 };
      }
    }
    const p = this._hass.states[this._active];
    if (p && p.state === "playing") {
      const a = p.attributes;
      let title = a.media_title && a.media_title.replace(NBSP, " "), artist = a.media_artist;
      if (title && !artist && / - /.test(title)) [artist, title] = title.split(" - ", 2);
      // MA viser strømnavnet (f.eks. "P04_MH") til første ICY-tittel kommer
      if (title && title !== st.name && !st.url.includes(title)) return { title, artist, image: a.entity_picture && !a.entity_picture.includes(st.logo) ? a.entity_picture : null };
    }
    return {};
  }

  _lookupArt(artist, title) {
    const key = `${artist}|${title}`;
    if (this._art.has(key)) return this._art.get(key);
    this._art.set(key, null);
    const term = encodeURIComponent(`${artist} ${title}`.replace(/\(.*?\)|feat\..*|ft\..*/gi, ""));
    fetch(`https://itunes.apple.com/search?term=${term}&entity=song&limit=1&country=no`)
      .then((r) => r.json())
      .then((j) => {
        const u = j.results && j.results[0] && j.results[0].artworkUrl100;
        if (u) { this._art.set(key, u.replace("100x100bb", "800x800bb")); this._updateNowPlaying(); }
      }).catch(() => {});
    return null;
  }

  /* ---------- UI ---------- */

  _build() {
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `<style>${CSS}</style>
      <ha-card>
        <div class="bg"><div class="bgimg"></div><div class="bgshade"></div></div>
        <div class="top">
          <div class="brand"><ha-icon icon="mdi:radio"></ha-icon> ${esc(this._config.title)}</div>
          <button class="chip out"><ha-icon icon="mdi:speaker-multiple"></ha-icon><span class="outname"></span><ha-icon icon="mdi:chevron-down"></ha-icon></button>
          <div class="menu hidden"></div>
        </div>
        <div class="stage">
          <div class="artwrap">
            <div class="art"><img class="artimg" alt=""><div class="artlogo"></div></div>
            <div class="badge"><img alt=""><span></span></div>
          </div>
          <div class="info">
            <div class="live"><span class="dot"></span> DIREKTE <span class="stname"></span></div>
            <div class="title"></div>
            <div class="artist"></div>
            <div class="program"></div>
            <div class="progress"><div></div></div>
            <div class="history"></div>
            <div class="controls">
              <button class="play" title="Spill / stopp"><ha-icon icon="mdi:play"></ha-icon></button>
              <button class="round fav" title="Favoritt"><ha-icon icon="mdi:star-outline"></ha-icon></button>
              <div class="vol"><ha-icon icon="mdi:volume-high"></ha-icon><input type="range" min="0" max="100" step="1"></div>
            </div>
          </div>
        </div>
        <div class="dock">
          <div class="tabs"></div>
          <div class="catbar hidden"></div>
          <div class="searchbar hidden"><ha-icon icon="mdi:magnify"></ha-icon><input type="search" placeholder="Søk i radiokanaler fra hele verden – f.eks. P4, jazz, BBC…" enterkeyhint="search" autocomplete="off"></div>
          <div class="strip"></div>
        </div>
        <div class="settings hidden"></div>
        <div class="toast hidden"></div>
      </ha-card>`;
    const $ = (s) => root.querySelector(s);
    this._el = {
      card: $("ha-card"), bgimg: $(".bgimg"), outname: $(".outname"), menu: $(".menu"), art: $(".artimg"), artlogo: $(".artlogo"),
      badge: $(".badge"), stname: $(".stname"), title: $(".title"), artist: $(".artist"), program: $(".program"),
      progress: $(".progress"), bar: $(".progress div"), history: $(".history"), play: $(".play"), fav: $(".fav"),
      vol: $(".vol input"), tabs: $(".tabs"), strip: $(".strip"), search: $(".searchbar"), searchIn: $(".searchbar input"), catbar: $(".catbar"), settings: $(".settings"), toast: $(".toast"), live: $(".live"),
    };
    $(".out").addEventListener("click", (e) => { e.stopPropagation(); this._toggleMenu(); });
    root.addEventListener("click", () => this._el.menu.classList.add("hidden"));
    this._el.play.addEventListener("click", () => {
      const p = this._hass.states[this._active];
      if (p && p.state === "playing") this._stop();
      else if (this._current) this._play(this._current);
      else if (this._pendingLast) this._play(this._pendingLast);
    });
    this._el.fav.addEventListener("click", () => this._current && this._toggleFav(this._current));
    this._el.vol.addEventListener("change", (e) => this._volume(e.target.value / 100));
    this._el.vol.addEventListener("input", () => { this._volDrag = Date.now(); });
    let t;
    const si = this._el.searchIn;
    const go = (delay) => { clearTimeout(t); t = setTimeout(() => this._search(si.value), delay); };
    si.addEventListener("input", () => go(350));
    si.addEventListener("search", () => go(0)); // Enter / tøm-kryss
    // ikke la HA sine hurtigtaster (e, c, a, m …) eller visningen stjele tastetrykk
    for (const ev of ["keydown", "keyup", "keypress"]) si.addEventListener(ev, (e) => { e.stopPropagation(); if (ev === "keydown" && e.key === "Enter") go(0); });
    this._el.art.addEventListener("error", () => { this._el.art.removeAttribute("src"); this._el.art.classList.remove("show"); });
    this._renderTabs();
  }

  _toggleMenu() {
    const m = this._el.menu;
    m.innerHTML = this._players().map((p) => `
      <button data-id="${esc(p.id)}" class="${p.id === this._player ? "sel" : ""}">
        <ha-icon icon="${p.id === this._defPlayer ? "mdi:home-sound-out" : p.tv ? "mdi:television" : "mdi:speaker"}"></ha-icon>
        <span>${esc(p.name)}</span>${p.state === "playing" ? '<ha-icon class="eqi" icon="mdi:equalizer"></ha-icon>' : ""}
      </button>`).join("")
      + (this._isAdmin ? `<button class="admin"><ha-icon icon="mdi:account-cog"></ha-icon><span>Utganger per bruker…</span></button>` : "");
    const adm = m.querySelector(".admin");
    if (adm) adm.addEventListener("click", (e) => { e.stopPropagation(); m.classList.add("hidden"); this._openSettings(); });
    m.querySelectorAll("button[data-id]").forEach((b) => b.addEventListener("click", (e) => {
      e.stopPropagation();
      const prev = this._active;
      this._player = b.dataset.id;
      this._data.player = this._player; // husk valget for denne brukeren
      this._saveUserData();
      this._userPickedAt = Date.now();
      this._localPlayAt = 0;
      m.classList.add("hidden");
      // flytt pågående kanal til ny utgang
      const ps = this._hass.states[prev];
      const already = this._playingOn(this._player);
      if (already) { this._current = already; this._np = {}; this._lastRoute = this._route(already); this._poll(); } // den nye utgangen spiller allerede – vis den kanalen
      else if (prev !== this._active && this._current && ps && ps.state === "playing") { this._stop(prev); this._play(this._current); }
      this._sig = null;
      this.hass = this._hass;
      this._renderStrip();
    }));
    m.classList.toggle("hidden");
  }

  _renderTabs() {
    const cats = this._data.cats || [];
    if (!["fav", "search"].includes(this._tab) && !this._cat()) { this._tab = "fav"; this._editCat = false; }
    const tabs = [["fav", "Favoritter"], ...cats.map((c) => ["cat:" + c.id, c.name]), ["search", "Søk"]];
    const isFav = this._tab === "fav", isCat = !!this._cat();
    const editing = isFav ? this._editFavs : this._editCat;
    this._el.tabs.innerHTML = tabs.map(([k, n]) => `<button data-k="${esc(k)}" class="${k === this._tab ? "sel" : ""}">${k === "fav" ? '<ha-icon icon="mdi:star"></ha-icon>' : ""}${esc(n)}</button>`).join("")
      // før brukeren har laget sin første kategori vises en tydelig «Lag kategori»-knapp, deretter bare +
      + (cats.length
        ? `<button class="add" title="Ny kategori"><ha-icon icon="mdi:plus"></ha-icon></button>`
        : `<button class="add first" title="Lag din egen kategori"><ha-icon icon="mdi:plus"></ha-icon>Lag kategori</button>`)
      + `<button class="edit ${isFav || isCat ? "" : "hidden"} ${editing ? "sel" : ""}" title="${isFav ? "Endre rekkefølge" : "Rediger kategori"}"><ha-icon icon="${isFav ? "mdi:swap-horizontal" : "mdi:pencil"}"></ha-icon></button>`;
    this._el.tabs.querySelectorAll("button[data-k]").forEach((b) => b.addEventListener("click", () => {
      this._tab = b.dataset.k; this._editFavs = false; this._editCat = false; this._addTarget = null;
      this._renderTabs(); this._renderStrip();
      if (this._tab === "search") setTimeout(() => this._el.searchIn.focus(), 50);
    }));
    this._el.tabs.querySelector(".add").addEventListener("click", () => this._newCat());
    this._el.tabs.querySelector(".edit").addEventListener("click", () => {
      if (this._tab === "fav") this._editFavs = !this._editFavs; else this._editCat = !this._editCat;
      this._renderTabs(); this._renderStrip();
    });
    this._el.search.classList.toggle("hidden", this._tab !== "search");
    this._renderCatBar();
  }

  _stripStations() {
    const favs = this._data.favs.map((id) => this._station(id)).filter(Boolean);
    switch (this._tab) {
      case "fav": return favs;
      case "search": return this._searchResults;
      default: {
        const cat = this._cat();
        if (!cat) return favs;
        const members = cat.ids.map((id) => this._station(id)).filter(Boolean);
        // redigering: medlemmene først (kan flyttes), deretter alle andre kanaler som kan legges til
        return members; // nye kanaler legges til via søke-flisen sist i raden
      }
    }
  }

  _renderStrip() {
    if (!this._el) return;
    const list = this._stripStations();
    const playing = this._hass.states[this._active]?.state === "playing";
    if (!list.length && this._tab !== "fav" && !this._cat()) {
      const msg = this._tab === "fav" ? "Ingen favoritter ennå – finn kanaler under Søk og trykk ★ for å legge dem til."
        : this._cat() ? "Tom kategori – trykk ✎ til høyre for å legge til kanaler."
        : this._tab !== "search" ? "Ingen kanaler."
        : this._searching ? "Søker…"
        : this._searchQ.length >= 2 ? `Ingen treff på «${esc(this._searchQ)}».`
        : "Skriv minst to bokstaver for å søke blant radiokanaler fra hele verden.";
      this._el.strip.innerHTML = `<div class="empty">${msg}</div>`;
      return;
    }
    // cat: redigering av en kategori (trykk fjerner, piler flytter). addCat: søk for å legge til i en kategori.
    const cat = this._editCat ? this._cat() : null;
    const addCat = this._tab === "search" ? this._addCat() : null;
    const badgeCat = cat || addCat;
    const inCat = (id) => !!badgeCat && badgeCat.ids.includes(id);
    const showMove = (s) => (this._editFavs && this._tab === "fav") || (!!cat && inCat(s.id));
    const viewCat = this._cat();
    const moreTile = (this._tab === "fav" && !this._editFavs) ? "Søk for flere kanaler" : viewCat ? "Søk for å legge til" : "";
    this._el.strip.innerHTML = list.map((s) => `
      <div class="tile ${this._current && this._current.id === s.id ? "active" : ""} ${playing ? "playing" : ""} ${badgeCat ? "adding" : ""} ${inCat(s.id) ? "in" : ""}" data-id="${esc(s.id)}" style="--c:${esc(s.color || "#5c7cfa")}">
        ${badgeCat ? `<button class="chk" title="${inCat(s.id) ? "Fjern fra" : "Legg til i"} ${esc(badgeCat.name)}"><ha-icon icon="${inCat(s.id) ? (cat ? "mdi:close-circle" : "mdi:check-circle") : "mdi:plus-circle"}"></ha-icon></button>` : ""}
        <div class="logo">${s.logo ? `<img src="${esc(s.logo)}" alt="" loading="lazy">` : `<span>${esc(initials(s.name))}</span>`}
          <div class="eq"><i></i><i></i><i></i></div></div>
        <div class="tname">${esc(s.name)}</div>
        <button class="star ${this._isFav(s.id) ? "on" : ""}" title="Favoritt"><ha-icon icon="${this._isFav(s.id) ? "mdi:star" : "mdi:star-outline"}"></ha-icon></button>
        ${showMove(s) ? `<div class="move"><button data-d="-1"><ha-icon icon="mdi:chevron-left"></ha-icon></button><button data-d="1"><ha-icon icon="mdi:chevron-right"></ha-icon></button></div>` : ""}
      </div>`).join("")
      + (moreTile ? `<div class="tile more"><div class="logo more"><ha-icon icon="${viewCat ? "mdi:magnify-plus-outline" : "mdi:magnify"}"></ha-icon></div><div class="tname">${moreTile}</div></div>` : "");
    const more = this._el.strip.querySelector(".tile.more");
    if (more) more.addEventListener("click", () => {
      this._addTarget = viewCat ? viewCat.id : null;
      this._tab = "search"; this._editFavs = false; this._editCat = false;
      this._renderTabs(); this._renderStrip();
      setTimeout(() => this._el.searchIn.focus(), 50);
    });
    const byId = new Map(list.map((s) => [s.id, s]));
    this._el.strip.querySelectorAll(".tile[data-id]").forEach((t) => {
      const st = byId.get(t.dataset.id);
      // redigering av kategori: et trykk fjerner kanalen. Ellers spilles den; ⊕/✓ legger til / fjerner.
      t.addEventListener("click", () => (cat ? this._toggleInCat(cat, st) : this._play(st)));
      const chk = t.querySelector(".chk");
      if (chk) chk.addEventListener("click", (e) => { e.stopPropagation(); this._toggleInCat(badgeCat, st); });
      t.querySelector(".star").addEventListener("click", (e) => { e.stopPropagation(); this._toggleFav(st); });
      t.querySelectorAll(".move button").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); this._moveIn(cat ? cat.ids : this._data.favs, st.id, +b.dataset.d); if (cat) this._persistCat(cat); }));
      const img = t.querySelector("img");
      if (img) img.addEventListener("error", () => { img.replaceWith(Object.assign(document.createElement("span"), { textContent: initials(st.name) })); });
    });
  }

  async _rbFetch(params) {
    for (const h of RB_HOSTS) {
      try {
        const ctl = new AbortController();
        const to = setTimeout(() => ctl.abort(), 6000);
        const r = await fetch(`https://${h}/json/stations/search?hidebroken=true&order=votes&reverse=true&limit=40&${params}`, { signal: ctl.signal });
        clearTimeout(to);
        if (r.ok) return await r.json();
      } catch (e) { /* prøv neste server */ }
    }
    throw new Error("Radio Browser svarer ikke");
  }

  async _search(q) {
    q = q.trim();
    this._searchQ = q;
    const seq = (this._searchSeq = (this._searchSeq || 0) + 1);
    if (q.length < 2) { this._searchResults = []; this._searching = false; this._renderStrip(); return; }
    // 1) egne kanaler – vises med en gang
    const nq = norm(q);
    const local = this._allStations.filter((s) => norm(`${s.name} ${s.tag || ""}`).includes(nq));
    this._searchResults = local;
    this._searching = true;
    this._renderStrip();
    // 2) Radio Browser: norske kanaler først, så resten av verden hvis det er få treff
    let remote = [];
    try {
      const name = encodeURIComponent(q);
      remote = await this._rbFetch(`countrycode=NO&name=${name}`);
      if (seq !== this._searchSeq) return;
      remote = remote.concat(await this._rbFetch(`name=${name}`).catch(() => [])); // norske først, så resten av verden
    } catch (e) { if (seq === this._searchSeq && !local.length) this._toast("Søket feilet – Radio Browser svarer ikke"); }
    if (seq !== this._searchSeq) return; // brukeren har skrevet videre
    const seen = new Set(local.map((s) => s.url));
    const extra = [];
    for (const s of remote) {
      const url = s.url_resolved || s.url;
      if (!url || seen.has(url)) continue;
      seen.add(url);
      if (STATIONS.find((x) => x.url === url)) continue;
      extra.push({
        id: "rb_" + s.stationuuid, rb: s.stationuuid, name: s.name.trim(), group: "custom", logo: s.favicon || "", url, color: "#5c7cfa",
        tag: [s.countrycode && s.countrycode !== "NO" ? s.countrycode : "", s.tags && s.tags.split(",").slice(0, 3).join(" · "), s.codec && `${s.codec}${s.bitrate ? " " + s.bitrate + "k" : ""}`].filter(Boolean).join(" · "),
      });
    }
    this._searchResults = [...local, ...extra].slice(0, 60);
    this._searching = false;
    this._renderStrip();
  }

  _renderFavButton() {
    const on = this._current && this._isFav(this._current.id);
    this._el.fav.innerHTML = `<ha-icon icon="${on ? "mdi:star" : "mdi:star-outline"}"></ha-icon>`;
    this._el.fav.classList.toggle("on", !!on);
  }

  _updateNowPlaying() {
    if (!this._el) return;
    const el = this._el, st = this._current;
    const p = this._hass.states[this._active];
    const playing = p && p.state === "playing";
    const sel = this._hass.states[this._player];
    el.outname.textContent = sel ? sel.attributes.friendly_name : this._player;
    el.play.innerHTML = `<ha-icon icon="${playing ? "mdi:stop" : "mdi:play"}"></ha-icon>`;
    if (p && p.attributes.volume_level != null && (!this._volDrag || Date.now() - this._volDrag > 2000)) el.vol.value = Math.round(p.attributes.volume_level * 100);
    el.card.classList.toggle("playing", !!playing);
    el.live.classList.toggle("off", !playing);

    if (!st || (!playing && !this._localPlayAt)) {
      // ingenting spiller: ikke lat som om sist valgte kanal er på
      const last = this._data.last && this._station(this._data.last);
      el.card.style.removeProperty("--accent");
      el.bgimg.style.backgroundImage = "none";
      el.art.classList.remove("show");
      el.artlogo.classList.remove("hidden");
      el.artlogo.dataset.id = "";
      el.title.textContent = "Ingenting spiller";
      el.artist.textContent = last ? `Sist: ${last.name} – trykk ▶ eller velg en kanal` : "Velg en kanal nederst";
      if (last && !st) this._current = null;
      this._pendingLast = last || null;
      el.stname.textContent = el.program.textContent = el.history.textContent = "";
      el.artlogo.innerHTML = '<ha-icon icon="mdi:radio"></ha-icon>';
      el.badge.classList.add("hidden");
      el.progress.classList.add("hidden");
      return;
    }
    const np = this._resolveNp();
    this._npNow = np;
    const hasSong = !!(np.title && np.artist);
    el.card.style.setProperty("--accent", st.color || "#5c7cfa");
    el.stname.textContent = "· " + st.name;
    el.title.textContent = hasSong ? np.title : st.name;
    el.artist.textContent = hasSong ? np.artist : (np.title || st.tag || "");
    el.program.textContent = np.program ? np.program : (hasSong ? st.tag || "" : "");
    el.history.innerHTML = np.history && np.history.length ? `<span>Nettopp spilt</span>${np.history.map((h) => `<div>${esc(h)}</div>`).join("")}` : "";

    const art = hasSong ? (this._lookupArt(np.artist, np.title) || np.image) : null;
    const logoHtml = st.logo ? `<img src="${esc(st.logo)}" alt="">` : `<span>${esc(initials(st.name))}</span>`;
    if (art) {
      if (el.art.getAttribute("src") !== art) el.art.src = art;
      el.art.classList.add("show");
      el.artlogo.classList.add("hidden");
      el.bgimg.style.backgroundImage = `url("${art}")`;
      el.badge.classList.remove("hidden");
      el.badge.querySelector("span").textContent = st.name;
      const bi = el.badge.querySelector("img");
      if (st.logo) { bi.src = st.logo; bi.classList.remove("hidden"); } else bi.classList.add("hidden");
    } else {
      el.art.classList.remove("show");
      el.artlogo.classList.remove("hidden");
      if (el.artlogo.dataset.id !== st.id) { el.artlogo.innerHTML = logoHtml; el.artlogo.dataset.id = st.id; }
      el.bgimg.style.backgroundImage = st.logo ? `url("${st.logo}")` : "none";
      el.badge.classList.add("hidden");
    }
    this._renderFavButton();
    this._renderProgress();
    this._el.strip.querySelectorAll(".tile").forEach((t) => {
      t.classList.toggle("active", t.dataset.id === st.id);
      t.classList.toggle("playing", !!playing);
    });
  }

  _renderProgress() {
    if (!this._el) return;
    const np = this._npNow || {};
    if (!np.start || !np.dur) { this._el.progress.classList.add("hidden"); return; }
    const pct = Math.min(100, Math.max(0, (Date.now() - np.start) / 10 / np.dur));
    this._el.progress.classList.toggle("hidden", pct >= 100);
    this._el.bar.style.width = pct + "%";
  }

  _toast(msg) {
    const t = this._el.toast;
    t.textContent = msg; t.classList.remove("hidden");
    clearTimeout(this._toastT); this._toastT = setTimeout(() => t.classList.add("hidden"), 4000);
  }
}

const CSS = `
:host { display:block; height:100%; }
ha-card { --accent:#5c7cfa; position:relative; overflow:hidden; height:calc(100vh - var(--header-height, 56px) - 16px); min-height:560px;
  border-radius:var(--ha-card-border-radius, 16px); background:#0b0d12; color:#fff; display:flex; flex-direction:column; font-family:var(--ha-font-family-body, Roboto, sans-serif); }
button { font:inherit; color:inherit; cursor:pointer; border:none; background:none; }
.hidden { display:none !important; }
.bg { position:absolute; inset:0; z-index:0; }
.bgimg { position:absolute; inset:-60px; background-size:cover; background-position:center; filter:blur(60px) saturate(1.4); opacity:.55; transform:scale(1.15); transition:background-image .8s; }
.bgshade { position:absolute; inset:0; background:
  radial-gradient(ellipse at 20% 30%, color-mix(in srgb, var(--accent) 45%, transparent), transparent 60%),
  linear-gradient(180deg, rgba(5,6,10,.35) 0%, rgba(5,6,10,.55) 55%, rgba(5,6,10,.92) 100%); transition:background .8s; }
.top { position:relative; z-index:3; display:flex; align-items:center; justify-content:space-between; padding:18px 24px 0; }
.brand { display:flex; align-items:center; gap:8px; font-weight:600; letter-spacing:.08em; text-transform:uppercase; font-size:13px; opacity:.85; }
.chip { display:flex; align-items:center; gap:6px; padding:8px 12px 8px 14px; border-radius:999px; background:rgba(255,255,255,.12); backdrop-filter:blur(12px); font-size:14px; border:1px solid rgba(255,255,255,.15); }
.chip:hover { background:rgba(255,255,255,.2); }
.chip ha-icon { --mdc-icon-size:18px; }
.menu { position:absolute; right:24px; top:58px; min-width:260px; max-height:60vh; overflow:auto; background:rgba(20,22,30,.95); backdrop-filter:blur(20px); border-radius:14px; padding:6px; box-shadow:0 20px 50px rgba(0,0,0,.5); border:1px solid rgba(255,255,255,.1); }
.menu button { display:flex; align-items:center; gap:10px; width:100%; padding:10px 12px; border-radius:10px; text-align:left; font-size:14px; }
.menu button:hover { background:rgba(255,255,255,.08); }
.menu button.sel { background:color-mix(in srgb, var(--accent) 35%, transparent); }
.menu button span { flex:1; }
.menu .eqi { color:#69db7c; --mdc-icon-size:18px; }
.stage { position:relative; z-index:1; flex:1; display:flex; align-items:center; gap:clamp(24px,5vw,72px); padding:16px clamp(20px,5vw,72px); min-height:0; }
.artwrap { position:relative; flex:0 0 auto; height:min(52vh, 42vw, 520px); aspect-ratio:1; }
.art { position:relative; width:100%; height:100%; border-radius:22px; overflow:hidden; box-shadow:0 30px 80px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.08); background:#fff; }
.artimg { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; opacity:0; transition:opacity .6s; }
.artimg.show { opacity:1; }
.artlogo { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; padding:16%; background:#fff; }
.artlogo img { max-width:100%; max-height:100%; object-fit:contain; }
.artlogo span, .logo span { font-weight:800; color:var(--c, var(--accent)); font-size:clamp(40px,8vw,110px); }
.artlogo ha-icon { --mdc-icon-size:120px; color:#adb5bd; }
.badge { position:absolute; left:16px; bottom:16px; display:flex; align-items:center; gap:8px; padding:6px 12px 6px 6px; border-radius:999px; background:rgba(255,255,255,.92); color:#111; font-size:13px; font-weight:600; box-shadow:0 6px 20px rgba(0,0,0,.35); }
.badge img { width:28px; height:28px; object-fit:contain; border-radius:6px; }
.info { flex:1; min-width:0; display:flex; flex-direction:column; gap:8px; }
.live { display:flex; align-items:center; gap:8px; font-size:13px; font-weight:700; letter-spacing:.12em; color:#ff6b6b; }
.live .stname { color:rgba(255,255,255,.75); letter-spacing:.04em; font-weight:500; }
.live.off { color:rgba(255,255,255,.5); }
.dot { width:9px; height:9px; border-radius:50%; background:currentColor; box-shadow:0 0 0 0 currentColor; }
ha-card.playing .dot { animation:pulse 1.6s infinite; }
@keyframes pulse { 0% { box-shadow:0 0 0 0 rgba(255,107,107,.7);} 70% { box-shadow:0 0 0 10px rgba(255,107,107,0);} 100% { box-shadow:0 0 0 0 rgba(255,107,107,0);} }
.title { font-size:clamp(28px,4.6vw,64px); font-weight:800; line-height:1.05; letter-spacing:-.02em; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; text-shadow:0 2px 20px rgba(0,0,0,.3); }
.artist { font-size:clamp(18px,2.4vw,30px); font-weight:500; color:rgba(255,255,255,.85); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.program { font-size:15px; color:rgba(255,255,255,.6); }
.progress { height:4px; border-radius:2px; background:rgba(255,255,255,.15); max-width:460px; margin-top:6px; overflow:hidden; }
.progress div { height:100%; background:var(--accent); filter:brightness(1.4); border-radius:2px; transition:width 1s linear; }
.history { font-size:13px; color:rgba(255,255,255,.55); margin-top:4px; }
.history span { text-transform:uppercase; letter-spacing:.1em; font-size:11px; opacity:.8; }
.history div { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.controls { display:flex; align-items:center; gap:14px; margin-top:18px; flex-wrap:wrap; }
.play { width:72px; height:72px; border-radius:50%; background:#fff; color:#111; display:flex; align-items:center; justify-content:center; box-shadow:0 10px 30px rgba(0,0,0,.4); transition:transform .15s; }
.play:hover { transform:scale(1.06); }
.play ha-icon { --mdc-icon-size:38px; }
.round { width:48px; height:48px; border-radius:50%; background:rgba(255,255,255,.12); display:flex; align-items:center; justify-content:center; border:1px solid rgba(255,255,255,.15); }
.round.on { color:#ffd43b; }
.vol { display:flex; align-items:center; gap:10px; padding:0 16px; height:48px; border-radius:999px; background:rgba(255,255,255,.1); border:1px solid rgba(255,255,255,.12); }
.vol input { width:min(220px, 30vw); accent-color:#fff; }
.dock { position:relative; z-index:2; margin:0 12px 12px; padding:10px 12px 12px; border-radius:20px; background:rgba(12,14,20,.55); backdrop-filter:blur(24px) saturate(1.3); border:1px solid rgba(255,255,255,.1); }
.tabs { display:flex; gap:6px; overflow-x:auto; scrollbar-width:none; padding-bottom:8px; }
.tabs button { flex:0 0 auto; display:flex; align-items:center; gap:4px; padding:6px 14px; border-radius:999px; font-size:13px; font-weight:500; color:rgba(255,255,255,.7); }
.tabs button ha-icon { --mdc-icon-size:16px; color:#ffd43b; }
.tabs button.sel { background:rgba(255,255,255,.16); color:#fff; }
.tabs .edit { margin-left:auto; }
.tabs .add ha-icon { color:rgba(255,255,255,.8); }
.tabs .add.first { border:1px dashed rgba(255,255,255,.45); color:#fff; background:rgba(255,255,255,.06); }
.tabs .add.first:hover { background:rgba(255,255,255,.14); }
.tabs .add.first ha-icon { color:#fff; }
.logo.more { background:rgba(255,255,255,.12); box-shadow:none; border:1px dashed rgba(255,255,255,.35); }
.logo.more ha-icon { --mdc-icon-size:40px; color:#fff; }
.tile.more .tname { white-space:normal; line-height:1.2; }
.menu .admin { border-top:1px solid rgba(255,255,255,.1); margin-top:4px; padding-top:12px; color:rgba(255,255,255,.75); }
.settings { position:absolute; inset:0; z-index:6; background:rgba(10,12,18,.97); overflow:auto; padding:22px clamp(16px,4vw,48px); }
.sethead { display:flex; align-items:center; justify-content:space-between; font-size:20px; margin-bottom:6px; }
.sethead .close { padding:8px 16px; border-radius:999px; background:#fff; color:#111; font-weight:600; font-size:14px; }
.sethint { color:rgba(255,255,255,.6); font-size:13px; margin:4px 0 16px; }
.setuser { padding:14px 0; border-top:1px solid rgba(255,255,255,.08); }
.setname { font-weight:600; margin-bottom:8px; }
.setouts { display:flex; flex-wrap:wrap; gap:6px; }
.setouts button { padding:6px 12px; border-radius:999px; font-size:13px; background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.12); color:rgba(255,255,255,.7); }
.setouts button.on { background:#69db7c; color:#111; border-color:#69db7c; font-weight:600; }
.setdef { display:block; margin-top:8px; font-size:13px; color:rgba(255,255,255,.7); }
.setdef select { margin-left:6px; background:#222; color:#fff; border:1px solid rgba(255,255,255,.2); border-radius:8px; padding:4px 8px; }
.catbar { display:flex; align-items:center; gap:8px; padding:0 6px 0 12px; margin-bottom:8px; border-radius:12px; background:rgba(255,255,255,.08); }
.catbar input { flex:1; min-width:0; height:40px; background:none; border:none; outline:none; color:#fff; font-size:15px; font-weight:600; }
.catbar button { padding:6px 12px; border-radius:999px; font-size:13px; background:rgba(255,255,255,.12); }
.catbar .done { background:#fff; color:#111; font-weight:600; }
.catbar .del.armed { background:#c92a2a; }
.tile.adding .star { display:none; }
.chk { position:absolute; top:2px; right:2px; z-index:2; width:34px; height:34px; border-radius:50%; background:rgba(0,0,0,.6); display:flex; align-items:center; justify-content:center; }
.chk ha-icon { --mdc-icon-size:24px; color:#fff; }
.tile.in .chk ha-icon { color:#69db7c; }
.tile.in .chk ha-icon[icon="mdi:close-circle"] { color:#ff8787; }
.catbar .addhint { flex:1; min-width:0; font-size:14px; padding:11px 0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.searchbar { display:flex; align-items:center; gap:8px; padding:0 12px; margin-bottom:8px; border-radius:12px; background:rgba(255,255,255,.08); }
.searchbar input { flex:1; height:40px; background:none; border:none; outline:none; color:#fff; font-size:15px; }
.strip { display:flex; gap:12px; overflow-x:auto; scroll-snap-type:x proximity; padding:4px 2px 4px; scrollbar-width:thin; scrollbar-color:rgba(255,255,255,.2) transparent; }
.empty { padding:22px 8px; color:rgba(255,255,255,.6); font-size:14px; }
.tile { position:relative; flex:0 0 auto; width:112px; scroll-snap-align:start; cursor:pointer; transition:transform .15s; }
.tile:hover { transform:translateY(-3px); }
.logo { position:relative; width:112px; height:112px; border-radius:16px; background:#fff; display:flex; align-items:center; justify-content:center; padding:14px; box-sizing:border-box; overflow:hidden; box-shadow:0 6px 18px rgba(0,0,0,.35); outline:3px solid transparent; outline-offset:2px; transition:outline-color .2s; }
.logo img { max-width:100%; max-height:100%; object-fit:contain; }
.logo span { font-size:34px; }
.tile.active .logo { outline-color:var(--c); }
.tname { margin-top:6px; font-size:12.5px; text-align:center; color:rgba(255,255,255,.85); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.star { position:absolute; top:4px; right:4px; width:28px; height:28px; border-radius:50%; background:rgba(0,0,0,.45); color:#fff; display:flex; align-items:center; justify-content:center; opacity:0; transition:opacity .15s; }
.star ha-icon { --mdc-icon-size:16px; }
.star.on { opacity:1; color:#ffd43b; }
.tile:hover .star { opacity:1; }
@media (hover:none) { .star { opacity:.85; } }
.move { position:absolute; inset:auto 0 26px 0; display:flex; justify-content:space-between; padding:0 4px; }
.move button { width:30px; height:30px; border-radius:50%; background:rgba(0,0,0,.65); display:flex; align-items:center; justify-content:center; }
.eq { position:absolute; left:8px; bottom:8px; display:none; gap:2px; align-items:flex-end; height:16px; padding:3px 4px; border-radius:6px; background:var(--c); }
.tile.active.playing .eq { display:flex; }
.eq i { width:3px; background:#fff; border-radius:1px; animation:eq 1s infinite ease-in-out; }
.eq i:nth-child(2) { animation-delay:-.4s; } .eq i:nth-child(3) { animation-delay:-.7s; }
@keyframes eq { 0%,100% { height:3px; } 50% { height:12px; } }
.toast { position:absolute; left:50%; top:70px; transform:translateX(-50%); z-index:5; background:rgba(201,42,42,.95); padding:10px 16px; border-radius:10px; font-size:14px; }
@media (max-width: 760px) {
  ha-card { height:auto; min-height:calc(100vh - var(--header-height, 56px) - 16px); }
  .stage { flex-direction:column; align-items:stretch; text-align:left; padding:12px 20px; gap:18px; }
  .artwrap { height:auto; width:min(78vw, 360px); align-self:center; }
  .controls { margin-top:10px; }
  .vol { flex:1; } .vol input { width:100%; }
  .tile, .logo { width:88px; } .logo { height:88px; padding:10px; }
}
`;

customElements.define("racast-card", RadioNorgeCard);
// gammelt navn beholdes slik at eksisterende dashbord (custom:radio-norge-card) virker
customElements.define("radio-norge-card", class extends RadioNorgeCard {});
window.customCards = window.customCards || [];
window.customCards.push({ type: "racast-card", name: "RACast", description: "Fullskjerms nettradio med faste kanaler og søk i radiokanaler fra hele verden, favoritter og egne kategorier per bruker, live sanginfo og utganger per bruker." });
console.info(`%c RACAST-CARD %c ${VERSION} `, "background:#d71d2f;color:#fff;font-weight:700", "background:#222;color:#fff");
