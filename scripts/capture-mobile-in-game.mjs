import { chromium } from "playwright";
import path from "path";

async function captureMobileInGame() {
  const browser = await chromium.launch({
    channel: "msedge",
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });

  const page = await context.newPage();
  await page.goto("http://localhost:3000/play?practice=true", { waitUntil: "networkidle" });

  const nameInput = page.locator("input[placeholder*='Cover Drive']");
  if (await nameInput.isVisible()) {
    await nameInput.fill("Mobile Striker");
    const startBtn = page.locator("button:has-text('Start playing')");
    await startBtn.click();
    await page.waitForTimeout(1500);
  }

  await page.waitForSelector(".maplibregl-canvas", { timeout: 8000 });
  await page.waitForTimeout(1000);

  const outputDir = path.resolve("data/verification_evidence");
  await page.screenshot({ path: path.join(outputDir, "05_mobile_gameplay_active.png") });
  console.log("Saved: 05_mobile_gameplay_active.png");

  // Place guess to capture mobile reveal
  const gameMapCanvas = page.locator(".maplibregl-canvas").first();
  const box = await gameMapCanvas.boundingBox();
  if (box) {
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.45);
    await page.waitForSelector(".cricket-distance-badge, .cricket-answer-marker", { timeout: 8000 });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(outputDir, "06_mobile_reveal_active.png") });
    console.log("Saved: 06_mobile_reveal_active.png");
  }

  await browser.close();
}

captureMobileInGame().catch((e) => {
  console.error(e);
  process.exit(1);
});
