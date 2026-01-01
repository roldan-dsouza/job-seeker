import { User } from "../model/user.mjs";
import * as authService from "../services/auth.services.mjs";
import { createAccessToken, createRefreshToken } from "../jwtToken.mjs";
import bcrypt from "bcrypt";

import mongoose from "mongoose";
import NodeCache from "node-cache";

import { userSchema } from "../helper/authHelper.mjs";
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
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required",
        code: "MISSING_FIELDS",
      });
    }

    const result = await authService.completeSignup(email, otp);

    if (!result.success) {
      return res.status(result.status).json(result.response);
    }

    res.cookie("access_token", result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 15 * 60 * 1000,
    });

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
    });
  } catch (err) {
    console.error("finalSignup controller error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      code: "FINAL_SIGNUP_ERROR",
    });
  }
};

export const login = async (req, res) => {
  try {
    let { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
        code: "MISSING_FIELDS",
      });
    }

    email = email.toLowerCase().trim();

    const result = await authService.login(email, password);

    if (!result.success) {
      return res.status(401).json(result.response);
    }

    res.cookie("access_token", result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 15 * 60 * 1000,
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
    });
  } catch (error) {
    console.error("login controller error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      code: "LOGIN_ERROR",
    });
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
