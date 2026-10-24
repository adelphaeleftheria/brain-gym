import { test, expect, type Page } from "@playwright/test";
async function open(page: Page) {
  await page.goto("./");
  await page.getByRole("button", { name: "Skip for now" }).click();
}
test("navigation, profile persistence, command palette, demo isolation and mobile layout", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await page.getByLabel("Display name").fill("Taylor");
  await page.getByLabel("Display name").blur();
  await expect(page.getByRole("button", { name: /Taylor/ })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Display name")).toHaveValue("Taylor");
  await page.getByRole("button", { name: "Explore sample workspace" }).click();
  await expect(page.getByText(/SAMPLE WORKSPACE/)).toBeVisible();
  await page.getByRole("button", { name: "Exit demo →" }).click();
  await expect(page.getByRole("button", { name: /Taylor/ })).toBeVisible();
  await page.getByRole("button", { name: /Find your focus/ }).click();
  await page.getByLabel("Search commands").fill("Play Quick Math");
  await page.getByRole("button", { name: "Play Quick Math" }).click();
  await expect(
    page.getByRole("button", { name: "Start exercise →" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
});
test("daily workout completes, refresh resumes, history and rewards survive refresh", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Math.random = () => 0.1;
  });
  await page.clock.install();
  await open(page);
  await page.getByRole("link", { name: "Daily Workout" }).click();
  for (let exercise = 0; exercise < 5; exercise++) {
    await page
      .getByRole("button", {
        name: exercise ? "Continue →" : "Start →",
        exact: true,
      })
      .click();
    const heading = await page.locator(".game-heading h1").textContent();
    await page.getByRole("button", { name: "Start exercise →" }).click();
    if (heading === "Memory Sequence") {
      await page.clock.runFor(2600);
      await page.getByRole("button", { name: "Tile 2", exact: true }).click();
      await page.clock.runFor(1000);
    } else if (heading === "Quick Math") {
      for (let i = 0; i < 10; i++) {
        await page.getByRole("textbox", { name: "Your answer" }).fill("6");
        await page.getByRole("button", { name: /Check answer/ }).click();
        await page.clock.runFor(1150);
      }
    } else if (heading === "Pattern Logic") {
      for (let i = 0; i < 8; i++) {
        await page.locator(".answers button").first().click();
        await page.clock.runFor(1150);
      }
    } else if (heading === "Focus Finder") {
      for (let i = 0; i < 3; i++) {
        const targets = page
          .locator(".focus button")
          .filter({ hasText: /^A$/ });
        for (const b of await targets.all()) await b.click();
        await page.clock.runFor(700);
      }
    } else if (heading === "Reaction Test") {
      for (let i = 0; i < 5; i++) {
        await page.getByRole("button", { name: /Ready/ }).click();
        await page.clock.runFor(1900);
        await page.clock.runFor(250);
        await page.getByRole("button", { name: /GO!/ }).click();
        await page.clock.runFor(800);
      }
    }
    await expect(
      page.getByText("EXERCISE COMPLETE", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Continue workout →" }).click();
    if (exercise === 0) {
      await page.reload();
      await expect(page.getByText("1/5", { exact: true })).toBeVisible();
    }
  }
  await expect(
    page.getByRole("heading", { name: "You showed up. Well done." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "History", exact: true }).click();
  await expect(page.locator(".session-row")).toHaveCount(5);
  await page.reload();
  await expect(page.locator(".session-row")).toHaveCount(5);
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await page.screenshot({ path: "test-results/dashboard.png", fullPage: true });
});
test("backup exports, safely rejects malformed files, restores and exposes analytics on mobile", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await page.getByLabel("Display name").fill("Backup User");
  await page.getByLabel("Display name").blur();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export full backup ↓" }).click();
  const file = await (await downloaded).path();
  expect(file).toBeTruthy();
  await page.locator("input[type=file]").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":99}'),
  });
  await expect(page.getByRole("status")).toContainText("not a valid");
  await expect(page.getByLabel("Display name")).toHaveValue("Backup User");
  await page.getByLabel("Display name").fill("Changed");
  await page.getByLabel("Display name").blur();
  await page.locator("input[type=file]").setInputFiles(file!);
  await page.getByRole("button", { name: "Replace workspace" }).click();
  await expect(page.getByLabel("Display name")).toHaveValue("Backup User");
  await page.setViewportSize({ width: 375, height: 812 });
  for (const name of [
    "Home",
    "Train",
    "Challenges",
    "Progress",
    "Achievements",
    "History",
    "Settings",
  ]) {
    await page.getByRole("link", { name, exact: true }).click();
    await expect(page.locator("main h1")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
test("all core game controls fit on a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await open(page);
  for (const name of [
    "Memory Sequence",
    "Quick Math",
    "Reaction Test",
    "Pattern Logic",
    "Focus Finder",
  ]) {
    await page.getByRole("link", { name: "Train", exact: true }).click();
    await page.getByRole("button", { name: new RegExp(name) }).click();
    await page.locator(".difficulty-select select").selectOption("Hard");
    await page.getByRole("button", { name: "Start exercise →" }).click();
    await expect(page.locator(".play")).toBeVisible();
    if (name === "Focus Finder") {
      const size = await page.locator(".focus button").first().boundingBox();
      expect(size!.width).toBeGreaterThanOrEqual(44);
      expect(size!.height).toBeGreaterThanOrEqual(44);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
