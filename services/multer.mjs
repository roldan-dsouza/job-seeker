import multer from "multer";

// Set up multer storage in memory
const storage = multer.memoryStorage();

export const upload = multer({
  storage: storage,
}).single("pdfFile");
