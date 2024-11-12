import multer from "multer";
import pdfParser from "pdf-parser";
import axios from "axios";
import NodeCache from "node-cache";
import { fork } from "child_process";
import path from "path";
import { realpathSync } from "fs";
import { error } from "console";
import { getCityFromIP } from "../functions/geolocation.mjs";
import {
  fetchNameLocationAndJobTitleFromPdf,
  fetchSkillsExperienceLocationFromPdf,
} from "../functions/userData.mjs";
import { searchAndScrapeJobDetails } from "../functions/searchJobs.mjs";

// Set up multer storage in memory
const storage = multer.memoryStorage();

export const validateFileType = (req, res, next) => {
  if (!req.file) return next();
  if (req.file.mimetype !== "application/pdf") {
    return res
      .status(400)
      .json({ error: "Invalid file format. Only PDF files are allowed!" });
  }
  next();
};

export const upload = multer({
  storage: storage,
}).single("pdfFile");

const cache = new NodeCache({ stdTTL: 3600 });

// API Endpoint Constants
const CLOUDFLARE_BASE_URL = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/`;
const AUTHORIZATION_HEADER = {
  Authorization: `Bearer ${process.env.CLOUDFLARE_TOKEN}`,
  "Content-Type": "application/json",
};

// Main function to handle PDF processing
export const pdfFunction = async (buffer, ip) => {
  // Check cache
  const cachedData = cache.get(ip);
  if (cachedData) {
    return cachedData; // Return cached data if available
  }

  // Parse the PDF file
  const pdfData = await parsePdf(buffer);
  const formattedText = pdfData.text.replace(/\n\n/g, "\n");

  // Store in cache
  cache.set(ip, formattedText); // Cache the processed text
  return formattedText;
};

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
``;
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

// Function to parse the PDF using pdf-parser
export async function parsePdf(buffer) {
  return new Promise((resolve, reject) => {
    pdfParser.pdf2json(buffer, (error, pdfData) => {
      if (error) {
        return reject(error);
      }
      const text = pdfData.pages
        .map((page) => page.texts.map((text) => text.text).join(" "))
        .join("\n");
      resolve({ text });
    });
  });
}

// ... [Rest of the functions remain unchanged]

// Function to create messages for insights
function createInsightsMessages(formattedText) {
  return [
    {
      role: "system",
      content: `You are a helpful bot helping me to get an overview of my resume. Keep the response limited to 100 words. Based on my resume, don't tell me about the things I have already mentioned, such as my education and internships. Create an overview with insights like salary range, job titles, pay scale, and rate of difficulty to get placed. Your response should sound human. Don't list out the insights specifically, but mend them within the response. Remember that the job should be localized based on the location specified in my resume. Your response is the last response in the conversation, and there are no more questions that should be asked,and remember if it is not a valid resume just send "invalid resume" no other text other than this should be sent in that case`,
    },
    {
      role: "user",
      content: formattedText,
    },
  ];
}

// Function to create messages for job links
function createJobMessages(formattedText, location) {
  return [
    {
      role: "system",
      content: `Based on the provided text from a resume, generate a list of links to apply for jobs using the skills and locations from my resume. DO NOT respond with anything other than the list of posts, only the links. Also, do not give links where results are none, and if the desired location is in India, then search in naukri.com.`,
    },
    {
      role: "user",
      content: formattedText + ` job location preference ${location}`,
    },
  ];
}

// Function to create messages for salary ranges
function createSalaryMessages(formattedText, location) {
  return [
    {
      role: "system",
      content: `Generate a list of jobs along with their corresponding salary ranges (minimum and maximum) per annum based on the provided resume text. Ensure that the salary ranges are relevant to the skills and experience mentioned in the resume. Provide the full annual salary amounts as numbers (e.g., 700000, not 7-8 lakhs), and base the currency code on the job location (e.g., 'INR' for India, 'USD' for the United States). 

      The response must strictly follow this JSON format and include nothing else: 
      [
        { 
          "job": "Job Title", 
          "salary": { 
            "min": <full number without currency>, 
            "max": <full number without currency> 
          }, 
          "currency": "<currency code based on location>"
        }, 
        ...
      ]
      
      Do not include any additional explanations, introductory text, or messages. The output should only be in the JSON format above with no extra text.`,
    },
    {
      role: "user",
      content: formattedText + ` job location preference ${location}`,
    },
  ];
}

// Function to fetch data from Cloudflare API using Axios
async function fetchFromCloudflare(messages) {
  try {
    const response = await axios.post(
      `${CLOUDFLARE_BASE_URL}${process.env.LLAMA_END_POINT}`,
      { messages },
      { headers: AUTHORIZATION_HEADER }
    );

    return response.data;
  } catch (error) {
    console.error(
      "Error fetching from Cloudflare:",
      error.response?.data || error.message
    );
    return null;
  }
}

// Function to fetch job links specifically
async function fetchJobLinks(messages) {
  return await fetchFromCloudflare(messages);
}

// Function to fetch salary ranges specifically
async function fetchSalaryRanges(messages) {
  return await fetchFromCloudflare(messages);
}

// Function to extract links from the response text
function extractLinks(text) {
  // Check if text is in the expected format
  if (!text || typeof text !== "string") {
    console.error("Invalid input for extractLinks:", text);
    return []; // Return empty array if input is invalid
  }

  // Regular expression to match URLs in the response text
  const regex = /https?:\/\/[^\s]+/g;
  const links = text.match(regex) || []; // Extract links or return empty array

  // Return an array of objects with the link, title, and favicon
  return links.map((link) => {
    const domain = link.replace(/(^\w+:|^)\/\//, "").replace("www.", "");
    const parts = domain.split(".");
    let title = parts.length > 2 ? parts[1] : parts[0]; // Get the domain title
    title = title.charAt(0).toUpperCase() + title.slice(1); // Capitalize the title
    const favicon = `https://www.google.com/s2/favicons?sz=64&domain_url=${link}`; // Favicon URL

    return { link, title, favicon }; // Return an object with link data
  });
}

