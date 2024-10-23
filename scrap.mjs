import puppeteer from "puppeteer";

// Function to search for job recommendations on Google and extract contact information
export const searchAndScrapeJobDetails = async (skill, location) => {
  const response = { success: false, data: [], error: null };
  let browser = null;

  try {
    console.log(
      `Searching for job recommendations for: ${skill} in ${location}`
    );
    browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    const query = `${skill} jobs in ${location}`;
    const googleJobsUrl = `https://www.google.com/search?q=${encodeURIComponent(
      query
    )}`;

    await page.goto(googleJobsUrl, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });
    // Click the button to view more jobs
    await page.waitForSelector(".jRKCUd .ZFiwCf", { timeout: 30000 });
    const element = await page.$(".jRKCUd .ZFiwCf");
    await element.click();

    await page.waitForNavigation({ waitUntil: "networkidle0", timeout: 30000 });
    // Wait for the job elements to load
    await page.waitForSelector(".u9g6vf", { timeout: 30000 });
    const jobElements = await page.$$(".u9g6vf");

    const jobDetails = [];

    // Click on each job button and extract details
    for (let jobButton of jobElements) {
      await jobButton.click();
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait for the details to load

      const titleElement = await page.$(".LZAQDf.cS4Vcb-pGL6qe-IRrXtf");
      const companyElement = await page.$(".UxTHrf");

      if (titleElement && companyElement) {
        const jobTitle = await page.evaluate(
          (el) => el.innerText,
          titleElement
        );
        const companyName = await page.evaluate(
          (el) => el.innerText,
          companyElement
        );
        jobDetails.push({ title: jobTitle, company: companyName });
      }

      // Close the job detail dialog and go back to the job list
      await page.goBack();
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for the job list to load again
    }

    // Remove duplicates based on company names
    const uniqueJobDetails = Array.from(
      new Map(jobDetails.map((job) => [job.company, job])).values()
    );

    const resultsWithContactInfo = [];
    const visitedWebsites = new Set();

    for (let job of uniqueJobDetails) {
      const companyName = job.company;
      console.log(`Searching for the company: ${companyName} on Google...`);

      const companySearchUrl = `https://www.google.com/search?q=${encodeURIComponent(
        companyName
      )}`;
      await page.goto(companySearchUrl, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });
      await page.waitForSelector("h3", { timeout: 30000 });

      const websiteLink = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll("h3"));
        return links.length > 0 ? links[0].parentElement.href : null;
      });

      if (websiteLink && !visitedWebsites.has(websiteLink)) {
        console.log(`Opening company website: ${websiteLink}`);
        visitedWebsites.add(websiteLink);

        try {
          await page.goto(websiteLink, {
            waitUntil: "networkidle2",
            timeout: 30000,
          });

          const contactDetails = await page.evaluate(() => {
            const emails = new Set(
              Array.from(
                document.body.innerText.matchAll(
                  /[\w.%+-]+@[\w.-]+\.[a-zA-Z]{2,}/g
                )
              ).map((match) => match[0])
            );

            const phones = new Set(
              Array.from(
                document.body.innerText.matchAll(/(\+?\d[\d -]{7,}\d)/g)
              ).map((match) => match[0])
            );

            return {
              emails: Array.from(emails),
              phones: Array.from(phones),
            };
          });

          job.contactInfo = {
            emails:
              contactDetails.emails.length > 0
                ? contactDetails.emails.join(", ")
                : "No email found",
            phones:
              contactDetails.phones.length > 0
                ? contactDetails.phones.join(", ")
                : "No phone found",
          };

          resultsWithContactInfo.push(job);
        } catch (error) {
          console.error(
            `Error opening website ${websiteLink}: ${error.message}`
          );
          job.contactInfo = {
            emails: "Error retrieving emails",
            phones: "Error retrieving phones",
          };
          resultsWithContactInfo.push(job);
        }
      }
    }

    // If fewer than 10 jobs found, log the number found
    if (uniqueJobDetails.length < 10) {
      console.log(
        `Found ${uniqueJobDetails.length} jobs, less than the desired 10.`
      );
      response.success = true;
      response.data = resultsWithContactInfo;
      return response;
    }

    response.success = true;
    response.data = resultsWithContactInfo.slice(0, 10);
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
};

// Example usage if the script is executed directly
if (import.meta.url === new URL(import.meta.url).href) {
  const args = process.argv.slice(2);
  const [skill, location] = args;

  searchAndScrapeJobDetails(skill, location)
    .then((results) => {
      process.send({ status: "success", data: results });
      process.exit(0);
    })
    .catch((error) => {
      process.send({ status: "error", error: error.message });
      process.exit(1);
    });
}
