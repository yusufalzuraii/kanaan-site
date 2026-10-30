/* Phone numbers the way Kanaan POS reads them (kanaan-pos core/phone.cjs, the storefront's src/lib/phone.js —
   keep the three the same): every way of writing a Lebanese number becomes one, so the shop's program finds the
   customer's file by it. A number from another country is kept when written with + or 00. */
const ARABIC = { "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
  "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9" };
const LB_MOBILE = /^(3\d{6}|7[01689]\d{6}|8[16]\d{6})$/;
const LB_FIXED = /^[1456789]\d{6}$/;

export function parsePhone(text) {
  const t = String(text || "").replace(/[٠-٩۰-۹]/g, (c) => ARABIC[c]).trim();
  let d = (t.startsWith("+") ? "+" : "") + t.replace(/\D/g, "");
  if (!d || d === "+") return null;
  let intl = false;
  if (d.startsWith("+")) { d = d.slice(1); intl = true; } else if (d.startsWith("00")) { d = d.slice(2); intl = true; }
  if (!intl && d.startsWith("961") && d.length >= 10) intl = true;
  let national;
  if (intl) {
    if (!d.startsWith("961")) {
      if (d.length < 8 || d.length > 15) return null;
      return { e164: d, pretty: `+${d}`, lebanon: false };
    }
    national = d.slice(3).replace(/^0+/, "");
  } else {
    national = d.replace(/^0+/, "");
  }
  if (!(national.length === 7 || national.length === 8)) return null;
  if (!LB_MOBILE.test(national) && !LB_FIXED.test(national)) return null;
  const n = national;
  const grouped = n.length === 7 ? `${n.slice(0, 1)} ${n.slice(1, 4)} ${n.slice(4)}` : `${n.slice(0, 2)} ${n.slice(2, 5)} ${n.slice(5)}`;
  return { e164: `961${n}`, pretty: `+961 ${grouped}`, lebanon: true };
}