export const searchJobsWithPuppeteer = async (req, res) => {
  let { location } = req.body; // Get location from request body
  const ip = req.ip; // Get the user's IP address

  try {
    let formattedText;
    if (req.file) {
      // If a file is uploaded, extract data from it
      formattedText = await pdfFunction(req.file.buffer, ip);
    } else {
      // If no file is uploaded, check the cache
      const cachedData = cache.get(ip);
      if (!cachedData) {
        return res
          .status(400)
          .json({ error: "No PDF uploaded and no cached data available." });
      }
      formattedText = cachedData;
    }

    // Fetch skill and experience level using the AI function
    const result = await fetchJobDetailsFromPdf(formattedText);
    if (location === "onlocation") location = result.location;
    console.log(result);
    if (!skill || !experienceLevel) {
      return res
        .status(400)
        .json({ error: "Failed to extract skill and experience level." });
    }

    const jobSearchScript = path.resolve("./scrap.mjs");
    console.log(
      "Forking child process with arguments:",
      skill,
      location,
      experienceLevel
    );

    const child = fork(jobSearchScript, [skill, location, experienceLevel]);

    child.on("message", (jobResults) => {
      console.log("Job results from child process:", jobResults); // Debug log

      if (jobResults.status === "success") {
        return res.status(200).json({ jobs: jobResults.data });
      } else {
        return res.status(500).json({
          error: jobResults.error || "Failed to fetch job listings.",
        });
      }
    });

    child.on("error", (error) => {
      console.error("Error in child process:", error);
      res.status(500).json({
        error: "Failed to fetch job listings due to child process error.",
      });
    });

    child.on("exit", (code) => {
      if (code !== 0) {
        console.error(`Child process exited with code ${code}`);
        res.status(500).json({ error: "Child process exited with an error." });
      }
    });
  } catch (error) {
    console.error("Error in searchJobsWithPuppeteer:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

async function fetchJobDetailsFromPdf(formattedText) {
  const skillMessage = {
    role: "system",
    content:
      "Extract a single eligible job title, location (city), and experience level from the following resume text. Return the result as JSON in the format { 'jobTitle': '<title>', 'location': '<city>', 'experience level': '<level>' }. Do not send anything else.",
  };

  const userMessage = {
    role: "user",
    content: formattedText,
  };

  try {
    const response = await axios.post(
      `${CLOUDFLARE_BASE_URL}${process.env.LLAMA_END_POINT}`,
      { messages: [skillMessage, userMessage] },
      { headers: AUTHORIZATION_HEADER }
    );

    // Log the raw response
    console.log("Raw response from AI:", response.data);

    // Extract the response text from the result
    const responseText = response.data.result.response;

    // Attempt to parse the response text directly as JSON
    const parsedData = JSON.parse(responseText);

    // Log the parsed data for debugging
    console.log("Parsed job details from AI response:", parsedData);

    // Extract and return the job details
    const {
      jobTitle,
      location,
      "experience level": experienceLevel,
    } = parsedData;
    return { jobTitle, location, experienceLevel };
  } catch (error) {
    console.error("Error fetching job details:", error.message);
    throw new Error("Failed to fetch job details from the AI model.");
  }
}

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
