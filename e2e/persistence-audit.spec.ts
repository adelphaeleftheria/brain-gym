import { readFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import { ready, begin, exported } from "./helpers";
import { defaults } from "../src/domain/model";
import { makeSession } from "../src/tests/fixtures";
test("simultaneous profile changes in two tabs are both retained", async ({
  page,
  context,
}) => {
  await ready(page);
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  const second = await context.newPage();
  await second.goto("./#settings");
  await expect(second.getByLabel("Display name")).toBeVisible();
  await Promise.all([
    page.getByLabel("Display name").fill("Two tabs"),
    second.getByLabel("Sound effects", { exact: true }).check(),
  ]);
  await expect(page.getByLabel("Sound effects", { exact: true })).toBeChecked();
  await expect(second.getByLabel("Display name")).toHaveValue("Two tabs");
  const d = await exported(page);
  expect(d.profile.name).toBe("Two tabs");
  expect(d.profile.sound).toBe(true);
  await second.close();
});
test("storage failure retains the same result for retry without duplicate XP or uncaught errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    Math.random = () => 0.1;
  });
  await page.clock.install();
  await ready(page);
  await begin(page, "Memory Sequence");
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    (window as unknown as { restorePut: () => void }).restorePut = () => {
      IDBObjectStore.prototype.put = original;
    };
    IDBObjectStore.prototype.put = function () {
      throw new DOMException("Test quota exhausted", "QuotaExceededError");
    };
  });
  await page.clock.runFor(3000);
  await page.getByRole("button", { name: "Tile 2", exact: true }).click();
  await page.clock.runFor(1000);
  await expect(
    page.getByRole("heading", { name: "Your result is still here." }),
  ).toBeVisible();
  await page.evaluate(() =>
    (window as unknown as { restorePut: () => void }).restorePut(),
  );
  await page.getByRole("button", { name: "Retry saving" }).click();
  await expect(
    page.getByText("EXERCISE COMPLETE", { exact: true }),
  ).toBeVisible();
  const d = await exported(page);
  expect(d.sessions).toHaveLength(1);
  await page.reload();
  await page.getByRole("link", { name: "History", exact: true }).click();
  await expect(page.locator(".session-row")).toHaveCount(1);
  expect(errors).toEqual([]);
});
test("filters use actual local calendar dates, and memory records display tiles", async ({
  page,
}) => {
  await ready(page);
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  const data = defaults();
  data.profile.onboarded = true;
  data.sessions = [
    makeSession({ id: "math", dateKey: "2026-10-24" }),
    makeSession({
      id: "memory",
      gameId: "memory",
      category: "Memory",
      dateKey: "2026-10-24",
      metrics: { span: 7 },
    }),
    makeSession({
      id: "old",
      start: "2026-09-01T10:00:00Z",
      end: "2026-09-01T10:01:00Z",
      dateKey: "2026-09-01",
    }),
  ];
  await page.locator("input[type=file]").setInputFiles({
    name: "sessions.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ version: 1, data })),
  });
  await page.getByRole("button", { name: "Replace workspace" }).click();
  await page.getByRole("link", { name: "Progress", exact: true }).click();
  await expect(
    page.getByText("Choose an exercise to view its trend"),
  ).toBeVisible();
  await page.getByLabel("Date range").selectOption("All");
  await page.getByLabel("Progress game").selectOption("memory");
  await expect(
    page.locator(".section-title strong").filter({ hasText: /7 tiles/ }),
  ).toBeVisible();
  await expect(page.getByText("NaN")).toHaveCount(0);
  await page.setViewportSize({ width: 360, height: 780 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.screenshot({
    path: "test-results/progress-mobile.png",
    fullPage: true,
  });
});
test("keyboard hints, skip link, modal focus and destructive cancellation have real effects", async ({
  page,
}) => {
  await ready(page);
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await page.getByLabel("Keyboard hints", { exact: true }).uncheck();
  await begin(page, "Memory Sequence");
  await expect(page.locator(".memory button").first()).toHaveText("");
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await page.getByRole("link", { name: "Skip to content" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
  expect(page.url()).toContain("#settings");
  await page
    .getByRole("button", { name: "Clear history", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Clear all training history?" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Clear history", exact: true }),
  ).toBeFocused();
});
test("corrupt saved data can be recovered without silently clearing it", async ({
  page,
}) => {
  await ready(page);
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("brain-gym");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result,
            tx = db.transaction("state", "readwrite");
          tx.objectStore("state").put({
            id: "main",
            data: { version: 99, corrupt: "preserve me" },
          });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Storage needs attention" }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download raw recovery" }).click();
  const raw = await download;
  expect(raw.suggestedFilename()).toContain("recovery");
  expect(
    JSON.parse(await readFile((await raw.path())!, "utf8")).data.corrupt,
  ).toBe("preserve me");
  const data = defaults();
  data.profile = { ...data.profile, onboarded: true, name: "Recovered" };
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByLabel("Restore validated backup", { exact: true })
    .setInputFiles({
      name: "valid.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify({ version: 1, data })),
    });
  await expect(page.getByRole("button", { name: /Recovered/ })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Storage needs attention" }),
  ).toHaveCount(0);
});
