import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = process.env.BASE || "http://localhost:4848";
const OUT = process.env.OUT || "/private/tmp/claude-501/-Users-mac-Workshop-Personal-gitfut/2227b677-a267-449b-8d82-867bc03f52f4/scratchpad/shots2";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

async function shoot(name, url, viewport, waitMs = 3500, full = true) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  } catch {
    console.log(`  (networkidle timeout ${name})`);
  }
  await page.waitForTimeout(waitMs);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
  console.log("OK", name);
  await ctx.close();
}

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

const only = process.argv[2];

if (!only || only === "landing") {
  await shoot("01-landing-desktop", BASE, DESKTOP);
  await shoot("02-landing-mobile", BASE, MOBILE);
}

if (only === "result" || only === "all") {
  // home-flow click → result (needs sample shim active for tokenless runs)
  for (const [name, vp, target] of [
    ["03-result-icon-desktop", DESKTOP, "TORVALDS"],
    ["04-result-icon-mobile", MOBILE, "TORVALDS"],
    ["05-result-gold-desktop", DESKTOP, "HOLT"],
    ["06-result-toty-desktop", DESKTOP, "RIVAS"],
  ]) {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: "networkidle" }).catch(() => {});
    await page.waitForTimeout(1000);
    const el = page.getByText(target, { exact: false }).first();
    await el.click({ timeout: 4000 }).catch((e) => console.log("click fail", name, e.message));
    await page.waitForTimeout(4500); // let the walkout + burst settle
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
    console.log("OK", name);
    await ctx.close();
  }
}

if (only === "loading") {
  // capture the loading screen mid-flight by intercepting the API with a delay
  const ctx = await browser.newContext({ viewport: DESKTOP, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.route("**/api/card/**", async (route) => {
    await new Promise((r) => setTimeout(r, 6000));
    route.continue();
  });
  await page.goto(BASE, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(800);
  await page.getByText("TORVALDS", { exact: false }).first().click().catch(() => {});
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/07-loading-desktop.png`, fullPage: false });
  console.log("OK 07-loading-desktop");
  await ctx.close();
}

await browser.close();
console.log("done");
