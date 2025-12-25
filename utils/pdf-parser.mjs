import pdfParser from "pdf-parser";

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
