import pdfParser from "pdf-parser";
import axios from "axios";
import { User } from "../model/user.mjs";

// API Endpoint Constants
const CLOUDFLARE_BASE_URL = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/`;
const AUTHORIZATION_HEADER = {
  Authorization: `Bearer ${process.env.CLOUDFLARE_TOKEN}`,
  "Content-Type": "application/json",
};

// Main function to handle PDF processing
export const pdfFunction = async (filePath) => {
  // Parse the PDF file from the given path
  const pdfData = await parsePdf(filePath);
  const formattedText = pdfData.text.replace(/\n\n/g, "\n");
  return formattedText;
};

// Middleware for getting insights
export const getInsights = async (req, res) => {
  const userId = req.user.id; // Assuming you're using some form of authentication
  try {
    const user = await User.findById(userId).select("pdfAddress");

    if (!user || !user.pdfAddress) {
      return res
        .status(404)
        .json({ error: "No PDF address found for the user" });
    }

    const formattedText = await pdfFunction(user.pdfAddress);
    const insightsMessages = createInsightsMessages(formattedText);
    const insights = await fetchFromCloudflare(insightsMessages);

    if (!insights) {
      return res.status(500).json({ error: "Failed to fetch insights" });
    }

    res.status(200).json({ insights: insights.result.response });
  } catch (error) {
    console.error("Error fetching insights:", error);
    res.status(500).json({
      error: "Failed to fetch insights",
      details: error.message,
    });
  }
};

// Middleware for getting salary ranges
export const getSalaryRanges = async (req, res) => {
  const userId = req.user.id; // Assuming you're using some form of authentication
  if (!req.body.location) {
    return res.status(400).json({ error: "No location specified" });
  }

  try {
    const user = await User.findById(userId).select("pdfAddress");

    if (!user || !user.pdfAddress) {
      return res
        .status(404)
        .json({ error: "No PDF address found for the user" });
    }

    const formattedText = await pdfFunction(user.pdfAddress);
    const salaryMessages = createSalaryMessages(
      formattedText,
      req.body.location
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
async function parsePdf(filePath) {
  return new Promise((resolve, reject) => {
    pdfParser.pdf2json(filePath, (error, pdfData) => {
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

// Function to create messages for insights
function createInsightsMessages(formattedText) {
  return [
    {
      role: "system",
      content: `You are a helpful bot helping me to get an overview of my resume. Keep the response limited to 60 words. Based on my resume, don't tell me about the things I have already mentioned, such as my education and internships. Create an overview with insights like salary range, job titles, pay scale, and rate of difficulty to get placed. Your response should sound human. Don't list out the insights specifically, but mend them within the response. Remember that the job should be localized based on the location specified in my resume. Your response is the last response in the conversation, and there are no more questions that should be asked.`,
    },
    {
      role: "user",
      content: formattedText,
    },
  ];
}

// Function to create messages for salary ranges
function createSalaryMessages(formattedText, location) {
  return [
    {
      role: "system",
      content: `Generate a list of jobs along with their corresponding salary ranges based on the provided resume text. Ensure that the salary ranges are relevant to the skills and experience mentioned in the resume. The response should include job titles and salary ranges in a professional manner. The JSON format must strictly follow this structure: [{ "job": "Job Title", "salary": "Salary Range" }, ...]. Do not include anything else in the response other than this JSON format.`,
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
    let title = parts[0]; // Default title to the first part of the domain
    const favicon = `https://www.google.com/s2/favicons?domain=${link}`;

    return { link, title, favicon };
  });
}
