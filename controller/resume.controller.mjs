import multer from "multer";
import { fetchNameLocationJobTitlesExperienceFromPdf } from "../utils/userData.mjs";
import { parsePdf } from "../utils/pdf-functions.mjs";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const uploadResume = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "PDF file is required" });
  }
  try {
    const user = await User.findById(req.user.userid);
    if (!user) {
      return res.status(404).json({ error: "User with that ID doesn't exist" });
    }

    if (user.pdfAddress) {
      fs.unlink(user.pdfAddress, (err) => {
        if (err) console.error("Failed to delete old PDF:", err);
      });
    }

    const pdfPath = req.file.path;
    const pdfData = await parsePdf(pdfPath);
    const formattedText = pdfData.text.replace(/\n\n/g, "\n");
    const userData = await fetchNameLocationJobTitlesExperienceFromPdf(pdfPath);
    console.log(userData);

    // Update user document with new PDF and extracted data
    await User.findByIdAndUpdate(
      req.user.userid,
      {
        pdfAddress: pdfPath,
        formattedText: formattedText,
        userName: userData.name,
        jobTitle: userData.jobTitle,
        skills: userData.skills,
        location: userData.location,
        experience: userData.experience,
      },
      { new: true }
    );

    // Respond with success and extracted data
    res.status(200).json({ pdfAddress: pdfPath, formattedText: formattedText });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const uploadMiddleware = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, path.join(__dirname, "../public/uploads"));
    },
    filename: (req, file, cb) => {
      const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, uniqueName + path.extname(file.originalname));
    },
  }),
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("Only PDF files are allowed!"), false);
    }
    cb(null, true);
  },
}).single("pdfFile");
