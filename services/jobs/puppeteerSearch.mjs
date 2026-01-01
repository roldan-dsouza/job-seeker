import puppeteerExtra from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

puppeteerExtra.use(StealthPlugin());

export async function searchAndScrapeJobDetails(
  skill,
  location,
  experienceLevel
) {
  let browser;

  try {
    console.log(
      `[BING] Searching jobs for "${skill}" in "${location}" (${experienceLevel})`
    );

    browser = await puppeteerExtra.launch({
      headless: false, // keep false until you trust it
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    });

    const page = await browser.newPage();
    page.setDefaultTimeout(30000);

    const query = `${skill} jobs mangalore`;
    const url = `https://www.bing.com/jobs?q=${encodeURIComponent(query)}`;

    await page.goto(url, { waitUntil: "networkidle2" });

    // Wait for job list
    await page.waitForSelector("ul.b_hList li", { timeout: 20000 });

    const jobs = [];

    const jobCount = await page.evaluate(
      () => document.querySelectorAll("ul.b_hList li").length
    );

    for (let i = 0; i < jobCount && jobs.length < 10; i++) {
      try {
        // Click job card SAFELY (no stale handles)
        await page.evaluate((index) => {
          const items = document.querySelectorAll("ul.b_hList li");
          if (items[index]) items[index].click();
        }, i);

        // Wait for right panel header to update
        await page.waitForFunction(
          () => {
            const h = document.querySelector("h1, h2");
            return h && h.innerText.length > 5;
          },
          { timeout: 10000 }
        );

        const jobData = await page.evaluate(() => {
          // Get ALL headings and choose the FIRST valid one
          const headings = Array.from(document.querySelectorAll("h1, h2"));

          const titleEl = headings.find(
            (h) =>
              h.innerText &&
              !h.innerText.toLowerCase().includes("requirements") &&
              !h.innerText.toLowerCase().includes("overview") &&
              h.innerText.length > 5
          );

          const title = titleEl?.innerText?.trim() || null;

          // Company is usually a nearby span (but NOT language tags)
          const spans = Array.from(document.querySelectorAll("span"));
          const company =
            spans.find(
              (s) =>
                s.innerText &&
                s.innerText.length > 2 &&
                s.innerText.length < 50 &&
                !["english", "requirements"].includes(s.innerText.toLowerCase())
            )?.innerText || null;

          // Location (best effort)
          const location =
            spans.find((s) => s.innerText?.toLowerCase().includes("remote"))
              ?.innerText || null;

          // Apply / external link
          const link =
            Array.from(document.querySelectorAll('a[href^="http"]')).find(
              (a) =>
                !a.href.includes("bing.com") && !a.href.includes("javascript")
            )?.href || null;

          return { title, company, location, link };
        });

        // FINAL HARD FILTER (NO MERCY)
        if (
          !jobData.title ||
          !jobData.company ||
          jobData.title.toLowerCase().includes("requirements") ||
          jobData.company.toLowerCase() === "english"
        ) {
          continue;
        }

        jobs.push(jobData);
      } catch {
        // swallow errors, move on
        continue;
      }
    }

    console.log(`[BING] Jobs found: ${jobs.length}`);

    return jobs;
  } catch (error) {
    console.error("[BING ERROR]", error.message);
    throw new Error("JOB_SCRAPING_FAILED");
  } finally {
    if (browser) await browser.close();
  }
}
