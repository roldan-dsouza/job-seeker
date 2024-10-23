import puppeteer from "puppeteer";

// Function to scrape emails and phone numbers from a page
const scrapeContactInfoFromPage = async (page) => {
  const contactInfo = {
    emails: new Set(),
    phones: new Set(),
  };

  const bodyText = await page.evaluate(() => document.body.innerText);

  // Extract emails
  const emails = bodyText.match(/[\w.%+-]+@[\w.-]+\.[a-zA-Z]{2,}/g);
  if (emails) {
    emails.forEach((email) => contactInfo.emails.add(email));
  }

  // Extract phone numbers
  const phones = bodyText.match(/(\+?\d[\d -]{7,}\d)/g);
  if (phones) {
    phones.forEach((phone) => contactInfo.phones.add(phone));
  }

  return contactInfo;
};

// Recursive function to explore links within the website
const exploreWebsite = async (page, visitedLinks, timeout = 60000) => {
  const startTime = Date.now();

  const links = await page.evaluate(() => {
    const anchorElements = Array.from(document.querySelectorAll("a"));
    return anchorElements
      .map((a) => a.href)
      .filter((href) => href && href.startsWith(window.location.origin));
  });

  for (const link of links) {
    if (visitedLinks.has(link) || Date.now() - startTime > timeout) {
      continue; // Skip visited links and check for timeout
    }

    visitedLinks.add(link);
    await page.goto(link, { waitUntil: "networkidle2", timeout: 30000 });

    // Check for contact info on this page
    const contactInfo = await scrapeContactInfoFromPage(page);
    if (contactInfo.emails.size > 0 || contactInfo.phones.size > 0) {
      return contactInfo; // Found contact info, return it
    }

    // Recursive call to explore further
    const nestedContactInfo = await exploreWebsite(page, visitedLinks, timeout);
    if (
      nestedContactInfo.emails.size > 0 ||
      nestedContactInfo.phones.size > 0
    ) {
      return nestedContactInfo; // Return if found in deeper exploration
    }

    // Delay to avoid overwhelming the server
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return contactInfo; // Return empty if nothing found
};

// Main function to search and scrape job details
export const searchAndScrapeJobDetails = async (
  skill,
  location,
  experienceLevel
) => {
  const response = { success: false, data: [], error: null };
  let browser = null;

  try {
    console.log(
      `Searching for job recommendations for: ${skill} in ${location} with ${experienceLevel} experience`
    );
    browser = await puppeteer.launch({ headless: false });
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
    const element = await page.$(".jRKCUd .ZFiwCf");
    await element.click();

    await page.waitForNavigation({ waitUntil: "networkidle0", timeout: 30000 });
    await page.waitForSelector(".u9g6vf", { timeout: 30000 });
    const jobElements = await page.$$(".u9g6vf");

    const jobDetails = [];
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

      await page.goBack();
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for the job list to load again
    }

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

          // Start exploring the website for contact information
          const contactInfo = await exploreWebsite(page, new Set());
          job.contactInfo = {
            emails:
              contactInfo.emails.size > 0
                ? Array.from(contactInfo.emails).join(", ")
                : "No email found",
            phones:
              contactInfo.phones.size > 0
                ? Array.from(contactInfo.phones).join(", ")
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
  const [skill, location, experienceLevel] = args;

  searchAndScrapeJobDetails(skill, location, experienceLevel)
    .then((results) => {
      process.send({ status: "success", data: results });
      process.exit(0);
    })
    .catch((error) => {
      process.send({ status: "error", error: error.message });
      process.exit(1);
    });
}
