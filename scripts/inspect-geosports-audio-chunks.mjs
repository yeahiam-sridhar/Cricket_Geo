import { chromium } from "playwright";
import fs from "fs";

async function inspectGeoSportsAudioSources() {
  const browser = await chromium.launch({
    channel: "msedge",
    headless: true,
  });
  const page = await browser.newPage();

  const scriptUrls = [];
  page.on("response", async (res) => {
    const url = res.url();
    if (url.includes("/_next/static/chunks/") && url.endsWith(".js")) {
      scriptUrls.push(url);
    }
  });

  await page.goto("https://geosports.app/play", { waitUntil: "networkidle" });

  console.log(`Found ${scriptUrls.length} Next.js chunks.`);

  for (const url of scriptUrls) {
    const res = await page.request.get(url);
    const text = await res.text();
    // Search for audio references
    const matches = text.match(/(\.mp3|\.wav|\.ogg|AudioContext|createOscillator|decodeAudioData|createBufferSource|data:audio\/[^"']+)/g);
    if (matches) {
      console.log(`Script ${url.split("/").pop()} matched:`, [...new Set(matches)]);
      // Find snippets around createBufferSource
      const idx = text.indexOf("createBufferSource");
      if (idx !== -1) {
        console.log("Snippet around createBufferSource:", text.slice(Math.max(0, idx - 100), idx + 200));
      }
      const base64Audio = text.match(/data:audio\/[^"']+/g);
      if (base64Audio) {
        console.log(`Found embedded base64 audio (${base64Audio.length} items):`, base64Audio.map(s => s.slice(0, 50) + "..."));
      }
    }
  }

  await browser.close();
}

inspectGeoSportsAudioSources().catch(console.error);
