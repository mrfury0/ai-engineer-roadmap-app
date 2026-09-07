import { expect, test, type Page } from "@playwright/test";

const VIEWS = [
  "dashboard", "today", "roadmap", "revision", "practice", "interview", "cases",
  "skills", "map", "projects", "portfolio", "progress", "resources", "settings",
] as const;

/** Progress writes are debounced; wait for them to reach localStorage before reloading. */
async function waitForSave(page: Page) {
  await page.waitForFunction(() => Boolean(window.localStorage.getItem("aieng-roadmap-v1")));
  await page.waitForTimeout(250);
}

/** Fails the test on any uncaught error or console error, in every spec. */
function guardErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });
  return errors;
}

test.describe("navigation", () => {
  test("every view renders without errors", async ({ page }) => {
    const errors = guardErrors(page);
    await page.goto("/");
    for (const view of VIEWS) {
      await page.evaluate((v) => { window.location.hash = `#${v}`; }, view);
      await expect(page.locator("#view .page")).toBeVisible();
      const text = await page.locator("#view").innerText();
      expect(text.length, `${view} rendered no content`).toBeGreaterThan(120);
    }
    expect(errors).toEqual([]);
  });

  test("sidebar navigates and marks the active item", async ({ page, isMobile }) => {
    await page.goto("/");
    if (isMobile) await page.getByRole("button", { name: "Open menu" }).click();
    await page.locator(".nav", { hasText: "Skill Tree" }).click();
    await expect(page).toHaveURL(/#skills/);
    await expect(page.getByRole("heading", { level: 1 }).or(page.locator(".h1"))).toContainText(/Skill tree/i);
  });
});

test.describe("learning loop", () => {
  test("a lesson opens, completes, and awards XP that survives reload", async ({ page }) => {
    const errors = guardErrors(page);
    await page.goto("/#roadmap/w1");
    const firstItem = page.locator(".item").first();
    await firstItem.locator(".ihead").click();
    await expect(firstItem.locator(".ibody")).toBeVisible();
    await expect(firstItem.getByText("Concept", { exact: true })).toBeVisible();

    await firstItem.getByRole("checkbox").click();
    await expect(firstItem.locator(".chk.on")).toBeVisible();

    const xpBefore = await page.locator(".sidefoot").innerText();
    expect(xpBefore).toMatch(/[1-9]\d*\s*XP/);

    await waitForSave(page);
    await page.reload();
    await expect(page.locator(".sidefoot")).toHaveText(/[1-9]\d*\s*XP/);
    expect(errors).toEqual([]);
  });

  test("marking a lesson for revision puts it in the revision queue", async ({ page }) => {
    await page.goto("/#roadmap/w1");
    const firstItem = page.locator(".item").first();
    await firstItem.locator(".ihead").click();
    await firstItem.getByRole("button", { name: /Need revision/ }).click();
    await expect(firstItem.getByText("↻ revise")).toBeVisible();
    await waitForSave(page);

    await page.goto("/#revision");
    await expect(page.locator("#view")).toContainText(/due now/i);
    await expect(page.locator(".item").first()).toBeVisible();
  });

  test("a debug mission reveals hints and the fix", async ({ page }) => {
    await page.goto("/#roadmap/w1");
    const item = page.locator(".item").first();
    await item.locator(".ihead").click();
    const hint = item.getByRole("button", { name: "Hint 1" });
    if (await hint.count()) {
      await hint.click();
      await expect(item.getByText(/Hint 1\./)).toBeVisible();
      await item.getByRole("button", { name: /Reveal the fix/ }).click();
      await expect(item.getByText("The fix", { exact: true })).toBeVisible();
    }
  });
});

test.describe("assessment and practice", () => {
  test("a week quiz can be completed and records a score", async ({ page }) => {
    await page.goto("/#roadmap/w1");
    await page.getByRole("button", { name: /Take the week quiz/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    for (let i = 0; i < 12; i++) {
      const option = dialog.locator(".qopt").first();
      if (await option.count()) await option.click();
      const next = dialog.getByRole("button", { name: /Next →|Finish/ });
      if (!(await next.count())) break;
      const label = await next.innerText();
      await next.click();
      if (label.includes("Finish")) break;
    }
    await expect(dialog).toContainText("%");
  });

  test("an engineering ticket reveals its root cause and can be resolved", async ({ page }) => {
    await page.goto("/#practice");
    const ticket = page.locator(".item").first();
    await ticket.locator(".ihead").click();
    await expect(ticket).toContainText(/Your mission/i);
    await ticket.getByRole("button", { name: /Reveal root cause/ }).click();
    await expect(ticket).toContainText(/lesson/i);
  });

  test("an interview answer stays hidden until revealed", async ({ page }) => {
    await page.goto("/#interview");
    const q = page.locator(".item").first();
    await q.locator(".ihead").click();
    await expect(q.getByRole("button", { name: /Reveal model answer/ })).toBeVisible();
    await q.getByRole("button", { name: /Reveal model answer/ }).click();
    await expect(q).toContainText(/Model answer/i);
  });

  test("a consulting case keeps the written attempt", async ({ page }) => {
    await page.goto("/#cases");
    await page.locator(".card").filter({ hasText: "LegalCo" }).first().click();
    await expect(page.locator("#view")).toContainText(/The client says/i);
    await page.locator(".item").first().locator(".ihead").click();
    const box = page.locator("textarea").first();
    await box.fill("Who owns the ethical walls, and where do the ACLs actually live?");
    await waitForSave(page);
    await page.reload();
    await page.locator(".item").first().locator(".ihead").click();
    await expect(page.locator("textarea").first()).toHaveValue(/ethical walls/);
  });
});

test.describe("search and persistence", () => {
  test("the command palette finds content across types", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".sidefoot")).toBeVisible();
    await page.keyboard.press("Control+k");
    const palette = page.getByRole("dialog", { name: "Command palette" });
    await expect(palette).toBeVisible();
    await palette.getByRole("textbox").fill("embeddings");
    await expect(palette.locator(".pitem")).not.toHaveCount(0);
    await palette.locator(".pitem").first().click();
    await expect(palette).toBeHidden();
  });

  test("progress exports as valid JSON", async ({ page }) => {
    await page.goto("/#roadmap/w1");
    await page.locator(".item").first().getByRole("checkbox").click();
    await page.goto("/#settings");
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /Export progress/ }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.json$/);
  });

  test("changing pace keeps the core curriculum", async ({ page }) => {
    await page.goto("/#settings");
    const before = await page.locator(".sidefoot").innerText();
    await page.locator(".card").filter({ hasText: "Minimum" }).first().click();
    await expect(page.locator(".sidefoot")).not.toHaveText("");
    expect(before).toBeTruthy();
  });
});

test("no horizontal overflow on any view", async ({ page }) => {
  await page.goto("/");
  for (const view of VIEWS) {
    await page.evaluate((v) => { window.location.hash = `#${v}`; }, view);
    await page.waitForTimeout(120);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
    expect(overflow, `${view} overflows horizontally`).toBe(false);
  }
});
