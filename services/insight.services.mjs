import { createInsightsMessages } from "../prompt/resumePrompt.mjs";
import { fetchFromCloudflare } from "./ai/cloudFLare.mjs";
import { parseAIJson } from "../utils/jsonParser.mjs";

export const getInsights = async (formattedText) => {
  try {
    const insightsMessages = createInsightsMessages(formattedText);
    const insights = await fetchFromCloudflare(insightsMessages);

    if (!insights) {
      const err = new Error("Failed to fetch insights");
      err.statusCode = 500;
      throw err;
    }

    return parseAIJson(insights.result.response);
  } catch (error) {
    console.error("Error fetching insights:", error);
    throw error;
  }
};
