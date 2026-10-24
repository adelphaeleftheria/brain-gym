import { test, expect } from "@playwright/test";
import { ready, exported } from "./helpers";
test.use({ timezoneId: "Europe/Berlin" });
test("an exercise that finishes after midnight stays attached to the original workout", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Math.random = () => 0.1;
  });
  await page.clock.install({ time: new Date("2026-10-24T23:59:55+02:00") });
  await ready(page);
  await page.getByRole("link", { name: "Daily Workout", exact: true }).click();
  await page.getByRole("button", { name: "Start →", exact: true }).click();
  const name = await page.locator(".game-heading h1").innerText();
  await page.getByRole("button", { name: "Start exercise →" }).click();
  await page.clock.runFor(10000);
  if (name === "Memory Sequence") {
    await page.getByRole("button", { name: "Tile 2", exact: true }).click();
    await page.clock.runFor(1000);
  } else if (name === "Quick Math") {
    await page.clock.runFor(61000);
  } else if (name === "Pattern Logic") {
    for (let i = 0; i < 8; i++) {
      await page.locator(".answers button").first().click();
      await page.clock.runFor(1150);
    }
  } else if (name === "Focus Finder") {
    for (let i = 0; i < 3; i++) {
      for (const b of await page
        .locator(".focus button")
        .filter({ hasText: /^A$/ })
        .all())
        await b.click();
      await page.clock.runFor(700);
    }
  } else {
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
  const d = await exported(page);
  expect(d.sessions).toHaveLength(1);
  expect(d.sessions[0].workoutId).toBe("daily-2026-10-24");
  expect(d.sessions[0].dateKey).toBe("2026-10-25");
  expect(d.workouts.find((w) => w.date === "2026-10-24")?.sessionIds).toEqual([
    d.sessions[0].id,
  ]);
});
