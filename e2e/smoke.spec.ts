import { expect, test } from "@playwright/test";

test("home page renders protected shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("top-tab-chat")).toBeVisible();
  await expect(page.getByTestId("chat-shell")).toBeVisible();
});
