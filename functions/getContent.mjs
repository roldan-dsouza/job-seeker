import axios from "axios";
import { content } from "../model/content.mjs";
import { User } from "../model/user.mjs";

const CLOUDFLARE_BASE_URL = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/`;
const AUTHORIZATION_HEADER = {
  Authorization: `Bearer ${process.env.CLOUDFLARE_TOKEN}`,
  "Content-Type": "application/json",
};

export async function generateContent(platform, id) {
  try {
    const user = await User.findOne({ _id: id });
    if (!user) {
      return { success: false, message: "noUser" };
    }
    if (!user.pdfAddress) {
      return { success: false, message: "noPdf" };
    }

    const jobTitle = user.jobTitle;
    const formattedText = user.formattedText;
    if (!formattedText) {
      return { success: false, message: "Formatted resume text is missing" };
    }

    const systemMessage = {
      role: "system",
      content: `
              Generate a job application message body to publish for the platform "${platform}".
              The content should include the fact that the user is seeking a job for the position of "${jobTitle}".
              Use the following resume text as the basis for the message:
              The response should be in JSON format and should contain only the content. No other information and do not say anything else other than the response.
              example response {'message':'<response>'}.
            `,
    };

    const userMessage = {
      role: "user",
      content: `${formattedText}\n\nPlatform: ${platform}\nJob Title: ${jobTitle}`,
    };

    const response = await axios.post(
      `${CLOUDFLARE_BASE_URL}${process.env.LLAMA_END_POINT}`,
      { messages: [systemMessage, userMessage] },
      { headers: AUTHORIZATION_HEADER }
    );
    const responseText = response.data.result.response;

    let cleanedResponseText = responseText
      .replace(/[\x00-\x1F\x7F]/g, "")
      .replace(/<p>.*?<\/p>/g, "")
      .trim();

    const jsonResponseMatch = cleanedResponseText.match(/{.*}/s);

    if (!jsonResponseMatch) {
      console.log("Retrying: JSON response missing...");
      return await generateContent(platform, id);
    }

    const parsedData = JSON.parse(jsonResponseMatch[0]);
    return { success: true, body: parsedData };
  } catch (error) {
    console.error("Error generating content:", error.message);
    return {
      success: false,
      message: `Error generating content: ${error.message}`,
    };
  }
}
