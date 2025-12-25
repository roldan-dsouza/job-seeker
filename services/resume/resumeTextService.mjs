import { pdfFunction } from "../../utils/pdf-functions.mjs";

import { cache } from "../../utils/pdf-functions.mjs";
export const getResumeText = async ({ file, ip }) => {
  if (file) {
    const text = await pdfFunction(file.buffer, ip);
    cache.set(ip, text);
    return text;
  }

  const cached = cache.get(ip);
  if (!cached) {
    throw new Error("NO_RESUME_DATA");
  }

  return cached;
};
