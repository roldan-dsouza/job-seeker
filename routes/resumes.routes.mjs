import {
  getInsights,
  getSalaryRanges,
} from "../controller/signedInUserPdfController.mjs";
import { Router } from "express";
import { searchJobsWithPuppeteer } from "../controller/pdfController.mjs";
import { allContent, getContent } from "../controller/contentController.mjs";
import { verifyToken } from "../jwtToken.mjs";
import {
  uploadResume,
  uploadMiddleware,
} from "../controller/resume.controller.mjs";

const router = Router();

router.post("/insights", getInsights);
router.post("/salaryRange", getSalaryRanges);
router.post("/jobLinksScrap", searchJobsWithPuppeteer);
router.post("/uploadResume", verifyToken, uploadMiddleware, uploadResume);
router.post("/uploadContent", verifyToken, getContent);
router.post("/allContent", verifyToken, allContent);

export default router;
