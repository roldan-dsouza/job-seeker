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
} from "../controller/authController.mjs";
import { searchJobsWithPuppeteer } from "../controller/pdfController.mjs";
import multer from "multer";
import path from "path";
const router = Router();

router.post("/initialSignUp", initialSignup);
router.post("/finalSignUp", uploadMiddleware, finalSignup);
router.get("/login", login);
router.post("/insights", getInsights);
router.post("/salaryRange", getSalaryRanges);
router.post("/jobLinksScrap", searchJobsWithPuppeteer);

export default router;
