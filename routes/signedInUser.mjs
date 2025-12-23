import { Router } from "express";

import {
  finalSignup,
  initialSignup,
  login,
} from "../controller/authController.mjs";

const router = Router();

router.post("/initialSignUp", initialSignup);
router.post("/finalSignUp", finalSignup);
router.post("/login", login);

export default router;
