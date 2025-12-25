import { pdfFunction } from "../utils/pdf-functions.mjs";
import {
  nameLocationJobTitlePrompt,
  skillExperienceLocationPrompt,
  nameLocationJobTitleExperiencePrompt,
} from "../prompt/resumePrompt.mjs";
import { fetchFromCloudflare } from "./cloud-flare/cloudFLare.mjs";
import {
  extractJsonFromAiResponse,
  extractJsonFromText,
} from "../utils/userData.mjs";
import { withRetry } from "../utils/retry.mjs";

export const fetchNameLocationAndJobTitleFromPdf = async (buffer, ip) => {
  const formattedText = await pdfFunction(buffer, ip);

  const messages = [
    nameLocationJobTitlePrompt,
    { role: "user", content: formattedText },
  ];

  const aiResponse = await fetchFromCloudflare(messages);
  const parsedData = extractJsonFromAiResponse(aiResponse);

  return {
    name: parsedData.name,
    location: parsedData.location,
    jobTitle: parsedData["job title"],
  };
};

export const fetchSkillsExperienceLocationFromPdf = async (formattedText) => {
  return withRetry(async () => {
    const response = await fetchFromCloudflare([
      skillExperienceLocationPrompt,
      { role: "user", content: formattedText },
    ]);

    const parsed = extractJsonFromText(response.result.response);

    return {
      skills: parsed.skills,
      experience: parsed.experience,
      location: parsed.location,
    };
  });
};

export const fetchNameLocationJobTitlesExperienceFromPdf = async (
  buffer,
  ip
) => {
  return withRetry(async () => {
    const formattedText = await pdfFunction(buffer, ip);

    const response = await fetchFromCloudflare([
      nameLocationJobTitleExperiencePrompt,
      { role: "user", content: formattedText },
    ]);

    const parsed = extractJsonFromText(response.result.response);

    const required = ["name", "location", "jobTitle", "skills", "experience"];
    for (const field of required) {
      if (
        !parsed[field] ||
        (Array.isArray(parsed[field]) && !parsed[field].length)
      ) {
        throw new Error(`Missing field: ${field}`);
      }
    }

    return {
      name: parsed.name,
      location: parsed.location,
      jobTitle: parsed.jobTitle,
      skills: parsed.skills,
      experience: parsed.experience,
    };
  });
};
