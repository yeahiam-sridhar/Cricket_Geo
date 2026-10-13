import { chromium } from "playwright";
import fs from "fs";
import path from "path";

async function investigateGeoSports() {
  console.log("=== PHASE 1: Live Dynamic Reverse Engineering of GeoSports ===");

  const evidenceDir = path.join(process.cwd(), "data", "geosports_evidence");
  if (!fs.existsSync(evidenceDir)) {
    fs.mkdirSync(evidenceDir, { recursive: true });
  }

  const browser = await chromium.launch({
    channel: "msedge",
    headless: true,
    args: [
      "--autoplay-policy=no-user-gesture-required",
      "--remote-debugging-port=9222",
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });

  const page = await context.newPage();

  const networkLog = [];
  const audioRequests = [];
  const audioEventLog = [];
  const consoleLog = [];

  // Capture network requests
  page.on("request", (req) => {
    const url = req.url();
    const type = req.resourceType();
    networkLog.push({ url, type, method: req.method() });

    if (
      type === "media" ||
      url.match(/\.(mp3|wav|ogg|aac|m4a|webm)($|\?)/i) ||
      url.includes("/sound") ||
      url.includes("/audio")
    ) {
      console.log(`[AUDIO REQUEST DETECTED]: ${url}`);
      audioRequests.push({ url, type, time: Date.now() });
    }
  });

  page.on("response", async (res) => {
    const url = res.url();
    const headers = res.headers();
    const contentType = headers["content-type"] || "";

    if (
      contentType.includes("audio") ||
      url.match(/\.(mp3|wav|ogg|aac|m4a|webm)($|\?)/i)
    ) {
      console.log(`[AUDIO RESPONSE 200]: ${url} (${contentType})`);
      try {
        const buffer = await res.body();
        const filename = path.basename(url.split("?")[0]) || "audio_" + Date.now();
        const savePath = path.join(evidenceDir, filename);
        fs.writeFileSync(savePath, buffer);
        console.log(`  -> Saved audio evidence to: ${savePath} (${buffer.length} bytes)`);
      } catch (err) {
        console.log(`  -> Could not save body: ${err.message}`);
      }
    }
  });

  page.on("console", (msg) => {
    consoleLog.push({ type: msg.type(), text: msg.text(), time: Date.now() });
    if (msg.text().includes("[AudioHook]")) {
      console.log(msg.text());
      audioEventLog.push(msg.text());
    }
  });

  // Inject deep instrumentation for AudioContext and HTMLAudioElement
  await page.addInitScript(() => {
    window.__audioEvents = [];

    // Instrument HTMLAudioElement
    const originalPlay = HTMLAudioElement.prototype.play;
    HTMLAudioElement.prototype.play = function () {
      const src = this.src || this.currentSrc || "inline/blob";
      const eventMsg = `[AudioHook] HTMLAudioElement.play(): src=${src}, volume=${this.volume}, time=${performance.now().toFixed(1)}ms`;
      console.log(eventMsg);
      window.__audioEvents.push(eventMsg);
      return originalPlay.apply(this, arguments);
    };

    // Instrument Web Audio API
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      const originalCreateBufferSource = AudioContextClass.prototype.createBufferSource;
      AudioContextClass.prototype.createBufferSource = function () {
        const source = originalCreateBufferSource.apply(this, arguments);
        const originalStart = source.start;
        source.start = function (when = 0) {
          const duration = source.buffer ? source.buffer.duration : "unknown";
          const channels = source.buffer ? source.buffer.numberOfChannels : "unknown";
          const sampleRate = source.buffer ? source.buffer.sampleRate : "unknown";
          const eventMsg = `[AudioHook] AudioBufferSourceNode.start(): duration=${duration}s, ch=${channels}, sr=${sampleRate}, when=${when}, time=${performance.now().toFixed(1)}ms`;
          console.log(eventMsg);
          window.__audioEvents.push(eventMsg);
          return originalStart.apply(this, arguments);
        };
        return source;
      };

      const originalCreateOscillator = AudioContextClass.prototype.createOscillator;
      AudioContextClass.prototype.createOscillator = function () {
        const osc = originalCreateOscillator.apply(this, arguments);
        const originalStart = osc.start;
        osc.start = function () {
          const eventMsg = `[AudioHook] OscillatorNode.start(): type=${osc.type}, freq=${osc.frequency.value}Hz, time=${performance.now().toFixed(1)}ms`;
          console.log(eventMsg);
          window.__audioEvents.push(eventMsg);
          return originalStart.apply(this, arguments);
        };
        return osc;
      };
    }
  });

  // 1. Visit Homepage
  console.log("\n--- STEP 1: Inspecting GeoSports Homepage ---");
  const t0 = Date.now();
  await page.goto("https://geosports.app", { waitUntil: "networkidle", timeout: 30000 });
  const loadTime = Date.now() - t0;
  console.log(`Homepage loaded in ${loadTime}ms.`);

  const homepageScreenshot = path.join(evidenceDir, "01_geosports_homepage.png");
  await page.screenshot({ path: homepageScreenshot, fullPage: true });
  console.log(`Saved screenshot: ${homepageScreenshot}`);

  // Analyze page title, metadata, buttons, layout
  const pageDetails = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button, a")).map((el) => ({
      tag: el.tagName,
      text: el.innerText.trim(),
      href: el.getAttribute("href"),
      classes: el.className,
    }));

    // Check audio objects in global scope
    const globals = {
      hasHowler: typeof window.Howl !== "undefined",
      hasAudioContext: typeof window.AudioContext !== "undefined",
      audioElementsCount: document.querySelectorAll("audio").length,
    };

    return {
      title: document.title,
      buttons,
      globals,
    };
  });

  console.log("GeoSports Page Details:", JSON.stringify(pageDetails, null, 2));

  // 2. Look for interactive play or start buttons
  console.log("\n--- STEP 2: Starting a Game on GeoSports ---");
  const playButton = page.locator("button:has-text('Play'), a:has-text('Play'), button:has-text('Start'), a:has-text('Start')").first();

  if (await playButton.isVisible()) {
    console.log("Clicking Play button...");
    await playButton.click();
    await page.waitForTimeout(2000);
  } else {
    console.log("No explicit Play button found; checking for sports categories or direct game interface...");
  }

  const step2Screenshot = path.join(evidenceDir, "02_geosports_after_start.png");
  await page.screenshot({ path: step2Screenshot, fullPage: true });
  console.log(`Saved screenshot: ${step2Screenshot}`);

  // Check current URL and DOM
  const currentUrl = page.url();
  console.log("Current URL after start action:", currentUrl);

  // 3. Inspect Map / Globe container and game UI
  console.log("\n--- STEP 3: Inspecting Map/Globe & Gameplay Element ---");
  const gameElements = await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    const maplibregl = typeof window.maplibregl !== "undefined";
    const mapboxgl = typeof window.mapboxgl !== "undefined";

    return {
      hasCanvas: !!canvas,
      canvasSize: canvas ? { width: canvas.width, height: canvas.height } : null,
      maplibregl,
      mapboxgl,
      url: window.location.href,
      htmlLength: document.body.innerHTML.length,
    };
  });
  console.log("Game Environment:", gameElements);

  // If there's a canvas or map, try a click to submit a guess
  const canvas = page.locator("canvas").first();
  if (await canvas.isVisible()) {
    console.log("Canvas is visible. Interacting with globe...");
    const box = await canvas.boundingBox();
    if (box) {
      // Tap globe
      console.log(`Clicking canvas at (${box.x + box.width * 0.5}, ${box.y + box.height * 0.5})...`);
      await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
      await page.waitForTimeout(1000);

      const step3Screenshot = path.join(evidenceDir, "03_geosports_after_guess_tap.png");
      await page.screenshot({ path: step3Screenshot });
      console.log(`Saved screenshot after guess tap: ${step3Screenshot}`);

      // Check if there's a submit/lock button
      const submitBtn = page.locator("button:has-text('Guess'), button:has-text('Lock'), button:has-text('Submit')").first();
      if (await submitBtn.isVisible()) {
        console.log("Submit/Lock button found! Clicking submit...");
        await submitBtn.click();
        await page.waitForTimeout(2000);

        const step4Screenshot = path.join(evidenceDir, "04_geosports_after_submit_reveal.png");
        await page.screenshot({ path: step4Screenshot });
        console.log(`Saved screenshot after submit: ${step4Screenshot}`);
      }
    }
  }

  // Check captured audio events
  const capturedAudioEvents = await page.evaluate(() => window.__audioEvents || []);
  console.log("\n=== Captured In-Page Audio Events ===");
  console.log(capturedAudioEvents);

  // Save full investigation report to evidence directory
  const report = {
    url: "https://geosports.app",
    timestamp: new Date().toISOString(),
    pageDetails,
    gameElements,
    audioRequests,
    capturedAudioEvents,
    consoleLog: consoleLog.slice(0, 30),
    networkLogSample: networkLog.filter((r) => r.type === "media" || r.url.includes("sound") || r.url.includes("api")),
  };

  fs.writeFileSync(
    path.join(evidenceDir, "investigation_report.json"),
    JSON.stringify(report, null, 2)
  );

  await browser.close();
  console.log("\n=== GeoSports Live Investigation Complete ===");
}

investigateGeoSports().catch((err) => {
  console.error("Investigation failed:", err);
  process.exit(1);
});
