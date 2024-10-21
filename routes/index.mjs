import { Router } from "express";
import {
  getInsights,
  getJobLinks,
  getSalaryRanges,
  pdfFunction,
  upload,
} from "../controller/pdfController.mjs";

const router = Router();

router.post("/insights", upload, getInsights);
router.post("/jobLinks", upload, getJobLinks);
router.post("/salaryRange", upload, getSalaryRanges);

export default router;
