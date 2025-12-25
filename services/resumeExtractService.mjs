import { pdfFunction } from "../utils/pdf-functions.mjs";
import { nameLocationJobTitlePrompt } from "../prompt/resumePrompt.mjs";
import { fetchFromCloudflare } from "./cloud-flare/cloudFLare.mjs";
import { extractJsonFromAiResponse } from "../utils/userData.mjs";

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
