import puppeteerExtra from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

puppeteerExtra.use(StealthPlugin());

const PUPPETEER_ARGS = [
  "--disable-setuid-sandbox",
  "--no-sandbox",
  "--no-zygote",
  "--single-process",
  "--disable-software-rasterizer",
];

const GOOGLE_JOBS_SELECTOR = ".jRKCUd .ZFiwCf";
const JOB_LIST_SELECTOR = ".u9g6vf";

export async function searchAndScrapeJobDetails(
  skill,
  location,
  experienceLevel
) {
  let browser;

  try {
    console.log(
      `[PUPPETEER] Searching jobs for "${skill}" in "${location}" (${experienceLevel})`
    );

    browser = await puppeteerExtra.launch({
      headless: true,
      args: PUPPETEER_ARGS,
    });

    const page = await browser.newPage();
    page.setDefaultTimeout(30_000);

    const query = `${skill} jobs in ${location} with ${experienceLevel} experience`;
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(
      query
    )}`;

    await page.goto(searchUrl, { waitUntil: "networkidle2" });

    // Open Google Jobs panel
    await page.waitForSelector(GOOGLE_JOBS_SELECTOR);
    await page.click(GOOGLE_JOBS_SELECTOR);
    await page.waitForNavigation({ waitUntil: "networkidle0" });

    await page.waitForSelector(JOB_LIST_SELECTOR);
    const jobButtons = await page.$$(JOB_LIST_SELECTOR);

    const jobs = [];

    for (const jobButton of jobButtons.slice(0, 15)) {
      await jobButton.click();
      await page.waitForTimeout(1500);

      const jobData = await page.evaluate(() => {
        const titleEl = document.querySelector(".LZAQDf.cS4Vcb-pGL6qe-IRrXtf");
        const companyEl = document.querySelector(".UxTHrf");
        const imageEl = document.querySelector(".YQ4gaf.zr758c");

        return {
          title: titleEl?.innerText || null,
          company: companyEl?.innerText || null,
          imageUrl: imageEl?.src || null,
        };
      });

      if (jobData.title && jobData.company) {
        jobs.push(jobData);
      }

      await page.goBack({ waitUntil: "networkidle0" });
    }

    // Deduplicate by company name
    const uniqueJobs = Array.from(
      new Map(jobs.map((job) => [job.company, job])).values()
    );

    return uniqueJobs.slice(0, 10);
  } catch (error) {
    console.error("[PUPPETEER ERROR]", error.message);
    throw new Error("JOB_SCRAPING_FAILED");
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
