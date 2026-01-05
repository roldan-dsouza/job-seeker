import { chromium } from "playwright";

export async function scrapeIndeed(skill, location) {
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  });

  const page = await browser.newPage({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    locale: "en-IN",
  });

  // 🚫 Block heavy resources (VERY IMPORTANT)
  await page.route("**/*", (route) => {
    const type = route.request().resourceType();
    if (["image", "font", "media"].includes(type)) {
      route.abort();
    } else {
      route.continue();
    }
  });

  page.setDefaultTimeout(30000);
  page.setDefaultNavigationTimeout(60000);

  let allJobs = [];
  let start = 0;
  const MAX_PAGES = 3; // keep LOW on Render

  while (start <= MAX_PAGES * 10) {
    const url = `https://in.indeed.com/jobs?q=${skill}&l=${location}&start=${start}`;
    console.log("Scraping:", url);

    try {
      await page.goto(url, {
        waitUntil: "load",
        timeout: 60000,
      });

      // ⏳ CRITICAL: let Indeed decide layout
      await page.waitForTimeout(5000);

      const jobs = await page.evaluate(() => {
        const cards = document.querySelectorAll("div.job_seen_beacon");

        return Array.from(cards).map((card) => {
          const title =
            card.querySelector("h2.jobTitle span")?.innerText?.trim() || null;

          const company =
            card.querySelector("span.companyName")?.innerText?.trim() ||
            card
              .querySelector("span[data-testid='company-name']")
              ?.innerText?.trim() ||
            null;

          const location =
            card.querySelector("div.companyLocation")?.innerText?.trim() ||
            card
              .querySelector("div[data-testid='text-location']")
              ?.innerText?.trim() ||
            null;

          const linkEl = card.querySelector("a");
          const link = linkEl
            ? "https://in.indeed.com" + linkEl.getAttribute("href")
            : null;

          return { title, company, location, link };
        });
      });

      if (!jobs.length) {
        console.warn("⚠️ No jobs found on this page (throttled). Stopping.");
        break;
      }

      allJobs.push(...jobs);

      start += 10;
      await page.waitForTimeout(2000); // anti-bot delay
    } catch (err) {
      console.error("❌ Page failed, skipping:", err.message);
      break;
    }
  }

  // 🧹 Deduplicate
  const uniqueJobs = Array.from(
    new Map(
      allJobs.map((j) => [`${j.title}-${j.company}-${j.link}`, j])
    ).values()
  );
  await browser.close();
  return uniqueJobs;
}
