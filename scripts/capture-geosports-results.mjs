import { chromium } from "playwright";
import fs from "fs";
import path from "path";

async function captureGeoSportsReference() {
  console.log("=== Capturing GeoSports Exact Reference UI Screens ===");

  const evidenceDir = path.join(process.cwd(), "data", "geosports_reference_ui");
  if (!fs.existsSync(evidenceDir)) {
    fs.mkdirSync(evidenceDir, { recursive: true });
  }

  const browser = await chromium.launch({
    channel: "msedge",
    headless: true,
  });

  // 1. Desktop Context (1280x800)
  const desktopCtx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await desktopCtx.newPage();

  console.log("1. Visiting Homepage...");
  await page.goto("https://geosports.app/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(evidenceDir, "ref_01_homepage_desktop.png") });

  // Click hamburger menu to capture menu drawer
  const menuBtn = page.locator("button.p-2, button:has-text('Menu'), button").first();
  if (await menuBtn.isVisible()) {
    console.log("Opening Menu...");
    await menuBtn.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(evidenceDir, "ref_02_menu_drawer_desktop.png") });
    // Close menu
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
  }

  // 2. Play page
  console.log("2. Navigating to Play page...");
  const playBtn = page.locator("a:has-text('Play today'), button:has-text('Play today')").first();
  if (await playBtn.isVisible()) {
    await playBtn.click();
  } else {
    await page.goto("https://geosports.app/play", { waitUntil: "networkidle" });
  }
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(evidenceDir, "ref_03_gameplay_q1.png") });

  // Play through questions to reach final match results screen
  for (let q = 1; q <= 5; q++) {
    console.log(`Answering Question ${q}...`);
    // Click globe canvas to place a guess
    const canvas = page.locator("canvas").first();
    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.45);
      await page.waitForTimeout(2500); // wait for camera & reveal
    }

    if (q < 5) {
      const nextBtn = page.locator("button:has-text('Next question')").first();
      if (await nextBtn.isVisible()) {
        await nextBtn.click();
        await page.waitForTimeout(1500);
      }
    } else {
      // Question 5 - click final button
      const finalBtn = page.locator("button:has-text('Next question'), button:has-text('results'), button:has-text('Finish')").first();
      if (await finalBtn.isVisible()) {
        await finalBtn.click();
        await page.waitForTimeout(3000);
      }
    }
  }

  // Capture final results screen
  await page.screenshot({ path: path.join(evidenceDir, "ref_04_final_results_desktop.png") });
  console.log("Saved: ref_04_final_results_desktop.png");

  // 3. Mobile Context (390x844 - iPhone 13)
  console.log("3. Capturing Mobile Homepage & Gameplay...");
  const mobileCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const mobilePage = await mobileCtx.newPage();

  await mobilePage.goto("https://geosports.app/", { waitUntil: "networkidle" });
  await mobilePage.waitForTimeout(1000);
  await mobilePage.screenshot({ path: path.join(evidenceDir, "ref_05_homepage_mobile.png") });

  await mobilePage.goto("https://geosports.app/play", { waitUntil: "networkidle" });
  await mobilePage.waitForTimeout(2000);
  await mobilePage.screenshot({ path: path.join(evidenceDir, "ref_06_gameplay_mobile.png") });

  await browser.close();
  console.log("=== Done capturing reference UI screens! ===");
}

captureGeoSportsReference().catch((e) => {
  console.error(e);
  process.exit(1);
});
