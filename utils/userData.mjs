import axios from "axios";
import { withRetry } from "./retry.mjs";
import { pdfFunction } from "./pdf-functions.mjs";
const CLOUDFLARE_BASE_URL = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/`;
const AUTHORIZATION_HEADER = {
  Authorization: `Bearer ${process.env.CLOUDFLARE_TOKEN}`,
  "Content-Type": "application/json",
};

export const extractJsonFromAiResponse = (responseText) => {
  const jsonMatch = responseText.match(/{.*}/s);

  if (!jsonMatch) {
    throw new Error("Failed to extract JSON from AI response");
  }

  return JSON.parse(jsonMatch[0]);
};

export const extractJsonFromText = (text) => {
  const match = text.match(/{[\s\S]*}/);
  if (!match) throw new Error("JSON not found");
  return JSON.parse(match[0].replace(/'/g, '"'));
};

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
        "Extract only the person's name, city name, and job title from the following resume text. Return them in JSON format as { 'name': '<person's name>', 'location': '<city name>', 'jobTitle': '<title>', 'skills':['<skills>(skills based on the resume)'], 'experience':'<person's experience>(beginner intermediate or senior nothing else and be very strict)' }. jobTitle means the type of job I can apply to send the title of job not the skill. Do not send anything other than the name, location, and job title in JSON format like NOTHING else",
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

    const responseText = response.data.result.response;

    const jsonResponseMatch = responseText.match(/{.*}/s);
    if (!jsonResponseMatch) {
      console.log("Retrying: JSON response missing...");
      return await fetchNameLocationJobTitlesExperienceFromPdf(buffer, ip);
    }

    const parsedData = JSON.parse(jsonResponseMatch[0]);

    const requiredFields = [
      "name",
      "location",
      "jobTitle",
      "skills",
      "experience",
    ];
    for (const field of requiredFields) {
      if (
        !parsedData[field] ||
        (Array.isArray(parsedData[field]) && !parsedData[field].length)
      ) {
        console.log(`Retrying: Missing field "${field}"...`);
        return await fetchNameLocationJobTitlesExperienceFromPdf(buffer, ip);
      }
    }

    const name = parsedData["name"];
    const location = parsedData["location"];
    const jobTitle = parsedData["jobTitle"];
    const skills = parsedData["skills"];
    const experience = parsedData["experience"];
    return { name, location, jobTitle, experience, skills };
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
