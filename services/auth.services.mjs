import bcrypt from "bcrypt";
import cache from "../config/cache.js";
import { createOtp } from "../utils/otp.mjs";
import { sendOtpBrevo } from "./mail.mjs";

export const generateSignupOtp = async (email, password) => {
  const otp = createOtp(email);
  if (!otp) return null;

  const hashedPassword = await bcrypt.hash(password, 12);

  const sent = await sendOtpBrevo(process.env.EMAIL_USER, email, otp);

  if (!sent) return null;

  cache.set(
    `signup:${email}`,
    {
      hashedPassword,
      otp,
      attempts: 0,
    },
    300 // 5 minutes
  );

  return true;
};
