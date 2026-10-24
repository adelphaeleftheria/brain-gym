import { test, expect } from "@playwright/test";
import { ready, begin, exported, solveLogic } from "./helpers";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    let state = 7391;
    Math.random = () =>
      (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296;
  });
  await page.clock.install();
  await ready(page);
});
test("Memory Sequence: six successful rounds, playback input lock, measured span, history and replay", async ({
  page,
}) => {
  await begin(page, "Memory Sequence");
  for (let r = 0; r < 6; r++) {
    await expect(page.locator(".memory button").first()).toBeDisabled();
    const sequence: number[] = [];
    let previous = -1;
    while (await page.locator(".memory button").first().isDisabled()) {
      await page.clock.runFor(100);
      const value = await page
        .locator(".memory button.lit")
        .getAttribute("aria-label", { timeout: 100 })
        .catch(() => null);
      const tile = value ? Number(value.match(/\d+/)?.[0]) : -1;
      if (tile !== previous && tile > 0) sequence.push(tile);
      previous = tile;
    }
    expect(sequence).toHaveLength(3 + r);
    for (const tile of sequence) {
      await page
        .getByRole("button", { name: new RegExp(`^Tile ${tile}(,|$)`) })
        .click();
      await page.clock.runFor(170);
    }
    await page.clock.runFor(700);
  }
  await expect(
    page.getByText("EXERCISE COMPLETE", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".difficulty-select")).toHaveCount(0);
  await page.getByRole("button", { name: "Play again", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Start exercise →" }),
  ).toBeVisible();
  const d = await exported(page);
  expect(d.sessions).toHaveLength(1);
  expect(d.sessions[0].metrics.span).toBe(8);
  expect(d.sessions[0].correct).toBe(33);
  expect(d.sessions[0].accuracy).toBe(100);
  expect(d.sessions[0].scoringVersion).toBe(2);
});
test("Quick Math: keyboard answers, input refocus, negative/zero padded integers, actual accuracy and one saved result", async ({
  page,
}) => {
  await begin(page, "Quick Math");
  for (let i = 0; i < 10; i++) {
    const [a, op, b] = (await page.locator(".question").innerText()).split(" ");
    const answer =
      op === "+"
        ? +a + +b
        : op === "−"
          ? +a - +b
          : op === "×"
            ? +a * +b
            : +a / +b;
    const input = page.getByRole("textbox", { name: "Your answer" });
    await expect(input).toBeFocused();
    await input.fill(
      i === 9 ? "999999" : answer >= 0 ? "0" + answer : String(answer),
    );
    await input.press("Enter");
    await expect(page.getByRole("status")).toContainText(
      i === 9 ? "Not quite" : "Correct",
    );
    await page.clock.runFor(1150);
  }
  await expect(
    page.getByText("EXERCISE COMPLETE", { exact: true }),
  ).toBeVisible();
  const d = await exported(page);
  expect(d.sessions).toHaveLength(1);
  expect(d.sessions[0].correct).toBe(9);
  expect(d.sessions[0].attempts).toBe(10);
  expect(d.sessions[0].accuracy).toBe(90);
  await page.reload();
  await page.getByRole("link", { name: "History", exact: true }).click();
  await expect(page.locator(".session-row")).toHaveCount(1);
});
test("Quick Math: timeout after one correct answer does not earn a full-session score", async ({
  page,
}) => {
  await begin(page, "Quick Math");
  const [a, op, b] = (await page.locator(".question").innerText()).split(" ");
  const answer =
    op === "+"
      ? +a + +b
      : op === "−"
        ? +a - +b
        : op === "×"
          ? +a * +b
          : +a / +b;
  await page.getByRole("textbox", { name: "Your answer" }).fill(String(answer));
  await page.getByRole("textbox", { name: "Your answer" }).press("Enter");
  await page.clock.runFor(61000);
  await expect(
    page.getByText("EXERCISE COMPLETE", { exact: true }),
  ).toBeVisible();
  const d = await exported(page);
  expect(d.sessions[0].correct).toBe(1);
  expect(d.sessions[0].score).toBeLessThanOrEqual(10);
});
test("Reaction Test: false start excluded from five valid measurements and result averages are accurate", async ({
  page,
}) => {
  await begin(page, "Reaction Test");
  await page.getByRole("button", { name: /Ready/ }).click();
  await page.getByRole("button", { name: /Wait/ }).click();
  await expect(page.getByRole("status")).toContainText("Too soon");
  for (let i = 0; i < 5; i++) {
    await page.getByRole("button", { name: /Ready/ }).click();
    await page.clock.runFor(4700);
    await page.clock.runFor(250);
    await page.keyboard.press("Space");
    await page.clock.runFor(800);
  }
  await expect(
    page.getByText("EXERCISE COMPLETE", { exact: true }),
  ).toBeVisible();
  const d = await exported(page),
    s = d.sessions[0],
    rounds = Array.from({ length: 5 }, (_, i) => s.metrics[`round${i + 1}Ms`]);
  expect(s.metrics.falseStarts).toBe(1);
  expect(rounds.every((t) => t >= 80)).toBe(true);
  expect(s.metrics.averageMs).toBeCloseTo(
    rounds.reduce((a, b) => a + b, 0) / 5,
    5,
  );
  expect(s.metrics.bestMs).toBe(Math.min(...rounds));
  expect(s.metrics.slowestMs).toBe(Math.max(...rounds));
  expect(s.attempts).toBe(6);
  expect(s.accuracy).toBeCloseTo((100 * 5) / 6);
  expect(d.sessions).toHaveLength(1);
});
test("Pattern Logic: independently solve all eight displayed puzzles and preserve exact results", async ({
  page,
}) => {
  await begin(page, "Pattern Logic");
  for (let i = 0; i < 8; i++) {
    const options = await page.locator(".answers button").allTextContents();
    const answer = solveLogic(
      await page.locator(".question").innerText(),
      options,
    );
    expect(options).toContain(answer);
    await page
      .locator(".answers button")
      .filter({ hasText: new RegExp(`^${answer}$`) })
      .click();
    await expect(page.getByRole("status")).toContainText("Correct");
    await page.clock.runFor(1150);
  }
  const d = await exported(page);
  expect(d.sessions[0].correct).toBe(8);
  expect(d.sessions[0].accuracy).toBe(100);
});
test("Focus Finder: all three grids, false selections, no duplicate tile rewards and persistence", async ({
  page,
}) => {
  await begin(page, "Focus Finder");
  for (let i = 0; i < 3; i++) {
    const wrong = page
      .locator(".focus button")
      .filter({ hasText: /^[RHNV]$/ })
      .first();
    await wrong.click();
    await expect(wrong).toBeDisabled();
    for (const target of await page
      .locator(".focus button")
      .filter({ hasText: /^A$/ })
      .all())
      await target.click();
    await page.clock.runFor(700);
  }
  await expect(
    page.getByText("EXERCISE COMPLETE", { exact: true }),
  ).toBeVisible();
  const d = await exported(page),
    s = d.sessions[0];
  expect(s.correct).toBe(18);
  expect(s.attempts).toBe(21);
  expect(s.metrics.falseSelections).toBe(3);
  expect(s.accuracy).toBeCloseTo((18 / 21) * 100);
});
test("tab interruption restart restarts the selected exercise without saving or awarding XP", async ({
  page,
}) => {
  await begin(page, "Memory Sequence");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(
    page.getByRole("heading", { name: "Session interrupted" }),
  ).toBeVisible();
  await page.evaluate(() =>
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    }),
  );
  await page.getByRole("button", { name: "Restart exercise" }).click();
  await expect(page.locator(".memory")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Watch closely" }),
  ).toBeVisible();
  const d = await exported(page);
  expect(d.sessions).toHaveLength(0);
});
