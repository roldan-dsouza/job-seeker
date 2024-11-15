import axios from "axios";
import path from "path";
import os from "os";
import fs from "fs";
import pdfParser from "pdf-parser";
import { getAvailableJobs, getJobLinks } from "../controller/pdfController.mjs";

const CLOUDFLARE_BASE_URL = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/`;
const AUTHORIZATION_HEADER = {
  Authorization: `Bearer ${process.env.CLOUDFLARE_TOKEN}`,
  "Content-Type": "application/json",
};

export async function fetchNameLocationAndJobTitleFromPdf(buffer, ip) {
  console.log("Destination 1");
  try {
    const formattedText = await pdfFunction(buffer, ip);
    const nameLocationTitleMessage = {
      role: "system",
      content:
        "Extract only the person's name, city name, and job title from the following resume text. Return them in JSON format as { 'name': '<person's name>', 'location': '<city name>', 'job title': '<title>' }. jobTitle means the type of job I can apply to and only send 1 and be specific of the job name. Do not send anything other than the name, location, and job title in JSON format like NOTHING else",
    };
    const userMessage = {
      role: "user",
      content: `${formattedText}`,
    };
    const response = await axios.post(
      `${CLOUDFLARE_BASE_URL}${process.env.LLAMA_END_POINT}`,
      { messages: [nameLocationTitleMessage, userMessage] },
      { headers: AUTHORIZATION_HEADER }
    );

    // Log the raw response for debugging
    console.log("Raw response from AI:", response.data);

    // Extract the response text from the result
    const responseText = response.data.result.response;

    // Clean the responseText to extract only the JSON part
    const jsonResponseMatch = responseText.match(/{.*}/s);
    if (!jsonResponseMatch) {
      throw new Error("Failed to extract JSON from response");
    }

    // Parse the JSON response
    const parsedData = JSON.parse(jsonResponseMatch[0]);

    // Log the parsed data for debugging
    console.log(
      "Parsed name, location, and job title from AI response:",
      parsedData
    );

    // Extract and return the name, location, and job title
    const name = parsedData["name"];
    const location = parsedData["location"];
    const jobTitle = parsedData["job title"];
    return { name, location, jobTitle };
  } catch (error) {
    console.error(
      "Error fetching name, location, and job title:",
      error.message
    );
    throw new Error(
      "Failed to fetch name, location, and job title from the AI model."
    );
  }
}

const pdfFunction = async (buffer, ip) => {
  // Parse the PDF file
  const pdfData = await parsePdf(buffer);
  const formattedText = pdfData.text.replace(/\n\n/g, "\n");
  return formattedText;
};

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

export async function fetchSkillsExperienceLocationFromPdf(formattedText) {
  console.log("Destination 2");
  try {
    const skillExperienceLocationMessage = {
      role: "system",
      content:
        "Extract only the primary skill, total years of experience (categorized as beginner, intermediate, or senior), and city location from the following resume text. Return them in JSON format as { 'skills': '<one primary skill do not say a framework but general name of job>', 'experience': '<beginner, intermediate, or senior>', 'location': '<city name (check properly and if not found state name)>' }. Select only one skill that best represents the candidate's expertise and use it in singular form. Provide only these fields in JSON format, with no additional information.",
    };
    const userMessage = {
      role: "user",
      content: `${formattedText}`,
    };
    const response = await axios.post(
      `${CLOUDFLARE_BASE_URL}${process.env.LLAMA_END_POINT}`,
      { messages: [skillExperienceLocationMessage, userMessage] },
      { headers: AUTHORIZATION_HEADER }
    );

    // Extract the response text from the result
    const responseText = response.data.result.response;

    // Clean the responseText to isolate only the JSON part
    const jsonResponseMatch = responseText.match(/{[\s\S]*}/);
    if (!jsonResponseMatch) {
      throw new Error("Failed to extract JSON from response");
    }

    // Parse the JSON response
    const parsedData = JSON.parse(jsonResponseMatch[0].replace(/'/g, '"'));

    // Extract and return the skills, experience, and location
    const skills = parsedData["skills"];
    const experience = parsedData["experience"];
    const location = parsedData["location"];
    return { skills, experience, location };
  } catch (error) {
    return await fetchSkillsExperienceLocationFromPdf(formattedText);
    throw new Error(
      "Failed to fetch skills, experience, and location from the AI model."
    );
  }
}

export async function fetchNameLocationJobTitlesExperienceFromPdf(buffer, ip) {
  try {
    const formattedText = await pdfFunction(buffer, ip);
    const nameLocationTitleMessage = {
      role: "system",
      content:
        "Extract only the person's name, city name, and job title from the following resume text. Return them in JSON format as { 'name': '<person's name>', 'location': '<city name>', 'jobTitle': '<title>', skills:[<skills>], 'experience':'<person's experience>(beginner intermediate or senior nothing else and be very strict)' }. jobTitle means the type of job I can apply to send the title of job not the skill. Do not send anything other than the name, location, and job title in JSON format like NOTHING else",
    };
    const userMessage = {
      role: "user",
      content: `${formattedText}`,
    };
    const response = await axios.post(
      `${CLOUDFLARE_BASE_URL}${process.env.LLAMA_END_POINT}`,
      { messages: [nameLocationTitleMessage, userMessage] },
      { headers: AUTHORIZATION_HEADER }
    );

    // Extract the response text from the result
    const responseText = response.data.result.response;

    // Clean the responseText to extract only the JSON part
    const jsonResponseMatch = responseText.match(/{.*}/s);
    if (!jsonResponseMatch) {
      await fetchNameLocationJobTitlesExperienceFromPdf(buffer, ip);
    }

    // Parse the JSON response
    const parsedData = JSON.parse(jsonResponseMatch[0]);

    console.log(parsedData.jobTitle);
    // Extract and return the name, location, and job title
    const name = parsedData["name"];
    const location = parsedData["location"];
    const jobTitle = parsedData["jobTitle"];
    const skills = parsedData["skills"];
    const experience = parsedData["experience"];
    return { name, location, jobTitle, experience ,skills};
  } catch (error) {
    console.error(
      "Error fetching name, location, and job title:",
      error.message
    );
    throw new Error(
      "Failed to fetch name, location, and job title from the AI model."
    );
  }
}
