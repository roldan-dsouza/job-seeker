import multer from "multer";
import pdfParser from "pdf-parser";
import axios from "axios";
import NodeCache from "node-cache";

// Set up multer storage in memory
const storage = multer.memoryStorage();
export const upload = multer({ storage }).single("pdfFile");

const cache = new NodeCache({ stdTTL: 86400 });

// API Endpoint Constants
const CLOUDFLARE_BASE_URL = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/`;
const AUTHORIZATION_HEADER = {
  Authorization: `Bearer ${process.env.CLOUDFLARE_TOKEN}`,
  "Content-Type": "application/json",
};

// Main function to handle PDF processing
export const pdfFunction = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }
  const { location } = req.body;
  if (!location) {
    return res.status(400).json({ error: "Job-location is not specified" });
  }
  if (
    location !== "onLocation" &&
    location !== "remote" &&
    location !== "hybrid"
  ) {
    return res.status(404).json({ error: "Invalid location preference" });
  }

  try {
    // Parse the PDF file
    const pdfData = await parsePdf(req.file.buffer);
    const formattedText = pdfData.text.replace(/\n\n/g, "\n");

    // Store parsed PDF data in cache
    cache.set(req.file.originalname, pdfData);

    // Prepare messages for the API requests
    const messages = createMessages(formattedText);
    const jobsmessages = createJobMessages(formattedText, location); // Pass location here

    // Fetch insights from Cloudflare API
    const insights = await fetchFromCloudflare(messages);
    if (!insights) {
      return res.status(500).json({ error: "Failed to fetch insights" });
    }

    // Fetch job links from Cloudflare API
    const jobs = await fetchFromCloudflare(jobsmessages);
    if (!jobs) {
      return res.status(500).json({ error: "Failed to fetch job links" });
    }

    // Send the cleaned response back to the client
    res
      .status(200)
      .json({ insights, jobs: extractLinks(jobs.result.response) });
  } catch (error) {
    console.error("Error processing PDF:", error);
    res.status(500).json({
      error: "Failed to process PDF or fetch insights",
      details: error.message,
    });
  }
};

// Function to parse the PDF using pdf-parser
async function parsePdf(buffer) {
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

// Function to create messages for insights
function createMessages(formattedText) {
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

// Function to create messages for job links
function createJobMessages(formattedText, location) {
  // Accept location here
  return [
    {
      role: "system",
      content: `Based on the provided text from a resume, generate a list of links to apply for jobs using the skills and locations from my resume. DO NOT respond with anything other than the list of posts, only the links.also do not give links wher results are none and if wanted location is in india then search in naukri.com`,
    },
    {
      role: "user",
      content: formattedText + ` job location preference ${location}`, // Use location here
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

    return response.data; // Return the data from the response
  } catch (error) {
    console.error(
      "Error fetching from Cloudflare:",
      error.response?.data || error.message
    );
    return null; // Return null on error
  }
}

// Function to extract links from the response text
function extractLinks(text) {
  const regex = /https?:\/\/[^\s]+/g; // Match URLs
  const links = text.match(regex) || []; // Get matches or return empty array

  return links.map((link) => {
    const domain = link.replace(/(^\w+:|^)\/\//, "").replace("www.", "");
    const parts = domain.split(".");
    let title = parts.length > 2 ? parts[1] : parts[0];
    title = title.charAt(0).toUpperCase() + title.slice(1); // Capitalize title
    const favicon = `https://www.google.com/s2/favicons?sz=64&domain_url=${link}`; // Favicon URL

    return { link, title, favicon }; // Return link object
  });
}
