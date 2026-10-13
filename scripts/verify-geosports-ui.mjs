import { chromium } from "playwright";
import fs from "fs";
import path from "path";

async function verifyGeoSportsUI() {
  console.log("==================================================================");
  console.log("CRICKETGEO: GEOSPORTS-INSPIRED UI VISUAL VERIFICATION & REGRESSION");
  console.log("==================================================================");

  const outputDir = path.resolve("data/verification_evidence");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const browser = await chromium.launch({
    channel: "msedge",
    headless: true,
    args: ["--autoplay-policy=no-user-gesture-required"],
  });

  const consoleErrors = [];

  // ==================================================================
  // DESKTOP RUN (1280 x 800)
  // ==================================================================
  console.log("\n>>> [1/2] DESKTOP VIEWPORT (1280x800) <<<");
  const desktopContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const desktopPage = await desktopContext.newPage();
  desktopPage.on("console", (msg) => {
    if (msg.type() === "error" && !msg.text().includes("favicon")) {
      consoleErrors.push(`[Desktop Console Error] ${msg.text()}`);
    }
  });

  // 1. Homepage Desktop
  console.log("Navigating to Homepage...");
  await desktopPage.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await desktopPage.waitForTimeout(1000);
  await desktopPage.screenshot({
    path: path.join(outputDir, "cricketgeo_desktop_home.png"),
    fullPage: true,
  });
  console.log("[SCREENSHOT] Saved: cricketgeo_desktop_home.png");

  // Test "How scoring works" modal on Desktop
  const scoringLink = desktopPage.locator("button:has-text('How scoring works')");
  if (await scoringLink.isVisible()) {
    await scoringLink.click();
    await desktopPage.waitForTimeout(500);
    await desktopPage.screenshot({
      path: path.join(outputDir, "cricketgeo_desktop_scoring_modal.png"),
    });
    console.log("[SCREENSHOT] Saved: cricketgeo_desktop_scoring_modal.png");
    const closeBtn = desktopPage.locator("button:has-text('Close')");
    await closeBtn.click();
    await desktopPage.waitForTimeout(500);
  }

  // 2. Gameplay Desktop
  console.log("Navigating to Gameplay (Practice round)...");
  await desktopPage.goto("http://localhost:3000/play?practice=true&game=101", {
    waitUntil: "networkidle",
  });
  await desktopPage.waitForTimeout(1000);

  // Fill player name if prompted
  const nameInput = desktopPage.locator("input[placeholder*='Cover Drive']");
  if (await nameInput.isVisible()) {
    await nameInput.fill("GeoSports Reviewer");
    await desktopPage.locator("button:has-text('Start playing')").click();
    await desktopPage.waitForTimeout(1000);
  }

  await desktopPage.waitForSelector(".maplibregl-canvas", { timeout: 15000 });
  await desktopPage.waitForTimeout(1500);

  await desktopPage.screenshot({
    path: path.join(outputDir, "cricketgeo_desktop_gameplay.png"),
  });
  console.log("[SCREENSHOT] Saved: cricketgeo_desktop_gameplay.png");

  // Guess on Question 1
  console.log("Submitting guess on Question 1...");
  const canvas = desktopPage.locator(".maplibregl-canvas").first();
  const box = await canvas.boundingBox();
  if (box) {
    await desktopPage.mouse.click(box.x + box.width * 0.52, box.y + box.height * 0.48);
  }

  // Wait for RevealCard
  await desktopPage.waitForSelector("button:has-text('Next question')", { timeout: 15000 });
  await desktopPage.waitForTimeout(1000);

  await desktopPage.screenshot({
    path: path.join(outputDir, "cricketgeo_desktop_reveal.png"),
  });
  console.log("[SCREENSHOT] Saved: cricketgeo_desktop_reveal.png");

  // Advance through remaining questions to reach results
  for (let q = 2; q <= 5; q++) {
    console.log(`Advancing to Question ${q}...`);
    const nextBtn = desktopPage.locator("button:has-text('Next question')").first();
    await nextBtn.click();
    await desktopPage.waitForTimeout(1200);

    const qBox = await canvas.boundingBox();
    if (qBox) {
      await desktopPage.mouse.click(qBox.x + qBox.width * 0.48, qBox.y + qBox.height * 0.52);
    }
    await desktopPage.waitForTimeout(1200);
  }

  // Final question -> See match results
  const resultsBtn = desktopPage.locator("button:has-text('See match results')").first();
  if (await resultsBtn.isVisible()) {
    console.log("Clicking 'See match results'...");
    await resultsBtn.click();
    await desktopPage.waitForTimeout(2000);
  }

  await desktopPage.screenshot({
    path: path.join(outputDir, "cricketgeo_desktop_results.png"),
    fullPage: true,
  });
  console.log("[SCREENSHOT] Saved: cricketgeo_desktop_results.png");

  // 3. Leaderboard Desktop
  console.log("Navigating to Leaderboard...");
  await desktopPage.goto("http://localhost:3000/leaderboard", {
    waitUntil: "networkidle",
  });
  await desktopPage.waitForTimeout(1000);

  await desktopPage.screenshot({
    path: path.join(outputDir, "cricketgeo_desktop_leaderboard.png"),
    fullPage: true,
  });
  console.log("[SCREENSHOT] Saved: cricketgeo_desktop_leaderboard.png");

  await desktopContext.close();

  // ==================================================================
  // MOBILE RUN (iPhone 13: 390 x 844)
  // ==================================================================
  console.log("\n>>> [2/2] MOBILE VIEWPORT (390x844) <<<");
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1",
    isMobile: true,
    hasTouch: true,
  });

  const mobilePage = await mobileContext.newPage();
  mobilePage.on("console", (msg) => {
    if (msg.type() === "error" && !msg.text().includes("favicon")) {
      consoleErrors.push(`[Mobile Console Error] ${msg.text()}`);
    }
  });

  // Helper to check horizontal overflow
  const checkOverflow = async (pageName) => {
    const overflow = await mobilePage.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    console.log(`[Mobile Overflow Check] ${pageName}: ${overflow ? "FAILED (Horizontal Scroll detected)" : "PASSED (Zero Overflow)"}`);
  };

  // 1. Homepage Mobile
  console.log("Mobile Homepage...");
  await mobilePage.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await mobilePage.waitForTimeout(1000);
  await checkOverflow("Homepage");
  await mobilePage.screenshot({
    path: path.join(outputDir, "cricketgeo_mobile_home.png"),
    fullPage: true,
  });
  console.log("[SCREENSHOT] Saved: cricketgeo_mobile_home.png");

  // 2. Gameplay Mobile
  console.log("Mobile Gameplay...");
  await mobilePage.goto("http://localhost:3000/play?practice=true&game=102", {
    waitUntil: "networkidle",
  });
  await mobilePage.waitForTimeout(1500);

  // Fill player name if prompted on mobile
  const mNameInput = mobilePage.locator("input[placeholder*='Cover Drive']");
  if (await mNameInput.isVisible()) {
    console.log("Entering player name in mobile modal...");
    await mNameInput.fill("Mobile Reviewer");
    await mobilePage.locator("button:has-text('Start playing')").click();
    await mobilePage.waitForTimeout(1000);
  }

  await mobilePage.waitForSelector(".maplibregl-canvas", { timeout: 15000 });
  await checkOverflow("Gameplay");
  await mobilePage.screenshot({
    path: path.join(outputDir, "cricketgeo_mobile_gameplay.png"),
  });
  console.log("[SCREENSHOT] Saved: cricketgeo_mobile_gameplay.png");

  // Mobile Guess & Reveal
  console.log("Mobile Guess & Reveal...");
  const mCanvas = mobilePage.locator(".maplibregl-canvas").first();
  const mBox = await mCanvas.boundingBox();
  if (mBox) {
    await mobilePage.mouse.click(mBox.x + mBox.width * 0.5, mBox.y + mBox.height * 0.5);
  }
  await mobilePage.waitForSelector("button:has-text('Next question')", { timeout: 15000 });
  await mobilePage.waitForTimeout(1000);
  await checkOverflow("Reveal");
  await mobilePage.screenshot({
    path: path.join(outputDir, "cricketgeo_mobile_reveal.png"),
  });
  console.log("[SCREENSHOT] Saved: cricketgeo_mobile_reveal.png");

  // 3. Mobile Leaderboard
  console.log("Mobile Leaderboard...");
  await mobilePage.goto("http://localhost:3000/leaderboard", {
    waitUntil: "networkidle",
  });
  await mobilePage.waitForTimeout(1000);
  await checkOverflow("Leaderboard");
  await mobilePage.screenshot({
    path: path.join(outputDir, "cricketgeo_mobile_leaderboard.png"),
    fullPage: true,
  });
  console.log("[SCREENSHOT] Saved: cricketgeo_mobile_leaderboard.png");

  await mobileContext.close();
  await browser.close();

  console.log("\n==================================================================");
  console.log(`VERIFICATION SUMMARY:`);
  console.log(`Console Errors: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    consoleErrors.forEach((e) => console.log(`  - ${e}`));
  }
  console.log("All screenshots saved successfully in data/verification_evidence/");
  console.log("==================================================================");
}

verifyGeoSportsUI().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
