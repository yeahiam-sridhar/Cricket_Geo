import { chromium } from "playwright";
import fs from "fs";
import path from "path";

async function captureGeoSportsFullGame() {
  const evidenceDir = path.join(process.cwd(), "data", "geosports_evidence");
  const browser = await chromium.launch({
    channel: "msedge",
    headless: true,
    args: ["--autoplay-policy=no-user-gesture-required"],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();
  const gameLog = [];

  page.on("console", (msg) => {
    if (msg.text().includes("[AudioHook]")) {
      console.log(msg.text());
      gameLog.push(msg.text());
    }
  });

  await page.addInitScript(() => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      const origCreateOsc = AudioContextClass.prototype.createOscillator;
      AudioContextClass.prototype.createOscillator = function () {
        const osc = origCreateOsc.apply(this, arguments);
        const origStart = osc.start;
        osc.start = function () {
          console.log(`[AudioHook] OscillatorNode: type=${osc.type}, freq=${osc.frequency.value}Hz, at=${performance.now().toFixed(1)}ms`);
          return origStart.apply(this, arguments);
        };
        return osc;
      };

      const origCreateBufferSource = AudioContextClass.prototype.createBufferSource;
      AudioContextClass.prototype.createBufferSource = function () {
        const source = origCreateBufferSource.apply(this, arguments);
        const origStart = source.start;
        source.start = function () {
          console.log(`[AudioHook] AudioBufferSource: dur=${source.buffer?.duration}s, at=${performance.now().toFixed(1)}ms`);
          return origStart.apply(this, arguments);
        };
        return source;
      };
    }
  });

  console.log("Navigating to https://geosports.app/play...");
  await page.goto("https://geosports.app/play", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  for (let q = 1; q <= 5; q++) {
    console.log(`Playing question ${q}...`);
    const canvas = page.locator("canvas").first();
    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width * (0.4 + q * 0.05), box.y + box.height * (0.4 + q * 0.05));
      await page.waitForTimeout(3000);

      if (q < 5) {
        const nextBtn = page.locator("button:has-text('Next question')").first();
        if (await nextBtn.isVisible()) {
          await nextBtn.click();
          await page.waitForTimeout(1500);
        }
      } else {
        // Question 5 - wait for summary/results
        console.log("Waiting for question 5 results/completion...");
        const finalBtn = page.locator("button:has-text('See results'), button:has-text('Next'), button:has-text('View results')").first();
        if (await finalBtn.isVisible()) {
          await finalBtn.click();
        }
        await page.waitForTimeout(3000);
        const resultsSc = path.join(evidenceDir, "geosports_final_results.png");
        await page.screenshot({ path: resultsSc });
        console.log(`Saved results screenshot: ${resultsSc}`);
      }
    }
  }

  fs.writeFileSync(
    path.join(evidenceDir, "full_game_audio_events.json"),
    JSON.stringify(gameLog, null, 2)
  );

  await browser.close();
  console.log("Full game capture complete!");
}

captureGeoSportsFullGame().catch(console.error);
