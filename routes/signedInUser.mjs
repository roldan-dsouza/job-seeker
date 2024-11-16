import { Router } from "express";
import {
  getInsights,
  getSalaryRanges,
} from "../controller/signedInUserPdfController.mjs";
import {
  finalSignup,
  initialSignup,
  login,
  uploadMiddleware,
  uploadResume,
} from "../controller/authController.mjs";
import { searchJobsWithPuppeteer } from "../controller/pdfController.mjs";
import multer from "multer";
import path from "path";
import { getContent } from "../controller/contentController.mjs";
const router = Router();

router.post("/initialSignUp", initialSignup);
router.post("/finalSignUp", finalSignup);
router.post("/login", login);
router.post("/insights", getInsights);
router.post("/salaryRange", getSalaryRanges);
router.post("/jobLinksScrap", searchJobsWithPuppeteer);
router.post("/uploadResume", uploadMiddleware, uploadResume);
router.post("/getContent", getContent);

export default router;
