// Legger kortets faste kanaler inn i Music Assistant sitt radiobibliotek med riktig navn og logo.
// Da viser MA (og Cast-skjermer som Google TV / Nest Hub) «P5 Hits» med logo i stedet for «P05_MM».
//
// Bruk (Node 22+):
//   MA_URL=http://<ma-ip>:8095 MA_TOKEN=<langtids-token fra MA> node tools/add-stations-to-ma.mjs [racast-card.js]
// Lag token i Music Assistant: Innstillinger → Profil → Langtids-tokens. Slett den gjerne etterpå.
import fs from "fs";

const file = process.argv[2] || new URL("../racast-card.js", import.meta.url).pathname;
const { MA_URL, MA_TOKEN } = process.env;
if (!MA_URL || !MA_TOKEN) { console.error("Sett MA_URL og MA_TOKEN"); process.exit(1); }

let src = fs.readFileSync(file, "utf8");
src = src.slice(0, src.indexOf("class RadioNorgeCard"));
const { STATIONS, CAST_IMG } = new Function(`${src}; return { STATIONS, CAST_IMG };`)();

const ws = new WebSocket(MA_URL.replace(/^http/, "ws").replace(/\/$/, "") + "/ws");
let id = 0;
const pending = new Map();
const send = (command, args = {}) => new Promise((res) => {
  const mid = String(++id); pending.set(mid, res);
  ws.send(JSON.stringify({ message_id: mid, command, args }));
});
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (pending.has(m.message_id)) { pending.get(m.message_id)(m); pending.delete(m.message_id); } };
ws.onerror = (e) => { console.error("Tilkobling feilet:", e.message || e); process.exit(1); };
ws.onopen = async () => {
  const a = await send("auth", { token: MA_TOKEN });
  if (!a.result || !a.result.authenticated) { console.error("Innlogging feilet:", JSON.stringify(a)); process.exit(1); }
  for (const st of STATIONS) {
    const args = { url: st.url, name: st.name };
    if (st.logo) args.image_url = CAST_IMG(st.logo);
    const r = await send("builtin/add_radio", args);
    console.log(r.error_code ? `FEIL  ${st.name}: ${r.details || r.error_code}` : `OK    ${st.name}`);
  }
  ws.close(); process.exit(0);
};
