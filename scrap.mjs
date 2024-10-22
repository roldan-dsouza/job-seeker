import puppeteer from "puppeteer";

// Function to search for job recommendations on Google and extract contact information
export const searchAndScrapeJobDetails = async (skill, location) => {
  const response = { success: false, data: [], error: null };

  try {
    console.log(
      `Searching for job recommendations for: ${skill} in ${location}`
    );

    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    const query = `${skill} jobs in ${location}`;
    const googleJobsUrl = `https://www.google.com/search?q=${encodeURIComponent(
      query
    )}`;

    await page.goto(googleJobsUrl, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // Wait for job elements to load
    await page.waitForSelector(".u9g6vf", { timeout: 30000 });
    console.log("Job elements found, starting to click on job titles...");

    // Extract job elements
    const jobDetails = await page.evaluate(async () => {
      const jobs = [];
      const jobElements = Array.from(document.querySelectorAll(".u9g6vf")); // Selecting job elements

      // Iterate over the first three job results (or less if there are fewer than 3)
      for (let i = 0; i < Math.min(jobElements.length, 3); i++) {
        const jobButton = jobElements[i];
        jobButton.click();

        // Wait for the job details to load
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Small delay for job to load

        const titleElement = document.querySelector(
          ".LZAQDf.cS4Vcb-pGL6qe-IRrXtf"
        ); // Title class
        const companyElement = document.querySelector(".UxTHrf"); // Company class

        if (titleElement && companyElement) {
          const jobTitle = titleElement.innerText;
          const companyName = companyElement.innerText;

          jobs.push({ title: jobTitle, company: companyName });
        }
      }

      return jobs;
    });

    // Use a Set to avoid duplicate companies
    const uniqueJobDetails = Array.from(
      new Map(jobDetails.map((job) => [job.company, job])).values()
    );

    // Debug log if jobDetails is empty
    if (uniqueJobDetails.length === 0) {
      response.error =
        "No job details found. Please check the page structure or selectors.";
      return response;
    } else {
      console.log("Unique job details found:", uniqueJobDetails);
    }

    // Now search for each company on Google and scrape for contact details
    const resultsWithContactInfo = [];
    const visitedWebsites = new Set(); // To track visited websites

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

      // Wait for search results to load and select the first website link
      await page.waitForSelector("h3", { timeout: 30000 }); // Wait for the title of the search results

      // Click the first link that usually corresponds to the company's official website
      const websiteLink = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll("h3"));
        return links.length > 0 ? links[0].parentElement.href : null; // Get the first link's URL
      });

      if (websiteLink && !visitedWebsites.has(websiteLink)) {
        console.log(`Opening company website: ${websiteLink}`);
        visitedWebsites.add(websiteLink); // Mark the website as visited

        try {
          await page.goto(websiteLink, {
            waitUntil: "networkidle2",
            timeout: 30000,
          });

          // Scrape for contact details or email
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
          resultsWithContactInfo.push(job); // Still push the job with error details
        }
      } else {
        console.log(
          `No website link found for company: ${companyName} or already visited. Skipping...`
        );
      }
    }

    response.success = true;
    response.data = resultsWithContactInfo;

    return response;
  } catch (error) {
    console.error("Error during job scraping:", error);
    response.error = "Failed to fetch job details.";
    return response;
  } finally {
    await browser.close(); // Ensure the browser is closed in all scenarios
  }
};

// Example usage if the script is executed directly
if (import.meta.url === new URL(import.meta.url).href) {
  const args = process.argv.slice(2);
  const [skill, location] = args;

  searchAndScrapeJobDetails(skill, location)
    .then((results) => {
      console.log("Job details:", results);
      process.exit(0);
    })
    .catch((error) => {
      console.error("Error in scraping:", error);
      process.exit(1);
    });
}
