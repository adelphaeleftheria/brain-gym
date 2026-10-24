import { test, expect } from "@playwright/test";
import { ready, begin, exported, solveLogic } from "./helpers";
import { gameScore } from "../src/domain/engine";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    let state = 9453;
    Math.random = () =>
      (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296;
  });
  await page.clock.install();
  await ready(page);
});
test("Number Memory: exact digits, progressive length, correct span and durable history", async ({
  page,
}) => {
  await begin(page, "Number Memory");
  for (let i = 0; i < 5; i++) {
    const number = await page.locator(".question").innerText();
    expect(number.length).toBe(4 + i);
    await page.clock.runFor(2000);
    const input = page.getByRole("textbox", { name: "Remembered number" });
    await expect(input).toBeFocused();
    await input.fill(number);
    await input.press("Enter");
    await page.clock.runFor(950);
  }
  const d = await exported(page);
  expect(d.sessions[0].metrics.digits).toBe(8);
  expect(d.sessions[0].correct).toBe(5);
  expect(d.sessions[0].accuracy).toBe(100);
  expect(d.sessions[0].metrics.averageResponseMs).toBeGreaterThanOrEqual(0);
  await page.reload();
  await page.getByRole("link", { name: "History", exact: true }).click();
  await expect(page.locator(".session-row")).toHaveCount(1);
});
test("Number Memory: failing the first round reports zero recalled digits", async ({
  page,
}) => {
  await begin(page, "Number Memory");
  await page.clock.runFor(2000);
  await page.getByRole("textbox", { name: "Remembered number" }).fill("wrong");
  await page.getByRole("button", { name: "Check answer" }).click();
  await page.clock.runFor(950);
  const d = await exported(page);
  expect(d.sessions[0].metrics.digits).toBe(0);
  expect(d.sessions[0].score).toBe(0);
});
test("Word Scramble: hint, skip, incorrect answer, numeric attempts and hint penalty", async ({
  page,
}) => {
  await begin(page, "Word Scramble");
  const words = [
    "garden",
    "planet",
    "window",
    "silver",
    "bridge",
    "forest",
    "puzzle",
    "candle",
    "orange",
    "pocket",
    "winter",
    "stream",
    "velvet",
    "anchor",
    "bright",
    "marble",
  ];
  for (let i = 0; i < 8; i++) {
    if (i === 0) {
      await page.getByRole("button", { name: "Hint", exact: true }).click();
      await expect(page.getByRole("button", { name: /Hint/ })).toBeDisabled();
    }
    if (i === 1) await page.getByRole("button", { name: "Skip word" }).click();
    else {
      const scrambled = await page.locator(".question").innerText(),
        word = words.find(
          (w) => [...w].sort().join("") === [...scrambled].sort().join(""),
        );
      expect(word).toBeTruthy();
      await page
        .getByRole("textbox", { name: "Your answer" })
        .fill(i === 2 ? "notaword" : word!);
      await page.getByRole("textbox", { name: "Your answer" }).press("Enter");
    }
    await page.clock.runFor(1150);
  }
  const s = (await exported(page)).sessions[0];
  expect(s.attempts).toBe(8);
  expect(s.correct).toBe(6);
  expect(s.accuracy).toBe(75);
  expect(s.metrics.hintsUsed).toBe(1);
  expect(s.score).toBe(
    Math.max(0, gameScore("words", "Normal", 6, 8, s.duration / 1000) - 5),
  );
});
test("Spatial Rotation: independently transform each visible shape and identify all eight correct options", async ({
  page,
}) => {
  await begin(page, "Spatial Rotation", "Hard");
  for (let i = 0; i < 8; i++) {
    const source = await page
      .locator(".play>.shape i")
      .evaluateAll((cells) =>
        cells.map((c) => (c.classList.contains("filled") ? 1 : 0)),
      );
    const turns =
      Number((await page.locator(".question").innerText()).match(/\d+/)?.[0]) /
      90;
    let shape = source;
    for (let turn = 0; turn < turns; turn++) {
      const target = Array(9).fill(0);
      shape.forEach((v, index) => {
        const x = index % 3,
          y = Math.floor(index / 3);
        target[x * 3 + 2 - y] = v;
      });
      shape = target;
    }
    const buttons = page.locator(".answers button"),
      options = await buttons.evaluateAll((items) =>
        items.map((item) =>
          [...item.querySelectorAll("i")].map((c) =>
            c.classList.contains("filled") ? 1 : 0,
          ),
        ),
      );
    const matches = options
      .map((s, index) => (s.join("") === shape.join("") ? index : -1))
      .filter((n) => n >= 0);
    expect(matches).toHaveLength(1);
    await buttons.nth(matches[0]).click();
    await expect(page.getByRole("status")).toContainText("Correct");
    await page.clock.runFor(1150);
  }
  const s = (await exported(page)).sessions[0];
  expect(s.correct).toBe(8);
  expect(s.accuracy).toBe(100);
  expect(s.difficulty).toBe("Hard");
});
test("N-Back: warmups do not count as errors and sixteen real comparisons use only memory", async ({
  page,
}) => {
  await begin(page, "N-Back Lite", "Hard");
  const letters: string[] = [];
  for (let i = 0; i < 18; i++) {
    const letter = await page.locator(".question").innerText();
    const answer =
      i < 2 ? "Match" : letter === letters[i - 2] ? "Match" : "Different";
    letters.push(letter);
    if (i >= 2)
      await expect(page.locator(".play .eyebrow")).toHaveText(
        "2-BACK · Compare from memory",
      );
    await page.getByRole("button", { name: answer, exact: true }).click();
    await page.clock.runFor(1150);
  }
  const s = (await exported(page)).sessions[0];
  expect(s.correct).toBe(16);
  expect(s.attempts).toBe(16);
  expect(s.metrics.missedMatches).toBe(0);
  expect(s.metrics.falseAlarms).toBe(0);
  expect(s.metrics.longestCorrectStreak).toBe(16);
});
test("Color & Word: hard mode is incongruent and scores the ink rather than the word", async ({
  page,
}) => {
  await begin(page, "Color & Word", "Hard");
  for (let i = 0; i < 12; i++) {
    const text = await page.locator(".question").innerText(),
      label = await page.locator(".question").getAttribute("aria-label"),
      ink = label!.split("ink color ")[1];
    expect(ink).not.toBe(text);
    await page.getByRole("button", { name: ink, exact: true }).click();
    await page.clock.runFor(1150);
  }
  const s = (await exported(page)).sessions[0];
  expect(s.correct).toBe(12);
  expect(s.accuracy).toBe(100);
});
test("Sequence Builder: solve eight hard sequences and retain history", async ({
  page,
}) => {
  await begin(page, "Sequence Builder", "Hard");
  for (let i = 0; i < 8; i++) {
    const options = await page.locator(".answers button").allTextContents(),
      answer = solveLogic(await page.locator(".question").innerText(), options);
    await page
      .locator(".answers button")
      .filter({ hasText: new RegExp(`^${answer}$`) })
      .click();
    await expect(page.getByRole("status")).toContainText("Correct");
    await page.clock.runFor(1150);
  }
  const s = (await exported(page)).sessions[0];
  expect(s.correct).toBe(8);
  expect(s.accuracy).toBe(100);
});
test("demo gameplay and a pending demo preference write never change the real workspace", async ({
  page,
}) => {
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await page.getByLabel("Display name").fill("Real Person");
  await page.getByRole("button", { name: "Explore sample workspace" }).click();
  await begin(page, "Number Memory");
  await page.clock.runFor(2000);
  await page.getByRole("textbox", { name: "Remembered number" }).fill("wrong");
  await page.getByRole("button", { name: "Check answer" }).click();
  await page.clock.runFor(950);
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await page.getByLabel("Display name").fill("Sample Person");
  await page.getByRole("button", { name: "Exit demo →" }).click();
  const d = await exported(page);
  expect(d.profile.name).toBe("Real Person");
  expect(d.sessions).toHaveLength(0);
  await page.reload();
  await expect(page.getByLabel("Display name")).toHaveValue("Real Person");
});
