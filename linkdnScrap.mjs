import puppeteer from "puppeteer";

// Function to login to LinkedIn
const loginToLinkedIn = async (page, email, password) => {
  await page.goto("https://www.linkedin.com/login", {
    waitUntil: "networkidle2",
  });

  await page.type("#username", email);
  await page.type("#password", password);
  await Promise.all([
    page.click("[data-litms-control-urn]"),
    page.waitForNavigation({ waitUntil: "networkidle2" }),
  ]);
  console.log("Logged into LinkedIn");
};

// Function to search for jobs
export const searchJobsOnLinkedIn = async (
  skill,
  location,
  experienceLevel,
  email,
  password
) => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Log into LinkedIn
  await loginToLinkedIn(page, email, password);

  try {
    const query = `${skill} jobs in ${location}`;
    const linkedInUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(
      query
    )}`;

    await page.goto(linkedInUrl, { waitUntil: "networkidle2", timeout: 30000 });
    console.log("Navigated to LinkedIn Jobs page.");

    // Wait for job links to load
    await page.waitForSelector(".jobs-search-results__list-item", {
      timeout: 10000,
    });

    // Extract job links
    const jobLinks = await page.evaluate(() => {
      const links = [];
      const jobElements = document.querySelectorAll(
        ".jobs-search-results__list-item a"
      );
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

        // Collect company name, job title, and contact information
        const { companyName, jobTitle, contactInfo } = await jobPage.evaluate(
          () => {
            const companyElement =
              document.querySelector(".jobs-unified-top-card__company-name") ||
              document.querySelector(".topcard__org-name-link") ||
              document.querySelector("h4");

            const titleElement =
              document.querySelector(".jobs-unified-top-card__job-title") ||
              document.querySelector("h2");

            const emailElement = document.querySelector("a[href^='mailto:']");
            const phoneElement = document.querySelector("a[href^='tel:']");

            return {
              companyName: companyElement
                ? companyElement.innerText
                : "Company not found",
              jobTitle: titleElement
                ? titleElement.innerText
                : "Title not found",
              contactInfo: {
                email: emailElement
                  ? emailElement.innerText
                  : "Email not found",
                phone: phoneElement
                  ? phoneElement.innerText
                  : "Phone not found",
              },
            };
          }
        );

        // Log each job detail as it's collected
        console.log(
          `Job detail collected: ${jobTitle} - ${companyName} - ${contactInfo.email} - ${contactInfo.phone}`
        );

        jobDetails.push({ link, companyName, jobTitle, contactInfo });
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
  const [skill, location, experienceLevel, email, password] = args;
  console.log(
    `Searching for jobs with: ${skill}, ${location}, ${experienceLevel}`
  );

  searchJobsOnLinkedIn(skill, location, experienceLevel, email, password)
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
