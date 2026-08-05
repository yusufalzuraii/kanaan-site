/* Guards against a mistake that has broken this build four times:
   a backtick inside the GlobalStyles template literal.

   The stylesheet is one long template string. A stray backtick — almost
   always inside a code comment, quoting a CSS selector or property —
   silently terminates it early. What follows is then parsed as
   JavaScript, and the whole stylesheet collapses to NaN. The build
   still succeeds; the site simply loses every style.

   Run: node check-styles.mjs */
import { readFileSync } from "node:fs";

const src = readFileSync("src/App.jsx", "utf8");
const start = src.indexOf("<style>{`");
const end = src.indexOf("`}</style>", start);

if (start === -1 || end === -1) {
  console.log("⚠️  لم يتم العثور على كتلة الأنماط");
  process.exit(0);
}

const body = src.slice(start + 9, end);
const strays = [...body.matchAll(/`/g)];
const lineOf = (i) => src.slice(0, start + 9 + i).split("\n").length;

if (strays.length > 0) {
  console.log(`❌ ${strays.length} علامة مائلة داخل كتلة الأنماط — ستكسر الأنماط بالكامل:`);
  for (const m of strays) {
    const line = lineOf(m.index);
    console.log(`   سطر ${line}: ${src.split("\n")[line - 1].trim().slice(0, 80)}`);
  }
  process.exit(1);
}

// An unintended ${...} would interpolate a JS value into the CSS.
const interps = [...body.matchAll(/\$\{([^}]*)\}/g)].map((m) => m[1].trim());
const expected = ["SPLASH_TOTAL_MS - 450"];
const unexpected = interps.filter((i) => !expected.includes(i));

console.log(`✅ كتلة الأنماط سليمة (${body.length} حرف، ${interps.length} تعبير)`);
if (unexpected.length) {
  console.log("⚠️  تعبيرات غير متوقعة:", unexpected);
}
