import { User } from "../model/user.mjs";
import * as authService from "../services/auth.services.mjs";
import { createAccessToken, createRefreshToken } from "../jwtToken.mjs";
import bcrypt from "bcrypt";

import mongoose from "mongoose";
import NodeCache from "node-cache";

import { userSchema } from "../helper/authHelper.mjs";
import { createOtp, verifyOtp } from "../utils/otp.mjs";
import { sendOtpBrevo } from "../services/mail.mjs";
const cache = new NodeCache();

export const initialSignup = async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        message: "Service unavailable",
        code: "DB_DOWN",
      });
    }

    let { password, confirmPassword, email } = req.body;

    // normalize email
    email = email.toLowerCase().trim();

    await userSchema.validateAsync({ password, confirmPassword, email });

    const userExists = await User.exists({ email });
    if (userExists) {
      return res.status(409).json({
        success: false,
        message: "Email already registered",
        code: "EMAIL_EXISTS",
      });
    }

    const otpInitiated = await authService.generateSignupOtp(email, password);

    if (!otpInitiated) {
      return res.status(500).json({
        success: false,
        message: "Failed to initiate signup",
        code: "OTP_INIT_FAILED",
      });
    }

    return res.status(200).json({
      success: true,
      message: "OTP sent successfully",
    });
  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({
        success: false,
        message: "Invalid signup details",
        code: "VALIDATION_ERROR",
      });
    }

    console.error("initialSignup error:", {
      error: error.message,
      stack: error.stack,
    });

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      code: "SIGNUP_ERROR",
    });
  }
};

export const finalSignup = async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ error: "missing fields email or otp" });
  }

  const userData = cache.get(email);
  const otpValid = await verifyOtp(email, otp);

  if (!userData) {
    return res.status(400).json({ error: "User data not found or expired" });
  }
  if (otpValid.valid == false) {
    cache.del(email);
    return res.status(400).json({ error: otpValid.message });
  }

  const hashedPassword = await bcrypt.hash(userData.password, 10);
  const newUser = new User({
    email: email,
    password: hashedPassword,
  });

  await newUser.save();

  const payload = {
    _id: newUser._id,
    email: newUser.email,
  };

  const accessToken = await createAccessToken(payload);
  const refreshToken = await createRefreshToken(payload, res);

  res.cookie("access_token", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 15 * 60 * 1000 * 8,
  });

  cache.del(email);
  return res.status(201).json({ message: "User registered successfully" });
};

export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const payload = {
      _id: user._id,
      email: user.email,
    };

    const accessToken = await createAccessToken(payload);
    const refreshToken = await createRefreshToken(payload, res);

    res.cookie("access_token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 15 * 60 * 1000 * 8,
    });

    return res.status(200).json({ message: "Login successful" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const forgotPassword = async (req, res) => {
  if (!req.body.email) {
    return res.status(400).json({ error: "Email is required" });
  }
  const { email } = req.body;
  const userExist = await User.findOne(email);
  if (!userExist) {
    return res.status(200).json({
      message:
        "If this email exists in our system, you will receive a password reset link.",
    });
  }
};
