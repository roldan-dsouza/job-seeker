import { Router } from "express";
import {
  getInsights,
  getSalaryRanges,
} from "../controller/signedInUserPdfController.mjs";
import { signup } from "../controller/authController.mjs";
import { searchJobsWithPuppeteer } from "../controller/pdfController.mjs";

const router = Router();

router.post("/signUp", signup);
router.post("/insights", getInsights);
router.post("/salaryRange", getSalaryRanges);
router.post("/jobLinksScrap", searchJobsWithPuppeteer);

export default router;
