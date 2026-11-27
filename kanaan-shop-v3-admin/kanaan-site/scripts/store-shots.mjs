/* The raw screens for the Google Play / App Store pictures: the app's own screens (the "kanaan-app-preview" tab flag,
   src/native.js) on the live catalogue, at a phone's size and 3x. Run by .github/workflows/store-shots.yml; the
   pictures themselves are composed from these. Nothing is ordered and the visit isn't counted (kanaan-staff). */
import { chromium } from "playwright";
import fs from "node:fs";

const SITE = process.env.SITE || "https://kanaanshop.com";
const OUT = process.env.OUT || "shots";
fs.mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log(...a);

const api = await fetch(`${SITE}/api/products`, { headers: { "X-Kanaan-Client": "app" } }).then((r) => r.json());
const live = api.products.filter((p) => p.active !== false && !p.soldOut);
const pick = (cat, n = 0) => live.filter((p) => p.category === cat)[n];
const likes = [pick("jackets"), pick("hoodies"), pick("shoes", 1), pick("knitwear")].filter(Boolean).map((p) => p.id);
const hero = pick("jackets") || live[0];
fs.writeFileSync(`${OUT}/catalog.json`, JSON.stringify({
  n: live.length, exclusives: live.filter((p) => p.appExclusive).map((p) => p.slug || p.id), sale: live.filter((p) => p.discount > 0).length,
  hero: hero.slug || hero.id, likes, cats: [...new Set(live.map((p) => p.category))],
  sample: live.slice(0, 60).map((p) => [p.id, p.slug, p.name, p.category, p.price, p.discount || 0, (p.sizes || []).join("/")]),
}, null, 1));

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 412, height: 915 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  userAgent: "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
  locale: "en-US", timezoneId: "Asia/Beirut",
});
await ctx.addInitScript((seed) => {
  try {
    sessionStorage.setItem("kanaan-app-preview", "1");
    localStorage.setItem("kanaan-welcome-seen", "1");
    localStorage.setItem("kanaan-staff", "1");
    if (!localStorage.getItem("kanaan-shots-seeded")) {
      localStorage.setItem("kanaan-shots-seeded", "1");
      if (seed.likes) localStorage.setItem("kanaan-likes", JSON.stringify(seed.likes));
    }
  } catch { /* fine */ }
}, { likes: null });
const page = await ctx.newPage();
await page.clock.setFixedTime(new Date("2026-11-28T12:10:00+02:00")); // midday in Saida: the shop is open
page.on("pageerror", (e) => log("pageerror:", e.message.slice(0, 200)));

const settle = async (ms = 1200) => {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.evaluate(() => Promise.all([...document.images].filter((i) => !i.complete).map((i) => new Promise((r) => { i.onload = i.onerror = r; setTimeout(r, 6000); })))).catch(() => {});
  await page.waitForTimeout(ms);
};
const shot = async (name) => { await page.screenshot({ path: `${OUT}/${name}.png` }); log("shot", name); };
const go = async (path) => { await page.goto(SITE + path, { waitUntil: "domcontentloaded" }); await settle(1800); };
const toHeading = async (text, offset = 14) => {
  await page.evaluate(([t, o]) => {
    const h = [...document.querySelectorAll("h2")].find((x) => x.textContent.trim().startsWith(t));
    if (h) window.scrollTo(0, h.getBoundingClientRect().top + window.scrollY - o);
  }, [text, offset]);
  await settle(900);
};
const step = async (name, fn) => { try { await fn(); } catch (e) { log(`step ${name} failed:`, String(e.message || e).slice(0, 300)); } };

// 1. home, a first visit
await step("home", async () => {
  await go("/");
  await shot("01-home");
  await toHeading("Walk in"); await shot("02-walk-in");
  await page.evaluate(() => window.scrollBy(0, 560)); await settle(900); await shot("03-walk-in-b");
  await toHeading("New in"); await shot("04-new-in");
  await toHeading("On sale"); await shot("05-sale-rail");
  await toHeading("Only in the app", 40); await shot("06-only-app");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${OUT}/00-home-full.png`, fullPage: true });
});

// 2. a piece
await step("product", async () => {
  await go(`/product/${hero.slug || hero.id}`);
  await shot("10-product");
  await page.evaluate(() => window.scrollBy(0, 520)); await settle(700); await shot("11-product-b");
  await page.evaluate(() => window.scrollTo(0, 0)); await settle(300);
  await page.locator("button.pick-open").first().click();
  await page.waitForTimeout(900); await shot("12-size-sheet");
  const sizes = page.locator('[role="dialog"] button:not([disabled]), .size-sheet button:not([disabled])');
  log("sheet buttons:", await sizes.allTextContents().then((a) => a.map((t) => t.trim().slice(0, 14)).join(" | ")));
});

// 3. put two pieces in the bag (quick add from the grid), like a few
await step("bag", async () => {
  await page.evaluate((ids) => localStorage.setItem("kanaan-likes", JSON.stringify(ids)), likes);
  for (const cat of ["hoodies", "jeans"]) {
    await go(`/shop/${cat}`);
    await page.locator('[data-testid="quick-add"]').first().click();
    await page.waitForTimeout(800);
    if (cat === "hoodies") await shot("20-quick-add-sheet");
    const sz = page.locator('[data-testid^="size-"]:not([disabled])');
    const n = await sz.count();
    log(cat, "sizes in sheet:", n);
    await sz.nth(Math.min(1, n - 1)).click();
    await page.waitForTimeout(700);
    const add = page.getByRole("button", { name: /add to (cart|bag)/i });
    if (await add.count()) { await add.first().click(); await page.waitForTimeout(700); }
    if (cat === "hoodies") await shot("21-added-note");
    await page.waitForTimeout(600);
  }
  log("cart:", await page.evaluate(() => localStorage.getItem("kanaan-cart")));
});

await step("home-yours", async () => { await go("/"); await shot("30-home-yours"); });
await step("catalog", async () => {
  await go("/shop/shoes"); await shot("40-shoes");
  await page.evaluate(() => window.scrollBy(0, 300)); await settle(600); await shot("41-shoes-b");
  await go("/shop/jackets"); await shot("42-jackets");
  await go("/shop"); await shot("43-shop-all");
});
await step("favorites", async () => { await go("/favorites"); await shot("50-favorites"); });
await step("exclusives", async () => { await go("/exclusives"); await shot("60-exclusives"); await go("/sale"); await shot("61-sale"); });
await step("cart", async () => {
  await go("/");
  await page.getByRole("button", { name: /^cart/i }).last().click();
  await page.waitForTimeout(1000); await shot("70-bag");
});
await step("checkout", async () => {
  await go("/checkout"); await shot("80-checkout");
  await page.evaluate(() => window.scrollBy(0, 600)); await settle(600); await shot("81-checkout-b");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await settle(600); await shot("82-checkout-end");
});
await browser.close();
log("done:", fs.readdirSync(OUT).join(" "));
