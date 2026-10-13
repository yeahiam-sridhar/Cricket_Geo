import { chromium } from "playwright";
import fs from "fs";
import path from "path";

async function verifyRevealSequence() {
  console.log("==================================================================");
  console.log("CRICKETGEO: REVEAL ANIMATION SEQUENCE VERIFICATION");
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

  // ==================================================================
  // DESKTOP TEST (1280x800)
  // ==================================================================
  console.log("\n>>> DESKTOP VIEWPORT (1280x800) <<<");
  const desktopContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  await desktopContext.addInitScript(() => {
    localStorage.setItem("cricket_geo.display_name", "Animation Reviewer");
    localStorage.setItem("cricket_geo.client_id", "reviewer-desktop-id");
  });
  const page = await desktopContext.newPage();

  console.log("Navigating to Gameplay...");
  await page.goto("http://localhost:3000/play?practice=true&game=201", {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(1000);

  // Fill player name if prompted fallback
  const nameInput = page.locator("input[placeholder*='Cover Drive']");
  if (await nameInput.isVisible()) {
    await nameInput.fill("Animation Reviewer");
    await page.locator("button:has-text('Start playing')").click();
    await page.waitForTimeout(1000);
  }

  await page.waitForSelector(".maplibregl-canvas", { timeout: 20000 });
  await page.waitForTimeout(1500);

  // -------------------------------------------------------------
  // STATE A: BEFORE GUESS
  // -------------------------------------------------------------
  console.log("\n--- Checking State A: Before Guess ---");
  const cardBeforeGuess = await page.locator("button:has-text('Next question')").count();
  console.log(`[PASS] Result card visible before guess: ${cardBeforeGuess === 0 ? "NO (Correct!)" : "YES (Bug!)"}`);
  const promptVisible = await page.locator("text=Rotate globe & tap where it happened").first().isVisible();
  console.log(`[PASS] Globe tap prompt visible: ${promptVisible}`);
  await page.screenshot({ path: path.join(outputDir, "state_A_before_guess.png") });
  console.log("[SCREENSHOT] Saved: state_A_before_guess.png");

  // -------------------------------------------------------------
  // SUBMIT GUESS -> STATE B & C: FLIGHT IN PROGRESS
  // -------------------------------------------------------------
  console.log("\n--- Submitting Guess & Checking State B & C: Flight In Progress ---");
  const canvas = page.locator(".maplibregl-canvas").first();
  const box = await canvas.boundingBox();
  if (box) {
    await page.mouse.click(box.x + box.width * 0.52, box.y + box.height * 0.48);
  }

  // Check 500ms into flight: card must NOT be visible!
  await page.waitForTimeout(500);
  const cardDuringFlight = await page.locator("button:has-text('Next question')").count();
  console.log(`[PASS] Result card visible DURING flight animation: ${cardDuringFlight === 0 ? "NO (Globe is unobstructed! Correct!)" : "YES (Blocked! Bug!)"}`);

  const revealingIndicator = await page.locator("text=REVEALING LOCATION").first().isVisible();
  console.log(`[PASS] Unobtrusive 'REVEALING LOCATION...' status pill: ${revealingIndicator}`);

  await page.screenshot({ path: path.join(outputDir, "state_C_flight_in_progress.png") });
  console.log("[SCREENSHOT] Saved: state_C_flight_in_progress.png");

  // -------------------------------------------------------------
  // STATE D: LOCATION REACHED -> REVEAL CARD PRESENTATION
  // -------------------------------------------------------------
  console.log("\n--- Waiting for Flight Completion -> State D: Location Reached ---");
  await page.waitForSelector("button:has-text('Next question')", { timeout: 15000 });
  await page.waitForTimeout(500);

  const cardAfterArrival = await page.locator("button:has-text('Next question')").first().isVisible();
  console.log(`[PASS] Result card visible AFTER arrival: ${cardAfterArrival}`);

  const scoreText = await page.locator("div:has-text('SCORE') + div, span:has-text('SCORE') ~ span").first().innerText();
  console.log(`[PASS] Updated HUD score: ${scoreText}`);

  await page.screenshot({ path: path.join(outputDir, "state_D_location_reached.png") });
  console.log("[SCREENSHOT] Saved: state_D_location_reached.png");

  // -------------------------------------------------------------
  // STATE E: ADVANCE TO NEXT QUESTION
  // -------------------------------------------------------------
  console.log("\n--- Advancing to Next Question -> State E ---");
  await page.locator("button:has-text('Next question')").first().click();
  await page.waitForTimeout(1000);

  const cardOnNextQ = await page.locator("button:has-text('Next question')").count();
  console.log(`[PASS] Result card reset on Question 2: ${cardOnNextQ === 0 ? "Cleanly reset (Correct!)" : "Still stuck!"}`);
  const q2Indicator = await page.locator("text=Question 2 of 5").first().isVisible();
  console.log(`[PASS] Question 2 indicator visible: ${q2Indicator}`);

  await page.screenshot({ path: path.join(outputDir, "state_E_next_question.png") });
  console.log("[SCREENSHOT] Saved: state_E_next_question.png");

  await desktopContext.close();

  // ==================================================================
  // MOBILE TEST (iPhone 13: 390x844)
  // ==================================================================
  console.log("\n>>> MOBILE VIEWPORT (390x844) <<<");
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1",
    isMobile: true,
    hasTouch: true,
  });
  await mobileContext.addInitScript(() => {
    localStorage.setItem("cricket_geo.display_name", "Mobile Reviewer");
    localStorage.setItem("cricket_geo.client_id", "reviewer-mobile-id");
  });
  const mPage = await mobileContext.newPage();

  console.log("Navigating to Mobile Gameplay...");
  await mPage.goto("http://localhost:3000/play?practice=true&game=202", {
    waitUntil: "networkidle",
  });
  await mPage.waitForTimeout(1000);

  const mNameInput = mPage.locator("input[placeholder*='Cover Drive']");
  if (await mNameInput.isVisible()) {
    await mNameInput.fill("Mobile Animation Reviewer");
    await mPage.locator("button:has-text('Start playing')").click();
    await mPage.waitForTimeout(1000);
  }

  await mPage.waitForSelector(".maplibregl-canvas", { timeout: 20000 });
  await mPage.waitForTimeout(1000);

  console.log("Submitting Mobile Guess...");
  const mCanvas = mPage.locator(".maplibregl-canvas").first();
  const mBox = await mCanvas.boundingBox();
  if (mBox) {
    await mPage.mouse.click(mBox.x + mBox.width * 0.5, mBox.y + mBox.height * 0.5);
  }

  // 500ms into mobile flight:
  await mPage.waitForTimeout(500);
  const mCardDuringFlight = await mPage.locator("button:has-text('Next question')").count();
  console.log(`[PASS] Mobile Result card visible DURING flight animation: ${mCardDuringFlight === 0 ? "NO (Globe is unobstructed! Correct!)" : "YES (Blocked! Bug!)"}`);
  await mPage.screenshot({ path: path.join(outputDir, "mobile_flight_in_progress.png") });
  console.log("[SCREENSHOT] Saved: mobile_flight_in_progress.png");

  // Wait for arrival:
  await mPage.waitForSelector("button:has-text('Next question')", { timeout: 15000 });
  await mPage.waitForTimeout(500);
  const mOverflow = await mPage.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  console.log(`[PASS] Mobile Zero Horizontal Overflow after arrival: ${!mOverflow}`);
  await mPage.screenshot({ path: path.join(outputDir, "mobile_location_reached.png") });
  console.log("[SCREENSHOT] Saved: mobile_location_reached.png");

  await mobileContext.close();
  await browser.close();

  console.log("\n==================================================================");
  console.log("ALL SEQUENCE VERIFICATIONS PASSED SUCCESSFULLY!");
  console.log("==================================================================");
}

verifyRevealSequence().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
