import { fetchSkillsExperienceLocationFromPdf } from "../utils/userData.mjs";
import { searchAndScrapeJobDetails } from "../services/jobs/puppeteerSearch.mjs";

import {
  createInsightsMessages,
  createJobMessages,
  createSalaryMessages,
} from "../prompt/resumePrompt.mjs";
import { fetchFromCloudflare } from "../services/ai/cloudFLare.mjs";
import { pdfFunction } from "../utils/pdf-functions.mjs";
import {
  fetchJobLinks,
  fetchSalaryRanges,
} from "../services/ai/job-scrapeServices.mjs";
import { extractLinks } from "../services/ai/job-scrapeServices.mjs";
import { fetchJobDetailsFromPdf } from "../services/resume/resumeExtractService.mjs";
import { getResumeText } from "../services/resume/resumeTextService.mjs";
import { runJobSearch } from "../services/jobs/jobSearchFork.mjs";

// Middleware for getting insights
export const getInsights = async (req, res) => {
  const ip = req.ip;
  if (!req.file && !cache.get(ip)) {
    return res.status(400).json({ error: "No file uploaded" });
  }
  try {
    const formattedText = req.file
      ? await pdfFunction(req.file.buffer, ip)
      : cache.get(ip);
    const insightsMessages = createInsightsMessages(formattedText);
    const insights = await fetchFromCloudflare(insightsMessages);

    if (!insights) {
      return res.status(500).json({ error: "Failed to fetch insights" });
    }
    if (insights.result.response == "invalid resume")
      return res.status(400).json({ error: "invalid resume" });
    res.status(200).json({ insights: insights.result.response });
  } catch (error) {
    console.error("Error fetching insights:", error);
    res.status(500).json({
      error: "Failed to fetch insights",
      details: error.message,
    });
  }
};

// Middleware for getting job links
export const getJobLinks = async (req, res) => {
  if (!req.file && !cache.get(req.ip))
    return res.status(400).json({ error: "no file uploaded" });
  if (!req.body.location) {
    return res.status(400).json({ error: "No location specified" });
  }
  try {
    const formattedText = await pdfFunction(req.file.buffer, req.ip);
    const jobMessages = createJobMessages(formattedText, req.body.location);
    const jobs = await fetchJobLinks(jobMessages);

    if (!jobs) {
      return res.status(500).json({ error: "Failed to fetch job links" });
    }

    res.status(200).json({ availableJobs: extractLinks(jobs.result.response) });
  } catch (error) {
    console.error("Error fetching job links:", error);
    res.status(500).json({
      error: "Failed to fetch job links",
      details: error.message,
    });
  }
};

// Middleware for getting salary ranges
export const getSalaryRanges = async (req, res) => {
  const ip = req.ip;
  if (!req.file && !cache.get(req.ip)) {
    return res.status(400).json({ error: "No file uploaded" });
  }
  try {
    const formattedText = req.file
      ? await pdfFunction(req.file.buffer, ip)
      : cache.get(req.ip);
    const location = await fetchSkillsExperienceLocationFromPdf(formattedText);
    const salaryMessages = createSalaryMessages(
      formattedText,
      location.location
    );
    const salaryRanges = await fetchSalaryRanges(salaryMessages);

    if (!salaryRanges) {
      return res.status(500).json({ error: "Failed to fetch salary ranges" });
    }

    const salRange = JSON.parse(salaryRanges.result.response);
    res.status(200).json({ salaryRangeWithJob: salRange });
  } catch (error) {
    console.error("Error fetching salary ranges:", error);
    res.status(500).json({
      error: "Failed to fetch salary ranges",
      details: error.message,
    });
  }
};

export const searchJobsWithPuppeteer = async (req, res) => {
  try {
    let { location } = req.body;
    const ip = req.ip;

    const formattedText = await getResumeText({ file: req.file, ip });
    const {
      jobTitle,
      experienceLevel,
      location: aiLocation,
    } = await fetchJobDetailsFromPdf(formattedText);

    if (location === "onlocation") location = aiLocation;

    const jobs = await runJobSearch({
      skill: jobTitle,
      location,
      experienceLevel,
    });

    return res.status(200).json({ jobs });
  } catch (error) {
    if (error.message === "NO_RESUME_DATA") {
      return res.status(400).json({
        error: "No PDF uploaded and no cached data available.",
      });
    }

    console.error("searchJobsWithPuppeteer:", error.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getAvailableJobs = async (req, res) => {
  try {
    const ip = req.ip;

    if (!req.file && !cache.get(ip)) {
      return res
        .status(400)
        .json({ error: "No file uploaded or data not found in cache." });
    }

    if (req.file && req.file.mimetype !== "application/pdf") {
      return res
        .status(415)
        .json({ error: "Unsupported file type. Only PDF files are allowed." });
    }
    if (!req.body.location) {
      return res
        .status(400)
        .json({ error: "Location is required in the request body" });
    }
    const validLocations = ["onlocation", "remote", "hybrid"];
    if (!validLocations.includes(req.body.location)) {
      return res.status(422).json({
        error:
          "Invalid location. Accepted values are 'onlocation', 'remote', or 'hybrid'.",
      });
    }
    const formattedText = req.file
      ? await pdfFunction(req.file.buffer, ip)
      : cache.get(ip);

    if (!formattedText) {
      return res.status(500).json({ error: "Failed to process PDF content." });
    }

    const response = await fetchSkillsExperienceLocationFromPdf(formattedText);
    let { skills, location, experience } = response;

    if (!skills || !location || !experience) {
      console.log(response);
      return res.status(422).json({
        error:
          "Required details (skills, location, experience) not found in PDF.",
      });
    }

    console.log("Details extracted:", skills, location, experience);

    if (req.body.location == "remote") {
      location = "remote";
    }
    if (req.body.location == "hybrid") {
      location = location + " or remote";
    }
    console.log(location);
    const jobDetails = await searchAndScrapeJobDetails(
      skills,
      location,
      experience
    );

    if (!jobDetails || jobDetails.length === 0) {
      return res
        .status(404)
        .json({ message: "No job listings found based on provided details." });
    }

    res.status(200).json(jobDetails);
  } catch (error) {
    console.error("Error in getAvailableJobs:", error);
    res
      .status(500)
      .json({ error: "An unexpected error occurred. Please try again later." });
  }
};
