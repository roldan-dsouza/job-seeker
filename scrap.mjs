import puppeteer from "puppeteer";

// Function to search for jobs
export const searchJobs = async (skill, location, experienceLevel) => {
  console.log("Job search initiated for:", skill, location, experienceLevel);
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // Refined search query
    const query = `${skill} jobs in ${location} ${experienceLevel}`;
    const googleJobsUrl = `https://www.google.com/search?q=${encodeURIComponent(
      query
    )}`;

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36"
    );
    await page.goto(googleJobsUrl, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    console.log("Navigated to Google Jobs page.");

    // Wait for job links to load
    await page.waitForSelector(".g", { timeout: 10000 });

    // Extract job links
    const jobLinks = await page.evaluate(() => {
      const links = [];
      const jobElements = document.querySelectorAll(".g .yuRUbf a"); // Adjusted selector for job links
      jobElements.forEach((jobElement) => {
        const link = jobElement.href;
        links.push(link);
      });
      return links.slice(0, 3); // Get first three job links
    });

    console.log("Found job links:", jobLinks);

    const jobDetails = [];

    for (const link of jobLinks) {
      const jobPage = await browser.newPage();
      try {
        await jobPage.goto(link, { waitUntil: "networkidle2", timeout: 30000 });

        // Collect company name and logo
        const { companyName, logoUrl } = await jobPage.evaluate(() => {
          const companyElement =
            document.querySelector(".company-name") ||
            document.querySelector(".base-search-card__subtitle") ||
            document.querySelector(".company") ||
            document.querySelector("h4");

          const logoElement =
            document.querySelector("img") ||
            document.querySelector(".logo img") ||
            document.querySelector(".company-logo img") ||
            document.querySelector('[alt*="logo"]');

          return {
            companyName: companyElement
              ? companyElement.innerText
              : "Company not found",
            logoUrl: logoElement ? logoElement.src : "Logo not found",
          };
        });

        // Log each job detail as it's collected
        console.log(
          `Job detail collected: ${companyName} - ${link} - ${logoUrl}`
        );

        jobDetails.push({ link, companyName, logoUrl });
      } catch (err) {
        console.error(`Error navigating to ${link}:`, err);
      } finally {
        await jobPage.close();
      }
    }

    console.log("Job details collected:", jobDetails);
    await browser.close();

    return jobDetails; // Ensure jobDetails is returned
  } catch (error) {
    console.error("Error during job search:", error);
    await browser.close();
    throw new Error("Failed to fetch job listings.");
  }
};

// This part runs the job search if the script is executed directly
if (import.meta.url === new URL(import.meta.url).href) {
  const args = process.argv.slice(2);
  const [skill, location, experienceLevel] = args;
  console.log(
    `Searching for jobs with: ${skill}, ${location}, ${experienceLevel}`
  );

  searchJobs(skill, location, experienceLevel)
    .then((results) => {
      console.log("Job details:", results); // Log the final results
      process.send(results); // Send results back to parent process
      process.exit(0); // Exit with code 0 on success
    })
    .catch((error) => {
      console.error("Error in scraping:", error);
      process.exit(1); // Exit with a non-zero code to indicate an error
    });
}
