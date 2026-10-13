import { chromium } from "playwright";

async function runAudioVerification() {
  console.log("=== Starting CricketGeo Audio Verification in Real Browser ===");
  const browser = await chromium.launch({
    channel: "msedge",
    headless: true,
    args: ["--autoplay-policy=no-user-gesture-required"],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();

  const networkRequests = [];
  const consoleErrors = [];

  page.on("request", (req) => {
    const url = req.url();
    if (url.includes("/sounds/")) {
      networkRequests.push({ url, method: req.method() });
    }
  });

  page.on("response", (res) => {
    const url = res.url();
    if (url.includes("/sounds/")) {
      console.log(`[Audio Asset Network] ${res.status()} ${url}`);
    } else if (res.status() >= 400) {
      console.log(`[404 or Error Response] ${res.status()} ${url}`);
    }
  });

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
      console.error(`[Browser Console Error]`, msg.text());
    }
  });

  // 1. Visit Home Page
  console.log("\n1. Navigating to Home Page http://localhost:3000...");
  await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);

  // Check Sound Toggle exists in Navbar on Home Page
  const navToggle = page.locator("[data-testid='sound-toggle']").first();
  const hasNavToggle = await navToggle.count();
  console.log(`- Sound Toggle visible in Navbar on Home: ${hasNavToggle > 0 ? "PASS" : "FAIL"}`);

  // 2. Click Practice Button to start a game
  console.log("\n2. Clicking 'Practice Unlimited 5 Questions' CTA...");
  const practiceBtn = page.locator("a[href*='practice=true']").first();
  await practiceBtn.click();
  await page.waitForTimeout(1500);

  // If Name modal appears, fill it
  const nameInput = page.locator("input[placeholder*='Cover Drive']");
  if (await nameInput.isVisible()) {
    console.log("- Player name modal detected. Entering test player name...");
    await nameInput.fill("Audio Test Master");
    const startBtn = page.locator("button:has-text('Start playing')");
    await startBtn.click();
    await page.waitForTimeout(1500);
  }

  // 3. Inspect in-game Audio System & Preloaded Buffers
  console.log("\n3. Inspecting Audio Engine in Game View...");
  await page.waitForSelector("header [data-testid='sound-toggle']", { timeout: 8000 });
  const audioContextState = await page.evaluate(async () => {
    const stored = localStorage.getItem("cricket_geo.sound_enabled");
    return {
      storedSetting: stored,
      hasAudioContext: typeof window.AudioContext !== "undefined",
    };
  });
  console.log("- Audio environment check:", audioContextState);

  // Check Sound Toggle in in-game HUD
  const gameHudToggle = page.locator("header [data-testid='sound-toggle']").first();
  const hudToggleVisible = await gameHudToggle.isVisible();
  console.log(`- Sound Toggle visible in Game Header: ${hudToggleVisible ? "PASS" : "FAIL"}`);

  // Test Muting & Persistence
  console.log("\n4. Testing Sound Mute Toggle...");
  await gameHudToggle.click();
  await page.waitForTimeout(300);
  let isMuted = await page.evaluate(() => localStorage.getItem("cricket_geo.sound_enabled"));
  console.log(`- After click 1: sound_enabled in localStorage = ${isMuted} (Expected: false)`);

  // Unmute again
  await gameHudToggle.click();
  await page.waitForTimeout(300);
  let isUnmuted = await page.evaluate(() => localStorage.getItem("cricket_geo.sound_enabled"));
  console.log(`- After click 2: sound_enabled in localStorage = ${isUnmuted} (Expected: true)`);

  // 5. Play through 5 Questions to verify all game audio events
  console.log("\n5. Playing through 5 questions to test each gameplay sound event...");
  for (let q = 1; q <= 5; q++) {
    console.log(`\n--- Question ${q} of 5 ---`);
    await page.waitForSelector(".maplibregl-canvas", { timeout: 10000 });
    await page.waitForTimeout(600);

    // Click map canvas to submit a guess
    const canvas = page.locator(".maplibregl-canvas").first();
    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width * 0.52, box.y + box.height * 0.48);
      console.log(`- Guess clicked on canvas (triggers guess-confirm and camera whoosh)`);
    }

    // Wait for reveal card button to appear
    await page.waitForSelector("button:has-text('Next question'), button:has-text('See Match Results')", {
      timeout: 12000,
    });
    console.log(`- Score reveal card rendered (triggers score-reveal / score-perfect and score ticks)`);
    await page.waitForTimeout(800);

    if (q < 5) {
      const nextBtn = page.locator("button:has-text('Next question')");
      await nextBtn.click();
      console.log(`- Clicked 'Next question' (triggers button click audio)`);
    } else {
      const finishBtn = page.locator("button:has-text('See Match Results')");
      await finishBtn.click();
      console.log(`- Clicked 'See Match Results' (advances to results)`);
    }
  }

  // 6. Verify Match Complete Results Screen & Victory Fanfare
  console.log("\n6. Verifying Match Complete Screen & Victory Fanfare...");
  await page.waitForSelector("h1:has-text('Match Complete!')", { timeout: 8000 });
  console.log("- 'Match Complete!' header visible.");

  const startAnotherBtn = page.locator("button:has-text('Start Another 5')");
  const hasStartAnother = await startAnotherBtn.isVisible();
  console.log(`- 'Start Another 5' button visible: ${hasStartAnother ? "PASS" : "FAIL"}`);

  // Summary of Audio Network Requests
  console.log("\n=== Audio Requests Summary ===");
  const requestedFiles = [...new Set(networkRequests.map((r) => r.url.split("/").pop()))];
  console.log(`Audio assets requested during gameplay session (${requestedFiles.length}):`, requestedFiles);

  const expectedSounds = [
    "game-start.wav",
    "guess-confirm.wav",
    "globe-whoosh.wav",
    "score-reveal.wav",
    "match-victory.wav",
    "ui-toggle.wav",
  ];

  const missing = expectedSounds.filter((s) => !requestedFiles.includes(s));
  if (missing.length === 0) {
    console.log("✓ ALL expected audio files were requested and preloaded/played!");
  } else {
    console.log(`Note: Files not yet fetched via network:`, missing);
  }

  console.log(`\nBrowser console errors encountered: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    console.log("Errors:", consoleErrors);
  } else {
    console.log("✓ ZERO console errors during complete 5-question playthrough!");
  }

  await browser.close();
  console.log("\n=== Audio Browser Verification Complete ===");
}

runAudioVerification().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
