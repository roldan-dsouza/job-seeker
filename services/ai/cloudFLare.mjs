import axios from "axios";

// API Endpoint Constants
const CLOUDFLARE_BASE_URL = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/`;
const AUTHORIZATION_HEADER = {
  Authorization: `Bearer ${process.env.CLOUDFLARE_TOKEN}`,
  "Content-Type": "application/json",
};

// Function to fetch data from Cloudflare API using Axios
export async function fetchFromCloudflare(messages) {
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

