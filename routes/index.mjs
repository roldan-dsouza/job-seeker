import { Router } from "express";
import {
  getInsights,
  getJobLinks,
  getSalaryRanges,
  pdfFunction,
  searchJobsWithPuppeteer,
  upload,
  validateFileType,
} from "../controller/pdfController.mjs";

const router = Router();

router.post("/insights", upload, validateFileType, getInsights);
router.post("/jobLinks", upload, validateFileType, getJobLinks);
router.post("/salaryRange", upload, validateFileType, getSalaryRanges);
router.post("/jobLinksScrap", searchJobsWithPuppeteer);

export default router;
