import puppeteerExtra from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

// Use the stealth plugin to prevent detection
puppeteerExtra.use(StealthPlugin());

export async function searchAndScrapeJobDetails(
  skill,
  location,
  experienceLevel
) {
  
  let response = { success: false, data: [], error: null };
  let browser = null;

  try {
    console.log(
      `Searching for job recommendations for: ${skill} in ${location} with ${experienceLevel} experience`
    );

    // Launch Puppeteer using puppeteer-extra with stealth
    browser = await puppeteerExtra.launch({
      headless: true, // Set headless to true (hidden mode)
      args: [
        "--disable-setuid-sandbox",
        "--no-sandbox",
        "--no-zygote",
        "--single-process",
        "--disable-software-rasterizer",
      ],
    });

    const page = await browser.newPage();
    const query = `${skill} jobs in ${location} with ${experienceLevel} experience`;
    const googleJobsUrl = `https://www.google.com/search?q=${encodeURIComponent(
      query
    )}`;

    // Navigate to the Google Jobs search results page
    await page.goto(googleJobsUrl, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // Wait for the "Google Jobs" section to load and click it
    await page.waitForSelector(".jRKCUd .ZFiwCf", { timeout: 30000 });
    const element = await page.$(".jRKCUd .ZFiwCf");
    await element.click();
    await page.waitForNavigation({ waitUntil: "networkidle0", timeout: 30000 });

    // Wait for the job listings to load
    await page.waitForSelector(".u9g6vf", { timeout: 30000 });
    const jobElements = await page.$$(".u9g6vf");
    const jobDetails = [];

    // Iterate through job elements to extract job information
    for (let jobButton of jobElements) {
      await jobButton.click();
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait for the details to load

      const titleElement = await page.$(".LZAQDf.cS4Vcb-pGL6qe-IRrXtf");
      const companyElement = await page.$(".UxTHrf");
      const imageElement = await page.$(".YQ4gaf.zr758c"); // Adjusted to match the class name
      let imageUrl = null;

      // Extract image URL if exists
      if (imageElement) {
        imageUrl = await page.evaluate((el) => el.src, imageElement);
      }

      // Extract job title and company name
      if (titleElement && companyElement) {
        const jobTitle = await page.evaluate((el) => el.innerText, titleElement);
        const companyName = await page.evaluate(
          (el) => el.innerText,
          companyElement
        );
        jobDetails.push({ title: jobTitle, company: companyName, imageUrl });
      }

      await page.goBack();
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for the job list to load again
    }

    // Remove duplicate job entries by company name
    const uniqueJobDetails = Array.from(
      new Map(jobDetails.map((job) => [job.company, job])).values()
    );

    response.success = true;
    response.data = uniqueJobDetails.slice(0, 10); // Return top 10 results
    return response;
  } catch (error) {
    console.error("Error during job scraping:", error);
    response.error = "Failed to fetch job details.";
    return response;
  } finally {
    // Ensure the browser is always closed, even if an error occurs
    if (browser !== null) {
      await browser.close();
    }
  }
}
