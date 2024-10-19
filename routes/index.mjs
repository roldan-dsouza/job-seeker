import { Router } from "express";
import { pdfFunction, upload } from "../controller/pdfController.mjs";

const router = Router();

router.post("/upload", upload, pdfFunction);

export default router;
