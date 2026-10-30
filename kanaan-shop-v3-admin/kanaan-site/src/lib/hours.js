/* "Open now · until 10 pm" — the shop's hours (set from Kanaan POS) read in
   Saida's own time, wherever the visitor is. The same words as the phone's
   control room shows (kanaan-pos phone/src/ui/Control.jsx openLine). */
const NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const toMin = (t) => { const [h, m] = String(t || "").split(":").map(Number); return Number.isFinite(h) ? h * 60 + (m || 0) : null; };
const hm12 = (t) => { const m = toMin(t); if (m === null) return ""; const h = Math.floor(m / 60) % 24; const mm = m % 60; return `${h % 12 || 12}${mm ? `:${String(mm).padStart(2, "0")}` : ""} ${h < 12 ? "am" : "pm"}`; };

function beirutNow(date = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Beirut", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date).map((x) => [x.type, x.value]));
  return { day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday), min: Number(p.hour) * 60 + Number(p.minute) };
}

/** { open, text } or null when no hours are set. */
export function openLine(hours, date = new Date()) {
  if (!hours || !Array.isArray(hours.days)) return null;
  const { day, min } = beirutNow(date);
  const today = hours.days[day];
  if (today && min >= toMin(today[0]) && min < toMin(today[1])) return { open: true, text: `Open now · until ${hm12(today[1])}` };
  for (let i = 0; i < 7; i++) {
    const d = (day + i) % 7;
    const h = hours.days[d];
    if (!h) continue;
    if (i === 0 && min < toMin(h[0])) return { open: false, text: `Closed now · opens at ${hm12(h[0])}` };
    if (i > 0) return { open: false, text: `Closed now · opens ${i === 1 ? "tomorrow" : NAMES[d]} at ${hm12(h[0])}` };
  }
  return { open: false, text: "Closed now" };
}

/** The week, for the shop's page: [["Mon", "10 am – 10 pm"], …] */
export function weekLines(hours) {
  if (!hours || !Array.isArray(hours.days)) return [];
  return [1, 2, 3, 4, 5, 6, 0].map((d) => [NAMES[d].slice(0, 3), hours.days[d] ? `${hm12(hours.days[d][0])} – ${hm12(hours.days[d][1])}` : "Closed"]);
}
