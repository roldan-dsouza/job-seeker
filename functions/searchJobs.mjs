import puppeteer from "puppeteer";

export async function searchAndScrapeJobDetails(
  skill,
  location,
  experienceLevel
) {
  let response = { success: false, data: [], error: null };

  try {
    console.log(
      `Searching for job recommendations for: ${skill} in ${location} with ${experienceLevel} experience`
    );
    const browser = await puppeteer.launch({
      headless: false,
      args: [
        "--disable-setuid-sandbox",
        "--no-sandbox",
        "--no-zygote",
        "--single-process",
      ],
    });
    const page = await browser.newPage();

    const query = `${skill} jobs in ${location} with ${experienceLevel} experience`;
    const googleJobsUrl = `https://www.google.com/search?q=${encodeURIComponent(
      query
    )}`;

    await page.goto(googleJobsUrl, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });
    await page.waitForSelector(".jRKCUd .ZFiwCf", { timeout: 30000 });

    // Click on the Google Jobs section
    const element = await page.$(".jRKCUd .ZFiwCf");
    await element.click();
    await page.waitForNavigation({ waitUntil: "networkidle0", timeout: 30000 });

    // Wait for the job listings to load
    await page.waitForSelector(".u9g6vf", { timeout: 30000 });
    const jobElements = await page.$$(".u9g6vf");
    const jobDetails = [];

    for (let jobButton of jobElements) {
      await jobButton.click();
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait for the details to load

      const titleElement = await page.$(".LZAQDf.cS4Vcb-pGL6qe-IRrXtf");
      const companyElement = await page.$(".UxTHrf");

      // Extract the image URL with the specified class name
      const imageElement = await page.$(".YQ4gaf.zr758c"); // Adjusted to match the class name
      let imageUrl = null;

      // Check if the image element exists and get its src, else set to null
      if (imageElement) {
        imageUrl = await page.evaluate((el) => el.src, imageElement);
      } else {
        imageUrl = null; // Explicitly set to null if not found
      }

      if (titleElement && companyElement) {
        const jobTitle = await page.evaluate(
          (el) => el.innerText,
          titleElement
        );
        const companyName = await page.evaluate(
          (el) => el.innerText,
          companyElement
        );
        jobDetails.push({ title: jobTitle, company: companyName, imageUrl });
      }

      await page.goBack();
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for the job list to load again
    }

    const uniqueJobDetails = Array.from(
      new Map(jobDetails.map((job) => [job.company, job])).values()
    );

    response.success = true;
    response.data = uniqueJobDetails.slice(0, 10);
    return response;
  } catch (error) {
    console.error("Error during job scraping:", error);
    response.error = "Failed to fetch job details.";
    return response;
  } finally {
    if (browser !== null) {
      await browser.close();
    }
  }
}
