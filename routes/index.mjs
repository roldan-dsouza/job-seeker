import { Router } from "express";
import {
  getAvailableJobs,
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
router.get("/jobLinksScrap", upload, validateFileType, searchJobsWithPuppeteer);
router.get("/getJobs", upload, validateFileType, getAvailableJobs);

export default router;
