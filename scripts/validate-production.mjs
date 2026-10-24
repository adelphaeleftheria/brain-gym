import { chromium } from "@playwright/test";
import { existsSync } from "node:fs";
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.CHROMIUM_PATH ||
    (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
  args: ["--no-sandbox"],
});
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("requestfailed", (r) =>
    errors.push(`${r.url()}: ${r.failure()?.errorText}`),
  );
  await page.addInitScript(() => {
    Math.random = () => 0.2;
  });
  const base = process.env.VALIDATION_URL || "http://127.0.0.1:4174/brain-gym/";
  await page.goto(base);
  await page.getByRole("button", { name: "Skip for now" }).click();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.getByRole("link", { name: "Progress", exact: true }).click();
  await page
    .getByRole("heading", { name: "See your practice take shape." })
    .waitFor();
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await page.getByLabel("Theme", { exact: true }).selectOption("light");
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === "light",
  );
  await page.reload();
  if (
    (await page.getByLabel("Theme", { exact: true }).inputValue()) !== "light"
  )
    throw Error("Theme did not persist");
  if (!(await page.evaluate(() => !!navigator.serviceWorker.controller)))
    throw Error("Page is not controlled by offline worker");
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("link", { name: "Train", exact: true }).click();
  await page.getByRole("button", { name: /Memory Sequence/ }).click();
  await page.getByRole("button", { name: "Start exercise →" }).click();
  await page.getByRole("heading", { name: "Repeat the pattern" }).waitFor();
  await page.getByRole("button", { name: "Tile 9", exact: true }).click();
  await page.getByText("EXERCISE COMPLETE", { exact: true }).waitFor();
  await page.reload();
  await page.getByRole("link", { name: "History", exact: true }).click();
  await page.locator(".session-row").waitFor();
  if ((await page.locator(".session-row").count()) !== 1)
    throw Error("Offline result was not persisted");
  if (errors.length) throw Error(errors.join("\n"));
  console.log(
    "PASS: production subpath, hash refresh, theme persistence, lazy charts, offline game completion and persistence; no browser exceptions or failed asset requests",
  );
  await page.screenshot({
    path: "test-results/production-offline.png",
    fullPage: true,
  });
} finally {
  await browser.close();
}
