import { Router } from "express";
import {
  getAvailableJobs,
  getInsightsResume,
  getJobLinks,
  getSalaryRanges,
  searchJobsWithPuppeteer,
} from "../controller/pdfController.mjs";
import { upload } from "../services/multer.mjs";
import { validateFileType } from "../helper/pdf.helper.mjs";

const router = Router();

router.post("/insights", upload, validateFileType, getInsightsResume);
router.post("/jobLinks", upload, validateFileType, getJobLinks);
router.post("/salaryRange", upload, validateFileType, getSalaryRanges);
router.get("/jobLinksScrap", upload, validateFileType, searchJobsWithPuppeteer);
router.get("/getJobs", upload, validateFileType, getAvailableJobs);

export default router;
