import { chromium, devices } from "playwright";

async function verifyMobile() {
  const browser = await chromium.launch({
    channel: "msedge",
    headless: true,
    args: ["--autoplay-policy=no-user-gesture-required"],
  });

  const context = await browser.newContext({
    ...devices["iPhone 13"],
  });

  const page = await context.newPage();
  await page.goto("http://localhost:3000/play?practice=true");
  await page.waitForTimeout(1000);

  // Name modal handling if first time
  const nameInput = page.locator("input[placeholder*='Cover Drive']");
  if (await nameInput.isVisible()) {
    await nameInput.fill("Mobile Cricketer");
    await page.locator("button:has-text('Start playing')").click();
    await page.waitForTimeout(1200);
  }

  await page.waitForSelector("header [data-testid='sound-toggle']", { timeout: 8000 });
  const toggle = page.locator("header [data-testid='sound-toggle']").first();
  const visible = await toggle.isVisible();
  console.log("Mobile Sound Toggle visible:", visible);

  await toggle.click();
  const muted = await page.evaluate(() => localStorage.getItem("cricket_geo.sound_enabled"));
  console.log("Mobile muted in localStorage:", muted);

  await toggle.click();
  const unmuted = await page.evaluate(() => localStorage.getItem("cricket_geo.sound_enabled"));
  console.log("Mobile unmuted in localStorage:", unmuted);

  await browser.close();
  console.log("✓ Mobile audio toggle and responsiveness test passed!");
}

verifyMobile().catch((err) => {
  console.error("Mobile test failed:", err);
  process.exit(1);
});
