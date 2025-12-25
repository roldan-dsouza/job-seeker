// Function to fetch job links specifically
export async function fetchJobLinks(messages) {
  return await fetchFromCloudflare(messages);
}

// Function to fetch salary ranges specifically
export async function fetchSalaryRanges(messages) {
  return await fetchFromCloudflare(messages);
}

// Function to extract links from the response text
export function extractLinks(text) {
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
