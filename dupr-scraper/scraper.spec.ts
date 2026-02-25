import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

chromium.use(StealthPlugin());

async function getPlayerRating(playerName: string) {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto("https://dashboard.dupr.com/dashboard/browse/players", {
      waitUntil: "networkidle",
    });

    // 1. Locate the Search Input
    // DUPR typically uses a placeholder like "Search by Name..."
    const searchSelector = 'input[placeholder*="Search"]';
    await page.waitForSelector(searchSelector);

    // 2. Human-like Typing
    // We click first, wait a beat, then type with a random delay per key
    await page.click(searchSelector);
    await page.waitForTimeout(Math.random() * 500 + 200);

    console.log(`Searching for: ${playerName}`);
    await page.type(searchSelector, playerName, {
      delay: Math.random() * 100 + 50,
    });

    // 3. Wait for the table to filter (Network & UI check)
    // We wait for the "Searching..." state to finish or the row to update
    await page.waitForTimeout(2000);

    // 4. Extract the top result
    const playerStats = await page.evaluate((targetName) => {
      const rows = Array.from(document.querySelectorAll("tr"));
      // Find the row that contains our player's name
      const targetRow = rows.find((row) =>
        row.textContent?.toLowerCase().includes(targetName.toLowerCase()),
      );

      if (!targetRow) return null;

      const cells = targetRow.querySelectorAll("td");
      return {
        name: cells[0]?.textContent?.trim(),
        doublesRating: cells[2]?.textContent?.trim(),
        singlesRating: cells[3]?.textContent?.trim(),
      };
    }, playerName);

    if (playerStats) {
      console.log(`✅ Found: ${playerStats.name}`);
      console.log(`🎾 Doubles DUPR: ${playerStats.doublesRating}`);
    } else {
      console.log(`❌ No player found matching "${playerName}"`);
    }
  } catch (error) {
    console.error("Search failed:", error);
  } finally {
    await browser.close();
  }
}

// Example usage:
getPlayerRating("Ben Johns");
