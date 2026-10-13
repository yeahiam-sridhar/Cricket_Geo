import { chromium } from "playwright";
import fs from "fs";
import path from "path";

async function captureGeoSportsReveal() {
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
  const audioEvents = [];

  page.on("console", (msg) => {
    if (msg.text().includes("[AudioHook]")) {
      console.log(msg.text());
      audioEvents.push(msg.text());
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

  const canvas = page.locator("canvas").first();
  const box = await canvas.boundingBox();

  if (box) {
    console.log("Clicking canvas to trigger guess...");
    await page.mouse.click(box.x + box.width * 0.45, box.y + box.height * 0.45);

    // Capture every 800ms during reveal
    for (let i = 1; i <= 6; i++) {
      await page.waitForTimeout(800);
      const scPath = path.join(evidenceDir, `reveal_frame_${i}.png`);
      await page.screenshot({ path: scPath });
      console.log(`Captured reveal frame ${i} -> ${scPath}`);
    }
  }

  // Look for next question button or score info
  const postRevealText = await page.evaluate(() => {
    return {
      bodyText: document.body.innerText.slice(0, 500),
      buttons: Array.from(document.querySelectorAll("button, a")).map(b => b.innerText.trim()),
    };
  });
  console.log("Post reveal text & buttons:", postRevealText);

  fs.writeFileSync(
    path.join(evidenceDir, "reveal_audio_events.json"),
    JSON.stringify(audioEvents, null, 2)
  );

  await browser.close();
  console.log("Reveal capture complete!");
}

captureGeoSportsReveal().catch(console.error);
