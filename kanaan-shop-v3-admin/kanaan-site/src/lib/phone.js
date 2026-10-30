/* Phone numbers, the way Kanaan POS reads them (kanaan-pos core/phone.cjs —
   keep the two the same): every way of writing a Lebanese number becomes the
   same digits, so the shop's program finds the customer's file by it.
     03 123 456 · 3123456 · +961 3 123 456 · 009613123456 · ٠٣١٢٣٤٥٦  →  +961 3 123 456
     70 123 456 · 070123456 · 96170123456                             →  +961 70 123 456
   A number from another country is kept when it is written with + or 00. */

const ARABIC = { "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
  "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9" };
const LB_MOBILE = /^(3\d{6}|7[01689]\d{6}|8[16]\d{6})$/; // 03 · 70 71 76 78 79 · 81 86
const LB_FIXED = /^[1456789]\d{6}$/; // 01 Beirut · 04 · 05 · 06 · 07 Saida · 08 · 09

/** Western digits only, "+" kept at the start. */
export function digitsOf(text) {
  const t = String(text || "").replace(/[٠-٩۰-۹]/g, (c) => ARABIC[c]).trim();
  return (t.startsWith("+") ? "+" : "") + t.replace(/\D/g, "");
}

/** { e164, national, pretty, mobile, lebanon } or null when it can't be a phone number. */
export function parsePhone(text) {
  let d = digitsOf(text);
  if (!d || d === "+") return null;
  let intl = false;
  if (d.startsWith("+")) { d = d.slice(1); intl = true; } else if (d.startsWith("00")) { d = d.slice(2); intl = true; }
  if (!intl && d.startsWith("961") && d.length >= 10) intl = true;
  let national;
  if (intl) {
    if (!d.startsWith("961")) {
      if (d.length < 8 || d.length > 15) return null;
      return { e164: d, national: `+${d}`, pretty: `+${d}`, mobile: true, lebanon: false };
    }
    national = d.slice(3).replace(/^0+/, "");
  } else {
    national = d.replace(/^0+/, "");
  }
  if (!(national.length === 7 || national.length === 8)) return null;
  const mobile = LB_MOBILE.test(national);
  if (!mobile && !LB_FIXED.test(national)) return null;
  const n = national;
  const grouped = n.length === 7 ? `${n.slice(0, 1)} ${n.slice(1, 4)} ${n.slice(4)}` : `${n.slice(0, 2)} ${n.slice(2, 5)} ${n.slice(5)}`;
  return { e164: `961${n}`, national: n.length === 7 ? `0${grouped}` : grouped, pretty: `+961 ${grouped}`, mobile, lebanon: true };
}
