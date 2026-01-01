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

export const completeSignup = async (email, otp) => {
  email = email.toLowerCase().trim();
  const cacheKey = `signup:${email}`;

  const signupData = cache.get(cacheKey);
  if (!signupData) {
    return {
      success: false,
      status: 400,
      response: {
        success: false,
        message: "Signup session expired",
        code: "SIGNUP_EXPIRED",
      },
    };
  }

  const otpResult = await verifyOtp(email, otp);
  if (!otpResult.valid) {
    cache.del(cacheKey);
    return {
      success: false,
      status: 400,
      response: {
        success: false,
        message: otpResult.message,
        code: "INVALID_OTP",
      },
    };
  }

  if (await User.exists({ email })) {
    cache.del(cacheKey);
    return {
      success: false,
      status: 409,
      response: {
        success: false,
        message: "Email already registered",
        code: "EMAIL_EXISTS",
      },
    };
  }

  const user = await User.create({
    email,
    password: signupData.hashedPassword,
  });

  const payload = { _id: user._id, email };
  const accessToken = await createAccessToken(payload);
  const refreshToken = await createRefreshToken(payload);

  cache.del(cacheKey);

  return {
    success: true,
    accessToken,
    refreshToken,
  };
};
