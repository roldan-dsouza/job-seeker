import pdfParser from "pdf-parser";
import NodeCache from "node-cache";

export const cache = new NodeCache({ stdTTL: 3600 });

// Function to parse the PDF using pdf-parser
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

// Main function to handle PDF processing
export const pdfFunction = async (buffer, ip) => {
  // Check cache
  const cachedData = cache.get(ip);
  if (cachedData) {
    return cachedData; // Return cached data if available
  }

  // Parse the PDF file
  const pdfData = await parsePdf(buffer);
  const formattedText = pdfData.text.replace(/\n\n/g, "\n");

  // Store in cache
  cache.set(ip, formattedText); // Cache the processed text
  return formattedText;
};
