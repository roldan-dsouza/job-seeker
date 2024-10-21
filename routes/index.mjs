import { Router } from "express";
import {
  getInsights,
  getJobLinks,
  getSalaryRanges,
  pdfFunction,
  searchJobsWithPuppeteer,
  upload,
} from "../controller/pdfController.mjs";

const router = Router();

router.post("/insights", upload, getInsights);
router.post("/jobLinks", upload, getJobLinks);
router.post("/salaryRange", upload, getSalaryRanges);
router.post("/jobLinksScrap", searchJobsWithPuppeteer);

export default router;
